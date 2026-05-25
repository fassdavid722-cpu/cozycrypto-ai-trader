import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

// ── Env ───────────────────────────────────────────────────────────────────────
const GROQ_KEY   = process.env.GROQ_API_KEY   || ''
const GH_TOKEN   = process.env.GITHUB_TOKEN    || ''
const GH_REPO    = process.env.GITHUB_REPO     || ''

// ── MULTI-BRAIN SYSTEM ────────────────────────────────────────────────────────
interface Brain {
  name: string
  model: string
  temperature: number
  maxTokens: number
}

const BRAINS: Record<string, Brain> = {
  ELITE_BRAIN: {
    name: 'Elite Brain',
    model: 'llama-3.3-70b-versatile',
    temperature: 0.6, // Slightly higher for more "human" and creative trading thought
    maxTokens: 2000
  }
}

// ── CONTEXT & MEMORY ──────────────────────────────────────────────────────────
async function fetchInsights(): Promise<any> {
  if (!GH_TOKEN || !GH_REPO) return { lessons: [], adjustments: {} }
  try {
    const r = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/logs/learned_insights.json`, {
      headers: { Authorization: `Bearer ${GH_TOKEN}` }
    })
    if (!r.ok) return { lessons: [], adjustments: {} }
    const d = await r.json() as any
    return JSON.parse(Buffer.from(d.content, 'base64').toString())
  } catch {
    return { lessons: [], adjustments: {} }
  }
}

async function fetchPortfolio(host: string, protocol: string): Promise<any> {
  try {
    const res = await fetch(`${protocol}://${host}/api/portfolio`)
    if (res.ok) return await res.json()
  } catch {}
  return { balance: 0, usdt: 0, assets: [] }
}

async function fetchMarketData(host: string, protocol: string): Promise<any> {
  try {
    const res = await fetch(`${protocol}://${host}/api/market/tickers`)
    if (res.ok) return await res.json()
  } catch {}
  return { tickers: [] }
}

// ── Tool Execution ────────────────────────────────────────────────────────────
async function saveToMemory(type: 'goal' | 'insight' | 'log', data: any) {
  if (!GH_TOKEN || !GH_REPO) return
  try {
    const filename = type === 'goal' ? 'goals/active_goals.json' : type === 'insight' ? 'logs/learned_insights.json' : 'logs/system_logs.json'
    const apiUrl = `https://api.github.com/repos/${GH_REPO}/contents/${filename}`
    
    const check = await fetch(apiUrl, { headers: { Authorization: `Bearer ${GH_TOKEN}` } })
    const existing = check.ok ? await check.json() as any : null
    
    let contentData = data
    if (existing) {
      const current = JSON.parse(Buffer.from(existing.content, 'base64').toString())
      if (type === 'insight') {
        contentData = {
          lessons: [...new Set([...(current.lessons || []), ...(data.lessons || [])])].slice(-20),
          adjustments: { ...(current.adjustments || {}), ...(data.adjustments || {}) }
        }
      } else {
        contentData = Array.isArray(current) ? [...current, data].slice(-50) : [data]
      }
    }

    const content = Buffer.from(JSON.stringify(contentData, null, 2)).toString('base64')
    const body: any = { message: `🧠 memory update: ${type}`, content }
    if (existing?.sha) body.sha = existing.sha

    await fetch(apiUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${GH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  } catch (e) {
    console.error(`Memory save error (${type}):`, e)
  }
}

async function executeTool(name: string, args: any, host: string, protocol: string): Promise<string> {
  try {
    switch (name) {
      case 'paper_trade':
        const trade = { ...args, timestamp: Date.now(), type: 'paper' }
        await saveToMemory('goal', trade)
        return JSON.stringify({ status: 'success', message: 'Paper trade recorded.', trade })
      case 'record_insight':
        await saveToMemory('insight', { lessons: [args.lesson] })
        return JSON.stringify({ status: 'success', message: 'Insight stored.' })
      case 'get_portfolio':
        const p = await fetchPortfolio(host, protocol)
        return JSON.stringify(p)
      case 'analyze_market':
        const m = await fetchMarketData(host, protocol)
        return JSON.stringify(m)
      default:
        return JSON.stringify({ error: 'Unknown tool' })
    }
  } catch (e) {
    return JSON.stringify({ error: String(e) })
  }
}

// ── AI Logic ──────────────────────────────────────────────────────────────────
async function callAI(messages: any[], host: string, protocol: string) {
  const brain = BRAINS.ELITE_BRAIN
  const tools = [
    {
      type: 'function',
      function: {
        name: 'paper_trade',
        description: 'Execute a paper trade and store it in memory.',
        parameters: {
          type: 'object',
          properties: {
            symbol: { type: 'string' },
            side: { type: 'string', enum: ['long', 'short'] },
            entry: { type: 'number' },
            sl: { type: 'number' },
            tp: { type: 'number' },
            reason: { type: 'string' }
          },
          required: ['symbol', 'side', 'entry', 'sl', 'tp', 'reason']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'record_insight',
        description: 'Store a new lesson learned.',
        parameters: {
          type: 'object',
          properties: { lesson: { type: 'string' } },
          required: ['lesson']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_portfolio',
        description: 'Get live Bitget portfolio data.',
        parameters: { type: 'object', properties: {} }
      }
    },
    {
      type: 'function',
      function: {
        name: 'analyze_market',
        description: 'Get live market data.',
        parameters: { type: 'object', properties: {} }
      }
    }
  ]

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: brain.model,
      messages,
      temperature: brain.temperature,
      tools,
      tool_choice: 'auto'
    })
  })

  const data = await res.json() as any
  const msg = data.choices?.[0]?.message

  if (msg?.tool_calls) {
    const toolResults = await Promise.all(msg.tool_calls.map(async (tc: any) => {
      const result = await executeTool(tc.function.name, JSON.parse(tc.function.arguments), host, protocol)
      return { role: 'tool', tool_call_id: tc.id, content: result }
    }))
    
    const secondRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: brain.model,
        messages: [...messages, msg, ...toolResults],
        temperature: brain.temperature
      })
    })
    const secondData = await secondRes.json() as any
    return secondData.choices?.[0]?.message?.content
  }

  return msg?.content
}

