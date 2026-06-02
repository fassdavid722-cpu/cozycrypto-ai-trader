import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

// ── Env ───────────────────────────────────────────────────────────────────────
const GROQ_KEY   = process.env.GROQ_API_KEY   || ''
const GH_TOKEN   = process.env.GITHUB_TOKEN    || ''
const GH_REPO    = process.env.GITHUB_REPO     || ''
const BASE       = 'https://api.bitget.com'
const API_KEY    = process.env.BITGET_API_KEY    || ''
const SECRET_KEY = process.env.BITGET_SECRET_KEY || ''
const PASSPHRASE = process.env.BITGET_PASSPHRASE || ''

// ── Auth helpers ───────────────────────────────────────────────────────────────
function sign(ts: string, method: string, path: string, body = '') {
  return crypto.createHmac('sha256', SECRET_KEY).update(ts + method + path + body).digest('base64')
}
function authHeaders(method: string, path: string, body = '') {
  const ts = Date.now().toString()
  return {
    'ACCESS-KEY': API_KEY, 'ACCESS-SIGN': sign(ts, method, path, body),
    'ACCESS-TIMESTAMP': ts, 'ACCESS-PASSPHRASE': PASSPHRASE,
    'Content-Type': 'application/json', 'locale': 'en-US',
  }
}
async function bitget(path: string) {
  try {
    const r = await fetch(BASE + path, { headers: authHeaders('GET', path) as any, signal: AbortSignal.timeout(10000) })
    if (!r.ok) return null
    return (await r.json() as any)?.data || null
  } catch { return null }
}
async function bitgetPost(path: string, body: object) {
  const str = JSON.stringify(body)
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { ...authHeaders('POST', path, str), 'Content-Type': 'application/json' } as any,
    body: str, signal: AbortSignal.timeout(12000)
  })
  return (await r.json() as any)
}

