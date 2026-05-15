import React, { useState } from 'react'
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { useStore } from '@/store/useStore'
import Card from '@/components/ui/Card'
import MiniChart from '@/components/ui/MiniChart'

export default function MarketOverview() {
  const { tickers } = useStore()
  const [filter, setFilter] = useState<'all' | 'gainers' | 'losers'>('all')

  const filtered = tickers.filter(t =>
    filter === 'gainers' ? t.change24h > 0 :
    filter === 'losers' ? t.change24h < 0 : true
  )

  return (
    <div className="h-full overflow-y-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-lg">Market Overview</h2>
        <div className="flex gap-2">
          {['all','gainers','losers'].map(f => (
            <button key={f} onClick={() => setFilter(f as any)}
              className={`px-3 py-1 rounded-lg text-xs capitalize transition-colors ${filter === f ? 'bg-gold text-black font-semibold' : 'bg-bg-card text-text-secondary hover:text-white border border-bg-border'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {/* Header */}
        <div className="grid grid-cols-6 px-4 py-2 text-[10px] text-text-muted uppercase tracking-wider">
          <span>Pair</span><span className="text-right">Price</span>
          <span className="text-right">24h Change</span><span className="text-right">24h High</span>
          <span className="text-right">24h Low</span><span className="text-right">Chart</span>
        </div>
        {filtered.length === 0 ? (
          <Card><p className="text-text-muted text-sm text-center py-8">Loading market data...</p></Card>
        ) : filtered.map(t => (
          <Card key={t.symbol} className="py-2" onClick={() => {}}>
            <div className="grid grid-cols-6 items-center">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
                  <span className="text-gold text-[10px] font-bold">{t.symbol.split('/')[0].slice(0,3)}</span>
                </div>
                <div>
                  <p className="text-white text-xs font-medium">{t.symbol.split('/')[0]}</p>
                  <p className="text-text-muted text-[10px]">{t.symbol.split('/')[1]}</p>
                </div>
              </div>
              <p className="text-white text-sm font-mono text-right">${t.price.toLocaleString()}</p>
              <div className={`flex items-center justify-end gap-1 ${t.change24h >= 0 ? 'text-green-trade' : 'text-red-trade'}`}>
                {t.change24h >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                <span className="text-xs font-mono">{t.change24h >= 0 ? '+' : ''}{t.change24h.toFixed(2)}%</span>
              </div>
              <p className="text-text-secondary text-xs font-mono text-right">${t.high24h.toLocaleString()}</p>
              <p className="text-text-secondary text-xs font-mono text-right">${t.low24h.toLocaleString()}</p>
              <div className="flex justify-end">
                <MiniChart data={t.sparkline || []} color={t.change24h >= 0 ? '#00D4A1' : '#FF4757'} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
