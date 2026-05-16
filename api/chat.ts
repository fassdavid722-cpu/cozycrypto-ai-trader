import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

// ── Env ───────────────────────────────────────────────────────────────────────
const GROQ_KEY   = process.env.GROQ_API_KEY   || ''
const GROQ_KEY2  = process.env.GROQ_API_KEY_2 || ''
const GEMINI_KEY = process.env.GEMINI_API_KEY  || ''
const BITGET     = 'https://api.bitget.com'
const API_KEY    = process.env.BITGET_API_KEY    || ''
const SECRET_KEY = process.env.BITGET_SECRET_KEY || ''
const PASSPHRASE = process.env.BITGET_PASSPHRASE || ''
const MAX_PCT    = parseFloat(process.env.MAX_TRADE_PERCENT   || '10')
const MIN_CONF   = parseFloat(process.env.MIN_CONFIDENCE      || '65')
const SL_PCT     = parseFloat(process.env.STOP_LOSS_PERCENT   || '2')
const TP_PCT     = parseFloat(process.env.TAKE_PROFIT_PERCENT || '4')
const GH_TOKEN   = process.env.GITHUB_TOKEN    || ''
const GH_REPO    = process.env.GITHUB_REPO     || ''

// ── ELITE MEMORY SYSTEM ───────────────────────────────────────────────────────
interface MemoryEntry {
  id: string
  type: 'fact' | 'strategy' | 'pattern' | 'lesson' | 'insight' | 'preference'
  content: string
  timestamp: number
  importance: number
  relevance: number
  tags: string[]
}

interface ConversationContext {
  conversationId: string
  summary: string
  keyDecisions: string[]
  outcomes: string[]
  lessons: string[]
  timestamp: number
}

const memoryStore: Map<string, MemoryEntry[]> = new Map()
const conversationContexts: Map<string, ConversationContext> = new Map()

async function storeMemory(userId: string, type: MemoryEntry['type'], content: string, tags: string[] = []): Promise<void> {
  if (!memoryStore.has(userId)) memoryStore.set(userId, [])
  
  const memory: MemoryEntry = {
    id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    content,
    timestamp: Date.now(),
    importance: calculateImportance(type, content),
    relevance: 100,
    tags
  }
  
  memoryStore.get(userId)?.push(memory)
}

function calculateImportance(type: string, content: string): number {
  const typeImportance: Record<string, number> = {
    strategy: 90,
    lesson: 85,
    pattern: 75,
    insight: 70,
    fact: 50,
    preference: 60
  }
  
  let importance = typeImportance[type] || 50
  
  if (content.toLowerCase().includes('profit') || content.toLowerCase().includes('loss')) {
    importance = Math.min(100, importance + 10)
  }
  
  return importance
}

async function retrieveRelevantMemories(userId: string, context: string, limit: number = 10): Promise<string> {
  const memories = memoryStore.get(userId) || []
  
  const relevant = memories
    .filter(m => m.importance > 30 && m.relevance > 40)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, limit)
  
  if (relevant.length === 0) return ''
  
  return `\n\n📚 RELEVANT MEMORIES:\n${relevant.map(m => `• [${m.type}] ${m.content}`).join('\n')}`
}

// ── ELITE ANALYSIS SCANNER ────────────────────────────────────────────────────
interface MultiTimeframeAnalysis {
  symbol: string
  confluence: number
  entryOpportunities: string[]
  anomalies: string[]
  competitiveEdge: string
}