// ── GitHub memory ──────────────────────────────────────────────────────────────
async function ghRead(file: string): Promise<any> {
  if (!GH_TOKEN || !GH_REPO) return null
  try {
    const r = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${file}`,
      { headers: { Authorization: `Bearer ${GH_TOKEN}` } })
    if (!r.ok) return null
    const d = await r.json() as any
    return JSON.parse(Buffer.from(d.content, 'base64').toString())
  } catch { return null }
}
async function ghWrite(file: string, data: any, msg: string) {
  if (!GH_TOKEN || !GH_REPO) return
  try {
    const apiUrl = `https://api.github.com/repos/${GH_REPO}/contents/${file}`
    const check = await fetch(apiUrl, { headers: { Authorization: `Bearer ${GH_TOKEN}` } })
    const existing = check.ok ? await check.json() as any : null
    const body: any = { message: msg, content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64') }
    if (existing?.sha) body.sha = existing.sha
    await fetch(apiUrl, { method: 'PUT', headers: { Authorization: `Bearer ${GH_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {}
}

// ── Data fetchers (used by tools + system prompt) ────────────────────────────
async function getPortfolio() {
  const [spot, futures] = await Promise.all([
    bitget('/api/v2/spot/account/assets'),
    bitget('/api/v2/mix/account/accounts?productType=USDT-FUTURES')
  ])
  const spotAssets = (Array.isArray(spot) ? spot : [])
    .filter((a: any) => parseFloat(a.available || '0') + parseFloat(a.frozen || '0') > 0.000001)
    .map((a: any) => ({ coin: a.coinName, available: parseFloat(a.available || '0'), frozen: parseFloat(a.frozen || '0') }))
  const futAcc = Array.isArray(futures) ? futures[0] : futures
  return {
    spot: spotAssets,
    futures: futAcc ? { equity: parseFloat(futAcc.equity || '0'), unrealizedPL: parseFloat(futAcc.unrealizedPL || '0'), available: parseFloat(futAcc.available || '0') } : null,
    usdtBalance: spotAssets.find((a: any) => a.coin === 'USDT')?.available || 0
  }
}

async function getPositions() {
  const data = await bitget('/api/v2/mix/position/allPosition?productType=USDT-FUTURES&marginCoin=USDT')
  if (!Array.isArray(data)) return []
  return data.filter((p: any) => parseFloat(p.total || '0') > 0).map((p: any) => ({
    symbol: p.symbol, side: p.holdSide, size: parseFloat(p.total), entryPrice: parseFloat(p.openPriceAvg),
    markPrice: parseFloat(p.markPrice), pnl: parseFloat(p.unrealizedPL), leverage: p.leverage,
    liquidationPrice: parseFloat(p.liquidationPrice || '0')
  }))
}

async function getOrders() {
  const [spot, futures] = await Promise.all([
    bitget('/api/v2/spot/trade/unfilled-orders'),
    bitget('/api/v2/mix/order/orders-pending?productType=USDT-FUTURES')
  ])
  return {
    spot: Array.isArray(spot) ? spot.slice(0, 10).map((o: any) => ({ id: o.orderId, symbol: o.symbol, side: o.side, size: o.size, price: o.price, status: o.status })) : [],
    futures: Array.isArray(futures) ? futures.slice(0, 10).map((o: any) => ({ id: o.orderId, symbol: o.symbol, side: o.side, size: o.size, price: o.price, status: o.status })) : []
  }
}

async function getMarketTickers(symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT']) {
  const results = await Promise.all(symbols.map(async sym => {
    const d = await fetch(`${BASE}/api/v2/spot/market/tickers?symbol=${sym}`, { signal: AbortSignal.timeout(6000) })
      .then(r => r.json()).then((d: any) => d.data?.[0]).catch(() => null)
    return d ? { symbol: sym, price: parseFloat(d.lastPr), change24h: parseFloat(d.change24h || '0'), volume: parseFloat(d.baseVolume || '0') } : null
  }))
  return results.filter(Boolean)
}

async function getCandles(symbol: string, granularity = '1H', limit = 50) {
  const sym = symbol.replace('/', '').replace('-', '').toUpperCase() + (symbol.includes('USDT') ? '' : 'USDT')
  try {
    const r = await fetch(`${BASE}/api/v2/spot/market/candles?symbol=${sym}&granularity=${granularity}&limit=${limit}`, { signal: AbortSignal.timeout(8000) })
    const d = await r.json() as any
    return ((d.data || []) as string[][]).map(c => ({
      time: parseInt(c[0]), open: parseFloat(c[1]), high: parseFloat(c[2]),
      low: parseFloat(c[3]), close: parseFloat(c[4]), vol: parseFloat(c[5])
    })).reverse()
  } catch { return [] }
}

async function getWorkflows() {
  return await ghRead('goals/active_goals.json') || []
}

async function getInsights() {
  return await ghRead('logs/learned_insights.json') || { lessons: [], adjustments: {} }
}

async function getTradeHistory() {
  return await ghRead('logs/trade_history.json') || []
}

// ── Risk management ─────────────────────────────────────────────────────────
function calcPositionSize(balance: number, entryPrice: number, stopLoss: number, riskPct = 1): number {
  const riskAmount = balance * (riskPct / 100)
  const riskPerUnit = Math.abs(entryPrice - stopLoss)
  if (riskPerUnit === 0) return 0
  return Math.min(riskAmount / riskPerUnit, balance * 0.1 / entryPrice)
}

// ── Tool executor ──────────────────────────────────────────────────────────────
async function executeTool(name: string, args: any): Promise<string> {
  try {
    switch (name) {

      case 'get_portfolio':
        return JSON.stringify(await getPortfolio())

      case 'get_positions':
        return JSON.stringify(await getPositions())

      case 'get_orders':
        return JSON.stringify(await getOrders())

      case 'get_market_data':
        return JSON.stringify(await getMarketTickers(args.symbols || ['BTCUSDT','ETHUSDT','SOLUSDT']))

      case 'get_candles':
        const candles = await getCandles(args.symbol || 'BTCUSDT', args.granularity || '1H', args.limit || 50)
        return JSON.stringify({ symbol: args.symbol, granularity: args.granularity, candles: candles.slice(-20) })

      case 'get_workflows':
        return JSON.stringify(await getWorkflows())

      case 'get_insights':
        return JSON.stringify(await getInsights())

      case 'get_trade_history':
        return JSON.stringify(await getTradeHistory())

      case 'analyze_symbol': {
        const [candles1h, candles4h, tickers] = await Promise.all([
          getCandles(args.symbol, '1H', 100),
          getCandles(args.symbol, '4H', 50),
          getMarketTickers([args.symbol.replace('/', '').toUpperCase() + 'USDT'])
        ])
        const last = candles1h[candles1h.length - 1]
        const prev = candles1h.slice(-20)
        const highs = prev.map((c: any) => c.high)
        const lows  = prev.map((c: any) => c.low)
        return JSON.stringify({
          symbol: args.symbol,
          currentPrice: last?.close,
          ticker: tickers[0],
          recentHigh: Math.max(...highs),
          recentLow: Math.min(...lows),
          candles1h: candles1h.slice(-10),
          candles4h: candles4h.slice(-5)
        })
      }

      case 'place_trade': {
        if (!API_KEY) return JSON.stringify({ error: 'Bitget API not configured' })
        const { symbol, side, size, orderType = 'market', price, stopLoss, takeProfit } = args
        const sym = symbol.replace('/', '').toUpperCase() + (symbol.includes('USDT') ? '' : 'USDT')
        const body: any = { symbol: sym, side: side === 'buy' ? 'buy' : 'sell', orderType, size: String(size), force: 'gtc' }
        if (orderType === 'limit' && price) body.price = String(price)
        const result = await bitgetPost('/api/v2/spot/trade/place-order', body)
        // Save to trade history
        const history = await ghRead('logs/trade_history.json') || []
        const tradeRecord = { ...args, orderId: result?.data?.orderId, timestamp: Date.now(), result: result?.msg }
        await ghWrite('logs/trade_history.json', [...history, tradeRecord].slice(-100), '📈 trade executed')
        return JSON.stringify(result)
      }

      case 'cancel_order': {
        if (!API_KEY) return JSON.stringify({ error: 'Bitget API not configured' })
        const result = await bitgetPost('/api/v2/spot/trade/cancel-order', { orderId: args.orderId, symbol: args.symbol })
        return JSON.stringify(result)
      }

      case 'paper_trade': {
        const history = await ghRead('logs/trade_history.json') || []
        const paper = { ...args, type: 'paper', timestamp: Date.now() }
        await ghWrite('logs/trade_history.json', [...history, paper].slice(-100), '📄 paper trade')
        return JSON.stringify({ status: 'success', message: 'Paper trade recorded', trade: paper })
      }

      case 'record_insight': {
        const insights = await getInsights()
        const updated = {
          lessons: [...new Set([...(insights.lessons || []), args.lesson])].slice(-30),
          adjustments: { ...(insights.adjustments || {}), ...(args.adjustments || {}) }
        }
        await ghWrite('logs/learned_insights.json', updated, '🧠 insight saved')
        return JSON.stringify({ status: 'success', message: 'Insight stored' })
      }

      case 'set_goal': {
        const goals = await ghRead('goals/active_goals.json') || []
        const goal = { id: Date.now(), ...args, created: new Date().toISOString(), status: 'active' }
        await ghWrite('goals/active_goals.json', [...goals, goal], '🎯 goal set')
        return JSON.stringify({ status: 'success', goal })
      }

      case 'risk_calculator': {
        const { balance, entryPrice, stopLoss, riskPercent = 1 } = args
        const size = calcPositionSize(balance, entryPrice, stopLoss, riskPercent)
        const riskAmount = balance * (riskPercent / 100)
        const rr = args.takeProfit ? Math.abs(args.takeProfit - entryPrice) / Math.abs(entryPrice - stopLoss) : null
        return JSON.stringify({ recommendedSize: size.toFixed(6), riskAmount: riskAmount.toFixed(2), riskRewardRatio: rr?.toFixed(2) || 'N/A', riskPercent })
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
  } catch (e) {
    return JSON.stringify({ error: String(e) })
  }
}

// ── 15 Tools definition ───────────────────────────────────────────────────────
const TOOLS = [
  { type: 'function', function: { name: 'get_portfolio', description: 'Get live Bitget portfolio: spot assets, futures account, USDT balance.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_positions', description: 'Get all open futures positions with PnL, leverage, liquidation price.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_orders', description: 'Get all pending/unfilled spot and futures orders.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_market_data', description: 'Get live price tickers for multiple symbols.', parameters: { type: 'object', properties: { symbols: { type: 'array', items: { type: 'string' }, description: 'e.g. ["BTCUSDT","ETHUSDT"]' } } } } },
  { type: 'function', function: { name: 'get_candles', description: 'Get OHLCV candlestick data for technical analysis.', parameters: { type: 'object', properties: { symbol: { type: 'string' }, granularity: { type: 'string', enum: ['1min','5min','15min','30min','1H','4H','1D'] }, limit: { type: 'number' } }, required: ['symbol'] } } },
  { type: 'function', function: { name: 'get_workflows', description: 'Get all active AI workflows and trading goals.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_insights', description: 'Get AI learned lessons, insights and strategy adjustments.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_trade_history', description: 'Get past trade history including paper and live trades.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'analyze_symbol', description: 'Deep analysis of a trading symbol: price, candles, recent high/low, market structure.', parameters: { type: 'object', properties: { symbol: { type: 'string', description: 'e.g. BTCUSDT' } }, required: ['symbol'] } } },
  { type: 'function', function: { name: 'place_trade', description: 'Execute a LIVE trade on Bitget spot market. Use only when confident.', parameters: { type: 'object', properties: { symbol: { type: 'string' }, side: { type: 'string', enum: ['buy', 'sell'] }, size: { type: 'number', description: 'Quantity in base currency' }, orderType: { type: 'string', enum: ['market', 'limit'] }, price: { type: 'number', description: 'Required for limit orders' }, stopLoss: { type: 'number' }, takeProfit: { type: 'number' } }, required: ['symbol', 'side', 'size', 'orderType'] } } },
  { type: 'function', function: { name: 'cancel_order', description: 'Cancel a pending order on Bitget.', parameters: { type: 'object', properties: { orderId: { type: 'string' }, symbol: { type: 'string' } }, required: ['orderId', 'symbol'] } } },
  { type: 'function', function: { name: 'paper_trade', description: 'Record a paper/simulated trade for practice and backtesting.', parameters: { type: 'object', properties: { symbol: { type: 'string' }, side: { type: 'string', enum: ['long', 'short'] }, entry: { type: 'number' }, sl: { type: 'number' }, tp: { type: 'number' }, reason: { type: 'string' } }, required: ['symbol', 'side', 'entry', 'sl', 'tp', 'reason'] } } },
  { type: 'function', function: { name: 'record_insight', description: 'Store a new lesson or market insight into long-term memory.', parameters: { type: 'object', properties: { lesson: { type: 'string' }, adjustments: { type: 'object' } }, required: ['lesson'] } } },
  { type: 'function', function: { name: 'set_goal', description: 'Set a new trading goal or workflow objective.', parameters: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, targetPnl: { type: 'number' }, deadline: { type: 'string' } }, required: ['name', 'description'] } } },
  { type: 'function', function: { name: 'risk_calculator', description: 'Calculate optimal position size based on risk parameters.', parameters: { type: 'object', properties: { balance: { type: 'number' }, entryPrice: { type: 'number' }, stopLoss: { type: 'number' }, takeProfit: { type: 'number' }, riskPercent: { type: 'number', description: 'Default 1%' } }, required: ['balance', 'entryPrice', 'stopLoss'] } } },
]

// ── AI call with tool loop ────────────────────────────────────────────────────
async function callAI(messages: any[]): Promise<string> {
  let msgs = [...messages]
  
  for (let round = 0; round < 4; round++) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: msgs, temperature: 0.6, max_tokens: 2000, tools: TOOLS, tool_choice: 'auto' })
    })
    const data = await res.json() as any
    const msg = data.choices?.[0]?.message
    if (!msg) return 'AI response error'

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return msg.content || ''
    }

    // Execute all tool calls in parallel
    msgs.push(msg)
    const toolResults = await Promise.all(msg.tool_calls.map(async (tc: any) => {
      let args: any = {}
      try { args = JSON.parse(tc.function.arguments) } catch {}
      const result = await executeTool(tc.function.name, args)
      return { role: 'tool', tool_call_id: tc.id, content: result }
    }))
    msgs.push(...toolResults)
  }
  
  // Final pass without tools to get clean response
  const finalRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: msgs, temperature: 0.6, max_tokens: 2000 })
  })
  const fd = await finalRes.json() as any
  return fd.choices?.[0]?.message?.content || ''
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { message, history = [] } = req.body
  if (!message) return res.status(400).json({ error: 'message required' })

  try {
    // Load context in parallel
    const [insights, portfolio, market] = await Promise.all([
      getInsights(),
      getPortfolio(),
      getMarketTickers()
    ])

    const SYSTEM = `You are COZANET — a High-IQ Autonomous AI Lead Trader with direct access to the entire trading dashboard.

You can see and control EVERY section of the platform:
- 📊 Dashboard: portfolio overview, P&L, AI health, price predictions
- 💼 Portfolio: spot assets, futures account, allocation breakdown  
- 📈 Positions: open futures positions, unrealized PnL, leverage
- 📋 Orders: pending spot/futures orders, order history
- 🌐 Market: real-time tickers, charts, 50+ trading pairs
- 🤖 Workflows: active AI trading goals and automation tasks
- 💬 AI Chat: (you are here)
- ⚙️ Settings: API config, trade parameters, risk limits

PHILOSOPHY:
- "Risk is the only way to learn." Bold, calculated, always learning.
- A missed opportunity is worse than a loss that teaches something.
- Every action is logged and reflected upon.

YOUR CURRENT CONTEXT:
- Portfolio: ${JSON.stringify(portfolio)}
- Market: ${JSON.stringify(market)}
- Learned Lessons: ${JSON.stringify(insights.lessons?.slice(-5))}

TOOLS AVAILABLE (use them proactively):
You have 15 tools: get_portfolio, get_positions, get_orders, get_market_data, get_candles,
get_workflows, get_insights, get_trade_history, analyze_symbol, place_trade, cancel_order,
paper_trade, record_insight, set_goal, risk_calculator.

RESPONSE FORMAT (always valid JSON):
{
  "thinking": "Your step-by-step SMC analysis and reasoning.",
  "reply": "Your natural, conversational response to the user."
}`

    const mappedHistory = (history as any[]).slice(-12).map((m: any) => ({
      role: m.role === 'ai' ? 'assistant' : m.role,
      content: m.content
    }))

    const aiResponse = await callAI([
      { role: 'system', content: SYSTEM },
      ...mappedHistory,
      { role: 'user', content: message }
    ])

    try {
      const parsed = JSON.parse(aiResponse)
      return res.json({ ...parsed, timestamp: Date.now() })
    } catch {
      return res.json({ thinking: 'Processing...', reply: aiResponse, timestamp: Date.now() })
    }
  } catch (e: any) {
    console.error('Chat error:', e)
    return res.status(500).json({ error: String(e) })
  }
}
