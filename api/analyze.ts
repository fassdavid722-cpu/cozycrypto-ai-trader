import type { VercelRequest, VercelResponse } from '@vercel/node'

const GROQ_KEY  = process.env.GROQ_API_KEY  || ''
const GROQ_KEY2 = process.env.GROQ_API_KEY_2 || ''
const BITGET    = 'https://api.bitget.com'

const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768']

async function getCandles(symbol: string, granularity: string, limit = 100) {
  try {
    const sym = symbol.replace('/', '').toUpperCase()
    const url = `${BITGET}/api/v2/spot/market/candles?symbol=${sym}&granularity=${granularity}&limit=${limit}`
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return []
    const d = await r.json() as any
    return ((d.data || []) as string[][]).map(c => ({
      time: parseInt(c[0]), open: parseFloat(c[1]),
      high: parseFloat(c[2]), low: parseFloat(c[3]),
      close: parseFloat(c[4]), vol: parseFloat(c[5])
    })).reverse()
  } catch { return [] }
}

async function getTicker(symbol: string) {
  try {
    const sym = symbol.replace('/', '').toUpperCase()
    const r = await fetch(`${BITGET}/api/v2/spot/market/tickers?symbol=${sym}`, { signal: AbortSignal.timeout(6000) })
    if (!r.ok) return null
    const d = await r.json() as any
    const t = d.data?.[0]
    if (!t) return null
    return {
      price: parseFloat(t.lastPr || '0'),
      change24h: parseFloat(t.changeUtc24h || '0'),
      high24h: parseFloat(t.high24h || '0'),
      low24h: parseFloat(t.low24h || '0'),
      volume24h: parseFloat(t.quoteVolume || '0'),
    }
  } catch { return null }
}

async function getFearGreed() {
  try {
    const r = await fetch('https://api.alternative.me/fng/?limit=1', { signal: AbortSignal.timeout(5000) })
    if (!r.ok) return { value: 50, label: 'Neutral' }
    const d = await r.json() as any
    return { value: parseInt(d.data?.[0]?.value || '50'), label: d.data?.[0]?.value_classification || 'Neutral' }
  } catch { return { value: 50, label: 'Neutral' } }
}

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) gains += d; else losses += Math.abs(d)
  }
  const avgG = gains / period, avgL = losses / period
  return parseFloat((100 - 100 / (1 + avgG / (avgL || 0.001))).toFixed(2))
}

function calcEMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] || 0
  const k = 2 / (period + 1)
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k)
  return parseFloat(ema.toFixed(6))
}

function calcMACD(closes: number[]) {
  // Build EMA12 and EMA26 series for proper signal line
  const k12 = 2 / 13, k26 = 2 / 27, k9 = 2 / 10
  let ema12 = closes.slice(0, 12).reduce((a,b)=>a+b,0)/12
  let ema26 = closes.slice(0, 26).reduce((a,b)=>a+b,0)/26
  const macdLine: number[] = []
  for (let i = Math.max(12,26); i < closes.length; i++) {
    ema12 = closes[i]*k12 + ema12*(1-k12)
    ema26 = closes[i]*k26 + ema26*(1-k26)
    macdLine.push(ema12-ema26)
  }
  let signal = macdLine.slice(0,9).reduce((a,b)=>a+b,0)/Math.min(9,macdLine.length)
  for (let i = 9; i < macdLine.length; i++) signal = macdLine[i]*k9 + signal*(1-k9)
  const macd = macdLine[macdLine.length-1] || 0
  return { macd: parseFloat(macd.toFixed(6)), signal: parseFloat(signal.toFixed(6)), histogram: parseFloat((macd-signal).toFixed(6)) }
}

function calcATR(candles: any[], p = 14) {
  if (candles.length < 2) return 0
  const trs = candles.slice(1).map((c: any, i: number) => {
    const prev = candles[i]
    return Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close))
  })
  return parseFloat((trs.slice(-p).reduce((a:number,b:number)=>a+b,0) / Math.min(p,trs.length)).toFixed(6))
}

function calcBB(closes: number[], p = 20) {
  const sl = closes.slice(-p)
  const m = sl.reduce((a,b)=>a+b,0)/sl.length
  const std = Math.sqrt(sl.reduce((s,x)=>s+Math.pow(x-m,2),0)/sl.length)
  return { upper: parseFloat((m+2*std).toFixed(2)), middle: parseFloat(m.toFixed(2)), lower: parseFloat((m-2*std).toFixed(2)) }
}

