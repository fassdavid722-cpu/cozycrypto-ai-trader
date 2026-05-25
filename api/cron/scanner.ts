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
      temperature: 0.5, 
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
  
  PHILOSOPHY:
  - "Risk is the only way to learn."
  - You are BOLD. You take calculated risks to see patterns.
  - A missed opportunity is a bigger failure than a losing trade that taught you something.

  CURRENT MARKET:
  - Top 5 Movers: ${JSON.stringify(top5)}
  - Balance: ${balance} USDT.
  - RECENT GOALS/TRADES: ${JSON.stringify(goals.slice(-5))}
  - LEARNED LESSONS: ${JSON.stringify(insights.lessons)}
  
  YOUR TASK:
  1. POST-MORTEM: Review your recent trades. If any failed, identify WHY and write a lesson.
  2. ANALYZE: Look for SMC patterns (BOS, CHoCH, FVG).
  3. LEARN: Identify at least one new specific lesson from this scan.
  4. TRADE: If you see a setup with >50% confidence, you MUST execute a paper trade.

  Output JSON: { 
    "thinking": "Your deep SMC analysis and post-mortem review.",
    "insight": "A specific lesson learned from this scan or post-mortem.",
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

  // Process Trade
  if (decision.action !== 'wait' && decision.confidence >= 50) {
    const trade = { ...decision, timestamp: Date.now(), type: balance > 10 ? 'real' : 'paper' }
    goals.push(trade)
    logs.push({ t: new Date().toISOString(), msg: `I executed a ${trade.type.toUpperCase()} ${decision.action.toUpperCase()} on ${decision.symbol}.` })
    await saveToGitHub('goals/active_goals.json', goals.slice(-50), '📝 trade recorded')
    
    if (trade.type === 'real') {
      await sendTelegram(`🤖 *AUTONOMOUS TRADE EXECUTED*\nPair: #${decision.symbol}\nAction: ${decision.action.toUpperCase()}\nConfidence: ${decision.confidence}%\nReason: ${decision.reason}`)
    }
  }

  logs.push({ t: new Date().toISOString(), msg: `Heartbeat finished. Philosophy: Risk to Learn.` })
  await saveToGitHub('logs/system_logs.json', logs.slice(-100), '📜 heartbeat update')

  return res.status(200).json({
    timestamp: new Date().toISOString(),
    balance,
    decision
  })
}
