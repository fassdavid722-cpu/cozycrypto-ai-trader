import type { VercelRequest, VercelResponse } from '@vercel/node'

async function getFearGreed() {
  try {
    const r = await fetch('https://api.alternative.me/fng/?limit=3', { signal: AbortSignal.timeout(6000) })
    const d = await r.json() as any
    return d.data?.map((i: any) => ({
      value: parseInt(i.value),
      label: i.value_classification,
      date: i.timestamp
    })) || []
  } catch { return [] }
}

async function getCryptoNews() {
  try {
    // CoinGecko trending + news via public API
    const [trendR, globalR] = await Promise.all([
      fetch('https://api.coingecko.com/api/v3/search/trending', { signal: AbortSignal.timeout(6000) }),
      fetch('https://api.coingecko.com/api/v3/global', { signal: AbortSignal.timeout(6000) })
    ])
    const trend = await trendR.json() as any
    const global = await globalR.json() as any

    const trending = (trend.coins || []).slice(0, 7).map((c: any) => ({
      name: c.item.name,
      symbol: c.item.symbol,
      rank: c.item.market_cap_rank,
      score: c.item.score,
      thumb: c.item.thumb,
      price_btc: c.item.price_btc,
    }))

    const globalData = global.data || {}
    return {
      trending,
      global: {
        market_cap_usd: globalData.total_market_cap?.usd,
        volume_24h: globalData.total_volume?.usd,
        btc_dominance: globalData.market_cap_percentage?.btc?.toFixed(1),
        eth_dominance: globalData.market_cap_percentage?.eth?.toFixed(1),
        market_cap_change_24h: globalData.market_cap_change_percentage_24h_usd?.toFixed(2),
        active_coins: globalData.active_cryptocurrencies,
      }
    }
  } catch { return { trending: [], global: {} } }
}

async function getTopMovers() {
  try {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=percent_change_24h_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h',
      { signal: AbortSignal.timeout(8000) }
    )
    if (!r.ok) return []
    const d = await r.json() as any
    return d.map((c: any) => ({
      id: c.id,
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      price: c.current_price,
      change_24h: c.price_change_percentage_24h?.toFixed(2),
      volume: c.total_volume,
      market_cap: c.market_cap,
      image: c.image,
    }))
  } catch { return [] }
}

async function getLosers() {
  try {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=percent_change_24h_asc&per_page=5&page=1&sparkline=false',
      { signal: AbortSignal.timeout(8000) }
    )
    if (!r.ok) return []
    const d = await r.json() as any
    return d.map((c: any) => ({
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      price: c.current_price,
      change_24h: c.price_change_percentage_24h?.toFixed(2),
    }))
  } catch { return [] }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')

  const [fearGreed, cryptoData, gainers, losers] = await Promise.all([
    getFearGreed(),
    getCryptoNews(),
    getTopMovers(),
    getLosers(),
  ])

  res.json({
    timestamp: new Date().toISOString(),
    fear_greed: fearGreed,
    global_market: cryptoData.global,
    trending: cryptoData.trending,
    top_gainers: gainers,
    top_losers: losers,
    sources: ['alternative.me', 'coingecko.com', 'bitget.com']
  })
}
