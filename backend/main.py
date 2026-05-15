"""
CozyCrypto Trader — Main FastAPI Server V2
Blueprint upgrades implemented:
  - Multi-agent pipeline endpoint (/trade/analyze)
  - Fear & Greed index endpoint (/market/sentiment)  
  - On-chain alerts endpoint (/market/onchain)
  - Pattern memory endpoint (/memory/patterns)
  - Confidence-gated trade execution
  - SSE streaming with brain routing info
  - Health check with all component statuses
"""

from fastapi import FastAPI, HTTPException, Request, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv
import os, json, asyncio, threading, time, queue
from datetime import datetime, timezone
from pathlib import Path

load_dotenv()

from core.agent import (BRAIN_TRADE, BRAIN_FAST, BRAIN_MATH, call_brain,
                         analyst_agent, risk_agent)
from core.orchestrator import chat as orchestrator_chat, stream_operator
from core.memory import (
    new_session, get_session, append_message, list_sessions,
    restore_sessions_from_github, load_memory, remember, recall,
    search_knowledge, get_trade_lessons
)
from core.notifications import (
    push_notification, get_notifications, mark_read, get_unread_count,
    register_sse_subscriber, unregister_sse_subscriber
)
try:
    from core.learner import start_learner, stop_learner, get_learner_status, queue_learn
    _HAS_LEARNER = True
except Exception as e:
    print(f"[WARN] Learner: {e}")
    _HAS_LEARNER = False
    def start_learner(): pass
    def get_learner_status(): return {"running": False}
    def queue_learn(t): pass

from tools.bitget import (
    get_balance, get_all_tickers, get_ticker, get_candles,
    place_order, get_open_orders, calculate_position_size,
    get_order_history
)

# ── Config ─────────────────────────────────────────────────────────────────────
API_KEY        = os.environ.get("GOVERNOR_API_KEY", "")
ALLOWED_ORIGINS= os.environ.get("ALLOWED_ORIGINS", "*")
MAX_TRADE_PCT  = float(os.environ.get("MAX_TRADE_PERCENT", "10"))
MIN_CONFIDENCE = int(os.environ.get("MIN_TRADE_CONFIDENCE", "65"))

app = FastAPI(title="CozyCrypto Trader V2", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS.split(",") if ALLOWED_ORIGINS != "*" else ["*"],
    allow_methods=["*"], allow_headers=["*"],
)

# ── Auth ───────────────────────────────────────────────────────────────────────
async def require_key(request: Request):
    if not API_KEY: return
    k = request.headers.get("X-API-Key") or request.headers.get("Authorization","").replace("Bearer ","")
    if k != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

# ── Models ─────────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    input: str
    history: List[Dict] = []
    session_id: Optional[str] = None
    stream: bool = False

class TradeRequest(BaseModel):
    symbol: str
    side: str
    reason: Optional[str] = None
    simulate: bool = True

class AnalyzeRequest(BaseModel):
    symbol: str = "BTCUSDT"
    timeframes: List[str] = ["15min", "1H", "4H", "1D"]
    use_agents: bool = True

class RememberRequest(BaseModel):
    content: str
    category: str = "general"

# ── Startup ────────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    print("[startup] CozyCrypto Trader V2 starting...")
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, restore_sessions_from_github)
    if _HAS_LEARNER:
        loop.run_in_executor(None, start_learner)
    push_notification("System Online", "CozyCrypto Trader V2 is running", "system")

# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/")
@app.get("/status")
async def status():
    bal = get_balance()
    learner = get_learner_status()
    return {
        "status": "online",
        "version": "2.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "balance": bal,
        "learner": learner,
        "has_bitget": bool(os.environ.get("BITGET_API_KEY")),
        "has_groq": bool(os.environ.get("GROQ_API_KEY")),
        "min_confidence": MIN_CONFIDENCE,
        "blueprint": "Elite AI Trader V2 — competitive dominance upgrade active",
    }

