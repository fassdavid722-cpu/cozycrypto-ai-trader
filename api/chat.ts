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

// ── MULTI-BRAIN SYSTEM ────────────────────────────────────────────────────────
interface Brain {
  name: string
  model: string
  temperature: number
  maxTokens: number
  specialization: string
}

const BRAINS: Record<string, Brain> = {
  MATH_BRAIN: {
    name: 'Math Brain',
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    maxTokens: 1200,
    specialization: 'calculations, position sizing, risk analysis'
  },
  FAST_BRAIN: {
    name: 'Fast Brain',
    model: 'llama-3.1-8b-instant',
    temperature: 0.5,
    maxTokens: 800,
    specialization: 'quick responses, simple queries'
  },
  TRADE_BRAIN: {
    name: 'Trade Brain',
    model: 'llama-3.3-70b-versatile',
    temperature: 0.7,
    maxTokens: 1400,
    specialization: 'market analysis, trading strategy, technical analysis'
  }
}

// ── INTERNET & CONTEXT ACCESS ─────────────────────────────────────────────────
interface PageContext {
  portfolio?: any
  marketData?: any
  openOrders?: any
  workflows?: any
  alerts?: any
  timestamp: number
}

const contextCache: Map<string, PageContext> = new Map()

async function fetchPortfolioContext(userId: string, host: string, protocol: string): Promise<any> {
  try {
    const res = await fetch(`${protocol}://${host}/api/portfolio`, {
      signal: AbortSignal.timeout(3000)
    })
    if (res.ok) return await res.json()
  } catch (e) {
    console.log('Portfolio fetch failed:', e)
  }
  return { balance: 0, assets: [], usdt: 0 }
}

async function fetchMarketContext(): Promise<any> {
  try {
    // Fetch market data from multiple sources
    const [bitgetRes, coingeckoRes] = await Promise.all([
      fetch('https://api.bitget.com/api/v2/spot/market/tickers?symbol=BTCUSDT', { signal: AbortSignal.timeout(3000) }),
      fetch('https://api.coingecko.com/api/v3/global', { signal: AbortSignal.timeout(3000) })
    ])

    const bitgetData = bitgetRes.ok ? await bitgetRes.json() : {}
    const coingeckoData = coingeckoRes.ok ? await coingeckoRes.json() : {}

    return {
      btc: bitgetData?.data?.[0],
      global: coingeckoDataa?.data,
      timestamp: Date.now()
    }
  } catch (e) {
    console.log('Market fetch failed:', e)
  }
  return {}
}

async function fetchWorkflowContext(host: string, protocol: string): Promise<any> {
  try {
    const res = await fetch(`${protocol}://${host}/api/workflows`, {
      signal: AbortSignal.timeout(3000)
    })
    if (res.ok) return await res.json()
  } catch (e) {
    console.log('Workflow fetch failed:', e)
  }
  return { workflows: [] }
}

async function buildPageContext(userId: string, host: string, protocol: string): Promise<PageContext> {
  // Check cache first
  const cached = contextCache.get(userId)
  if (cached && Date.now() - cached.timestamp < 30000) {
    return cached
  }

  // Fetch all context in parallel
  const [portfolio, market, workflows] = await Promise.all([
    fetchPortfolioContext(userId, host, protocol),
    fetchMarketContext(),
    fetchWorkflowContext(host, protocol)
  ])

  const context: PageContext = {
    portfolio,
    marketData: market,
    workflows,
    timestamp: Date.now()
  }

  contextCache.set(userId, context)
  return context
}

