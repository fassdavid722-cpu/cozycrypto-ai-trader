import { useStore } from '@/store/useStore'
import TopBar from '../TopBar'
import { TrendingUp, TrendingDown, Search, Filter } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

export default function MarketOverview() {
  const { tickers } = useStore()

  return (
    <div className="p-6 min-h-full">
      <TopBar title="Market Overview" subtitle="Real-time market data and AI insights" />

      <div className="panel-surface overflow-hidden">
        <div className="p-4 border-b border-[rgba(255,255,255,0.05)] flex items-center justify-between bg-[rgba(255,255,255,0.02)]">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525b]" />
              <input
                type="text"
                placeholder="Search pairs..."
                className="bg-[#1f1f1f] border border-[rgba(255,255,255,0.08)] rounded-lg pl-9 pr-4 py-1.5 text-xs text-[#fafafa] outline-none focus:border-[rgba(34,197,94,0.3)] w-64"
              />
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1f1f1f] border border-[rgba(255,255,255,0.08)] text-xs text-[#a1a1aa] hover:text-[#fafafa]">
              <Filter size={14} />
              Filter
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#52525b] uppercase tracking-widest font-bold">Sort by:</span>
            <select className="bg-transparent text-xs text-[#a1a1aa] outline-none cursor-pointer hover:text-[#fafafa]">
              <option>Volume (24h)</option>
              <option>Price Change</option>
              <option>Market Cap</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[#52525b] border-b border-[rgba(255,255,255,0.05)]">
                <th className="px-6 py-4 font-medium">Asset</th>
                <th className="px-6 py-4 font-medium">Price</th>
                <th className="px-6 py-4 font-medium">24h Change</th>
                <th className="px-6 py-4 font-medium">24h Volume</th>
                <th className="px-6 py-4 font-medium">Last 24h</th>
                <th className="px-6 py-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">
              {tickers.map((ticker) => (
                <tr key={ticker.symbol} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#1f1f1f] flex items-center justify-center border border-[rgba(255,255,255,0.05)]">
                        <span className="text-[10px] font-bold text-[#fafafa]">{ticker.symbol.split('/')[0]}</span>
                      </div>
                      <div>
                        <p className="font-medium text-[#fafafa]">{ticker.symbol}</p>
                        <p className="text-[10px] text-[#52525b]">Spot Trading</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono-data text-[#fafafa]">
                    $${ticker.price.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className={`flex items-center gap-1 font-mono-data ${ticker.change24h >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {ticker.change24h >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {ticker.change24h >= 0 ? '+' : ''}{ticker.change24h}%
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[#a1a1aa] font-mono-data">
                    $${(ticker.volume / 1000000).toFixed(2)}M
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-24 h-8">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={(ticker.sparkline || []).map((v, i) => ({ i, v }))}>
                          <Line
                            type="monotone"
                            dataKey="v"
                            stroke={ticker.change24h >= 0 ? '#22c55e' : '#ef4444'}
                            strokeWidth={1.5}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="px-3 py-1.5 rounded-lg bg-[#1f1f1f] border border-[rgba(255,255,255,0.08)] text-[10px] text-[#fafafa] hover:bg-[#22c55e] hover:border-[#22c55e] transition-all uppercase tracking-widest font-bold">
                      Trade
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
