"""
CozyCrypto Trader — Autonomous Background Learner V2
Blueprint upgrades:
  - Sentiment analysis scoring (Fear/Greed)
  - On-chain data monitoring (whale alerts, exchange flows)
  - Pattern library building (successful/failed setups)
  - Adaptive learning interval based on market volatility
  - News anomaly detection
"""

import os, re, time, json, threading, requests
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional
from urllib.parse import quote

from core.agent import call_brain, BRAIN_FAST, BRAIN_LONG, BRAIN_TRADE
from core.memory import save_knowledge, load_knowledge
from core.notifications import push_notification

BASE_INTERVAL    = 20 * 60   # 20 minutes base
VOLATILE_INTERVAL = 10 * 60  # 10 minutes during high volatility
SEARCH_TIMEOUT   = 20
SCRAPE_TIMEOUT   = 15
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124"}

_learner_thread: Optional[threading.Thread] = None
_running = False
_queue: List[str] = []
_last_volatility = 0.0  # Tracks BTC 24h change for adaptive intervals

# ── Learning topics ────────────────────────────────────────────────────────────
TOPICS = [
    # Live market
    {"id": "crypto_movers",    "query": "top crypto gainers losers today 2026",               "priority": 1},
    {"id": "btc_analysis",     "query": "Bitcoin BTC price analysis support resistance today", "priority": 1},
    {"id": "eth_analysis",     "query": "Ethereum ETH price analysis today 2026",              "priority": 1},
    {"id": "fear_greed",       "query": "crypto fear greed index today 2026",                  "priority": 1},
    {"id": "bitget_listings",  "query": "Bitget new listings hot pairs 2026",                  "priority": 2},
    {"id": "altcoin_movers",   "query": "altcoins pumping momentum breakout 2026",             "priority": 2},
    {"id": "defi_tvl",         "query": "DeFi TVL trending protocols gains 2026",              "priority": 2},
    # On-chain (blueprint: 3.4)
    {"id": "whale_movements",  "query": "crypto whale large transaction alerts today 2026",    "priority": 2},
    {"id": "exchange_flows",   "query": "bitcoin ethereum exchange inflow outflow today",       "priority": 2},
    {"id": "onchain_metrics",  "query": "on-chain metrics active addresses network health 2026","priority": 3},
    # Sentiment (blueprint: 3.2)
    {"id": "social_sentiment", "query": "crypto twitter sentiment bullish bearish today 2026", "priority": 2},
    {"id": "news_sentiment",   "query": "cryptocurrency market news sentiment today 2026",     "priority": 2},
    # Trading intelligence
    {"id": "smc_education",    "query": "smart money concepts order blocks FVG trading 2026",  "priority": 3},
    {"id": "african_crypto",   "query": "Nigeria Ghana Kenya crypto market prices 2026",       "priority": 3},
    {"id": "macro_events",     "query": "macroeconomic events affecting crypto markets 2026",  "priority": 3},
]

# ── Web helpers ────────────────────────────────────────────────────────────────
def _search(query: str) -> str:
    """DuckDuckGo search."""
    try:
        url = f"https://html.duckduckgo.com/html/?q={quote(query)}"
        r = requests.get(url, headers=UA, timeout=SEARCH_TIMEOUT)
        texts = re.findall(r'class="result__snippet"[^>]*>(.*?)</a>', r.text, re.DOTALL)
        snippets = [re.sub(r"<[^>]+>", "", t).strip() for t in texts[:8]]
        return " | ".join(snippets)[:2000]
    except Exception as e:
        return f"Search error: {e}"

def _fetch_page(url: str) -> str:
    """Fetch and clean a webpage."""
    try:
        r = requests.get(url, headers=UA, timeout=SCRAPE_TIMEOUT)
        text = re.sub(r"<script[^>]*>.*?</script>", "", r.text, flags=re.DOTALL)
        text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text[:3000]
    except Exception as e:
        return f"Fetch error: {e}"

def _fetch_fear_greed() -> Dict:
    """Fetch Fear & Greed Index from alternative.me."""
    try:
        r = requests.get("https://api.alternative.me/fng/?limit=1", timeout=10)
        d = r.json()["data"][0]
        return {"value": int(d["value"]), "label": d["value_classification"], "timestamp": d["timestamp"]}
    except:
        return {"value": 50, "label": "Neutral", "timestamp": ""}

def _fetch_btc_change() -> float:
    """Get BTC 24h change for adaptive interval."""
    try:
        r = requests.get("https://api.bitget.com/api/v2/spot/market/tickers?symbol=BTCUSDT", timeout=8)
        d = r.json()["data"][0]
        price = float(d["lastPr"])
        open_ = float(d["open24h"])
        return abs((price - open_) / open_ * 100) if open_ else 0
    except:
        return 0