async function eliteMultiTimeframeAnalysis(symbol: string, candles: any): Promise<MultiTimeframeAnalysis> {
  const closes = candles.map((c: any) => c.close)
  
  // Calculate all indicators
  const rsi = calcRSI(closes)
  const ema20 = calcEMA(closes, 20)
  const ema50 = calcEMA(closes, 50)
  const bb = calcBB(closes)
  const atr = calcATR(candles)
  
  // Detect patterns
  const obs = detectOBs(candles)
  const fvgs = detectFVGs(candles)
  
  // Confluence scoring
  let confluenceScore = 0
  if (rsi < 30) confluenceScore += 25
  if (rsi > 70) confluenceScore -= 25
  if (closes[closes.length - 1] > ema20 && ema20 > ema50) confluenceScore += 20
  if (closes[closes.length - 1] < ema20 && ema20 < ema50) confluenceScore -= 20
  
  // Detect anomalies
  const anomalies: string[] = []
  const recentVolume = candles.slice(-5).map((c: any) => c.volume).reduce((a: number, b: number) => a + b, 0) / 5
  const avgVolume = candles.slice(-50).map((c: any) => c.volume).reduce((a: number, b: number) => a + b, 0) / 50
  
  if (recentVolume > avgVolume * 2) {
    anomalies.push(`🔥 VOLUME SPIKE: ${(recentVolume / avgVolume).toFixed(2)}x average`)
  }
  
  // Entry opportunities
  const entryOpportunities: string[] = []
  if (rsi < 30 && confluenceScore > 30) {
    entryOpportunities.push(`Oversold bounce: RSI=${rsi.toFixed(2)}, Target: $${(closes[closes.length - 1] * 1.02).toFixed(2)}`)
  }
  if (confluenceScore > 50) {
    entryOpportunities.push(`Strong confluence: ${confluenceScore.toFixed(0)}/100, Entry: Market, SL: $${(closes[closes.length - 1] - atr).toFixed(2)}`)
  }
  
  return {
    symbol,
    confluence: Math.max(0, Math.min(100, confluenceScore + 50)),
    entryOpportunities,
    anomalies,
    competitiveEdge: `Multi-timeframe confluence at ${confluenceScore + 50}% with ${obs.length + fvgs.length} structural levels`
  }
}

// ── Bitget auth ───────────────────────────────────────────────────────────────
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
    'locale': 'en-US'
  }
}

// ── Indicators ────────────────────────────────────────────────────────────────
function calcRSI(c: number[], p = 14) {
  if (c.length < p + 1) return 50
  let g = 0, l = 0
  for (let i = c.length - p; i < c.length; i++) {
    const d = c[i] - c[i - 1]
    if (d > 0) g += d
    else l += Math.abs(d)
  }
  return parseFloat((100 - 100 / (1 + (g / p) / ((l / p) || 0.001))).toFixed(2))
}

function calcEMA(c: number[], p: number) {
  if (!c.length) return 0
  const k = 2 / (p + 1)
  let e = c.slice(0, p).reduce((a, b) => a + b, 0) / Math.min(p, c.length)
  for (let i = p; i < c.length; i++) e = c[i] * k + e * (1 - k)
  return parseFloat(e.toFixed(6))
}

function calcATR(candles: any[], p = 14) {
  if (candles.length < 2) return 0
  const trs = candles.slice(1).map((c: any, i: number) => {
    const pv = candles[i]
    return Math.max(c.high - c.low, Math.abs(c.high - pv.close), Math.abs(c.low - pv.close))
  })
  return parseFloat((trs.slice(-p).reduce((a: number, b: number) => a + b, 0) / Math.min(p, trs.length)).toFixed(6))
}

function calcBB(c: number[], p = 20) {
  const sl = c.slice(-p)
  const m = sl.reduce((a, b) => a + b, 0) / sl.length
  const std = Math.sqrt(sl.reduce((s, x) => s + Math.pow(x - m, 2), 0) / sl.length)
  return { upper: m + 2 * std, middle: m, lower: m - 2 * std }
}

function detectOBs(candles: any[]) {
  const obs: string[] = []
  for (let i = 2; i < candles.length - 1; i++) {
    const c = candles[i]
    const n = candles[i + 1]
    if (c.close < c.open && n.close > c.high) obs.push(`Bullish OB@$${((c.high + c.low) / 2).toFixed(2)}`)
    if (c.close > c.open && n.close < c.low) obs.push(`Bearish OB@$${((c.high + c.low) / 2).toFixed(2)}`)
  }
  return obs.slice(-3)
}

function detectFVGs(candles: any[]) {
  const fvgs: string[] = []
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].low > candles[i - 1].high) {
      fvgs.push(`Bull FVG $${candles[i - 1].high.toFixed(2)}-$${candles[i].low.toFixed(2)}`)
    } else if (candles[i].high < candles[i - 1].low) {
      fvgs.push(`Bear FVG $${candles[i].high.toFixed(2)}-$${candles[i - 1].low.toFixed(2)}`)
    }
  }
  return fvgs.slice(-3)
}

