"""
CozyCrypto Trader — Notification System

Handles:
  - In-app notification queue (consumed by SSE /stream endpoint)
  - Telegram push notifications (optional)
  - Trade alerts (entry, exit, SL hit, TP hit)
  - Market alerts (pump/dump/whale/news)
  - System alerts (errors, restarts, low balance)

Frontend receives notifications via SSE stream.
"""

import os, time, threading, json
from datetime import datetime, timezone
from typing import List, Dict, Optional
from collections import deque
import requests

# ── In-app notification queue (consumed by SSE) ───────────────────────────────
_notification_queue: deque = deque(maxlen=200)
_subscribers: List = []  # SSE subscriber queues
_subscribers_lock = threading.Lock()

TELEGRAM_TOKEN   = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

CATEGORY_EMOJI = {
    "trade":    "💰",
    "market":   "📊",
    "system":   "⚙️",
    "alert":    "⚠️",
    "profit":   "✅",
    "loss":     "❌",
    "learn":    "🧠",
    "news":     "📰",
}

def push_notification(title: str, body: str, category: str = "system",
                      priority: str = "normal", data: Dict = None):
    """Push notification to all channels."""
    notif = {
        "id": str(int(time.time() * 1000)),
        "title": title,
        "body": body,
        "category": category,
        "priority": priority,
        "data": data or {},
        "emoji": CATEGORY_EMOJI.get(category, "📣"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "read": False,
    }

    # Add to in-app queue
    _notification_queue.appendleft(notif)

    # Broadcast to SSE subscribers
    _broadcast_sse({"type": "notification", "data": notif})

    # Send to Telegram if configured and priority is high
    if TELEGRAM_TOKEN and TELEGRAM_CHAT_ID and priority in ("high", "critical"):
        _send_telegram(title, body, category)

def _broadcast_sse(event: Dict):
    """Send event to all active SSE subscribers."""
    with _subscribers_lock:
        dead = []
        for q in _subscribers:
            try:
                q.put_nowait(event)
            except Exception:
                dead.append(q)
        for d in dead:
            _subscribers.remove(d)

def register_sse_subscriber(q):
    with _subscribers_lock:
        _subscribers.append(q)

def unregister_sse_subscriber(q):
    with _subscribers_lock:
        if q in _subscribers:
            _subscribers.remove(q)

def get_notifications(limit=50) -> List[Dict]:
    return list(_notification_queue)[:limit]

def mark_read(notif_id: str):
    for n in _notification_queue:
        if n["id"] == notif_id:
            n["read"] = True
            break

def get_unread_count() -> int:
    return sum(1 for n in _notification_queue if not n["read"])

def _send_telegram(title: str, body: str, category: str):
    """Send Telegram message (non-blocking)."""
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return
    emoji = CATEGORY_EMOJI.get(category, "📣")
    text = f"{emoji} *{title}*\n\n{body}"

    def _push():
        try:
            requests.post(
                f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
                json={"chat_id": TELEGRAM_CHAT_ID, "text": text, "parse_mode": "Markdown"},
                timeout=10
            )
        except Exception as e:
            print(f"[Notifications] Telegram error: {e}")

    threading.Thread(target=_push, daemon=True).start()

# ── Trade-specific notifications ───────────────────────────────────────────────

def notify_trade_opened(symbol: str, side: str, size: float, price: float, reason: str):
    push_notification(
        title=f"{'🟢 BUY' if side == 'buy' else '🔴 SELL'} {symbol}",
        body=f"Size: {size} @ ${price:,.4f}\nReason: {reason}",
        category="trade",
        priority="high",
        data={"symbol": symbol, "side": side, "size": size, "price": price}
    )

def notify_trade_closed(symbol: str, side: str, pnl: float, reason: str):
    cat = "profit" if pnl >= 0 else "loss"
    push_notification(
        title=f"{'✅' if pnl >= 0 else '❌'} Closed {symbol} — {'+'if pnl>=0 else ''}{pnl:.4f} USDT",
        body=f"Reason: {reason}",
        category=cat,
        priority="high",
        data={"symbol": symbol, "pnl": pnl}
    )

def notify_sl_hit(symbol: str, loss: float):
    push_notification(
        title=f"🛑 Stop Loss Hit — {symbol}",
        body=f"Loss: {loss:.4f} USDT. AI is learning from this.",
        category="alert",
        priority="high"
    )

def notify_tp_hit(symbol: str, profit: float):
    push_notification(
        title=f"🎯 Take Profit Hit — {symbol}",
        body=f"Profit: +{profit:.4f} USDT 🎉",
        category="profit",
        priority="high"
    )

def notify_low_balance(balance: float):
    push_notification(
        title="⚠️ Low Balance",
        body=f"Balance: ${balance:.4f} USDT — entering micro-position mode",
        category="alert",
        priority="high"
    )

def notify_learn_complete(topic: str, summary: str):
    push_notification(
        title=f"🧠 Learned: {topic}",
        body=summary[:200],
        category="learn",
        priority="normal"
    )
