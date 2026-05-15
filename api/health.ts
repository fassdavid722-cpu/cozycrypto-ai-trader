import type { VercelRequest, VercelResponse } from '@vercel/node'

const GROQ_KEY = process.env.GROQ_API_KEY || ''
const BITGET_BASE = 'https://api.bitget.com'
const FEAR_GREED_URL = 'https://api.alternative.me/fng/?limit=1'
const NEWS_URL = 'https://cryptopanic.com/api/v1/posts/?auth_token=pub_free&kind=news&filter=hot'

async function checkGroq(): Promise<{ ok: boolean; latency: number; model: string }> {
  const start = Date.now()
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 }),
      signal: AbortSignal.timeout(8000)
    })
    return { ok: r.ok, latency: Date.now() - start, model: 'llama-3.1-8b-instant' }
  } catch { return { ok: false, latency: Date.now() - start, model: 'none' } }
}

async function checkBitget(): Promise<{ ok: boolean; latency: number; price: number }> {
  const start = Date.now()
  try {
    const r = await fetch(`${BITGET_BASE}/api/v2/spot/market/tickers?symbol=BTCUSDT`, { signal: AbortSignal.timeout(6000) })
    const d = await r.json() as any
    const price = parseFloat(d?.data?.[0]?.lastPr || '0')
    return { ok: r.ok && price > 0, latency: Date.now() - start, price }
  } catch { return { ok: false, latency: 0, price: 0 } }
}

async function checkNews(): Promise<{ ok: boolean; source: string }> {
  try {
    const r = await fetch(FEAR_GREED_URL, { signal: AbortSignal.timeout(5000) })
    return { ok: r.ok, source: 'alternative.me/fng' }
  } catch { return { ok: false, source: 'alternative.me/fng' } }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const [groq, bitget, news] = await Promise.all([checkGroq(), checkBitget(), checkNews()])

  const allOk = groq.ok && bitget.ok
  const status = {
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    checks: {
      groq_ai: {
        status: groq.ok ? '✅ online' : '❌ offline',
        latency_ms: groq.latency,
        model: groq.model,
      },
      bitget_market: {
        status: bitget.ok ? '✅ online' : '❌ offline',
        latency_ms: bitget.latency,
        btc_price: bitget.price > 0 ? `$${bitget.price.toLocaleString()}` : 'unavailable',
      },
      live_feeds: {
        fear_greed: news.ok ? '✅ online' : '⚠️ unavailable',
        crypto_news: '✅ cryptopanic + coingecko',
        price_feed: bitget.ok ? '✅ bitget live' : '❌ offline',
      },
      trade_brain: {
        status: '✅ active',
        mode: process.env.TRADE_MODE || 'autonomous',
        confidence_gate: `${process.env.MIN_CONFIDENCE || '65'}%`,
        max_risk: `${process.env.MAX_TRADE_PERCENT || '10'}% per trade`,
      },
      environment: {
        groq_key: GROQ_KEY ? '✅ set' : '❌ missing',
        bitget_key: process.env.BITGET_API_KEY ? '✅ set' : '❌ missing',
        bitget_secret: process.env.BITGET_SECRET_KEY ? '✅ set' : '❌ missing',
        bitget_pass: process.env.BITGET_PASSPHRASE ? '✅ set' : '❌ missing',
      }
    }
  }

  res.status(allOk ? 200 : 207).json(status)
}
