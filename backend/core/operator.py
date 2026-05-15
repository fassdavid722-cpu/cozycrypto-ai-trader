"""
CozyCrypto Trader — Autonomous Operator
Governor-style: Plan → Execute → Observe → Reflect → Finish

Actions available:
  plan(outline)       → think first (required step 1)
  search(query)       → web search for market data / news
  analyze(data)       → technical analysis with BRAIN_TRADE
  calculate(expr)     → precise math (risk sizing, P&L)
  trade(spec)         → execute/simulate a trade
  check_portfolio()   → check current positions
  learn(topic)        → queue topic for learner
  finish(answer)      → deliver final answer (after validate)
"""

import time, json, re
from typing import List, Dict, Callable, Generator

from core.agent import call_brain, route_brain, BRAIN_TRADE, BRAIN_LONG, BRAIN_FAST, BRAIN_MATH
from core.memory import recall, remember_trade_lesson, search_knowledge
from core.notifications import push_notification

MAX_STEPS = 10

SYSTEM_OPERATOR = """You are the CozyCrypto Trading AI — Autonomous Operator.

You do NOT reply immediately. You THINK step by step.

Available actions:
  plan(outline)       → REQUIRED step 1 — outline your approach
  search(query)       → search web for market data, news, prices
  analyze(pair|data)  → deep technical analysis (SMC, RSI, MACD, structure)
  calculate(expr)     → precise math: risk size, P&L, position sizing
  trade(spec)         → execute trade — format: "BUY|SELL SYMBOL SIZE reason"
  check_portfolio()   → check open positions and balance
  learn(topic)        → queue topic for background research
  finish(answer)      → final response — only when confident

Rules:
  - plan() FIRST, always
  - Never guess market data — search or analyze it
  - calculate() before any trade for proper position sizing
  - Only call trade() when you have: direction, size, entry, SL, TP, reason
  - finish() only when you have solid information

Respond ONLY in JSON:
{"action": "plan|search|analyze|calculate|trade|check_portfolio|learn|finish", "input": "..."}"""

def _decide(task: str, history: List[Dict]) -> Dict:
    messages = [
        {"role": "system", "content": SYSTEM_OPERATOR},
        {"role": "user", "content": f"Task: {task}\n\nHistory:\n{json.dumps(history, indent=2)[-3000:]}"}
    ]
    raw = call_brain(BRAIN_TRADE, messages, temperature=0.2, max_tokens=300)
    try:
        m = re.search(r'\{.*?\}', raw, re.DOTALL)
        if m: return json.loads(m.group())
    except Exception: pass
    return {"action": "search", "input": task}

def _execute(action: str, inp: str, tools: Dict) -> str:
    if action == "plan":
        return f"Plan: {inp}"

    elif action == "search":
        search_fn = tools.get("search")
        if search_fn:
            return search_fn(inp)
        return "[No search tool available]"

    elif action == "analyze":
        # Use BRAIN_TRADE for technical analysis
        kb = search_knowledge(inp, n=3)
        context = "\n".join(kb) if kb else "No cached data"
        messages = [
            {"role": "system", "content": (
                "You are an elite crypto technical analyst. Use SMC (Smart Money Concepts), "
                "RSI, MACD, volume, and market structure. Give specific levels: entry, SL, TP. "
                "Be precise and actionable."
            )},
            {"role": "user", "content": f"Analyze {inp}\n\nContext:\n{context}"}
        ]
        return call_brain(BRAIN_TRADE, messages, temperature=0.3, max_tokens=600)

    elif action == "calculate":
        try:
            # Safe eval for math
            allowed = {k: v for k, v in __builtins__.items() if k in ['abs','round','min','max','sum']} if isinstance(__builtins__, dict) else {}
            result = eval(inp, {"__builtins__": allowed})
            return f"= {result}"
        except Exception as e:
            # Fall back to AI math
            messages = [{"role": "user", "content": f"Calculate: {inp}"}]
            return call_brain(BRAIN_MATH, messages, temperature=0, max_tokens=100)

    elif action == "trade":
        trade_fn = tools.get("trade")
        if trade_fn:
            return trade_fn(inp)
        return f"[Simulated] Trade: {inp}"

    elif action == "check_portfolio":
        portfolio_fn = tools.get("portfolio")
        if portfolio_fn:
            return portfolio_fn()
        return "[Portfolio check]"

    elif action == "learn":
        from core.learner import queue_learn
        queue_learn(inp)
        return f"Queued for learning: {inp}"

    elif action == "finish":
        return inp

    return f"[Unknown action: {action}]"

def run_operator(task: str, tools: Dict = None, on_step: Callable = None) -> Generator[Dict, None, None]:
    """
    Run the operator loop. Yields step events for SSE streaming.
    Each event: {"type": "step", "step": n, "action": ..., "result": ...}
    Final event: {"type": "done", "answer": ...}
    """
    tools = tools or {}
    history = []

    for step in range(MAX_STEPS):
        decision = _decide(task, history)
        action = decision.get("action", "finish")
        inp = decision.get("input", "")

        result = _execute(action, inp, tools)

        history.append({"step": step+1, "action": action, "input": inp, "result": result[:500]})

        event = {"type": "step", "step": step+1, "action": action, "input": inp, "result": result}
        yield event

        if on_step: on_step(event)

        if action == "finish":
            # Learn from this interaction
            if len(history) > 2:
                lesson = f"Task: {task[:50]} → {result[:100]}"
                remember_trade_lesson(lesson)
            yield {"type": "done", "answer": result, "steps": len(history)}
            return

        time.sleep(0.3)

    # Max steps reached — synthesize answer
    synthesis_messages = [
        {"role": "system", "content": "Synthesize a final answer from the research done. Be direct."},
        {"role": "user", "content": f"Task: {task}\n\nResearch:\n{json.dumps(history, indent=2)[-2000:]}"}
    ]
    final = call_brain(BRAIN_TRADE, synthesis_messages, temperature=0.5, max_tokens=800)
    yield {"type": "done", "answer": final, "steps": MAX_STEPS}
