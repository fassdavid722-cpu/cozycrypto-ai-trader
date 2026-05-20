import type { VercelRequest, VercelResponse } from '@vercel/node'

async function getFearGreed() {
  try {
    const r = await fetch('https://api.alternative.me/fng/?limit=1', { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return { value: 50, label: 'Neutral', date: '' }
    const d = await r.json() as any
    const item = d.data?.[0]
    return item
      ? { value: parseInt(item.value), label: item.value_classification, date: item.timestamp }
      : { value: 50, label: 'Neutral', date: '' }
  } catch { return { value: 50, label: 'Neutral', date: '' } }
}

async function getGlobalMarket() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/global', { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return {}
    const d = await r.json() as any
    const g = d.data || {}
    return {
      market_cap_usd: g.total_market_cap?.usd || 0,
      volume_24h: g.total_volume?.usd || 0,
      btc_dominance: parseFloat((g.market_cap_percentage?.btc || 0).toFixed(1)),
      eth_dominance: parseFloat((g.market_cap_percentage?.eth || 0).toFixed(1)),
      market_cap_change_24h: parseFloat((g.market_cap_change_percentage_24h_usd || 0).toFixed(2)),
      active_coins: g.active_cryptocurrencies || 0,
    }
  } catch { return {} }
}

async function getTrending() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/search/trending', { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return []
    const d = await r.json() as any
    return (d.coins || []).slice(0, 7).map((c: any) => ({
      name: c.item.name, symbol: c.item.symbol,
      rank: c.item.market_cap_rank, score: c.item.score, thumb: c.item.thumb,
    }))
  } catch { return [] }
}

async function getTopMovers() {
  try {
    const r = await fetch('https://api.bitget.com/api/v2/spot/market/tickers', { signal: AbortSignal.timeout(8000) })
    if (!r.ok) throw new Error(`Bitget ${r.status}`)
    const d = await r.json() as any
    const items: any[] = d.data || []

    // changeUtc24h is a decimal ratio (e.g. 0.00735 = +0.735%)
    const usdtPairs = items
      .filter((t: any) => t.symbol.endsWith('USDT') && parseFloat(t.lastPr || '0') > 0 && t.changeUtc24h !== undefined)
      .map((t: any) => ({
        symbol: t.symbol.replace('USDT', ''),
        price: parseFloat(t.lastPr),
        change_24h: parseFloat((parseFloat(t.changeUtc24h) * 100).toFixed(2)),
        volume: parseFloat(t.usdtVolume || t.quoteVolume || '0'),
      }))
      .filter((t: any) => t.volume > 100000) // filter out dust pairs

    const gainers = [...usdtPairs].sort((a, b) => b.change_24h - a.change_24h).slice(0, 5)
    const losers  = [...usdtPairs].sort((a, b) => a.change_24h - b.change_24h).slice(0, 5)
    return { gainers, losers }
  } catch { return { gainers: [], losers: [] } }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')

  const [fearGreed, globalMarket, trending, movers] = await Promise.all([
    getFearGreed(), getGlobalMarket(), getTrending(), getTopMovers(),
  ])

  res.json({
    timestamp: new Date().toISOString(),
    fearGreed, fear_greed: fearGreed,
    globalMarket, global_market: globalMarket,
    trending,
    topGainers: movers.gainers, top_gainers: movers.gainers,
    topLosers: movers.losers,   top_losers: movers.losers,
    sources: ['alternative.me', 'coingecko.com', 'bitget.com']
  })
}
