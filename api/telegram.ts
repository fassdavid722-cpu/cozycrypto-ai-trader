import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

// ── Configuration ──────────────────────────────────────────────────────────────
const TG_TOKEN      = process.env.TELEGRAM_BOT_TOKEN || ''
const TG_CHAT_ID    = process.env.TELEGRAM_CHAT_ID || ''
const BITGET_BASE   = 'https://api.bitget.com'
const API_KEY       = process.env.BITGET_API_KEY || ''
const SECRET_KEY    = process.env.BITGET_SECRET_KEY || ''
const PASSPHRASE    = process.env.BITGET_PASSPHRASE || ''
const GH_TOKEN      = process.env.GITHUB_TOKEN || ''
const GH_REPO       = process.env.GITHUB_REPO || ''
const GROQ_KEY      = process.env.GROQ_API_KEY || ''

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

async function loadFromGitHub(path: string): Promise<any> {
  if (!GH_TOKEN || !GH_REPO) return null
  try {
    const r = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${path}`, { headers: { 'Authorization': `Bearer ${GH_TOKEN}` } })
    if (!r.ok) return null
    const d = await r.json() as any
    return JSON.parse(Buffer.from(d.content, 'base64').toString())
  } catch (e) { return null }
}

async function getBalance() {
  if (!API_KEY) return '0'
  try {
    const path = '/api/v2/spot/account/assets'
    const r = await fetch(BITGET_BASE + path, { headers: authHeaders('GET', path) as any })
    const d = await r.json() as any
    const usdt = (d.data || []).find((a: any) => a.coinName === 'USDT')
    return usdt?.available || '0'
  } catch { return 'Error' }
}

async function callAI(prompt: string) {
  if (!GROQ_KEY) return "AI Brain not configured."
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are the Lead AI Trader for CozyCrypto. You are talking to your owner on Telegram. Be professional, concise, and data-driven. You have full access to Bitget and market data.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5
      })
    })
    const data = await res.json() as any
    return data.choices[0].message.content
  } catch (e) { return "I'm having trouble thinking right now. Check my logs." }
}

// ── Main Handler ───────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  const { message } = req.body
  if (!message || !message.text) return res.status(200).send('OK')

  const chatId = message.chat.id.toString()
  const text = message.text

  // Security: Only respond to the authorized chat ID
  if (TG_CHAT_ID && chatId !== TG_CHAT_ID) {
    return res.status(200).send('Unauthorized')
  }

  console.log(`📩 Received Telegram Message: ${text}`)

  // 1. Handle Commands
  if (text.startsWith('/')) {
    const cmd = text.toLowerCase()
    if (cmd === '/start') {
      await sendTelegram("🦅 *COZANET AI TRADER ACTIVE*\n\nI am your Lead Trader. You can talk to me normally or use these commands:\n/status - Current AI status & balance\n/balance - Detailed USDT balance\n/last - Last 5 trades\n/insights - Latest AI lessons")
    } 
    else if (cmd === '/status') {
      const balance = await getBalance()
      await sendTelegram(`📊 *SYSTEM STATUS*\n\nMode: Autonomous\nHeartbeat: Active (5m)\nBalance: ${balance} USDT\nMemory: Connected`)
    }
    else if (cmd === '/balance') {
      const balance = await getBalance()
      await sendTelegram(`💰 *CURRENT BALANCE*\n\nAvailable: ${balance} USDT`)
    }
    else if (cmd === '/last') {
      const goals = await loadFromGitHub('goals/active_goals.json')
      if (!goals || goals.length === 0) {
        await sendTelegram("📭 No trades recorded yet.")
      } else {
        const last5 = goals.slice(-5).reverse()
        const list = last5.map((g: any) => `- ${g.symbol}: ${g.action.toUpperCase()} (${g.confidence}%)`).join('\n')
        await sendTelegram(`📝 *LAST 5 TRADES*\n\n${list}`)
      }
    }
    else if (cmd === '/insights') {
      const insights = await loadFromGitHub('logs/learned_insights.json')
      if (!insights || !insights.lessons || insights.lessons.length === 0) {
        await sendTelegram("🧠 No insights learned yet.")
      } else {
        const last3 = insights.lessons.slice(-3).reverse()
        const list = last3.map((l: string) => `• ${l}`).join('\n')
        await sendTelegram(`🧠 *LATEST INSIGHTS*\n\n${list}`)
      }
    }
  } 
  // 2. Handle General Prompting
  else {
    await sendTelegram("_Thinking..._")
    const aiResponse = await callAI(text)
    await sendTelegram(aiResponse)
  }

  return res.status(200).send('OK')
}