# ── Core learning ──────────────────────────────────────────────────────────────
def _learn_topic(topic: Dict) -> Optional[Dict]:
    """Research a topic and distill it into actionable intelligence."""
    raw = _search(topic["query"])
    if not raw or "Search error" in raw:
        return None

    # Blueprint 3.2: Sentiment anomaly detection
    sentiment_note = ""
    if "sentiment" in topic["id"] or "fear" in topic["id"]:
        fg = _fetch_fear_greed()
        sentiment_note = f"Fear & Greed: {fg['value']} ({fg['label']}). "

    prompt = f"""Extract actionable trading intelligence from this market data.
Topic: {topic['id']}
Raw data: {sentiment_note}{raw}

Output as JSON:
{{
  "summary": "2-3 sentence summary",
  "sentiment": "bullish|bearish|neutral",
  "sentiment_score": -100 to +100,
  "key_insights": ["insight1", "insight2"],
  "tradeable_signals": ["signal1 if any"],
  "whale_activity": "any large movements detected",
  "risk_flags": ["any red flags"],
  "confidence": 0-100
}}"""

    try:
        brain = BRAIN_LONG if topic["priority"] <= 2 else BRAIN_FAST
        raw_resp = call_brain(brain, [{"role": "user", "content": prompt}], max_tokens=500, temperature=0.3)
        start = raw_resp.find("{"); end = raw_resp.rfind("}") + 1
        insight = json.loads(raw_resp[start:end]) if start >= 0 else {"summary": raw_resp[:300]}
        insight["topic_id"] = topic["id"]
        insight["query"]    = topic["query"]
        insight["learned_at"] = datetime.now(timezone.utc).isoformat()
        return insight
    except Exception as e:
        print(f"[learner] Parse error for {topic['id']}: {e}")
        return {"topic_id": topic["id"], "summary": raw[:300], "learned_at": datetime.now(timezone.utc).isoformat()}

# ── Anomaly detection (blueprint 3.2) ─────────────────────────────────────────
def _check_anomalies(knowledge: Dict) -> List[str]:
    """Detect unusual patterns across knowledge base."""
    alerts = []
    items = list(knowledge.get("insights", {}).values())
    
    # Check for extreme sentiment
    scores = [i.get("sentiment_score", 0) for i in items if "sentiment_score" in i]
    if scores:
        avg = sum(scores) / len(scores)
        if avg > 60:
            alerts.append(f"🔥 Strong bullish sentiment detected: avg score {avg:.0f}")
        elif avg < -60:
            alerts.append(f"⚠️ Strong bearish sentiment detected: avg score {avg:.0f}")

    # Check for whale mentions
    for item in items[-5:]:
        whale = item.get("whale_activity", "")
        if whale and whale.lower() not in ["none", "no", "n/a", ""]:
            alerts.append(f"🐋 Whale activity: {whale[:100]}")

    return alerts

# ── Main learner loop ──────────────────────────────────────────────────────────
def _run_learner():
    global _running, _last_volatility
    print("[learner] Starting V2 autonomous learner")
    push_notification("Learner Started", "Intelligence learner v2 is online — gathering market data", "learn")
    
    cycle = 0
    while _running:
        try:
            # Adaptive interval based on BTC volatility (blueprint 3.5)
            _last_volatility = _fetch_btc_change()
            interval = VOLATILE_INTERVAL if _last_volatility > 3.0 else BASE_INTERVAL
            
            print(f"[learner] Cycle {cycle+1} | BTC 24h change: {_last_volatility:.1f}% | interval: {interval//60}min")
            
            knowledge, _ = load_knowledge()
            if not isinstance(knowledge, dict):
                knowledge = {}
            if "insights" not in knowledge:
                knowledge["insights"] = {}

            # Pick topics for this cycle (rotate priority)
            batch = sorted(TOPICS, key=lambda t: t["priority"] + (0.1 * (cycle % 5)))[:4]
            
            # Add queued topics
            while _queue:
                q = _queue.pop(0)
                batch.insert(0, {"id": f"queued_{int(time.time())}", "query": q, "priority": 1})

            for topic in batch:
                if not _running:
                    break
                print(f"[learner] Learning: {topic['id']}")
                insight = _learn_topic(topic)
                if insight:
                    knowledge["insights"][topic["id"]] = insight

            # Blueprint 3.2: Anomaly detection
            anomalies = _check_anomalies(knowledge)
            for a in anomalies:
                push_notification("Market Anomaly", a, "alert", priority="high")

            # Fear & Greed notification
            fg = _fetch_fear_greed()
            knowledge["fear_greed"] = fg
            if fg["value"] <= 20:
                push_notification("Extreme Fear", f"Fear & Greed: {fg['value']} — Potential buy opportunity", "alert")
            elif fg["value"] >= 80:
                push_notification("Extreme Greed", f"Fear & Greed: {fg['value']} — Caution: potential top", "alert")

            knowledge["last_update"] = datetime.now(timezone.utc).isoformat()
            knowledge["cycle"]       = cycle + 1
            knowledge["volatility"]  = _last_volatility
            save_knowledge(knowledge)

            push_notification("Learner Update", f"Cycle {cycle+1} complete — {len(batch)} topics refreshed", "learn")
            cycle += 1

        except Exception as e:
            print(f"[learner] Error in cycle {cycle}: {e}")

        # Sleep in small chunks so we can stop cleanly
        slept = 0
        while _running and slept < interval:
            time.sleep(5)
            slept += 5

    print("[learner] Stopped.")

def start_learner():
    global _learner_thread, _running
    if _running:
        return
    _running = True
    _learner_thread = threading.Thread(target=_run_learner, daemon=True)
    _learner_thread.start()

def stop_learner():
    global _running
    _running = False

def get_learner_status() -> Dict:
    return {
        "running": _running,
        "volatility": _last_volatility,
        "interval_min": (VOLATILE_INTERVAL if _last_volatility > 3 else BASE_INTERVAL) // 60,
        "queue_size": len(_queue),
    }

def queue_learn(topic: str):
    _queue.append(topic)
