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
  const { status, logs, config } = req.body
  
  const prompt = `You are an elite Autonomous Health Monitor Agent. Analyze the current state of the COZANET AI system:
- System Status: ${JSON.stringify(status)}
- Recent Logs: ${JSON.stringify(logs)}
- Configuration: ${JSON.stringify(config)}

Your goal is to detect any anomalies, failures, or performance degradation.
Focus on:
1. Connectivity issues with exchanges or GitHub.
2. AI reasoning quality (e.g., repeating the same mistakes).
3. Resource exhaustion or API rate limiting.

Output JSON only:
{
  "healthy": boolean,
  "status_report": "concise summary of system health",
  "anomalies": ["list of detected issues or null"],
  "self_diagnosis": "what needs to be fixed and how"
}`

  try {
    const analysis = await groqCall([{ role: 'user', content: prompt }])
    const result = JSON.parse(analysis.replace(/```json?/g,'').replace(/```/g,'').trim())
    res.status(200).json(result)
  } catch (e) {
    res.status(500).json({ error: 'Health monitoring failed' })
  }
}