function formatContextForAI(context: PageContext): string {
  let contextStr = '\n\n📊 CURRENT CONTEXT:\n'

  if (context.portfolio) {
    contextStr += `\n💰 Portfolio:\n`
    contextStr += `  • Balance: $${context.portfolio.balance?.toFixed(2) || '0'}\n`
    contextStr += `  • USDT Available: $${context.portfolio.usdt?.toFixed(2) || '0'}\n`
    if (context.portfolio.assets?.length) {
      contextStr += `  • Assets: ${context.portfolio.assets.map((a: any) => `${a.coin || a.symbol}($${a.usdValue?.toFixed(0) || a.available})`).join(', ')}\n`
    }
  }

  if (context.marketData?.btc) {
    contextStr += `\n📈 Market:\n`
    contextStr += `  • BTC: $${context.marketData.btc.lastPr || 'N/A'}\n`
  }

  if (context.workflows?.workflows?.length) {
    contextStr += `\n⚙️ Active Workflows: ${context.workflows.workflows.length}\n`
  }

  return contextStr
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
  } catch (e) {
    console.log('Save session error:', e)
  }
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

// ── Needs-tool check ──────────────────────────────────────────────────────────
function needsTools(msg: string): boolean {
  const m = msg.toLowerCase()
  const toolTriggers = [
    'portfolio', 'balance', 'how much', 'my account', 'what do i have', 'holdings', 'assets',
    'open order', 'pending order', 'cancel', 'unfilled',
    'trade history', 'past trade', 'my trades', 'recent trade',
    'buy ', 'sell ', 'place', 'execute', 'open a trade', 'enter a trade',
    'price of', 'btc price', 'eth price', 'sol price', 'current price', 'live price',
    'analyze ', 'analysis of', 'check ', 'scan ', 'look at ',
    'workflow', 'scanner', 'learner', 'signal bot', 'risk guard', 'start ', 'pause ',
    'system health', 'is everything', 'all good', 'api key',
    'trending', 'gainers', 'losers', "what's pumping", "what's dumping", 'movers',
    'position size', 'how many', 'risk calc', '1% rule',
    'run brain', 'brain analysis', 'full analysis', '3 agent',
    'scan market', 'scan opportunity', 'best setup', 'best trade right now',
    'fear', 'greed', 'market cap', 'dominance', 'btc dom',
    'what is my', 'show me my', 'tell me my'
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
      name: 'analyze_symbol',
      description: 'Full SMC multi-timeframe analysis: RSI, EMA, ATR, BB, Order Blocks, FVGs on 15m/1H/4H.',
      parameters: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] }
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
  }
]

// ── Tool Execution ────────────────────────────────────────────────────────────
async function executeTool(name: string, args: any, host: string, protocol: string): Promise<string> {
  try {
    switch (name) {
      case 'get_portfolio':
        const pRes = await fetch(`${protocol}://${host}/api/portfolio`)
        return pRes.ok ? JSON.stringify(await pRes.json()) : JSON.stringify({ error: 'Failed to fetch portfolio' })
      case 'get_market_prices':
        const mRes = await fetch(`${protocol}://${host}/api/market/tickers`)
        return mRes.ok ? JSON.stringify(await mRes.json()) : JSON.stringify({ error: 'Failed to fetch market prices' })
      case 'analyze_symbol':
        const candles = await fetchCandles(args.symbol, '1H', 100)
        if (candles.length > 0) {
          const closes = candles.map((c: any) => c.close)
          return JSON.stringify({
            symbol: args.symbol,
            rsi: calcRSI(closes),
            ema20: calcEMA(closes, 20),
            ema50: calcEMA(closes, 50),
            atr: calcATR(candles),
            status: 'ok'
          })
        }
        return JSON.stringify({ error: 'No candles data', status: 'error' })
      default:
        return JSON.stringify({ status: 'ok' })
    }
  } catch (e) {
    console.error('Tool execution error:', e)
    return JSON.stringify({ error: String(e), status: 'error' })
  }
}

