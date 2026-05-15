import type { VercelRequest, VercelResponse } from '@vercel/node'

const GROQ_KEY  = process.env.GROQ_API_KEY  || ''
const GROQ_KEY2 = process.env.GROQ_API_KEY_2 || ''
const BITGET    = 'https://api.bitget.com'

async function getCandles(symbol: string, granularity: string, limit = 100): Promise<number[][]> {
  try {
    const sym = symbol.replace('/', '').toUpperCase()
    const url = `${BITGET}/api/v2/spot/market/candles?symbol=${sym}&granularity=${granularity}&limit=${limit}`
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return []
    const d = await r.json() as any
    return (d.data || []).map((c: string[]) => [
      parseInt(c[0]), parseFloat(c[1]), parseFloat(c[2]),
      parseFloat(c[3]), parseFloat(c[4]), parseFloat(c[5])
    ])
  } catch { return [] }
}

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gains += diff
    else losses += Math.abs(diff)
  }
  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2))
}

function calcEMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] || 0
  const k = 2 / (period + 1)
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k)
  return parseFloat(ema.toFixed(6))
}

function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = calcEMA(closes, 12)
  const ema26 = calcEMA(closes, 26)
  const macd  = ema12 - ema26
  // Simplified signal line
  const signal = macd * 0.85
  return { macd: parseFloat(macd.toFixed(6)), signal: parseFloat(signal.toFixed(6)), histogram: parseFloat((macd - signal).toFixed(6)) }
}

function detectTrend(closes: number[]): string {
  if (closes.length < 20) return 'neutral'
  const recent = closes.slice(-5)
  const older  = closes.slice(-20, -5)
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
  const olderAvg  = older.reduce((a, b) => a + b, 0) / older.length
  const pct = ((recentAvg - olderAvg) / olderAvg) * 100
  if (pct > 1.5) return 'strong_uptrend'
  if (pct > 0.3) return 'uptrend'
  if (pct < -1.5) return 'strong_downtrend'
  if (pct < -0.3) return 'downtrend'
  return 'sideways'
}

async function callGroq(model: string, key: string, prompt: string): Promise<string> {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are an elite crypto technical analyst specializing in SMC (Smart Money Concepts). Be concise, data-driven, and actionable.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 800,
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(20000),
  })
  if (!r.ok) throw new Error(`Groq ${r.status}`)
  const d = await r.json() as any
  return d.choices?.[0]?.message?.content || ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { symbol = 'BTCUSDT', timeframes = ['1h', '4h', '1D'] } = req.body || {}
  const sym = symbol.replace('/', '').toUpperCase()

  // Fetch candles for multiple timeframes in parallel
  const tfMap: Record<string, string> = { '1m': '1min', '5m': '5min', '15m': '15min', '1h': '1H', '4h': '4H', '1D': '1D' }
  const candlePromises = timeframes.map((tf: string) => getCandles(sym, tfMap[tf] || tf))
  const allCandles = await Promise.all(candlePromises)

  const analysis: Record<string, any> = {}
  let overallBias = 0
  let tfCount = 0

  for (let i = 0; i < timeframes.length; i++) {
    const tf = timeframes[i]
    const candles = allCandles[i]
    if (!candles.length) continue

    const closes = candles.map(c => c[4])
    const highs  = candles.map(c => c[2])
    const lows   = candles.map(c => c[3])
    const volumes = candles.map(c => c[5])

    const rsi    = calcRSI(closes)
    const macd   = calcMACD(closes)
    const ema20  = calcEMA(closes, 20)
    const ema50  = calcEMA(closes, 50)
    const trend  = detectTrend(closes)
    const price  = closes[closes.length - 1]
    const support = Math.min(...lows.slice(-20))
    const resistance = Math.max(...highs.slice(-20))
    const avgVol = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10
    const lastVol = volumes[volumes.length - 1]

    // SMC: simple BOS detection
    const recentHighs = highs.slice(-10)
    const prevHigh = Math.max(...highs.slice(-20, -10))
    const bos = recentHighs.some(h => h > prevHigh) ? 'bullish_BOS' : null
    const choch = lows.slice(-5).some(l => l < Math.min(...lows.slice(-20, -5))) ? 'bearish_CHoCH' : null

    // Bias score: +1 bullish, -1 bearish
    let bias = 0
    if (trend.includes('up')) bias += 1
    if (trend.includes('down')) bias -= 1
    if (rsi < 35) bias += 1
    if (rsi > 65) bias -= 1
    if (ema20 > ema50) bias += 0.5
    else bias -= 0.5
    if (macd.histogram > 0) bias += 0.5
    else bias -= 0.5

    overallBias += bias
    tfCount++

    analysis[tf] = { rsi, macd, ema20, ema50, trend, price, support: parseFloat(support.toFixed(6)), resistance: parseFloat(resistance.toFixed(6)), volumeSpike: lastVol > avgVol * 1.5, smc: { bos, choch }, bias: bias > 0 ? 'bullish' : bias < 0 ? 'bearish' : 'neutral' }
  }

  const confluenceBias = tfCount > 0 ? overallBias / tfCount : 0
  const overallDirection = confluenceBias > 0.5 ? 'BUY' : confluenceBias < -0.5 ? 'SELL' : 'WAIT'
  const confidence = Math.min(95, Math.round(Math.abs(confluenceBias) * 40 + 50))

  // AI reasoning if GROQ available
  let aiReasoning = ''
  if (GROQ_KEY) {
    const summary = Object.entries(analysis).map(([tf, d]) => `${tf}: RSI=${d.rsi} trend=${d.trend} bias=${d.bias}`).join(' | ')
    try {
      aiReasoning = await callGroq('llama-3.3-70b-versatile', GROQ_KEY,
        `Analyze ${sym}. Data: ${summary}. Overall bias: ${overallDirection} (${confidence}% confidence). Provide 3-sentence SMC analysis and entry recommendation.`)
    } catch { aiReasoning = `${sym} analysis complete. ${overallDirection} bias across ${tfCount} timeframes.` }
  }

  return res.status(200).json({
    symbol: sym,
    direction: overallDirection,
    confidence,
    analysis,
    aiReasoning,
    entry: analysis['1h']?.price || 0,
    stopLoss: overallDirection === 'BUY' ? analysis['1h']?.support : analysis['1h']?.resistance,
    takeProfit: overallDirection === 'BUY' ? analysis['1h']?.resistance : analysis['1h']?.support,
    timestamp: Date.now(),
  })
}