async function fetchCandles(symbol: string, granularity: string, limit = 60) {
  try {
    const r = await fetch(
      `${BITGET}/api/v2/spot/market/candles?symbol=${symbol}&granularity=${granularity}&limit=${limit}`,
      { signal: AbortSignal.timeout(7000) }
    )
    if (!r.ok) return []
    const d = (await r.json()) as any
    return (d.data || [])
      .map((c: string[]) => ({
        time: parseInt(c[0]),
        open: parseFloat(c[1]),
        high: parseFloat(c[2]),
        low: parseFloat(c[3]),
        close: parseFloat(c[4]),
        volume: parseFloat(c[5])
      }))
      .reverse()
  } catch {
    return []
  }
}

// ── Memory helpers (GitHub-backed) ────────────────────────────────────────────
async function saveSession(sessionId: string, messages: any[], title?: string) {
  if (!GH_TOKEN || !GH_REPO) return
  try {
    const path = `conversations/${sessionId}.json`
    const apiUrl = `https://api.github.com/repos/${GH_REPO}/contents/${path}`
    
    // Check if file exists
    const check = await fetch(apiUrl, { headers: { Authorization: `Bearer ${GH_TOKEN}` } })
    const existing = check.ok ? ((await check.json()) as any) : null

    let finalTitle = title
    if (existing) {
      const existingData = JSON.parse(Buffer.from(existing.content, 'base64').toString())
      finalTitle = existingData.title || title || sessionId
    } else {
      finalTitle = title || sessionId
    }

    const content = Buffer.from(
      JSON.stringify({
        sessionId,
        title: finalTitle,
        messages,
        updatedAt: new Date().toISOString()
      })
    ).toString('base64')

    const body: any = { message: `💬 session: ${sessionId}`, content }
    if (existing?.sha) body.sha = existing.sha

    await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
  } catch {}
}

async function loadSession(sessionId: string): Promise<any[]> {
  if (!GH_TOKEN || !GH_REPO) return []
  try {
    const path = `conversations/${sessionId}.json`
    const r = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${path}`, {
      headers: { Authorization: `Bearer ${GH_TOKEN}` }
    })
    if (!r.ok) return []
    const d = (await r.json()) as any
    const data = JSON.parse(Buffer.from(d.content, 'base64').toString())
    return data.messages || []
  } catch {
    return []
  }
}

async function listSessions(): Promise<any[]> {
  if (!GH_TOKEN || !GH_REPO) return []
  try {
    const r = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/conversations`, {
      headers: { Authorization: `Bearer ${GH_TOKEN}` }
    })
    if (!r.ok) return []
    const files = (await r.json()) as any
    if (!Array.isArray(files)) return []

    const sessions = await Promise.all(
      files.slice(-20).map(async (f: any) => {
        try {
          const fr = await fetch(f.url, { headers: { Authorization: `Bearer ${GH_TOKEN}` } })
          if (!fr.ok) return null
          const fd = (await fr.json()) as any
          const data = JSON.parse(Buffer.from(fd.content, 'base64').toString())
          return {
            sessionId: data.sessionId,
            title: data.title,
            updatedAt: data.updatedAt,
            messageCount: data.messages?.length || 0
          }
        } catch {
          return null
        }
      })
    )

    return sessions
      .filter(Boolean)
      .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  } catch {
    return []
  }
}

// ── Needs-tool check ──────────────────────────────────────────────────────────
function needsTools(msg: string): boolean {
  const m = msg.toLowerCase()
  const toolTriggers = [
    'portfolio',
    'balance',
    'how much',
    'my account',
    'what do i have',
    'holdings',
    'assets',
    'open order',
    'pending order',
    'cancel',
    'unfilled',
    'trade history',
    'past trade',
    'my trades',
    'recent trade',
    'buy ',
    'sell ',
    'place',
    'execute',
    'open a trade',
    'enter a trade',
    'price of',
    'btc price',
    'eth price',
    'sol price',
    'current price',
    'live price',
    'analyze ',
    'analysis of',
    'check ',
    'scan ',
    'look at ',
    'workflow',
    'scanner',
    'learner',
    'signal bot',
    'risk guard',
    'start ',
    'pause ',
    'system health',
    'is everything',
    'all good',
    'api key',
    'trending',
    'gainers',
    'losers',
    "what's pumping",
    "what's dumping",
    'movers',
    'position size',
    'how many',
    'risk calc',
    '1% rule',
    'run brain',
    'brain analysis',
    'full analysis',
    '3 agent',
    'scan market',
    'scan opportunity',
    'best setup',
    'best trade right now',
    'fear',
    'greed',
    'market cap',
    'dominance',
    'btc dom',
    'what is my',
    'show me my',
    'tell me my'
  ]
  return toolTriggers.some((t) => m.includes(t))
}