function detectOBs(candles: any[]) {
  const obs: string[] = []
  for (let i = 2; i < candles.length-1; i++) {
    const c = candles[i], n = candles[i+1]
    if (c.close < c.open && n.close > c.high) obs.push(`Bullish OB @ $${((c.high+c.low)/2).toFixed(2)}`)
    if (c.close > c.open && n.close < c.low)  obs.push(`Bearish OB @ $${((c.high+c.low)/2).toFixed(2)}`)
  }
  return obs.slice(-3)
}

function detectFVGs(candles: any[]) {
  const fvgs: string[] = []
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].low > candles[i-1].high) fvgs.push(`Bullish FVG $${candles[i-1].high.toFixed(2)}-$${candles[i].low.toFixed(2)}`)
    if (candles[i].high < candles[i-1].low)  fvgs.push(`Bearish FVG $${candles[i].high.toFixed(2)}-$${candles[i-1].low.toFixed(2)}`)
  }
  return fvgs.slice(-3)
}

async function callGroq(prompt: string, maxTokens = 800): Promise<string> {
  const keys = [GROQ_KEY, GROQ_KEY2].filter(Boolean)
  for (const key of keys) {
    for (const model of GROQ_MODELS) {
      try {
        const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: 'You are an elite crypto analyst. Respond with valid JSON only.' },
              { role: 'user', content: prompt }
            ],
            max_tokens: maxTokens,
            temperature: 0.3
          }),
          signal: AbortSignal.timeout(20000)
        })
        if (!r.ok) continue
        const d = await r.json() as any
        const txt = d.choices?.[0]?.message?.content || ''
        if (txt) return txt
      } catch { continue }
    }
  }
  return ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { symbol = 'BTCUSDT', timeframe = '1h' } = req.body || {}
  const sym = symbol.replace('/', '').toUpperCase()

  // Map timeframe to Bitget granularity
  const granMap: Record<string,string> = { '1m':'1min','5m':'5min','15m':'15min','30m':'30min','1h':'1H','4h':'4H','1d':'1D' }
  const gran = granMap[timeframe] || '1H'

  // Fetch all data in parallel
  const [candles15m, candles1h, candles4h, ticker, fearGreed] = await Promise.all([
    getCandles(sym, '15min', 80),
    getCandles(sym, '1H', 80),
    getCandles(sym, '4H', 60),
    getTicker(sym),
    getFearGreed(),
  ])

  if (!ticker) return res.status(502).json({ error: `Cannot fetch ticker for ${sym}` })

  const closes1h = candles1h.map((c:any) => c.close)
  const closes4h = candles4h.map((c:any) => c.close)
  const closes15m = candles15m.map((c:any) => c.close)

  const indicators = {
    '15m': { rsi: calcRSI(closes15m), ema20: calcEMA(closes15m,20), ema50: calcEMA(closes15m,50), atr: calcATR(candles15m), macd: calcMACD(closes15m), bb: calcBB(closes15m) },
    '1h':  { rsi: calcRSI(closes1h),  ema20: calcEMA(closes1h,20),  ema50: calcEMA(closes1h,50),  atr: calcATR(candles1h),  macd: calcMACD(closes1h),  bb: calcBB(closes1h) },
    '4h':  { rsi: calcRSI(closes4h),  ema20: calcEMA(closes4h,20),  ema50: calcEMA(closes4h,50),  atr: calcATR(candles4h),  macd: calcMACD(closes4h),  bb: calcBB(closes4h) },
  }

  const obs  = detectOBs(candles1h)
  const fvgs = detectFVGs(candles1h)

  const prompt = `Analyze ${sym} using the following LIVE data. Respond with JSON only.

PRICE: $${ticker.price} | 24h: ${ticker.change24h >= 0 ? '+' : ''}${ticker.change24h}%
Fear & Greed: ${fearGreed.value}/100 (${fearGreed.label})

INDICATORS:
15m → RSI: ${indicators['15m'].rsi} | EMA20: ${indicators['15m'].ema20} | EMA50: ${indicators['15m'].ema50} | ATR: ${indicators['15m'].atr}
     MACD: ${indicators['15m'].macd.macd} / Signal: ${indicators['15m'].macd.signal} (hist: ${indicators['15m'].macd.histogram})
1H  → RSI: ${indicators['1h'].rsi} | EMA20: ${indicators['1h'].ema20} | EMA50: ${indicators['1h'].ema50} | ATR: ${indicators['1h'].atr}
     MACD: ${indicators['1h'].macd.macd} / Signal: ${indicators['1h'].macd.signal} (hist: ${indicators['1h'].macd.histogram})
     BB: Upper ${indicators['1h'].bb.upper} | Mid ${indicators['1h'].bb.middle} | Lower ${indicators['1h'].bb.lower}
4H  → RSI: ${indicators['4h'].rsi} | EMA20: ${indicators['4h'].ema20} | EMA50: ${indicators['4h'].ema50}
     MACD: ${indicators['4h'].macd.macd} / Signal: ${indicators['4h'].macd.signal} (hist: ${indicators['4h'].macd.histogram})

SMC: Order Blocks: ${obs.join(', ') || 'none detected'} | FVGs: ${fvgs.join(', ') || 'none detected'}

Respond with this exact JSON:
{
  "bias": "bullish|bearish|neutral",
  "confidence": 0-100,
  "direction": "LONG|SHORT|WAIT",
  "entry": ${ticker.price},
  "stopLoss": 0,
  "takeProfit": 0,
  "leverage": 10,
  "liquidationPrice": 0,
  "rr": "1:X",
  "summary": "2-3 sentence analysis",
  "keyLevels": { "support": 0, "resistance": 0 },
  "patterns": ["list"],
  "timeframe": "${timeframe}"
}`

  const raw = await callGroq(prompt, 600)
  let analysis: any = {}
  try {
    analysis = JSON.parse(raw.replace(/```json?/g,'').replace(/```/g,'').trim())
  } catch {
    // Fallback: build from indicators
    const rsi1h = indicators['1h'].rsi
    const bias = rsi1h > 55 ? 'bullish' : rsi1h < 45 ? 'bearish' : 'neutral'
    const dir = bias === 'bullish' ? 'LONG' : bias === 'bearish' ? 'SHORT' : 'WAIT'
    const sl = dir === 'LONG' ? ticker.price * 0.97 : ticker.price * 1.03
    const tp = dir === 'LONG' ? ticker.price * 1.06 : ticker.price * 0.94
    analysis = { bias, confidence: 55, direction: dir, entry: ticker.price, stopLoss: sl, takeProfit: tp, leverage: 10, liquidationPrice: dir==='LONG'?ticker.price*0.91:ticker.price*1.09, rr:'1:2', summary: `RSI ${rsi1h} on 1H. Fear & Greed: ${fearGreed.value} (${fearGreed.label}).`, keyLevels:{support:ticker.price*0.97,resistance:ticker.price*1.03}, patterns:[], timeframe }
  }

  // Ensure liquidation price is calculated
  if (!analysis.liquidationPrice && analysis.entry) {
    const lev = analysis.leverage || 10
    analysis.liquidationPrice = analysis.direction === 'LONG'
      ? parseFloat((analysis.entry * (1 - 1/lev * 0.9)).toFixed(2))
      : parseFloat((analysis.entry * (1 + 1/lev * 0.9)).toFixed(2))
  }

  res.json({
    symbol: sym,
    timeframe,
    price: ticker.price,
    fearGreed,
    indicators,
    orderBlocks: obs,
    fairValueGaps: fvgs,
    // Normalised keys — both camelCase and old style
    bias: analysis.bias,
    direction: analysis.direction,
    confidence: analysis.confidence,
    entry: analysis.entry,
    stopLoss: analysis.stopLoss,
    takeProfit: analysis.takeProfit,
    leverage: analysis.leverage || 10,
    liquidationPrice: analysis.liquidationPrice,
    rr: analysis.rr,
    summary: analysis.summary,
    keyLevels: analysis.keyLevels,
    patterns: analysis.patterns || [],
    analysis: analysis.summary,   // backwards compat
    signal: analysis.direction,   // backwards compat
    timestamp: new Date().toISOString()
  })
}