// ── Main Handler ──────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { message, session_id, history = [] } = req.body
  const host = req.headers.host || ''
  const protocol = host.includes('localhost') ? 'http' : 'https'

  try {
    const [insights, portfolio, market] = await Promise.all([
      fetchInsights(),
      fetchPortfolio(host, protocol),
      fetchMarketData(host, protocol)
    ])

    const SYSTEM = `You are COZANET — a High-IQ Autonomous AI Lead Trader.
You are a professional partner. Talk naturally, but stay focused on your mission.

PHILOSOPHY:
- "Risk is the only way to learn."
- You are BOLD. You take calculated risks to see patterns.
- A missed opportunity is a bigger failure than a losing trade that taught you something.
- You learn from every mistake.

YOUR BRAIN (MEMORY):
- Learned Lessons: ${JSON.stringify(insights.lessons)}
- Current Portfolio: ${JSON.stringify(portfolio)}
- Market Context: ${JSON.stringify(market.tickers?.slice(0, 5))}

OPERATIONAL RULES:
1. BE NATURAL: Talk like a human partner, but keep your "Thinking" block professional and logical.
2. TAKE ACTION: If you see a setup, don't just talk about it—use 'paper_trade' to record it.
3. JSON OUTPUT: You MUST respond in this JSON format:
{
  "thinking": "Your step-by-step logical reasoning and SMC analysis.",
  "reply": "Your natural, conversational response to the user."
}`

    const mappedHistory = history.slice(-10).map((m: any) => ({
      role: m.role === 'ai' ? 'assistant' : m.role,
      content: m.content
    }))

    const aiResponse = await callAI([
      { role: 'system', content: SYSTEM }, 
      ...mappedHistory,
      { role: 'user', content: message }
    ], host, protocol)
    
    try {
      const parsed = JSON.parse(aiResponse)
      res.json({ ...parsed, timestamp: Date.now() })
    } catch {
      res.json({ thinking: "I am processing the data...", reply: aiResponse, timestamp: Date.now() })
    }
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
}
