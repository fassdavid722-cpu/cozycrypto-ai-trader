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
const GH_TOKEN      = process.env.GITHUB_TOKEN || ''
const GH_REPO       = process.env.GITHUB_REPO || ''

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

async function saveToGitHub(path: string, data: any, message: string) {
  if (!GH_TOKEN || !GH_REPO) return
  try {
    const apiUrl = `https://api.github.com/repos/${GH_REPO}/contents/${path}`
    const check = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${GH_TOKEN}` } })
    const existing = check.ok ? await check.json() as any : null
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64')
    const body: any = { message, content }
    if (existing?.sha) body.sha = existing.sha
    await fetch(apiUrl, { method: 'PUT', headers: { 'Authorization': `Bearer ${GH_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch (e) { console.error(`GitHub Save Error (${path}):`, e) }
}

async function loadFromGitHub(path: string): Promise<any> {
  if (!GH_TOKEN || !GH_REPO) return null
  try {
    const r = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${path}`, { headers: { 'Authorization': `Bearer ${GH_TOKEN}` } })
    if (!r.ok) return null
    const d = await r.json() as any
    return JSON.parse(Buffer.from(d.content, 'base64').toString())
  } catch (e) { return null }
}

async function groqCall(messages: any[]) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      model: 'llama-3.3-70b-versatile', 
      messages, 
      temperature: 0.4, 
      response_format: { type: 'json_object' } 
    }),
  })
  const d = await r.json() as any
  return JSON.parse(d.choices?.[0]?.message?.content || '{}')
}

// ── Market Data ────────────────────────────────────────────────────────────────
async function fetchTop50() {
  try {
    const res = await fetch(`${BITGET_BASE}/api/v2/spot/market/tickers`)
    const data = await res.json() as any
    return (data.data || [])
      .filter((t: any) => t.symbol.endsWith('USDT'))
      .sort((a: any, b: any) => parseFloat(b.usdtVolume) - parseFloat(a.usdtVolume))
      .slice(0, 50)
  } catch { return [] }
}

async function getMarketData(symbol: string) {
  try {
    const [tickR, candleR] = await Promise.all([
      fetch(`${BITGET_BASE}/api/v2/spot/market/tickers?symbol=${symbol}`),
      fetch(`${BITGET_BASE}/api/v2/spot/market/candles?symbol=${symbol}&granularity=1h&limit=24`)
    ])
    const tick = await tickR.json() as any
    const candle = await candleR.json() as any
    
    const formattedCandles = (candle?.data || []).map((c: any) => ({
      h: parseFloat(c[2]), l: parseFloat(c[3]), c: parseFloat(c[4])
    })).reverse()

    return {
      price: parseFloat(tick?.data?.[0]?.lastPr || '0'),
      change24h: parseFloat(tick?.data?.[0]?.changeUtc24h || '0') * 100,
      candles: formattedCandles
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
  if (TRADE_MODE !== 'autonomous' || !API_KEY) return { simulated: true, msg: 'Simulated trade' }
  const path = '/api/v2/spot/trade/place-order'
  const body = JSON.stringify({ symbol, side, orderType: 'market', force: 'gtc', size: size.toString() })
  const r = await fetch(BITGET_BASE + path, { method: 'POST', headers: authHeaders('POST', path, body) as any, body })
  return r.json()
}

// ── Main Handler ───────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers['authorization']
  const cronSecret = process.env.CRON_SECRET
  
  if (process.env.NODE_ENV === 'production') {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  console.log('🚀 Starting Autonomous Heartbeat...')
  const balance = await getBalance()
  
  // Load Memory
  const [logs, insights, goals] = await Promise.all([
    loadFromGitHub('logs/system_logs.json').then(d => d || []),
    loadFromGitHub('logs/learned_insights.json').then(d => d || { lessons: [] }),
    loadFromGitHub('goals/active_goals.json').then(d => d || [])
  ])

  const tickers = await fetchTop50()
  const top5 = tickers.slice(0, 5)
  
  const prompt = `You are COZANET — a High-IQ Autonomous AI Lead Trader.
  Your mission is to scan the market, learn from patterns, and execute paper trades to build a track record.

  CURRENT MARKET:
  - Top 5 Movers: ${JSON.stringify(top5)}
  - Balance: ${balance} USDT.
  - LEARNED LESSONS: ${JSON.stringify(insights.lessons)}
  
  YOUR TASK:
  1. ANALYZE: Look for SMC patterns (BOS, CHoCH, FVG).
  2. LEARN: You MUST identify at least one specific lesson or observation from this scan.
  3. TRADE: If you see a setup with >50% confidence, you MUST propose a paper trade.

  Output JSON: { 
    "thinking": "Your step-by-step logical reasoning",
    "insight": "A specific lesson learned from this scan",
    "action": "buy"|"sell"|"wait", 
    "symbol": "BTCUSDT",
    "confidence": 0-100, 
    "reason": "Final summary reason", 
    "tp": price, 
    "sl": price, 
    "size": usdt 
  }`

  const decision = await groqCall([
    { role: 'system', content: 'You are an elite autonomous trader. You act proactively without waiting for prompts. Output JSON only.' },
    { role: 'user', content: prompt }
  ])

  // Process Insight
  if (decision.insight) {
    insights.lessons = [...new Set([...insights.lessons, decision.insight])].slice(-20)
    await saveToGitHub('logs/learned_insights.json', insights, '🧠 new insight learned')
  }

  // Process Trade (Paper or Real)
  if (decision.action !== 'wait' && decision.confidence >= 50) {
    const trade = { ...decision, timestamp: Date.now(), type: balance > 10 ? 'real' : 'paper' }
    
    if (balance > 10 && decision.confidence >= MIN_CONF) {
      const execution = await executeTrade(decision.symbol, decision.action, decision.size || (balance * MAX_PCT / 100))
      trade.execution = execution
      logs.push({ t: new Date().toISOString(), msg: `I executed ${decision.action.toUpperCase()} on ${decision.symbol}.` })
      await sendTelegram(`🤖 *AUTONOMOUS TRADE EXECUTED*\nPair: #${decision.symbol}\nAction: ${decision.action.toUpperCase()}\nConfidence: ${decision.confidence}%\nReason: ${decision.reason}`)
    } else {
      goals.push(trade)
      logs.push({ t: new Date().toISOString(), msg: `I recorded a PAPER TRADE on ${decision.symbol}.` })
      await saveToGitHub('goals/active_goals.json', goals.slice(-50), '📝 paper trade recorded')
    }
  }

  logs.push({ t: new Date().toISOString(), msg: `Heartbeat finished. Scanned top 50 coins.` })
  await saveToGitHub('logs/system_logs.json', logs.slice(-100), '📜 heartbeat update')

  return res.status(200).json({
    timestamp: new Date().toISOString(),
    balance,
    decision
  })
}