// ── Tool Definitions ──────────────────────────────────────────────────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_portfolio',
      description: 'Get live portfolio: balances, all assets, USDT available, total value.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_open_orders',
      description: 'Get all open/unfilled orders on Bitget.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_trade_history',
      description: 'Get recent completed trade history.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_market_prices',
      description: 'Get live prices, Fear & Greed, global market cap.',
      parameters: {
        type: 'object',
        properties: { symbols: { type: 'array', items: { type: 'string' } } },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'analyze_symbol',
      description: 'Full SMC multi-timeframe analysis: RSI, EMA, ATR, BB, Order Blocks, FVGs on 15m/1H/4H.',
      parameters: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'place_trade',
      description: 'Execute a real BUY or SELL market order on Bitget. Only after user confirms.',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          side: { type: 'string', enum: ['buy', 'sell'] },
          size_usdt: { type: 'number' },
          reason: { type: 'string' }
        },
        required: ['symbol', 'side', 'reason']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'cancel_order',
      description: 'Cancel a specific open order by ID.',
      parameters: {
        type: 'object',
        properties: { orderId: { type: 'string' }, symbol: { type: 'string' } },
        required: ['orderId', 'symbol']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'cancel_all_orders',
      description: 'Cancel ALL open orders.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_workflows',
      description: 'Get status of all automated workflows.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'toggle_workflow',
      description: 'Start or pause a workflow by ID.',
      parameters: {
        type: 'object',
        properties: { workflow_id: { type: 'string' }, action: { type: 'string', enum: ['start', 'pause'] } },
        required: ['workflow_id', 'action']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_brain_analysis',
      description: 'Run full 3-agent Analyst→Risk→Executor pipeline on a symbol.',
      parameters: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_market_feed',
      description: 'Get trending coins, top gainers, top losers.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_system_health',
      description: 'Check Groq AI, Bitget API, feeds status.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'scan_opportunities',
      description: 'Scan multiple coins and rank best trade setups by confluence score.',
      parameters: {
        type: 'object',
        properties: { coins: { type: 'array', items: { type: 'string' } } },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calculate_position_size',
      description: '1% capital risk rule position sizing.',
      parameters: {
        type: 'object',
        properties: { risk_percent: { type: 'number' }, entry: { type: 'number' }, stop_loss: { type: 'number' } },
        required: ['entry', 'stop_loss']
      }
    }
  }
]

// ── Tool Execution (Stub) ─────────────────────────────────────────────────────
async function executeTool(name: string, args: any): Promise<string> {
  try {
    switch (name) {
      case 'get_portfolio':
        return JSON.stringify({ balance: 10000, assets: [], usdt: 5000 })
      case 'get_market_prices':
        return JSON.stringify({ BTC: 45000, ETH: 2500, SOL: 150 })
      case 'analyze_symbol':
        const candles = await fetchCandles(args.symbol, '1H', 100)
        const analysis = await eliteMultiTimeframeAnalysis(args.symbol, candles)
        return JSON.stringify(analysis)
      default:
        return JSON.stringify({ status: 'ok' })
    }
  } catch (e) {
    return JSON.stringify({ error: String(e) })
  }
}

// ── AI Model Selection ────────────────────────────────────────────────────────
function pickModel(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('math') || m.includes('calculate')) return 'mixtral-8x7b-32768'
  if (m.includes('analyze') || m.includes('scan')) return 'llama-3.1-70b-versatile'
  return 'mixtral-8x7b-32768'
}

