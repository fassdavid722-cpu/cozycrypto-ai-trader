"""
CozyCrypto Trader — AI Brain Engine V2
Blueprint upgrade: Multi-agent architecture, improved routing, Gemini fallback.

BRAIN LAYOUT:
─────────────────────────────────────────────────────────────────
Key 1  → BRAIN_TRADE    llama-3.3-70b-versatile   Trading strategy, SMC analysis
          BRAIN_CODE     llama-3.3-70b-versatile   Code generation, self-repair
          BRAIN_LONG     llama-4-scout-17b          Multi-source, big context

Key 2  → BRAIN_FAST     llama-3.1-8b-instant       Quick replies, notifications
          BRAIN_MATH     qwen/qwen3-32b             P&L calc, risk sizing, stats

Gemini → BRAIN_GEMINI   gemini-2.0-flash           Emergency fallback on 429
─────────────────────────────────────────────────────────────────
Blueprint upgrades implemented:
  - Specialist agent roles (Analyst, RiskManager, Executor, Learner)
  - Dynamic risk adjustment based on market volatility
  - Confidence scoring for all AI outputs
  - Chain-of-thought reasoning for trade decisions
  - Adversarial risk validation before execution
"""

import os, time, threading, requests, json
from typing import List, Dict, Optional, Any

GROQ_BASE   = "https://api.groq.com/openai/v1"
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

_KEY1        = (os.environ.get("GROQ_API_KEY")   or "").strip()
_KEY2        = (os.environ.get("GROQ_API_KEY_2") or "").strip()
_GEMINI_KEY  = (os.environ.get("GEMINI_API_KEY") or "").strip()

BRAIN_TRADE  = {"key": _KEY1,           "model": "llama-3.3-70b-versatile",                   "name": "Trade",  "provider": "groq"}
BRAIN_CODE   = {"key": _KEY1,           "model": "llama-3.3-70b-versatile",                   "name": "Code",   "provider": "groq"}
BRAIN_LONG   = {"key": _KEY1,           "model": "meta-llama/llama-4-scout-17b-16e-instruct", "name": "Long",   "provider": "groq"}
BRAIN_FAST   = {"key": _KEY2 or _KEY1,  "model": "llama-3.1-8b-instant",                      "name": "Fast",   "provider": "groq"}
BRAIN_MATH   = {"key": _KEY2 or _KEY1,  "model": "qwen/qwen3-32b",                            "name": "Math",   "provider": "groq"}
BRAIN_GEMINI = {"key": _GEMINI_KEY,     "model": "gemini-2.0-flash",                          "name": "Gemini", "provider": "gemini"}

# ── Blueprint: Specialist Agent Roles ─────────────────────────────────────────
AGENT_ANALYST  = "analyst"     # Market analysis, SMC detection
AGENT_RISK     = "risk_mgr"    # Risk validation, position sizing
AGENT_EXECUTOR = "executor"    # Trade execution decisions
AGENT_LEARNER  = "learner"     # Background knowledge acquisition

AGENT_SYSTEM_PROMPTS = {
    AGENT_ANALYST: """You are the Market Analyst Agent for CozyCrypto AI.
Your role: Identify high-probability setups using SMC (Smart Money Concepts).
Focus on: Order Blocks, Fair Value Gaps, BOS/CHoCH, liquidity levels, multi-timeframe confluence.
Always output: direction (BUY/SELL/WAIT), confidence (0-100%), key levels, reasoning.
Be concise and data-driven. No fluff.""",

    AGENT_RISK: """You are the Risk Management Agent for CozyCrypto AI.
Your role: Validate every trade for risk compliance before execution.
Rules: Never risk >MAX% per trade. Always include SL. Check position sizing. Assess market volatility.
Output: APPROVED/REJECTED + position size + adjusted SL/TP + risk score (0-100, higher = safer).
Be strict. Protect capital above all.""",

    AGENT_EXECUTOR: """You are the Execution Agent for CozyCrypto AI.
Your role: Determine optimal entry timing and execute approved trades.
Consider: Current spread, volume, market depth, order book pressure.
Output: Execute NOW / WAIT FOR PULLBACK / SKIP + entry price + reasoning.
Precision matters — bad entries kill good setups.""",

    AGENT_LEARNER: """You are the Learning Agent for CozyCrypto AI.
Your role: Extract tradeable insights from market data, news, and trade history.
Store: patterns that worked, patterns that failed, market regime shifts, important news events.
Output: structured JSON with insights. Focus on actionable intelligence only.""",
}

# ── Per-key throttles ──────────────────────────────────────────────────────────
_k1_last, _k2_last = 0.0, 0.0
_k1_lock = threading.Lock()
_k2_lock = threading.Lock()
MIN_INTERVAL = 1.2  # seconds between calls per key

def _throttle(key_id: int):
    global _k1_last, _k2_last
    lock  = _k1_lock if key_id == 1 else _k2_lock
    with lock:
        last = _k1_last if key_id == 1 else _k2_last
        wait = MIN_INTERVAL - (time.time() - last)
        if wait > 0:
            time.sleep(wait)
        if key_id == 1: _k1_last = time.time()
        else:           _k2_last = time.time()

