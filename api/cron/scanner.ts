import type { VercelRequest, VercelResponse } from '@vercel/node'

// --- CONFIG ---
const WATCH_PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT']
const MIN_CONF = 75
const GH_TOKEN = process.env.GITHUB_TOKEN || ''
const GH_REPO = process.env.GITHUB_REPO || ''
const BASE_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'

// --- HELPERS ---
async function ghLoad(path: string) {
  if (!GH_TOKEN || !GH_REPO) return null
  try {
    const r = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${path}`, {
      headers: { Authorization: `Bearer ${GH_TOKEN}` },
      signal: AbortSignal.timeout(8000)
    })
    if (!r.ok) return null
    const d = await r.json() as any
    return JSON.parse(Buffer.from(d.content, 'base64').toString())
  } catch { return null }
}

async function ghSave(path: string, data: any, msg: string) {
  if (!GH_TOKEN || !GH_REPO) return
  try {
    const url = `https://api.github.com/repos/${GH_REPO}/contents/${path}`
    const r = await fetch(url, { headers: { Authorization: `Bearer ${GH_TOKEN}` } })
    const sha = r.ok ? (await r.json() as any).sha : null
    await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${GH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'), sha })
    })
  } catch (e) { console.error('ghSave error:', e) }
}

async function agentCall(agent: string, body: any) {
  try {
    const r = await fetch(`${BASE_URL}/api/agents/${agent}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000)
    })
    if (!r.ok) return null
    return await r.json()
  } catch (e) {
    console.error(`Agent ${agent} call failed:`, e)
    return null
  }
}

async function getMarketData(symbol: string) {
  try {
    const r = await fetch(`${BASE_URL}/api/analyze?symbol=${symbol}`)
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

async function getBalance() {
  try {
    const r = await fetch(`${BASE_URL}/api/portfolio`)
    if (!r.ok) return 0
    const d = await r.json()
    return parseFloat(d.totalUsdt || '0')
  } catch { return 0 }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('🤖 Full Spectrum Autonomous Heartbeat Started...')
  const startTime = Date.now()
  const balance = await getBalance()
  
  const [savedLogs, insights, activeTrades] = await Promise.all([
    ghLoad('logs/system_logs.json').then(d => Array.isArray(d) ? d : []),
    ghLoad('logs/learned_insights.json').then(d => d || { lessons: [], detailed_reasoning: [] }),
    ghLoad('logs/active_trades.json').then(d => Array.isArray(d) ? d : [])
  ])

  const logs: any[] = [...savedLogs]
  const results: any[] = []
  let tradesExecuted = 0
  const remainingTrades: any[] = []

  // 1. FEEDBACK LOOP
  for (const trade of activeTrades) {
    const market = await getMarketData(trade.symbol)
    if (market) {
      const evaluation = await agentCall('evaluator', { trade, currentPrice: market.price, marketContext: market })
      if (evaluation) {
        if (evaluation.hard_lesson) insights.lessons.push(`[HARD LESSON] ${evaluation.hard_lesson}`)
        logs.push({ t: new Date().toISOString(), msg: `EVALUATED ${trade.symbol}: ${evaluation.analysis}` })
      }
    }
  }

  // 2. MAIN SCANNING LOOP
  for (const symbol of WATCH_PAIRS) {
    try {
      const market = await getMarketData(symbol)
      if (!market) continue

      const technical = await agentCall('technical', { symbol, marketData: market })
      const sentiment = await agentCall('sentiment', { symbol, fearGreed: market.fearGreed, news: [] })
      const onchain = await agentCall('onchain', { symbol, onChainData: { whales: [], flows: [], smartMoney: [] } })
      const risk = await agentCall('risk', { symbol, technical, sentiment, onchain, portfolio: { balance }, marketData: market })
      const decision = await agentCall('orchestrator', { symbol, technical, sentiment, onchain, risk })

      if (decision && decision.action !== 'wait' && decision.confidence >= MIN_CONF && balance >= 10) {
        tradesExecuted++
        const newTrade = { symbol, action: decision.action, entry: market.price, t: new Date().toISOString(), reasoning: decision.thinking }
        remainingTrades.push(newTrade)
        logs.push({ t: new Date().toISOString(), msg: `COLLABORATIVE ${decision.action.toUpperCase()} ${symbol} @ ${market.price} (Conf: ${decision.confidence}%)` })
      } else {
        logs.push({ t: new Date().toISOString(), msg: `${symbol}: Waiting (Conf: ${decision?.confidence || 0}%)` })
      }

      results.push({ symbol, technical, sentiment, onchain, risk, decision })
      
      if (decision && decision.thinking) {
        insights.detailed_reasoning.push({
          symbol,
          thinking: decision.thinking,
          t: new Date().toISOString(),
          agents: { technical: technical?.reasoning, sentiment: sentiment?.reasoning, onchain: onchain?.reasoning, risk: risk?.reasoning }
        })
      }
      if (decision && decision.new_lesson) insights.lessons.push(decision.new_lesson)

    } catch (e) {
      console.error(`Error in multi-agent flow for ${symbol}:`, e)
    }
  }

  // 3. HEALTH MONITORING
  const health = await agentCall('health', { status: { balance, scanned: results.length }, logs: logs.slice(-5), config: { MIN_CONF } })
  if (health) {
    logs.push({ t: new Date().toISOString(), msg: `HEALTH: ${health.status_report}` })
  }

  // Cleanup and Save
  insights.detailed_reasoning = insights.detailed_reasoning.slice(-20)
  insights.lessons = insights.lessons.slice(-100)
  insights.lastUpdated = new Date().toISOString()

  await Promise.all([
    ghSave('logs/learned_insights.json', insights, '🧠 Full spectrum learning update'),
    ghSave('logs/system_logs.json', logs.slice(-100), `📜 heartbeat — ${tradesExecuted} trades`),
    ghSave('logs/active_trades.json', remainingTrades, '💼 Active trades update')
  ])

  res.status(200).json({ scanned: results.length, tradesExecuted, duration: (Date.now() - startTime)/1000, health: health?.status_report })
}
