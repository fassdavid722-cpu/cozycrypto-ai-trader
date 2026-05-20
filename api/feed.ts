import type { VercelRequest, VercelResponse } from '@vercel/node'

async function getFearGreed() {
  try {
    const r = await fetch('https://api.alternative.me/fng/?limit=1', { signal: AbortSignal.timeout(8000) })
    if (!r.ok) throw new Error(`FNG ${r.status}`)
    const d = await r.json() as any
    const item = d.data?.[0]
    if (!item) throw new Error('No FNG data')
    return {
      value: parseInt(item.value),
      label: item.value_classification,
      date: item.timestamp
    }
  } catch {
    return { value: 50, label: 'Neutral', date: '' }
  }
}

async function getGlobalMarket() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/global', { signal: AbortSignal.timeout(8000) })
    if (!r.ok) throw new Error(`CG global ${r.status}`)
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
  } catch {
    return { market_cap_usd: 0, volume_24h: 0, btc_dominance: 0, eth_dominance: 0, market_cap_change_24h: 0, active_coins: 0 }
  }
}

async function getTrending() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/search/trending', { signal: AbortSignal.timeout(8000) })
    if (!r.ok) throw new Error(`CG trending ${r.status}`)
    const d = await r.json() as any
    return (d.coins || []).slice(0, 7).map((c: any) => ({
      name: c.item.name,
      symbol: c.item.symbol,
      rank: c.item.market_cap_rank,
      score: c.item.score,
      thumb: c.item.thumb,
    }))
  } catch { return [] }
}

async function getTopMovers() {
  try {
    // Use Bitget as primary — more reliable on Vercel than CoinGecko
    const r = await fetch(
      'https://api.bitget.com/api/v2/spot/market/tickers',
      { signal: AbortSignal.timeout(8000) }
    )
    if (!r.ok) throw new Error(`Bitget tickers ${r.status}`)
    const d = await r.json() as any
    const items: any[] = d.data || []

    // Filter USDT pairs with valid data
    const usdtPairs = items
      .filter((t: any) => t.symbol.endsWith('USDT') && parseFloat(t.lastPr || '0') > 0 && parseFloat(t.open24h || '0') > 0)
      .map((t: any) => {
        const price = parseFloat(t.lastPr)
        const open = parseFloat(t.open24h)
        const change = ((price - open) / open) * 100
        return {
          symbol: t.symbol.replace('USDT', ''),
          price,
          change_24h: parseFloat(change.toFixed(2)),
          volume: parseFloat(t.quoteVolume || '0'),
        }
      })

    const gainers = [...usdtPairs].sort((a, b) => b.change_24h - a.change_24h).slice(0, 5)
    const losers  = [...usdtPairs].sort((a, b) => a.change_24h - b.change_24h).slice(0, 5)
    return { gainers, losers }
  } catch {
    return { gainers: [], losers: [] }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')

  const [fearGreed, globalMarket, trending, movers] = await Promise.all([
    getFearGreed(),
    getGlobalMarket(),
    getTrending(),
    getTopMovers(),
  ])

  res.json({
    timestamp: new Date().toISOString(),
    fearGreed,          // { value, label, date }
    fear_greed: fearGreed, // alias for backwards compat
    globalMarket,       // { market_cap_usd, btc_dominance, ... }
    global_market: globalMarket,
    trending,           // [{ name, symbol, rank, ... }]
    topGainers: movers.gainers,
    top_gainers: movers.gainers,
    topLosers: movers.losers,
    top_losers: movers.losers,
    sources: ['alternative.me', 'coingecko.com', 'bitget.com']
  })
}
