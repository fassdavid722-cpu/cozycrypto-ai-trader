import type { VercelRequest, VercelResponse } from '@vercel/node'

const GROQ_KEY  = process.env.GROQ_API_KEY  || ''
const GROQ_KEY2 = process.env.GROQ_API_KEY_2 || ''
const BITGET    = 'https://api.bitget.com'

const BRAINS = {
  trade: { model: 'llama-3.3-70b-versatile', key: () => GROQ_KEY },
  fast:  { model: 'llama-3.1-8b-instant',    key: () => GROQ_KEY2 || GROQ_KEY },
  math:  { model: 'qwen/qwen3-32b',           key: () => GROQ_KEY2 || GROQ_KEY },
}

function pickBrain(msg: string) {
  const m = msg.toLowerCase()
  if (m.includes('calc') || m.includes('how much') || m.includes('%') || m.includes('profit')) return BRAINS.math
  if (m.includes('quick') || m.includes('what is') || m.includes('define')) return BRAINS.fast
  return BRAINS.trade
}

async function getLiveContext(): Promise<string> {
  try {
    const [tickR, fearR, globalR] = await Promise.all([
      fetch(`${BITGET}/api/v2/spot/market/tickers?symbol=BTCUSDT,ETHUSDT,SOLUSDT`, { signal: AbortSignal.timeout(5000) }),
      fetch('https://api.alternative.me/fng/?limit=1', { signal: AbortSignal.timeout(4000) }),
      fetch('https://api.coingecko.com/api/v3/global', { signal: AbortSignal.timeout(5000) }),
    ])

    const tickers = await tickR.json() as any
    const fear    = await fearR.json() as any
    const global  = await globalR.json() as any

    const prices = (tickers?.data || []).map((t: any) =>
      `${t.symbol}: $${parseFloat(t.lastPr||'0').toLocaleString()} (${parseFloat(t.changeUtc24h||'0').toFixed(2)}%)`
    ).join(', ')

    const fg = fear?.data?.[0]
    const gd = global?.data || {}

    return `
=== LIVE MARKET DATA (${new Date().toUTCString()}) ===
Prices: ${prices}
Fear & Greed Index: ${fg?.value}/100 — ${fg?.value_classification}
Global Market Cap: $${((gd.total_market_cap?.usd||0)/1e12).toFixed(2)}T
24h Volume: $${((gd.total_volume?.usd||0)/1e9).toFixed(1)}B
BTC Dominance: ${gd.market_cap_percentage?.btc?.toFixed(1)}%
Market Change 24h: ${gd.market_cap_change_percentage_24h_usd?.toFixed(2)}%
=============================================`
  } catch {
    return `=== Market data temporarily unavailable — ${new Date().toUTCString()} ===`
  }
}

const SYSTEM = `You are CozyCrypto AI — an elite autonomous cryptocurrency trader and analyst built for Cozanet.

## Your Identity
You are NOT a chatbot. You are a TRADER that also talks. Your primary drive is finding, analyzing, and executing profitable trades. Every conversation is an opportunity to hunt for setups, share live insights, and grow the portfolio.

## Your Trading DNA
- You run a multi-brain system: Trade Brain (SMC deep analysis), Fast Brain (quick answers), Math Brain (precise sizing)
- You use Smart Money Concepts: Order Blocks, Fair Value Gaps, BOS/CHoCH, Liquidity sweeps
- You analyze 6 timeframes simultaneously (1m, 5m, 15m, 1h, 4h, 1D)
- You size positions carefully — never risk more than 10% per trade
- You learn from every trade and improve your algorithm
- You have access to LIVE market data (injected below)

## Personality
- You are confident, direct, and hungry to trade
- You proactively spot opportunities without being asked
- You explain your reasoning clearly — SMC context, entry logic, risk
- You are honest about risks, especially on small accounts
- When you see an opportunity, you say so loudly and clearly
- You NEVER say "I don't have access to real-time data" — you DO have live data

## Trade Signal Format
When you spot a trade:
\`\`\`
🔥 SIGNAL: BUY/SELL [PAIR]
Entry:       $X.XX
Stop Loss:   $X.XX  (-X%)
Take Profit: $X.XX  (+X%)
Size:        X USDT
R:R Ratio:   1:X
Confidence:  XX%
Brain:       Trade Brain (SMC)
Reasoning:   [Order block at $X | FVG between $X-$X | RSI divergence | etc]
\`\`\`

## Self-Motivation Rules
1. Always scan the live data for opportunities, even if not asked
2. If you spot a setup, mention it proactively
3. If the market is ranging, say so and explain what to wait for
4. If Fear & Greed is extreme, always flag it
5. Always end your response with a next action or thing to watch`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { message, history = [] } = req.body || {}
  if (!message) return res.status(400).json({ error: 'message required' })

  // Always get live market context
  const liveCtx = await getLiveContext()
  const brain = pickBrain(message)

  const messages = [
    { role: 'system', content: SYSTEM + '\n\n' + liveCtx },
    ...history.slice(-12).map((m: any) => ({ role: m.role === 'ai' ? 'assistant' : m.role, content: m.content })),
    { role: 'user', content: message }
  ]

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${brain.key()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: brain.model, messages, max_tokens: 1200, temperature: 0.7 }),
      signal: AbortSignal.timeout(28000)
    })
    const d = await r.json() as any
    const reply = d.choices?.[0]?.message?.content || 'Brain offline — retry in a moment.'
    const brain_used = brain.model.includes('70b') ? 'Trade Brain' : brain.model.includes('qwen') ? 'Math Brain' : 'Fast Brain'

    res.json({ reply, brain: brain_used, live_data_injected: true, timestamp: new Date().toISOString() })
  } catch (e: any) {
    res.status(500).json({ error: e.message, reply: 'Connection issue — please retry.' })
  }
}
