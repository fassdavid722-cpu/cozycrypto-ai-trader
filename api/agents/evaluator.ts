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
  const { trade, currentPrice, marketContext } = req.body
  
  const prompt = `You are an elite Post-Trade Evaluator Agent. Analyze the outcome of this trade:
- Trade Details: ${JSON.stringify(trade)}
- Current Price: ${currentPrice}
- Market Context at Close: ${JSON.stringify(marketContext)}

Your goal is to determine if the trade was successful and WHY.
Focus on:
1. Accuracy of the original reasoning vs actual market movement.
2. Identifying if the Stop Loss or Take Profit was hit correctly.
3. Extracting a "Hard Lesson" for the AI's long-term memory to avoid repeating mistakes or to double down on winning patterns.

Output JSON only:
{
  "success": boolean,
  "pnl_percent": number,
  "analysis": "detailed breakdown of what happened",
  "hard_lesson": "a specific, actionable rule for the future"
}`

  try {
    const analysis = await groqCall([{ role: 'user', content: prompt }])
    const result = JSON.parse(analysis.replace(/```json?/g,'').replace(/```/g,'').trim())
    res.status(200).json(result)
  } catch (e) {
    res.status(500).json({ error: 'Trade evaluation failed' })
  }
}
