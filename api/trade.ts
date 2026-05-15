import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

const BASE       = 'https://api.bitget.com'
const API_KEY    = process.env.BITGET_API_KEY    || ''
const SECRET_KEY = process.env.BITGET_SECRET_KEY || ''
const PASSPHRASE = process.env.BITGET_PASSPHRASE || ''

const MAX_PCT = parseFloat(process.env.MAX_TRADE_PERCENT   || '10')
const SL_PCT  = parseFloat(process.env.STOP_LOSS_PERCENT   || '2')
const TP_PCT  = parseFloat(process.env.TAKE_PROFIT_PERCENT || '4')

function sign(ts: string, method: string, path: string, body = ''): string {
  return crypto.createHmac('sha256', SECRET_KEY).update(ts + method + path + body).digest('base64')
}

function authHeaders(method: string, path: string, body = ''): Record<string, string> {
  const ts = Date.now().toString()
  return {
    'ACCESS-KEY':        API_KEY,
    'ACCESS-SIGN':       sign(ts, method, path, body),
    'ACCESS-TIMESTAMP':  ts,
    'ACCESS-PASSPHRASE': PASSPHRASE,
    'Content-Type':      'application/json',
    'locale':            'en-US',
  }
}

async function getPrice(symbol: string): Promise<number> {
  try {
    const r = await fetch(`${BASE}/api/v2/spot/market/tickers?symbol=${symbol}`, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return 0
    const d = await r.json() as any
    return parseFloat(d.data?.[0]?.lastPr || '0')
  } catch { return 0 }
}

async function getUSDTBalance(): Promise<number> {
  if (!API_KEY) return 0
  try {
    const path = '/api/v2/spot/account/assets'
    const r = await fetch(BASE + path, { headers: authHeaders('GET', path) as any, signal: AbortSignal.timeout(8000) })
    if (!r.ok) return 0
    const d = await r.json() as any
    const usdt = (d.data || []).find((a: any) => a.coinName === 'USDT')
    return parseFloat(usdt?.available || '0')
  } catch { return 0 }
}

async function placeOrder(symbol: string, side: 'buy' | 'sell', size: string): Promise<any> {
  const path = '/api/v2/spot/trade/place-order'
  const body = JSON.stringify({ symbol, side, orderType: 'market', force: 'gtc', size })
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: authHeaders('POST', path, body) as any,
    body,
    signal: AbortSignal.timeout(12000),
  })
  return r.json()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { symbol, side, reason, simulate = !API_KEY } = req.body || {}
  if (!symbol || !side) return res.status(400).json({ error: 'symbol and side required' })

  const sym = symbol.replace('/', '').toUpperCase()
  const price = await getPrice(sym)
  if (!price) return res.status(400).json({ error: `Cannot get price for ${sym}` })

  const balance = await getUSDTBalance()
  const tradeUSDT = Math.max(2, balance * (MAX_PCT / 100))
  const qty = (tradeUSDT / price).toFixed(6)
  const sl  = side === 'buy' ? price * (1 - SL_PCT / 100) : price * (1 + SL_PCT / 100)
  const tp  = side === 'buy' ? price * (1 + TP_PCT / 100) : price * (1 - TP_PCT / 100)

  if (simulate || !API_KEY) {
    return res.status(200).json({
      simulated: true,
      symbol: sym,
      side,
      price,
      size: tradeUSDT.toFixed(2),
      quantity: qty,
      stopLoss: sl.toFixed(6),
      takeProfit: tp.toFixed(6),
      reason: reason || 'Manual trade',
      message: API_KEY ? 'Simulation mode' : 'No API keys — add BITGET_API_KEY to enable live trading',
      timestamp: Date.now(),
    })
  }

  try {
    const result = await placeOrder(sym, side, qty)
    if (result.code !== '00000') {
      return res.status(400).json({ error: result.msg || 'Order failed', details: result })
    }
    return res.status(200).json({
      simulated: false,
      symbol: sym,
      side,
      price,
      size: tradeUSDT.toFixed(2),
      quantity: qty,
      stopLoss: sl.toFixed(6),
      takeProfit: tp.toFixed(6),
      orderId: result.data?.orderId,
      reason: reason || 'AI trade',
      timestamp: Date.now(),
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
