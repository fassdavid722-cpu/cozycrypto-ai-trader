import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

const BASE       = 'https://api.bitget.com'
const API_KEY    = process.env.BITGET_API_KEY    || ''
const SECRET_KEY = process.env.BITGET_SECRET_KEY || ''
const PASSPHRASE = process.env.BITGET_PASSPHRASE || ''

function sign(ts: string, method: string, path: string, body = '') {
  return crypto.createHmac('sha256', SECRET_KEY).update(ts + method + path + body).digest('base64')
}
function authHeaders(method: string, path: string, body = '') {
  const ts = Date.now().toString()
  return { 'ACCESS-KEY': API_KEY, 'ACCESS-SIGN': sign(ts, method, path, body),
           'ACCESS-TIMESTAMP': ts, 'ACCESS-PASSPHRASE': PASSPHRASE,
           'Content-Type': 'application/json', 'locale': 'en-US' }
}

async function getAssets() {
  if (!API_KEY) return []
  try {
    const path = '/api/v2/spot/account/assets'
    const r = await fetch(BASE + path, { headers: authHeaders('GET', path) as any, signal: AbortSignal.timeout(10000) })
    if (!r.ok) return []
    const d = await r.json() as any
    return (d.data || []).filter((a: any) => parseFloat(a.available || '0') > 0 || parseFloat(a.frozen || '0') > 0)
  } catch { return [] }
}

async function getOpenOrders() {
  if (!API_KEY) return []
  try {
    const path = '/api/v2/spot/trade/unfilled-orders?limit=20'
    const r = await fetch(BASE + path, { headers: authHeaders('GET', path) as any, signal: AbortSignal.timeout(10000) })
    if (!r.ok) return []
    const d = await r.json() as any
    return d.data || []
  } catch { return [] }
}

async function getOrderHistory() {
  if (!API_KEY) return []
  try {
    const path = '/api/v2/spot/trade/history-orders?limit=50'
    const r = await fetch(BASE + path, { headers: authHeaders('GET', path) as any, signal: AbortSignal.timeout(10000) })
    if (!r.ok) return []
    const d = await r.json() as any
    return d.data || []
  } catch { return [] }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (!API_KEY) {
    return res.status(200).json({
      connected: false,
      message: 'No Bitget API keys configured. Add BITGET_API_KEY, BITGET_SECRET_KEY, BITGET_PASSPHRASE to environment variables.',
      balance: 0,
      portfolioValue: 0,
      portfolioChange: 0,
      assets: [],
      openOrders: [],
      recentTrades: [],
    })
  }

  const [assets, openOrders, history] = await Promise.all([getAssets(), getOpenOrders(), getOrderHistory()])

  // Fetch prices for non-stable assets to calculate total value
  const stables = ['USDT', 'USDC', 'BUSD', 'TUSD', 'DAI']
  const nonStables = assets.filter((a: any) => !stables.includes(a.coinName) && (parseFloat(a.available) + parseFloat(a.frozen)) > 0)
  
  const priceMap: Record<string, number> = { 'USDT': 1, 'USDC': 1, 'BUSD': 1, 'TUSD': 1, 'DAI': 1 }
  try {
    const tickerRes = await fetch(`${BASE}/api/v2/spot/market/tickers`, { signal: AbortSignal.timeout(5000) })
    if (tickerRes.ok) {
      const tickerData = await tickerRes.json() as any
      (tickerData.data || []).forEach((t: any) => {
        if (t.symbol.endsWith('USDT')) {
          const coin = t.symbol.replace('USDT', '')
          priceMap[coin] = parseFloat(t.lastPr)
        }
      })
    }
  } catch (e) {
    console.error('Price fetch failed, using stables only for valuation')
  }

  let totalValue = 0
  const assetList: any[] = []

  for (const a of assets) {
    const qty = parseFloat(a.available || '0') + parseFloat(a.frozen || '0')
    if (qty < 0.000001) continue
    const price = priceMap[a.coinName] || 0
    const usdVal = qty * price
    totalValue += usdVal
    assetList.push({ 
      coin: a.coinName, 
      available: parseFloat(a.available || '0'), 
      frozen: parseFloat(a.frozen || '0'), 
      usdValue: parseFloat(usdVal.toFixed(2)) 
    })
  }

  const trades = history.slice(0, 20).map((o: any) => {
    const side = o.side?.toLowerCase()
    const price = parseFloat(o.priceAvg || o.price || '0')
    const qty = parseFloat(o.baseVolume || o.size || '0')
    return { 
      id: o.orderId,
      symbol: o.symbol, 
      side, 
      price, 
      quantity: qty, 
      total: (price * qty).toFixed(2),
      status: o.status === 'filled' ? 'closed' : 'open', 
      timestamp: parseInt(o.cTime),
      reason: 'Bitget Order'
    }
  })

  // Match frontend App.tsx expectations: { value, change, history, balance }
  return res.status(200).json({
    connected: true,
    value: parseFloat(totalValue.toFixed(2)),
    change: 0, 
    history: [], // Placeholder for chart
    balance: assetList.find(a => a.coin === 'USDT')?.available || 0,
    assets: assetList,
    openOrders: openOrders.slice(0, 10),
    trades: trades,
    timestamp: Date.now(),
  })
}