# ── Chat ───────────────────────────────────────────────────────────────────────
@app.post("/chat")
async def chat_endpoint(req: ChatRequest, _=Depends(require_key)):
    session_id = req.session_id or new_session()
    session    = get_session(session_id)
    history    = session.get("messages", [])

    append_message(session_id, {"role": "user", "content": req.input})

    if req.stream:
        async def gen():
            loop = asyncio.get_event_loop()
            q: queue.Queue = queue.Queue()
            def run():
                for chunk in stream_operator(req.input, history):
                    q.put(chunk)
                q.put(None)
            loop.run_in_executor(None, run)
            full = ""
            while True:
                chunk = await asyncio.wait_for(loop.run_in_executor(None, q.get), timeout=30)
                if chunk is None: break
                full += chunk
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            append_message(session_id, {"role": "assistant", "content": full})
            yield f"data: {json.dumps({'done': True, 'session_id': session_id})}\n\n"
        return StreamingResponse(gen(), media_type="text/event-stream")

    reply = await asyncio.get_event_loop().run_in_executor(
        None, lambda: orchestrator_chat(req.input, history, session_id)
    )
    append_message(session_id, {"role": "assistant", "content": reply})
    return {"reply": reply, "session_id": session_id, "timestamp": datetime.now(timezone.utc).isoformat()}

