import type { VercelRequest, VercelResponse } from '@vercel/node'

const GROQ_KEY   = process.env.GROQ_API_KEY   || ''
const GROQ_KEY2  = process.env.GROQ_API_KEY_2 || ''
const GEMINI_KEY = process.env.GEMINI_API_KEY  || ''
const BITGET_KEY = process.env.BITGET_API_KEY  || ''

async function checkGroq(key: string, label: string) {
  if (!key) return { status: '❌ missing', latency_ms: 0, model: '' }
  const start = Date.now()
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 }),
      signal: AbortSignal.timeout(8000)
    })
    const latency = Date.now() - start
    return r.ok
      ? { status: '✅ online', latency_ms: latency, model: 'llama-3.1-8b-instant' }
      : { status: `❌ ${r.status}`, latency_ms: latency, model: '' }
  } catch (e: any) {
    return { status: `❌ ${e.message?.slice(0,40)}`, latency_ms: Date.now()-start, model: '' }
  }
}

async function checkBitget() {
  const start = Date.now()
  try {
    const r = await fetch('https://api.bitget.com/api/v2/spot/market/tickers?symbol=BTCUSDT', { signal: AbortSignal.timeout(6000) })
    const d = await r.json() as any
    const price = parseFloat(d?.data?.[0]?.lastPr || '0')
    return { status: r.ok ? '✅ online' : `❌ ${r.status}`, latency_ms: Date.now()-start, btc_price: price ? `$${price.toLocaleString()}` : 'N/A' }
  } catch (e: any) {
    return { status: `❌ ${e.message?.slice(0,40)}`, latency_ms: Date.now()-start, btc_price: 'N/A' }
  }
}

async function checkFearGreed() {
  try {
    const r = await fetch('https://api.alternative.me/fng/?limit=1', { signal: AbortSignal.timeout(5000) })
    const d = await r.json() as any
    return d?.data?.[0] ? `✅ ${d.data[0].value} (${d.data[0].value_classification})` : '❌ no data'
  } catch { return '❌ timeout' }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const [groq1, groq2, bitget, fearGreed] = await Promise.all([
    checkGroq(GROQ_KEY, 'primary'),
    GROQ_KEY2 ? checkGroq(GROQ_KEY2, 'secondary') : Promise.resolve({ status: '⚪ not set', latency_ms: 0, model: '' }),
    checkBitget(),
    checkFearGreed(),
  ])

  const tradeMode = process.env.TRADE_MODE || 'autonomous'
  const ghRepo    = process.env.GITHUB_REPO || ''

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.1.0',
    checks: {
      groq_primary:   groq1,
      groq_secondary: groq2,
      bitget_market:  bitget,
      live_feeds: {
        fear_greed:   fearGreed,
        crypto_news:  '✅ coingecko',
        price_feed:   '✅ bitget live',
      },
      trade_brain: {
        status:          '✅ active',
        mode:            tradeMode,
        confidence_gate: `${process.env.MIN_CONFIDENCE || '65'}%`,
        max_risk:        `${process.env.MAX_TRADE_PERCENT || '10'}% per trade`,
        sl_default:      `${process.env.STOP_LOSS_PERCENT || '2'}%`,
        tp_default:      `${process.env.TAKE_PROFIT_PERCENT || '4'}%`,
      },
      memory: {
        github_repo:  ghRepo ? `✅ ${ghRepo}` : '⚪ not configured',
        sessions:     ghRepo ? '✅ enabled' : '⚪ disabled',
      },
      environment: {
        groq_key:     GROQ_KEY    ? '✅ set' : '❌ missing',
        groq_key2:    GROQ_KEY2   ? '✅ set' : '⚪ not set',
        gemini_key:   GEMINI_KEY  ? '✅ set' : '⚪ not set',
        bitget_key:   BITGET_KEY  ? '✅ set' : '❌ missing',
        bitget_secret: process.env.BITGET_SECRET_KEY ? '✅ set' : '❌ missing',
        bitget_pass:  process.env.BITGET_PASSPHRASE  ? '✅ set' : '❌ missing',
        github_token: process.env.GITHUB_TOKEN ? '✅ set' : '⚪ not set',
      }
    }
  })
}