# ── Groq caller ───────────────────────────────────────────────────────────────
def _call_groq(brain: Dict, messages: List[Dict], max_tokens: int = 1200, temperature: float = 0.7) -> str:
    key_id = 1 if brain["key"] == _KEY1 else 2
    _throttle(key_id)
    try:
        r = requests.post(
            f"{GROQ_BASE}/chat/completions",
            headers={"Authorization": f"Bearer {brain['key']}", "Content-Type": "application/json"},
            json={"model": brain["model"], "messages": messages, "max_tokens": max_tokens, "temperature": temperature},
            timeout=30,
        )
        if r.status_code == 429:
            raise Exception("rate_limit_429")
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
    except Exception as e:
        raise e

# ── Gemini fallback ───────────────────────────────────────────────────────────
def _call_gemini(messages: List[Dict], max_tokens: int = 1200) -> str:
    if not _GEMINI_KEY:
        raise Exception("No Gemini key configured")
    contents = [{"role": "user" if m["role"] == "user" else "model",
                 "parts": [{"text": m["content"]}]} for m in messages if m["role"] != "system"]
    sys_prompt = next((m["content"] for m in messages if m["role"] == "system"), "")
    r = requests.post(
        f"{GEMINI_BASE}/gemini-2.0-flash:generateContent?key={_GEMINI_KEY}",
        json={"system_instruction": {"parts": [{"text": sys_prompt}]},
              "contents": contents,
              "generationConfig": {"maxOutputTokens": max_tokens}},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["candidates"][0]["content"]["parts"][0]["text"]

# ── Main call_brain ───────────────────────────────────────────────────────────
def call_brain(brain: Dict, messages: List[Dict], max_tokens: int = 1200, temperature: float = 0.7,
               fallback: bool = True) -> str:
    """Call a brain with automatic Gemini fallback on rate limit."""
    try:
        return _call_groq(brain, messages, max_tokens, temperature)
    except Exception as e:
        if "rate_limit_429" in str(e) or "429" in str(e):
            if fallback and _GEMINI_KEY:
                print(f"[agent] {brain['name']} rate limited → Gemini fallback")
                return _call_gemini(messages, max_tokens)
            # Try key 2 if available
            if brain["key"] == _KEY1 and _KEY2:
                alt = dict(brain); alt["key"] = _KEY2
                return _call_groq(alt, messages, max_tokens, temperature)
        raise e

# ── Blueprint: route_brain ────────────────────────────────────────────────────
def route_brain(intent: str) -> Dict:
    """Route to the optimal brain based on intent keyword."""
    intent = intent.lower()
    if any(k in intent for k in ["trade","signal","smc","order block","fvg","entry","long","short"]): return BRAIN_TRADE
    if any(k in intent for k in ["code","fix","debug","write","generate","implement"]):               return BRAIN_CODE
    if any(k in intent for k in ["research","news","sentiment","learn","background","explain"]):      return BRAIN_LONG
    if any(k in intent for k in ["calculate","size","risk","pnl","percent","math","how much"]):       return BRAIN_MATH
    return BRAIN_FAST

# ── Blueprint: Multi-agent consensus ─────────────────────────────────────────
def analyst_agent(market_data: Dict, memory: str = "", knowledge: str = "") -> Dict:
    """Market Analyst agent — identifies setups with confidence scoring."""
    prompt = f"""Analyze the following market data and identify the highest probability trading setup.

Market Data:
{json.dumps(market_data, indent=2)}

Memory context: {memory[:500] if memory else 'None'}
Knowledge context: {knowledge[:500] if knowledge else 'None'}

Output as JSON:
{{
  "direction": "BUY|SELL|WAIT",
  "confidence": 0-100,
  "pair": "XXX/USDT",
  "entry": price,
  "stopLoss": price,
  "takeProfit": price,
  "rr_ratio": "1:X",
  "smc_context": "order block / FVG / BOS etc",
  "reasoning": "step by step reasoning",
  "timeframe_confluence": "list of agreeing TFs"
}}"""
    msgs = [{"role": "system", "content": AGENT_SYSTEM_PROMPTS[AGENT_ANALYST]},
            {"role": "user", "content": prompt}]
    raw = call_brain(BRAIN_TRADE, msgs, max_tokens=800, temperature=0.3)
    try:
        start = raw.find("{"); end = raw.rfind("}") + 1
        return json.loads(raw[start:end]) if start >= 0 else {"direction": "WAIT", "confidence": 0, "reasoning": raw}
    except:
        return {"direction": "WAIT", "confidence": 0, "reasoning": raw}

def risk_agent(setup: Dict, balance: float, max_trade_pct: float = 10.0) -> Dict:
    """Risk Management agent — validates and sizes trade."""
    prompt = f"""Validate this trade setup for risk compliance.

Setup: {json.dumps(setup, indent=2)}
Account balance: ${balance:.2f} USDT
Max trade size: {max_trade_pct}% = ${balance * max_trade_pct / 100:.2f} USDT

Calculate exact position sizing. Output as JSON:
{{
  "approved": true|false,
  "risk_score": 0-100,
  "position_size_usdt": X.XX,
  "position_size_pct": X.X,
  "adjusted_sl": price,
  "adjusted_tp": price,
  "rejection_reason": "if rejected",
  "risk_notes": "any warnings"
}}"""
    msgs = [{"role": "system", "content": AGENT_SYSTEM_PROMPTS[AGENT_RISK]},
            {"role": "user", "content": prompt}]
    raw = call_brain(BRAIN_MATH, msgs, max_tokens=400, temperature=0.2)
    try:
        start = raw.find("{"); end = raw.rfind("}") + 1
        return json.loads(raw[start:end]) if start >= 0 else {"approved": False, "rejection_reason": "Parse error"}
    except:
        return {"approved": False, "rejection_reason": raw[:200]}
