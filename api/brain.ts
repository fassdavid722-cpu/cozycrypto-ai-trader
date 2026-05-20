import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

const GROQ_KEY   = process.env.GROQ_API_KEY || ''
const GROQ_KEY2  = process.env.GROQ_API_KEY_2 || ''
const BASE       = 'https://api.bitget.com'
const API_KEY    = process.env.BITGET_API_KEY || ''
const SECRET_KEY = process.env.BITGET_SECRET_KEY || ''
const PASSPHRASE = process.env.BITGET_PASSPHRASE || ''
const MIN_CONF   = parseFloat(process.env.MIN_CONFIDENCE || '65')
const MAX_PCT    = parseFloat(process.env.MAX_TRADE_PERCENT || '10')
const TRADE_MODE = process.env.TRADE_MODE || 'autonomous' // autonomous | observe | manual

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
    'locale': 'en-US',
  }
}

async function groqCall(model: string, key: string, messages: any[], max_tokens = 1000) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens, temperature: 0.3 }),
    signal: AbortSignal.timeout(25000)
  })
  const d = await r.json() as any
  return d.choices?.[0]?.message?.content || ''
}

async function getMarketSnapshot(symbol: string) {
  try {
    const sym = symbol.replace('/', '')
    const [tickR, candleR, fearR] = await Promise.all([
      fetch(`${BASE}/api/v2/spot/market/tickers?symbol=${sym}`, { signal: AbortSignal.timeout(6000) }),
      fetch(`${BASE}/api/v2/spot/market/candles?symbol=${sym}&granularity=900&limit=50`, { signal: AbortSignal.timeout(6000) }),
      fetch('https://api.alternative.me/fng/?limit=1', { signal: AbortSignal.timeout(5000) }),
    ])
    const tick = await tickR.json() as any
    const candle = await candleR.json() as any
    const fear = await fearR.json() as any

    const t = tick?.data?.[0] || {}
    const candles = (candle?.data || []).map((c: string[]) => ({
      time: c[0], open: parseFloat(c[1]), high: parseFloat(c[2]),
      low: parseFloat(c[3]), close: parseFloat(c[4]), vol: parseFloat(c[5])
    }))

    // Calculate indicators
    const closes = candles.map((c: any) => c.close)
    const rsi = calcRSI(closes)
    const ema20 = calcEMA(closes, 20)
    const ema50 = calcEMA(closes, 50)
    const atr = calcATR(candles)

    return {
      symbol, price: parseFloat(t.lastPr || '0'),
      change24h: parseFloat(t.changeUtc24h || '0'),
      high24h: parseFloat(t.high24h || '0'), low24h: parseFloat(t.low24h || '0'),
      volume24h: parseFloat(t.quoteVolume || '0'),
      rsi, ema20, ema50, atr,
      trend: ema20 > ema50 ? 'bullish' : 'bearish',
      fearGreed: parseInt(fear?.data?.[0]?.value || '50'),
      fearLabel: fear?.data?.[0]?.value_classification || 'Neutral',
      candles: candles.slice(-10),
    }
  } catch (e) { return null }
}

function calcRSI(closes: number[], period = 14) {
  if (closes.length < period + 1) return 50
  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i-1]
    if (diff > 0) gains += diff; else losses += Math.abs(diff)
  }
  const rs = (gains/period) / ((losses/period) || 0.001)
  return parseFloat((100 - 100/(1+rs)).toFixed(2))
}

function calcEMA(closes: number[], period: number) {
  if (closes.length < period) return closes[closes.length-1] || 0
  const k = 2/(period+1)
  let ema = closes.slice(0, period).reduce((a,b) => a+b,0)/period
  for (let i = period; i < closes.length; i++) ema = closes[i]*k + ema*(1-k)
  return parseFloat(ema.toFixed(6))
}

function calcATR(candles: any[], period = 14) {
  if (candles.length < 2) return 0
  const trs = candles.slice(1).map((c, i) => {
    const prev = candles[i]
    return Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close))
  })
  return parseFloat((trs.slice(-period).reduce((a,b)=>a+b,0)/period).toFixed(6))
}

async function getBalance() {
  if (!API_KEY) return 0
  try {
    const path = '/api/v2/spot/account/assets'
    const r = await fetch(BASE + path, { headers: authHeaders('GET', path) as any, signal: AbortSignal.timeout(8000) })
    const d = await r.json() as any
    const usdt = (d.data || []).find((a: any) => a.coinName === 'USDT')
    return parseFloat(usdt?.available || '0')
  } catch { return 0 }
}

