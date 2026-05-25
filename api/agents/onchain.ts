import { VercelRequest, VercelResponse } from '@vercel/node'

const GROQ_KEY = process.env.GROQ_API_KEY || ''

async function groqCall(messages: any[]) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, temperature: 0.1 }),
    signal: AbortSignal.timeout(25000)
  })
  const d = await r.json() as any
  return d.choices?.[0]?.message?.content || ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { symbol, onChainData } = req.body
  
  const prompt = `You are an elite On-Chain Analyst Agent. Analyze the blockchain data for ${symbol}:
- Whale Movements: ${JSON.stringify(onChainData?.whales)}
- Exchange Inflows/Outflows: ${JSON.stringify(onChainData?.flows)}
- Smart Money Activity: ${JSON.stringify(onChainData?.smartMoney)}

Your goal is to detect hidden accumulation or distribution patterns.
Focus on:
1. Large transfers to/from exchanges.
2. Changes in holder concentration.
3. Unusual minting or burning events.

Output JSON only:
{
  "bias": "bullish|bearish|neutral",
  "confidence": 0-100,
  "reasoning": "detailed on-chain analysis",
  "alert_level": "low|medium|high"
}`

  try {
    const analysis = await groqCall([{ role: 'user', content: prompt }])
    const result = JSON.parse(analysis.replace(/```json?/g,'').replace(/```/g,'').trim())
    res.status(200).json(result)
  } catch (e) {
    res.status(500).json({ error: 'On-chain analysis failed' })
  }
}
