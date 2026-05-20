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

async function apiFetch(path: string) {
  const r = await fetch(BASE + path, { headers: authHeaders('GET', path) as any, signal: AbortSignal.timeout(10000) })
  if (!r.ok) return null
  return r.json() as any
}

async function getSpotAssets() {
  if (!API_KEY) return []
  try {
    const d = await apiFetch('/api/v2/spot/account/assets')
    return (d?.data || []).filter((a: any) => parseFloat(a.available || '0') + parseFloat(a.frozen || '0') > 0.000001)
  } catch { return [] }
}

async function getFuturesAccount() {
  if (!API_KEY) return null
  try {
    const d = await apiFetch('/api/v2/mix/account/accounts?productType=USDT-FUTURES')
    if (!d?.data) return null
    const acc = Array.isArray(d.data) ? d.data.find((a: any) => a.marginCoin === 'USDT') : d.data
    return acc || null
  } catch { return null }
}

async function getFuturesPositions() {
  if (!API_KEY) return []
  try {
    const d = await apiFetch('/api/v2/mix/position/all-position?productType=USDT-FUTURES&marginCoin=USDT')
    return (d?.data || []).filter((p: any) => parseFloat(p.total || '0') > 0)
  } catch { return [] }
}

async function getOpenOrders() {
  if (!API_KEY) return []
  try {
    const d = await apiFetch('/api/v2/spot/trade/unfilled-orders?limit=20')
    return d?.data || []
  } catch { return [] }
}

async function getOrderHistory() {
  if (!API_KEY) return []
  try {
    const d = await apiFetch('/api/v2/spot/trade/history-orders?limit=20')
    return d?.data || []
  } catch { return [] }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (!API_KEY) {
    return res.status(200).json({
      connected: false,
      message: 'No Bitget API keys configured.',
      balance: 0, portfolioValue: 0, value: 0, change: 0,
      assets: [], openOrders: [], trades: [], positions: [],
      timestamp: Date.now(),
    })
  }

  const [spotAssets, futuresAcc, positions, openOrders, history] = await Promise.all([
    getSpotAssets(), getFuturesAccount(), getFuturesPositions(), getOpenOrders(), getOrderHistory()
  ])

  // Fetch live prices for spot assets
  const stables = new Set(['USDT','USDC','BUSD','TUSD','DAI'])
  const priceMap: Record<string, number> = { USDT:1, USDC:1, BUSD:1, TUSD:1, DAI:1 }
  try {
    const r = await fetch(`${BASE}/api/v2/spot/market/tickers`, { signal: AbortSignal.timeout(6000) })
    if (r.ok) {
      const d = await r.json() as any
      for (const t of (d.data || [])) {
        if (t.symbol.endsWith('USDT')) priceMap[t.symbol.replace('USDT','')] = parseFloat(t.lastPr)
      }
    }
  } catch {}

  let spotValue = 0
  const assetList = spotAssets.map((a: any) => {
    const qty = parseFloat(a.available||'0') + parseFloat(a.frozen||'0')
    const price = priceMap[a.coinName] || 0
    const usdVal = qty * price
    spotValue += usdVal
    return { coin: a.coinName, available: parseFloat(a.available||'0'), frozen: parseFloat(a.frozen||'0'), usdValue: parseFloat(usdVal.toFixed(2)), price }
  }).filter((a: any) => a.usdValue > 0.01 || !stables.has(a.coin))

  const futuresBalance = parseFloat(futuresAcc?.usdtEquity || futuresAcc?.available || '0')
  const totalValue = spotValue + futuresBalance

  res.json({
    connected: true,
    balance: assetList.find((a:any)=>a.coin==='USDT')?.available || 0,
    value: parseFloat(totalValue.toFixed(2)),
    portfolioValue: parseFloat(totalValue.toFixed(2)),
    spotValue: parseFloat(spotValue.toFixed(2)),
    futuresBalance,
    change: 0,
    assets: assetList,
    positions: positions.map((p: any) => ({
      symbol: p.symbol,
      side: p.holdSide,
      size: parseFloat(p.total||'0'),
      entryPrice: parseFloat(p.openPriceAvg||'0'),
      markPrice: parseFloat(p.markPrice||'0'),
      pnl: parseFloat(p.unrealizedPL||'0'),
      leverage: parseInt(p.leverage||'10'),
    })),
    openOrders: openOrders.slice(0, 10),
    trades: history.slice(0, 20),
    timestamp: Date.now(),
  })
}
