import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'GET') {
    return res.status(200).json({
      risk: {
        maxTradePercent: parseFloat(process.env.MAX_TRADE_PERCENT || '10'),
        stopLossPercent: parseFloat(process.env.STOP_LOSS_PERCENT || '2'),
        takeProfitPercent: parseFloat(process.env.TAKE_PROFIT_PERCENT || '4'),
        maxOpenTrades: parseInt(process.env.MAX_OPEN_TRADES || '3'),
      },
      connections: {
        bitget: !!process.env.BITGET_API_KEY,
        groq: !!process.env.GROQ_API_KEY,
        telegram: !!process.env.TELEGRAM_BOT_TOKEN,
      },
      version: '2.0.0',
    })
  }

  if (req.method === 'POST') {
    // Settings are managed via Vercel environment variables — this endpoint
    // acknowledges the save request. Actual env changes must go through Vercel dashboard.
    return res.status(200).json({
      success: true,
      message: 'Settings received. To persist API keys, add them as Environment Variables in your Vercel project settings.',
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