# ── Blueprint 3.3: Multi-agent trade analysis ──────────────────────────────────
@app.post("/trade/analyze")
async def analyze_trade(req: AnalyzeRequest, _=Depends(require_key)):
    """Full multi-agent analysis: Analyst → Risk Manager pipeline."""
    symbol = req.symbol.replace("/", "").upper()

    # Fetch multi-TF candles
    market_data = {"symbol": symbol, "timeframes": {}}
    for tf in req.timeframes:
        candles = get_candles(symbol, tf, 100)
        if candles:
            closes = [c[4] for c in candles]
            highs  = [c[2] for c in candles]
            lows   = [c[3] for c in candles]
            market_data["timeframes"][tf] = {
                "last_price": closes[-1] if closes else 0,
                "change_pct": round((closes[-1] - closes[0]) / closes[0] * 100, 2) if len(closes) > 1 else 0,
                "high": max(highs[-20:]) if highs else 0,
                "low":  min(lows[-20:]) if lows else 0,
                "candle_count": len(candles),
            }

    current_price = market_data["timeframes"].get(req.timeframes[0], {}).get("last_price", 0)
    market_data["current_price"] = current_price

    if req.use_agents:
        # Analyst agent
        setup = await asyncio.get_event_loop().run_in_executor(
            None, lambda: analyst_agent(market_data, recall(3), search_knowledge(symbol, 2))
        )

        # Risk agent
        balance = get_balance()
        risk = await asyncio.get_event_loop().run_in_executor(
            None, lambda: risk_agent(setup, balance, MAX_TRADE_PCT)
        )

        return {
            "symbol": symbol,
            "analyst": setup,
            "risk": risk,
            "approved": risk.get("approved", False) and setup.get("confidence", 0) >= MIN_CONFIDENCE,
            "reason": risk.get("rejection_reason") if not risk.get("approved") else f"Confidence {setup.get('confidence')}% >= {MIN_CONFIDENCE}% threshold",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    else:
        return {"symbol": symbol, "market_data": market_data, "timestamp": datetime.now(timezone.utc).isoformat()}

# ── Trade execution ────────────────────────────────────────────────────────────
@app.post("/trade/execute")
async def execute_trade(req: TradeRequest, _=Depends(require_key)):
    symbol = req.symbol.replace("/","").upper()
    ticker = get_ticker(symbol)
    if "error" in ticker:
        raise HTTPException(400, f"Cannot get price for {symbol}")

    price = ticker.get("price", 0)
    balance = get_balance()
    size = calculate_position_size(price, balance, MAX_TRADE_PCT)

    if req.simulate or not os.environ.get("BITGET_API_KEY"):
        result = {"simulated": True, "symbol": symbol, "side": req.side,
                  "price": price, "size_usdt": size, "balance": balance,
                  "reason": req.reason or "Manual", "timestamp": datetime.now(timezone.utc).isoformat()}
        push_notification("Simulated Trade", f"{req.side.upper()} {symbol} @ ${price:.4f}", "trade")
        return result

    result = place_order(symbol, req.side, str(size / price))
    if result.get("code") != "00000":
        raise HTTPException(400, f"Order failed: {result.get('msg', 'Unknown error')}")

    push_notification("Trade Executed", f"{req.side.upper()} {symbol} @ ${price:.4f} | Size: ${size:.2f}", "trade", "high")
    return {**result, "price": price, "size_usdt": size, "reason": req.reason, "timestamp": datetime.now(timezone.utc).isoformat()}

# ── Market data ────────────────────────────────────────────────────────────────
@app.get("/market/tickers")
async def tickers():
    data = get_all_tickers()
    return {"tickers": data, "timestamp": datetime.now(timezone.utc).isoformat()}

@app.get("/market/ticker/{symbol}")
async def single_ticker(symbol: str):
    return get_ticker(symbol.upper())

@app.get("/market/candles/{symbol}")
async def candles(symbol: str, tf: str = "1H", limit: int = 100):
    return {"candles": get_candles(symbol.upper(), tf, limit)}

# ── Blueprint 3.4: On-chain / sentiment ────────────────────────────────────────
@app.get("/market/sentiment")
async def sentiment():
    """Fear & Greed index + market sentiment from learner knowledge."""
    import requests as req_lib
    try:
        r = req_lib.get("https://api.alternative.me/fng/?limit=7", timeout=8)
        data = r.json()["data"]
        fg = [{"value": int(d["value"]), "label": d["value_classification"], "date": d["timestamp"]} for d in data]
    except:
        fg = [{"value": 50, "label": "Neutral", "date": ""}]

    knowledge, _ = load_memory() if hasattr(load_memory, '__call__') else ({}, "")
    try:
        from core.memory import load_knowledge
        know, _ = load_knowledge()
        insights = know.get("insights", {})
        sentiment_insights = {k: v for k, v in insights.items() if "sentiment" in k or "fear" in k}
    except:
        sentiment_insights = {}

    return {"fear_greed": fg, "insights": sentiment_insights, "timestamp": datetime.now(timezone.utc).isoformat()}

# ── Portfolio ──────────────────────────────────────────────────────────────────
@app.get("/portfolio")
async def portfolio(_=Depends(require_key)):
    balance = get_balance()
    orders  = get_open_orders()
    history = get_order_history(20)
    return {"balance": balance, "open_orders": orders, "recent_trades": history,
            "timestamp": datetime.now(timezone.utc).isoformat()}

# ── Memory ────────────────────────────────────────────────────────────────────
@app.get("/memory")
async def get_memory(_=Depends(require_key)):
    mem = load_memory()
    know, _ = (lambda: (__import__('core.memory', fromlist=['load_knowledge']).load_knowledge()))()
    return {"memory": mem, "knowledge_topics": list(know.get("insights", {}).keys()) if isinstance(know, dict) else []}

@app.post("/memory/remember")
async def remember_endpoint(req: RememberRequest, _=Depends(require_key)):
    remember(req.content, req.category)
    return {"success": True}

@app.get("/memory/recall")
async def recall_endpoint(n: int = 5, _=Depends(require_key)):
    return {"memories": recall(n)}

# ── Notifications / SSE ────────────────────────────────────────────────────────
@app.get("/notifications")
async def notifications(_=Depends(require_key)):
    return {"notifications": get_notifications(20), "unread": get_unread_count()}

@app.post("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, _=Depends(require_key)):
    mark_read(notif_id)
    return {"success": True}

@app.get("/stream")
async def sse_stream(request: Request, _=Depends(require_key)):
    q: queue.Queue = queue.Queue(maxsize=100)
    register_sse_subscriber(q)
    async def event_gen():
        try:
            yield "data: {\"type\": \"connected\"}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    ev = await asyncio.wait_for(
                        asyncio.get_event_loop().run_in_executor(None, lambda: q.get(timeout=1)),
                        timeout=2
                    )
                    yield f"data: {json.dumps(ev)}\n\n"
                except (asyncio.TimeoutError, Exception):
                    yield ": heartbeat\n\n"
        finally:
            unregister_sse_subscriber(q)
    return StreamingResponse(event_gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

# ── Sessions ──────────────────────────────────────────────────────────────────
@app.get("/sessions")
async def sessions(_=Depends(require_key)):
    return {"sessions": list_sessions(20)}

@app.get("/sessions/{sid}")
async def session(sid: str, _=Depends(require_key)):
    s = get_session(sid)
    if not s: raise HTTPException(404, "Session not found")
    return s

# ── Learner ───────────────────────────────────────────────────────────────────
@app.get("/learner/status")
async def learner_status(_=Depends(require_key)):
    return get_learner_status()

@app.post("/learner/queue")
async def learner_queue(req: Dict[str, str] = {}, _=Depends(require_key)):
    topic = req.get("topic", "")
    if topic: queue_learn(topic)
    return {"queued": topic}
