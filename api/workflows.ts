import type { VercelRequest, VercelResponse } from '@vercel/node'

const WORKFLOWS = [
  { id: 'learner',        name: 'Intelligence Learner',    description: 'Market intel + news updates every 20 min', status: 'running', type: 'ai',       nextRun: 'in 20 min' },
  { id: 'market-scanner', name: 'Elite Multi-TF Scanner',  description: '6-timeframe confluence scoring (1m → 1D)', status: 'running', type: 'analysis',  nextRun: 'in 5 min' },
  { id: 'signal-bot',     name: 'SMC Signal Monitor',      description: 'Order blocks, FVGs, BOS/CHoCH, liquidity sweeps', status: 'running', type: 'trading', nextRun: 'continuous' },
  { id: 'risk-guard',     name: 'Risk Guard',              description: 'Position sizing + SL/TP enforcement on all trades', status: 'running', type: 'risk',     nextRun: 'always-on' },
  { id: 'anomaly-detect', name: 'Anomaly Detector',        description: 'Volume spikes, price gaps, whale move alerts', status: 'running', type: 'alert',    nextRun: 'continuous' },
  { id: 'reasoning-eng',  name: 'Elite Reasoning Engine',  description: 'Multi-step chain-of-thought analysis for every signal', status: 'running', type: 'ai', nextRun: 'on-demand' },
  { id: 'onchain-watch',  name: 'On-Chain Monitor',        description: 'Whale wallet movements, exchange inflows/outflows', status: 'paused',  type: 'research', nextRun: '—' },
  { id: 'sentiment',      name: 'Sentiment Engine',        description: 'Social media + news sentiment scoring (Fear/Greed)', status: 'running', type: 'research', nextRun: 'in 15 min' },
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'GET') {
    return res.status(200).json({ workflows: WORKFLOWS })
  }

  if (req.method === 'POST') {
    const { id, action } = req.body || {}
    const wf = WORKFLOWS.find(w => w.id === id)
    if (!wf) return res.status(404).json({ error: 'Workflow not found' })
    // In a real system this would toggle the workflow in a DB
    wf.status = action === 'pause' ? 'paused' : 'running'
    return res.status(200).json({ success: true, workflow: wf })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