// ── MULTI-BRAIN callAI with proper error handling ────────────────────────────
async function callAI(
  brainType: string,
  messages: any[],
  useTools: boolean,
  contextStr: string,
  host: string,
  protocol: string
): Promise<{ reply: string; toolsUsed: string[]; brain: string }> {
  const brain = BRAINS[brainType] || BRAINS.TRADE_BRAIN
  const toolsUsed: string[] = []

  // Add context to system message
  const systemMsg = messages[0]
  if (systemMsg?.role === 'system') {
    systemMsg.content = String(systemMsg.content || '') + contextStr
  }

  // Ensure all messages are properly formatted
  const sanitizedMessages = messages.map((m) => ({
    ...m,
    content: String(m.content || '').trim()
  }))

  console.log(`[${brain.name}] Starting with model: ${brain.model}`)

  for (const key of [GROQ_KEY, GROQ_KEY2].filter(Boolean)) {
    try {
      const reqBody: any = {
        model: brain.model,
        messages: sanitizedMessages,
        max_tokens: brain.maxTokens,
        temperature: brain.temperature
      }

      if (useTools) {
        reqBody.tools = TOOLS
        reqBody.tool_choice = 'auto'
      }

      console.log(`[${brain.name}] Calling Groq API...`)

      const r1 = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reqBody),
        signal: AbortSignal.timeout(30000)
      })

      console.log(`[${brain.name}] Response status: ${r1.status}`)

      if (r1.status === 429) {
        console.log(`[${brain.name}] Rate limited on ${brain.model}, trying fallback model...`)
        // Try fast fallback model with same key before switching keys
        try {
          const fallbackR = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: sanitizedMessages, max_tokens: 800, temperature: 0.7 }),
            signal: AbortSignal.timeout(25000)
          })
          if (fallbackR.ok) {
            const fb = await fallbackR.json() as any
            const fbReply = fb.choices?.[0]?.message?.content
            if (fbReply) {
              console.log(`[${brain.name}] Fallback model succeeded`)
              return { reply: fbReply, toolsUsed, brain: brain.name + ' (fast)' }
            }
          }
        } catch {}
        continue
      }

      if (!r1.ok) {
        const errorText = await r1.text()
        console.log(`[${brain.name}] API error: ${errorText}`)
        continue
      }

      const d1 = (await r1.json()) as any
      const msg1 = d1.choices?.[0]?.message

      if (!msg1) {
        console.log(`[${brain.name}] No message in response`)
        continue
      }

      console.log(`[${brain.name}] Got response successfully`)

      // Tool calls needed
      if (msg1.tool_calls?.length) {
        console.log(`[${brain.name}] Processing ${msg1.tool_calls.length} tool calls`)
        const toolMsgs = [...sanitizedMessages, msg1]
        const toolResults = await Promise.all(
          msg1.tool_calls.map(async (tc: any) => {
            const name = tc.function.name
            const args = JSON.parse(tc.function.arguments || '{}')
            toolsUsed.push(name)
            console.log(`[${brain.name}] Executing tool: ${name}`)
            return {
              role: 'tool',
              tool_call_id: tc.id,
              content: String(await executeTool(name, args, host, protocol))
            }
          })
        )

        // Second pass
        const secondPassMessages = [...toolMsgs, ...toolResults].map((m) => ({
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
            model: brain.model,
            messages: secondPassMessages,
            max_tokens: brain.maxTokens,
            temperature: brain.temperature
          }),
          signal: AbortSignal.timeout(28000)
        })

        if (r2.ok) {
          const d2 = (await r2.json()) as any
          const content = d2.choices?.[0]?.message?.content
          if (content) {
            try {
              const parsed = JSON.parse(content)
              console.log(`[${brain.name}] Success with tools`)
              return { reply: parsed.reply, thinking: parsed.thinking, toolsUsed, brain: brain.name }
            } catch {
              return { reply: content, thinking: '', toolsUsed, brain: brain.name }
            }
          }
        }
      }

      // Direct reply
      if (msg1.content) {
        console.log(`[${brain.name}] Success with direct reply`)
        try {
          const parsed = JSON.parse(msg1.content)
          return { reply: parsed.reply, thinking: parsed.thinking, toolsUsed, brain: brain.name }
        } catch {
          return { reply: msg1.content, thinking: '', toolsUsed, brain: brain.name }
        }
      }
    } catch (e) {
      console.error(`[${brain.name}] Error:`, e)
      continue
    }
  }

  console.log(`[${brain.name}] All attempts failed`)
  return {
    reply: `${brain.name} encountered an error. Please check your GROQ_API_KEY is set correctly.`,
    toolsUsed,
    brain: brain.name
  }
}