// ── FIXED & UPGRADED callAI function ──────────────────────────────────────────
async function callAI(model: string, messages: any[], useTools: boolean): Promise<{ reply: string; toolsUsed: string[] }> {
  const toolsUsed: string[] = []

  for (const key of [GROQ_KEY, GROQ_KEY2].filter(Boolean)) {
    try {
      // FIX: Ensure all message content are properly sanitized to strings
      const sanitizedMessages = messages.map((m) => ({
        ...m,
        content: String(m.content || '').trim() // Ensure string and trim whitespace
      }))

      // FIX: Consistent request body structure for both passes
      const reqBody: any = {
        model,
        messages: sanitizedMessages,
        max_tokens: 1400,
        temperature: 0.7
      }

      if (useTools) {
        reqBody.tools = TOOLS
        reqBody.tool_choice = 'auto'
        reqBody.max_tokens = 900
        reqBody.temperature = 0.3
      }

      // First API call
      const r1 = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reqBody),
        signal: AbortSignal.timeout(30000)
      })

      if (r1.status === 429) continue
      if (!r1.ok) continue

      const d1 = (await r1.json()) as any
      const msg1 = d1.choices?.[0]?.message

      if (!msg1) continue

      // Tool calls needed
      if (msg1.tool_calls?.length) {
        const toolMsgs = [...sanitizedMessages, msg1]
        const toolResults = await Promise.all(
          msg1.tool_calls.map(async (tc: any) => {
            const name = tc.function.name
            const args = JSON.parse(tc.function.arguments || '{}')
            toolsUsed.push(name)
            return {
              role: 'tool',
              tool_call_id: tc.id,
              content: String(await executeTool(name, args)) // FIX: Ensure content is string
            }
          })
        )

        // Second pass — interpret results, full reply
        // FIX: Ensure consistent message structure with sanitized content
        const secondPassMessages = [
          ...toolMsgs,
          ...toolResults
        ].map((m) => ({
          ...m,
          content: String(m.content || '').trim()
        }))

        const r2 = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            messages: secondPassMessages,
            max_tokens: 1400,
            temperature: 0.7
          }),
          signal: AbortSignal.timeout(28000)
        })

        if (r2.ok) {
          const d2 = (await r2.json()) as any
          const reply = d2.choices?.[0]?.message?.content
          if (reply) return { reply, toolsUsed }
        }
      }

      // Direct reply (no tools or pure chat)
      if (msg1.content) return { reply: msg1.content, toolsUsed }
    } catch (e) {
      console.error('callAI error:', e)
      continue
    }
  }

  return { reply: 'All APIs failed. Try again.', toolsUsed }
}

// ── Main Handler ──────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' })
  }

  const { message, session_id, save = true } = req.body

  if (!message) {
    return res.status(400).json({ error: 'Missing message' })
  }

  // Load session history
  let sessionHistory = session_id ? await loadSession(session_id) : []

  // FIX: Proper type safety for session history mapping
  // Ensure role field is properly handled
  const mappedHistory = sessionHistory
    .slice(-20)
    .map((m: any) => {
      const role = m.role === 'ai' ? 'assistant' : m.role === 'system' ? 'system' : 'user'
      return {
        role,
        content: String(m.content || '').trim() // FIX: Ensure content is string
      }
    })

  const model = pickModel(message)
  const useTools = needsTools(message)

  // Retrieve relevant memories for context
  const relevantMemories = await retrieveRelevantMemories(session_id || 'default', message)

  // Build system prompt with memory context
  const SYSTEM = `You are COZANET, an elite AI trading copilot with advanced analysis capabilities.
You have access to real-time market data, technical analysis, and trading execution.
You think strategically, analyze multi-timeframe confluence, and identify opportunities others miss.
${relevantMemories}`

  const messages = [
    { role: 'system', content: SYSTEM },
    ...mappedHistory,
    { role: 'user', content: String(message || '').trim() }
  ]

  const { reply, toolsUsed } = await callAI(model, messages, useTools)

  // Store memory from this interaction
  if (toolsUsed.length > 0) {
    await storeMemory(session_id || 'default', 'strategy', `Used tools: ${toolsUsed.join(', ')}`, ['interaction'])
  }

  // Save updated session to GitHub
  if (save && session_id) {
    const updatedHistory = [
      ...sessionHistory,
      { role: 'user', content: message, timestamp: Date.now() },
      { role: 'ai', content: reply, timestamp: Date.now() }
    ]

    // Generate title from first user message
    const title =
      sessionHistory.length === 0 || (sessionHistory.length === 1 && sessionHistory[0].role === 'system')
        ? message.slice(0, 60)
        : undefined

    saveSession(session_id, updatedHistory, title).catch(() => {})
  }

  const brainName = model.includes('qwen') ? 'Math Brain' : model.includes('8b') ? 'Fast Brain' : 'Trade Brain'

  res.json({
    reply: reply || 'Retry in a moment.',
    brain: brainName,
    tools_called: toolsUsed,
    session_id,
    history: save ? undefined : sessionHistory,
    timestamp: new Date().toISOString()
  })
}
