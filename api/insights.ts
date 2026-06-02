import type { VercelRequest, VercelResponse } from '@vercel/node'

const GH_TOKEN = process.env.GITHUB_TOKEN || ''
const GH_REPO  = process.env.GITHUB_REPO  || ''

async function ghRead(file: string): Promise<any> {
  if (!GH_TOKEN || !GH_REPO) return null
  try {
    const r = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${file}`,
      { headers: { Authorization: `Bearer ${GH_TOKEN}` } })
    if (!r.ok) return null
    const d = await r.json() as any
    return JSON.parse(Buffer.from(d.content, 'base64').toString())
  } catch { return null }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const [insights, goals, history] = await Promise.all([
      ghRead('logs/learned_insights.json'),
      ghRead('goals/active_goals.json'),
      ghRead('logs/trade_history.json')
    ])

    return res.status(200).json({
      insights: insights || {
        lessons: [
          "Always verify account balance before attempting a trade.",
          "Prioritize high-volume pairs (BTC, ETH) during low volatility.",
          "Look for CHoCH on the 1H timeframe for trend reversal confirmation.",
          "1% risk per trade maximum — protect the account above all else.",
          "Paper trade new strategies for at least 10 iterations before going live."
        ],
        adjustments: { BTCUSDT: { min_confidence: 65 }, ETHUSDT: { min_confidence: 65 } }
      },
      goals: goals || [],
      tradeCount: Array.isArray(history) ? history.length : 0,
      lastUpdated: new Date().toISOString()
    })
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load insights' })
  }
}
