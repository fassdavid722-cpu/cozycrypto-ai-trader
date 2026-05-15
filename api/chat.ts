import type { VercelRequest, VercelResponse } from '@vercel/node'

const GROQ_KEY   = process.env.GROQ_API_KEY || ''
const GROQ_KEY2  = process.env.GROQ_API_KEY_2 || ''

// Brain routing — mirrors backend governor architecture
const BRAINS = {
  trade:    { model: 'llama-3.3-70b-versatile',              key: () => GROQ_KEY  },
  fast:     { model: 'llama-3.1-8b-instant',                 key: () => GROQ_KEY2 || GROQ_KEY },
  long:     { model: 'meta-llama/llama-4-scout-17b-16e-instruct', key: () => GROQ_KEY },
  math:     { model: 'qwen/qwen3-32b',                       key: () => GROQ_KEY2 || GROQ_KEY },
}

const SYSTEM_PROMPT = `You are CozyCrypto AI — an elite autonomous cryptocurrency trading copilot built for Cozanet.

## Identity
You run on a multi-brain architecture: Trade Brain (deep analysis), Fast Brain (quick replies), Math Brain (precise calculations), Long Brain (big picture research). You route each task to the right brain automatically.

## Capabilities
- Real-time Bitget market analysis and trade execution
- Smart Money Concepts (SMC): Order Blocks, Fair Value Gaps, Break of Structure, Change of Character, liquidity sweeps
- Multi-timeframe confluence (1m → 1D)
- Position sizing for micro accounts ($3+)
- Autonomous background learner (updates market knowledge every 20 min)
- Persistent memory — you remember past trades and lessons
- Risk management: max loss limits, dynamic position sizing, auto stop-loss

## Trading Output Format
When suggesting a trade ALWAYS include:
\`\`\`
📊 SIGNAL: BUY/SELL [PAIR]
Entry:      $X.XX
Stop Loss:  $X.XX (-X%)
Take Profit: $X.XX (+X%)
Size:       X USDT (X% of balance)
R:R Ratio:  1:X
Confidence: XX%
Reasoning:  [SMC context + why this entry]
\`\`\`

## Personality
- Confident, direct, data-driven
- Proactively spots opportunities
- Honest about risks — especially small accounts
- Never emotional — purely systematic
- When balance is $0 or unavailable: study patterns, backtest, prepare

## Risk Rules
- Never risk more than MAX_TRADE_PERCENT per trade
- Always include stop-loss
- For accounts under $10: max 1-2 trades open at once
- Compound small: 1% per trade > gambling big`

function detectBrain(message: string): keyof typeof BRAINS {
  const m = message.toLowerCase()
  if (/calculate|position size|how much|risk|percent|pnl|profit|loss|\$\d/.test(m)) return 'math'
  if (/analyze|analysis|chart|rsi|macd|smc|order block|fvg|structure|confluence|timeframe/.test(m)) return 'trade'
  if (/research|explain|what is|history|background|whitepaper/.test(m)) return 'long'
  return 'fast'
}

async function callGroq(model: string, key: string, messages: any[]): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens: 1024, temperature: 0.7 }),
    signal: AbortSignal.timeout(25000),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq ${res.status}: ${err.slice(0, 100)}`)
  }
  const data = await res.json() as any
  return data.choices?.[0]?.message?.content || 'No response from AI'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!GROQ_KEY) return res.status(503).json({ error: 'AI not configured — add GROQ_API_KEY to environment variables' })

  const { message, history = [], context = {} } = req.body || {}
  if (!message?.trim()) return res.status(400).json({ error: 'Message required' })

  const brainKey = detectBrain(message)
  const brain    = BRAINS[brainKey]

  // Build context string
  const ctxParts: string[] = []
  if (context.balance != null) ctxParts.push(`Balance: $${context.balance} USDT`)
  if (context.portfolio) ctxParts.push(`Portfolio: ${JSON.stringify(context.portfolio)}`)
  if (context.topMover) ctxParts.push(`Top mover: ${context.topMover}`)

  const systemContent = SYSTEM_PROMPT + (ctxParts.length ? `\n\n## Current Context\n${ctxParts.join('\n')}` : '')

  const messages = [
    { role: 'system', content: systemContent },
    ...history.slice(-16).map((m: any) => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content,
    })),
    { role: 'user', content: message },
  ]

  try {
    const reply = await callGroq(brain.model, brain.key(), messages)
    return res.status(200).json({
      reply,
      brain: brainKey,
      model: brain.model,
      timestamp: Date.now(),
    })
  } catch (err: any) {
    // Fallback to fast brain on any error
    if (brainKey !== 'fast') {
      try {
        const fallback = BRAINS.fast
        const reply = await callGroq(fallback.model, fallback.key(), messages)
        return res.status(200).json({ reply, brain: 'fast_fallback', model: fallback.model, timestamp: Date.now() })
      } catch {}
    }
    console.error('[chat] Error:', err.message)
    return res.status(500).json({ error: `AI error: ${err.message}` })
  }
}