async function placeOrder(symbol: string, side: 'buy'|'sell', size: string) {
  const path = '/api/v2/spot/trade/place-order'
  const body = JSON.stringify({ symbol: symbol.replace('/',''), side, orderType: 'market', force: 'gtc', size })
  const r = await fetch(BASE + path, { method: 'POST', headers: authHeaders('POST', path, body) as any, body, signal: AbortSignal.timeout(10000) })
  return r.json()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { symbol = 'BTCUSDT', action = 'analyze' } = req.body || req.query as any

  // 1. Get live market data
  const market = await getMarketSnapshot(symbol)
  if (!market) return res.status(500).json({ error: 'Market data unavailable' })

  const balance = await getBalance()

  // 2. ADVANCED ANALYST BRAIN — SMC + Pattern Recognition + Sentiment
  const analystPrompt = `You are an elite autonomous trading brain using Smart Money Concepts (SMC) and Advanced Pattern Recognition.

LIVE MARKET DATA for ${symbol}:
- Price: $${market.price}
- 24h Change: ${market.change24h}%
- RSI(14): ${market.rsi}
- EMA20: ${market.ema20} | EMA50: ${market.ema50}
- Trend: ${market.trend}
- ATR: ${market.atr}
- Fear & Greed: ${market.fearGreed} (${market.fearLabel})
- Volume 24h: $${(market.volume24h/1e6).toFixed(1)}M
- Account Balance: $${balance.toFixed(2)} USDT

Analyze using:
1. Institutional Order Blocks (OB) & Fair Value Gaps (FVG)
2. Market Structure: BOS (Break of Structure) & CHoCH (Change of Character)
3. Liquidity Analysis: Identify stop-hunt zones and liquidity pools
4. Pattern Recognition: Identify high-probability setups (e.g., Wyckoff, Quasimodo)
5. Confluence: Align EMA trend, RSI divergence, and Sentiment (Fear/Greed)
6. Continuous Learning: Adapt bias based on recent 24h price action and volume spikes

Output JSON only:
{
  "bias": "bullish|bearish|neutral",
  "confidence": 0-100,
  "entry": price,
  "stop_loss": price,
  "take_profit": price,
  "rr_ratio": "1:X",
  "size_usdt": amount (max ${(balance * MAX_PCT/100).toFixed(2)} USDT),
  "reasoning": "detailed SMC + pattern context",
  "key_levels": { "support": price, "resistance": price },
  "patterns_detected": ["list of identified patterns"],
  "action": "buy|sell|wait"
}`

  let analystResult: any = {}
  try {
    const raw = await groqCall('llama-3.3-70b-versatile', GROQ_KEY, [
      { role: 'system', content: 'You are an elite SMC crypto analyst. Output JSON only, no markdown.' },
      { role: 'user', content: analystPrompt }
    ], 600)
    analystResult = JSON.parse(raw.replace(/```json?/g,'').replace(/```/g,'').trim())
  } catch { analystResult = { bias: 'neutral', confidence: 0, action: 'wait', reasoning: 'Analysis failed' } }

  // 3. RISK BRAIN — validate the trade
  let riskApproved = false
  let riskNote = ''
  if (analystResult.confidence >= MIN_CONF && analystResult.action !== 'wait' && balance > 1) {
    const rrMatch = (analystResult.rr_ratio || '1:1').match(/1:(\d+\.?\d*)/)
    const rr = rrMatch ? parseFloat(rrMatch[1]) : 1
    riskApproved = rr >= 1.5 && analystResult.size_usdt <= balance * MAX_PCT/100
    riskNote = riskApproved
      ? `✅ Risk approved — ${analystResult.size_usdt} USDT, R:R ${analystResult.rr_ratio}`
      : `❌ Risk rejected — R:R ${analystResult.rr_ratio} too low or size too large`
  } else {
    riskNote = balance <= 1
      ? '⚠️ Balance too low to trade — observing & learning'
      : `⏳ Confidence ${analystResult.confidence}% below gate (${MIN_CONF}%) — waiting`
  }

  // 4. EXECUTE if all gates pass
  let execution: any = null
  if (TRADE_MODE === 'autonomous' && riskApproved && action === 'execute') {
    try {
      const size = analystResult.size_usdt.toString()
      const result = await placeOrder(symbol, analystResult.action as 'buy'|'sell', size)
      execution = { attempted: true, result, timestamp: new Date().toISOString() }
    } catch (e: any) {
      execution = { attempted: true, error: e.message }
    }
  } else if (action === 'analyze') {
    execution = { attempted: false, reason: TRADE_MODE === 'autonomous' ? riskNote : `Mode: ${TRADE_MODE}` }
  }

  res.json({
    timestamp: new Date().toISOString(),
    symbol,
    mode: TRADE_MODE,
    market_snapshot: market,
    balance_usdt: balance,
    analyst: analystResult,
    risk: { approved: riskApproved, note: riskNote, min_confidence: MIN_CONF },
    execution,
    next_action: riskApproved ? `Execute ${analystResult.action?.toUpperCase()} at $${analystResult.entry}` : 'Monitor — waiting for high-confidence setup'
  })
}
