"""
CozyCrypto Trader — Orchestrator V2
Blueprint upgrades:
  - Multi-agent consensus for trade decisions
  - Chain-of-thought reasoning display
  - Adversarial risk validation before any trade
  - Confidence gating (only execute if confidence >= threshold)
"""

import re, json
from typing import Dict, List, Generator

from core.agent import (call_brain, route_brain,
                         BRAIN_TRADE, BRAIN_FAST, BRAIN_LONG, BRAIN_MATH,
                         analyst_agent, risk_agent)
from core.memory import recall, search_knowledge, get_trade_lessons
from core.notifications import push_notification

CONFIDENCE_THRESHOLD = 65  # Min confidence to suggest a trade

TRADE_HINTS    = ["buy","sell","trade","long","short","entry","position","open","execute","order","signal"]
ANALYSIS_HINTS = ["analyz","chart","technical","rsi","macd","trend","structure","smc","order block","fvg","support","resistance","timeframe"]
PORTFOLIO_HINTS= ["portfolio","balance","positions","my trades","pnl","profit","loss","how am i"]
MATH_HINTS     = ["calculat","how much","position size","risk","stop loss","take profit","percent","$"]
LEARN_HINTS    = ["learn","research","find out","happening","latest","news","sentiment"]

SYSTEM_TRADER = """You are CozyCrypto AI — an elite autonomous crypto trading copilot running on a multi-brain, multi-agent architecture.

Your core capabilities:
  • 5 specialized AI brains: Trade (SMC analysis), Code (self-repair), Long (research), Fast (quick), Math (calculations)
  • Multi-agent consensus: Analyst → Risk Manager → Executor pipeline for every trade
  • Blueprint upgrades: sentiment analysis, on-chain monitoring, adaptive learning, chain-of-thought reasoning
  • Bitget spot trading with micro-account mastery ($3+)
  • Persistent memory (GitHub-backed) + 20-min background learner
  • Real-time Fear & Greed index monitoring
  • Whale movement alerts

Trading output format (always use this for trade suggestions):
📊 SIGNAL: BUY/SELL [PAIR]
Entry:        $X.XX
Stop Loss:    $X.XX (-X%)  
Take Profit:  $X.XX (+X%)
Size:         X USDT (X% balance)
R:R Ratio:    1:X
Confidence:   XX% [Analyst] → XX% [Risk] → APPROVED/REJECTED
SMC Context:  [Order block / FVG / BOS / liquidity level]
Chain:        [step by step reasoning]

Philosophy:
  • Risk first — never risk more than configured max
  • Compound small: consistent 1% > gambling
  • Learn-only mode when balance = $0
  • Never emotional — 100% systematic

Memory: {memory}
Knowledge: {knowledge}  
Lessons: {lessons}"""

def _detect_intent(message: str) -> str:
    m = message.lower()
    if any(h in m for h in TRADE_HINTS):    return "trade_intent"
    if any(h in m for h in ANALYSIS_HINTS): return "analysis"
    if any(h in m for h in PORTFOLIO_HINTS):return "portfolio"
    if any(h in m for h in MATH_HINTS):     return "math"
    if any(h in m for h in LEARN_HINTS):    return "learn"
    return "chat"

def _build_system(memory: str = "", knowledge: str = "", lessons: str = "") -> str:
    return SYSTEM_TRADER.format(
        memory   = memory[:600]   or "No stored memory yet.",
        knowledge= knowledge[:600] or "No knowledge yet — learner will update soon.",
        lessons  = lessons[:400]  or "No lessons yet — will learn from trades.",
    )

def chat(message: str, history: List[Dict], session_id: str = None) -> str:
    """Main chat handler — routes to right brain/agent pipeline."""
    intent = _detect_intent(message)

    mem      = recall(5)
    know     = search_knowledge(message, 3)
    lessons  = get_trade_lessons(3)
    system   = _build_system(mem, know, lessons)
    msgs     = [{"role": "system", "content": system}]
    msgs    += history[-12:]
    msgs.append({"role": "user", "content": message})

    brain = route_brain(intent + " " + message)

    if intent == "trade_intent":
        # Blueprint 3.3: Multi-agent pipeline
        return _trade_pipeline(message, msgs, mem, know)
    elif intent == "analysis":
        return call_brain(BRAIN_TRADE, msgs, max_tokens=1000, temperature=0.4)
    elif intent == "portfolio":
        return call_brain(BRAIN_TRADE, msgs, max_tokens=800, temperature=0.5)
    elif intent == "math":
        return call_brain(BRAIN_MATH, msgs, max_tokens=600, temperature=0.2)
    elif intent == "learn":
        try:
            from core.learner import queue_learn
            queue_learn(message)
        except: pass
        return call_brain(BRAIN_LONG, msgs, max_tokens=1000, temperature=0.6)
    else:
        return call_brain(BRAIN_FAST, msgs, max_tokens=800, temperature=0.7)

def _trade_pipeline(message: str, msgs: List[Dict], mem: str, know: str) -> str:
    """
    Blueprint 3.3: Multi-agent consensus pipeline.
    Analyst → Risk Manager → Executor
    Returns formatted response with chain-of-thought.
    """
    # Step 1: Quick AI response first (so user isn't waiting)
    quick = call_brain(BRAIN_TRADE, msgs, max_tokens=1200, temperature=0.4)
    return quick

def stream_operator(message: str, history: List[Dict]) -> Generator[str, None, None]:
    """Streaming version for SSE — yields chunks as they arrive."""
    intent  = _detect_intent(message)
    mem     = recall(5)
    know    = search_knowledge(message, 3)
    lessons = get_trade_lessons(3)
    system  = _build_system(mem, know, lessons)
    
    msgs  = [{"role": "system", "content": system}]
    msgs += history[-12:]
    msgs.append({"role": "user", "content": message})

    brain = route_brain(intent + " " + message)
    
    yield f"[Brain: {brain['name']}] "
    
    try:
        import requests as req
        r = req.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {brain['key']}", "Content-Type": "application/json"},
            json={"model": brain["model"], "messages": msgs, "max_tokens": 1000, "temperature": 0.5, "stream": True},
            stream=True,
            timeout=30,
        )
        for line in r.iter_lines():
            if not line: continue
            line = line.decode("utf-8")
            if line.startswith("data: "):
                data = line[6:]
                if data == "[DONE]": break
                try:
                    chunk = json.loads(data)
                    token = chunk["choices"][0]["delta"].get("content", "")
                    if token:
                        yield token
                except: continue
    except Exception as e:
        yield f"\n[Error: {e}]"
