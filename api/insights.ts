import { VercelRequest, VercelResponse } from '@vercel/node'
import fs from 'fs'
import path from 'path'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // In a real Vercel environment, we'd fetch this from GitHub or a DB
    // For now, we'll try to read the local file if it exists (for local dev)
    // or return a default structure if not.
    const insightsPath = path.join(process.cwd(), 'logs', 'learned_insights.json')
    
    if (fs.existsSync(insightsPath)) {
      const data = fs.readFileSync(insightsPath, 'utf8')
      return res.status(200).json(JSON.parse(data))
    }

    // Default fallback if file not found
    return res.status(200).json({
      lessons: [
        "Always verify account balance before attempting a trade.",
        "Prioritize high-volume pairs (BTC, ETH) during low volatility.",
        "Look for CHoCH on the 1H timeframe for trend reversal confirmation."
      ],
      adjustments: {
        "BTCUSDT": { "min_confidence": 65 },
        "ETHUSDT": { "min_confidence": 65 }
      }
    })
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load insights' })
  }
}
