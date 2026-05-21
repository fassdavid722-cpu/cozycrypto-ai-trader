import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

// ── Configuration ──────────────────────────────────────────────────────────────
const GROQ_KEY      = process.env.GROQ_API_KEY || ''
const BITGET_BASE   = 'https://api.bitget.com'
const API_KEY       = process.env.BITGET_API_KEY || ''
const SECRET_KEY    = process.env.BITGET_SECRET_KEY || ''
const PASSPHRASE    = process.env.BITGET_PASSPHRASE || ''
const TG_TOKEN      = process.env.TELEGRAM_BOT_TOKEN || ''
const TG_CHAT_ID    = process.env.TELEGRAM_CHAT_ID || ''
const MIN_CONF      = parseFloat(process.env.MIN_CONFIDENCE || '55')
const MAX_PCT       = parseFloat(process.env.MAX_TRADE_PERCENT || '10')
const TRADE_MODE    = process.env.TRADE_MODE || 'autonomous'

const WATCH_PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT']

// ── Utilities ──────────────────────────────────────────────────────────────────
function sign(ts: string, method: string, path: string, body = '') {
  return crypto.createHmac('sha256', SECRET_KEY).update(ts + method + path + body).digest('base64')
}

function authHeaders(method: string, path: string, body = '') {
  const ts = Date.now().toString()
  return {
    'ACCESS-KEY': API_KEY,
    'ACCESS-SIGN': sign(ts, method, path, body),
    'ACCESS-TIMESTAMP': ts,
    'ACCESS-PASSPHRASE': PASSPHRASE,
    'Content-Type': 'application/json',
  }
}

async function sendTelegram(text: string) {
  if (!TG_TOKEN || !TG_CHAT_ID) return
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: 'Markdown' })
    })
  } catch (e) { console.error('Telegram error:', e) }
}

async function groqCall(messages: any[]) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, temperature: 0.2, response_format: { type: 'json_object' } }),
  })
  const d = await r.json() as any
  return JSON.parse(d.choices?.[0]?.message?.content || '{}')
}

// ── Market Data ────────────────────────────────────────────────────────────────
async function getMarketData(symbol: string) {
  try {
    const [tickR, candleR] = await Promise.all([
      fetch(`${BITGET_BASE}/api/v2/spot/market/tickers?symbol=${symbol}`),
      fetch(`${BITGET_BASE}/api/v2/spot/market/candles?symbol=${symbol}&granularity=1h&limit=24`)
    ])
    const tick = await tickR.json() as any
    const candle = await candleR.json() as any
    return {
      price: parseFloat(tick?.data?.[0]?.lastPr || '0'),
      change24h: parseFloat(tick?.data?.[0]?.changeUtc24h || '0') * 100,
      candles: candle?.data || []
    }
  } catch { return null }
}

async function getBalance() {
  if (!API_KEY) return 0
  try {
    const path = '/api/v2/spot/account/assets'
    const r = await fetch(BITGET_BASE + path, { headers: authHeaders('GET', path) as any })
    const d = await r.json() as any
    const usdt = (d.data || []).find((a: any) => a.coinName === 'USDT')
    return parseFloat(usdt?.available || '0')
  } catch { return 0 }
}

// ── Execution ──────────────────────────────────────────────────────────────────
async function executeTrade(symbol: string, side: 'buy'|'sell', size: number) {
  if (TRADE_MODE !== 'autonomous' || !API_KEY) return { simulated: true }
  const path = '/api/v2/spot/trade/place-order'
  const body = JSON.stringify({ symbol, side, orderType: 'market', force: 'gtc', size: size.toString() })
  const r = await fetch(BITGET_BASE + path, { method: 'POST', headers: authHeaders('POST', path, body) as any, body })
  return r.json()
}

// ── Main Handler ───────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Security check for Vercel Cron or GitHub Actions
  const authHeader = req.headers['authorization']
  const cronSecret = process.env.CRON_SECRET
  
  if (process.env.NODE_ENV === 'production') {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  console.log('🚀 Starting Autonomous Market Scan...')
  const results = []
  const balance = await getBalance()

  for (const symbol of WATCH_PAIRS) {
    const market = await getMarketData(symbol)
    if (!market) continue

    const prompt = `Analyze ${symbol} at $${market.price}. 24h Change: ${market.change24h}%.
    Use SMC (Order Blocks, FVG) and Market Structure.
    Balance: ${balance} USDT. Max Trade: ${balance * MAX_PCT / 100} USDT.
    Output JSON: { "action": "buy"|"sell"|"wait", "confidence": 0-100, "reason": "...", "tp": price, "sl": price, "size": usdt }`

    const analysis = await groqCall([
      { role: 'system', content: 'You are an elite autonomous trader. Output JSON only.' },
      { role: 'user', content: prompt }
    ])

    let execution = null
    if (analysis.action !== 'wait' && analysis.confidence >= MIN_CONF && balance > 10) {
      execution = await executeTrade(symbol, analysis.action, analysis.size || (balance * MAX_PCT / 100))
      await sendTelegram(`🤖 *AUTONOMOUS TRADE EXECUTED*
Pair: #${symbol}
Action: ${analysis.action.toUpperCase()}
Price: $${market.price}
Confidence: ${analysis.confidence}%
Reason: ${analysis.reason}
TP: $${analysis.tp} | SL: $${analysis.sl}`)
    }

    results.push({ symbol, analysis, execution })
  }

  return res.status(200).json({
    timestamp: new Date().toISOString(),
    balance,
    scanned: results.length,
    results
  })
}
