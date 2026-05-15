"""
CozyCrypto Trader — Bitget Exchange Tool V2
Upgrades:
  - Order history endpoint
  - Better error messages for no-key mode
  - Candle data for analysis
  - Multi-symbol ticker batch fetch
"""

import os, json, time, hmac, hashlib, base64, requests
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

BASE_URL   = "https://api.bitget.com"
API_KEY    = os.environ.get("BITGET_API_KEY", "")
SECRET_KEY = os.environ.get("BITGET_SECRET_KEY", "")
PASSPHRASE = os.environ.get("BITGET_PASSPHRASE", "")

MAX_TRADE_PERCENT = float(os.environ.get("MAX_TRADE_PERCENT", "10"))
STOP_LOSS_PCT     = float(os.environ.get("STOP_LOSS_PERCENT", "2"))
TAKE_PROFIT_PCT   = float(os.environ.get("TAKE_PROFIT_PERCENT", "4"))
MAX_OPEN_TRADES   = int(os.environ.get("MAX_OPEN_TRADES", "3"))
MIN_ORDER_USDT    = 2.0

WATCH_SYMBOLS = [
    "BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT",
    "DOGEUSDT","ADAUSDT","AVAXUSDT","DOTUSDT","MATICUSDT",
    "LINKUSDT","UNIUSDT","LTCUSDT","ATOMUSDT","NEARUSDT",
    "APTUSDT","SUIUSDT","ARBUSDT","OPUSDT","INJUSDT",
]

def _sign(ts: str, method: str, path: str, body: str = "") -> str:
    msg = ts + method.upper() + path + body
    return base64.b64encode(hmac.new(SECRET_KEY.encode(), msg.encode(), hashlib.sha256).digest()).decode()

def _headers(method: str, path: str, body: str = "") -> Dict:
    ts = str(int(time.time() * 1000))
    return {
        "ACCESS-KEY":        API_KEY,
        "ACCESS-SIGN":       _sign(ts, method, path, body),
        "ACCESS-TIMESTAMP":  ts,
        "ACCESS-PASSPHRASE": PASSPHRASE,
        "Content-Type":      "application/json",
        "locale":            "en-US",
    }

def _get(path: str) -> Dict:
    if not API_KEY:
        return {"error": "no_key", "message": "No Bitget API key — simulation mode"}
    try:
        r = requests.get(BASE_URL + path, headers=_headers("GET", path), timeout=15)
        return r.json()
    except Exception as e:
        return {"error": str(e)}

def _post(path: str, data: Dict) -> Dict:
    if not API_KEY:
        return {"code": "no_key", "msg": "No API keys — simulation mode"}
    body = json.dumps(data)
    try:
        r = requests.post(BASE_URL + path, headers=_headers("POST", path, body), data=body, timeout=15)
        return r.json()
    except Exception as e:
        return {"error": str(e)}

# ── Public endpoints (no auth needed) ──────────────────────────────────────────

def get_all_tickers() -> List[Dict]:
    """Fetch all spot tickers and filter to watchlist."""
    try:
        r = requests.get(f"{BASE_URL}/api/v2/spot/market/tickers", timeout=15)
        all_tickers = r.json().get("data", [])
        result = []
        for t in all_tickers:
            if t["symbol"] not in WATCH_SYMBOLS:
                continue
            price  = float(t.get("lastPr", 0))
            open24 = float(t.get("open24h", 0))
            change = round((price - open24) / open24 * 100, 2) if open24 else 0
            result.append({
                "symbol":    t["symbol"].replace("USDT", "/USDT"),
                "price":     price,
                "change24h": change,
                "volume":    float(t.get("quoteVolume", 0)),
                "high24h":   float(t.get("high24h", 0)),
                "low24h":    float(t.get("low24h", 0)),
            })
        return result
    except Exception as e:
        return [{"error": str(e)}]

def get_ticker(symbol: str) -> Dict:
    """Get single ticker."""
    try:
        sym = symbol.replace("/", "").upper()
        r = requests.get(f"{BASE_URL}/api/v2/spot/market/tickers?symbol={sym}", timeout=10)
        d = r.json().get("data", [{}])[0]
        price = float(d.get("lastPr", 0))
        open_ = float(d.get("open24h", 0))
        return {
            "symbol": sym, "price": price,
            "change24h": round((price - open_) / open_ * 100, 2) if open_ else 0,
            "volume": float(d.get("quoteVolume", 0)),
            "high24h": float(d.get("high24h", 0)),
            "low24h":  float(d.get("low24h", 0)),
        }
    except Exception as e:
        return {"error": str(e), "price": 0}

def get_candles(symbol: str, granularity: str = "1H", limit: int = 100) -> List:
    """Fetch OHLCV candles for technical analysis."""
    try:
        sym = symbol.replace("/", "").upper()
        url = f"{BASE_URL}/api/v2/spot/market/candles?symbol={sym}&granularity={granularity}&limit={limit}"
        r = requests.get(url, timeout=15)
        data = r.json().get("data", [])
        # Format: [timestamp, open, high, low, close, volume]
        return [[int(c[0]), float(c[1]), float(c[2]), float(c[3]), float(c[4]), float(c[5])] for c in data]
    except Exception as e:
        return []

# ── Authenticated endpoints ────────────────────────────────────────────────────

def get_balance() -> float:
    """Get available USDT balance."""
    d = _get("/api/v2/spot/account/assets")
    if "error" in d:
        return 0.0
    assets = d.get("data", [])
    usdt = next((a for a in assets if a.get("coinName") == "USDT"), None)
    return float(usdt.get("available", 0)) if usdt else 0.0

def get_open_orders(symbol: str = None) -> List[Dict]:
    """Get all unfilled orders."""
    path = "/api/v2/spot/trade/unfilled-orders?limit=20"
    if symbol: path += f"&symbol={symbol.replace('/', '').upper()}"
    d = _get(path)
    return d.get("data", []) if "data" in d else []

def get_order_history(limit: int = 20) -> List[Dict]:
    """Get order history."""
    d = _get(f"/api/v2/spot/trade/history-orders?limit={limit}")
    if "data" not in d: return []
    return [{
        "symbol":   o.get("symbol", ""),
        "side":     o.get("side", ""),
        "price":    float(o.get("priceAvg", 0)),
        "quantity": float(o.get("baseVolume", 0)),
        "total":    round(float(o.get("priceAvg", 0)) * float(o.get("baseVolume", 0)), 4),
        "status":   o.get("status", ""),
        "time":     o.get("cTime", ""),
        "orderId":  o.get("orderId", ""),
    } for o in d["data"]]

def place_order(symbol: str, side: str, size: str) -> Dict:
    """Place a spot market order."""
    return _post("/api/v2/spot/trade/place-order", {
        "symbol": symbol.replace("/", "").upper(),
        "side":   side.lower(),
        "orderType": "market",
        "force":  "gtc",
        "size":   size,
    })

def calculate_position_size(price: float, balance: float, pct: float = None) -> float:
    """Calculate position size in USDT."""
    pct = pct or MAX_TRADE_PERCENT
    size = balance * (pct / 100)
    return max(MIN_ORDER_USDT, round(size, 2))