// ── Brain Selection Logic ─────────────────────────────────────────────────────
function selectBrain(message: string): string {
  const m = message.toLowerCase()

  // Math Brain for calculations
  if (m.includes('calculate') || m.includes('position size') || m.includes('risk') || m.includes('math')) {
    return 'MATH_BRAIN'
  }

  // Fast Brain for quick responses
  if (m.length < 50 || m.includes('hello') || m.includes('hi') || m.includes('status')) {
    return 'FAST_BRAIN'
  }

  // Trade Brain for analysis
  return 'TRADE_BRAIN'
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

  try {
    // Load session history
    let sessionHistory = session_id ? await loadSession(session_id) : []

    // Build page context with internet access
    const host = req.headers.host || 'cozycrypto-ai-trader.vercel.app'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const pageContext = await buildPageContext(session_id || 'default', host, protocol)
    const contextStr = formatContextForAI(pageContext)

    // Map session history
    const mappedHistory = sessionHistory
      .slice(-20)
      .map((m: any) => {
        const role = m.role === 'ai' ? 'assistant' : m.role === 'system' ? 'system' : 'user'
        return {
          role,
          content: String(m.content || '').trim()
        }
      })

    // Select appropriate brain
    const brainType = selectBrain(message)
    const useTools = needsTools(message)

    const SYSTEM = `You are COZANET — an elite autonomous AI trading copilot built by Cozanet.
You specialize in USDT-M Perpetual Futures trading on Bitget with 10x leverage.
You have real-time access to live market data, technical indicators, portfolio state, and order books.

Your trading methodology:
- Smart Money Concepts (SMC): Order Blocks, Fair Value Gaps, Break of Structure, Change of Character
- Multi-timeframe confluence (15m, 1H, 4H alignment required for high-confidence trades)
- Risk management: 10x leverage, SL at key structure, TP at next liquidity zone
- Always calculate: Entry, Stop Loss, Take Profit, Liquidation Price, R:R ratio
- Confidence gate: only recommend trades above 65% confidence

Response style:
- You MUST think deeply before responding.
- Your response MUST be a JSON object with two fields:
  1. "thinking": A detailed, step-by-step explanation of your logic, market analysis, and risk assessment.
  2. "reply": Your final concise, specific, and actionable response to the user.
- For trade signals in "reply", use this format: 🔥 SIGNAL: LONG/SHORT | Entry: $X | SL: $X | TP: $X | Liq: $X | R:R 1:X | Confidence: X%
- If asked about price, always fetch live data before responding${contextStr}`

    const messages = [
      { role: 'system', content: SYSTEM },
      ...mappedHistory,
      { role: 'user', content: String(message || '').trim() }
    ]

    // Call the selected brain
    const { reply, thinking, toolsUsed, brain } = await callAI(brainType, messages, useTools, contextStr, host, protocol)

    // Save updated session
    if (save && session_id) {
      const updatedHistory = [
        ...sessionHistory,
        { role: 'user', content: message, timestamp: Date.now() },
        { role: 'ai', content: reply, thinking, timestamp: Date.now() }
      ]

      const title =
        sessionHistory.length === 0 || (sessionHistory.length === 1 && sessionHistory[0].role === 'system')
          ? message.slice(0, 60)
          : undefined

      saveSession(session_id, updatedHistory, title).catch((e) => console.log('Save error:', e))
    }

    res.json({
      reply: reply || 'No response generated.',
      thinking: thinking || '',
      brain,
      tools_called: toolsUsed,
      session_id,
      history: save ? undefined : sessionHistory,
      timestamp: new Date().toISOString()
    })
  } catch (e) {
    console.error('Handler error:', e)
    res.status(500).json({
      error: 'Internal server error',
      message: String(e),
      timestamp: new Date().toISOString()
    })
  }
}
