import { useStore } from '@/store/useStore'
import TopBar from '../TopBar'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Wallet, ArrowUpRight, ArrowDownRight, MoreHorizontal } from 'lucide-react'

export default function Portfolio() {
  const { portfolioValue, portfolioChange, balance, tickers } = useStore()

  const data = [
    { name: 'BTC', value: 45, color: '#F7931A' },
    { name: 'ETH', value: 30, color: '#627EEA' },
    { name: 'SOL', value: 15, color: '#14F195' },
    { name: 'USDT', value: 10, color: '#26A17B' },
  ]

  return (
    <div className="p-6 min-h-full">
      <TopBar title="Portfolio" subtitle="Asset allocation and performance" />

      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2 panel-surface p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[rgba(34,197,94,0.1)] flex items-center justify-center border border-[rgba(34,197,94,0.2)]">
                <Wallet className="text-[#22c55e]" size={20} />
              </div>
              <div>
                <p className="text-xs text-[#a1a1aa]">Available Balance</p>
                <p className="text-2xl font-medium text-[#fafafa] font-mono-data">$${balance.toLocaleString()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#a1a1aa]">Total P&L (24h)</p>
              <div className={`flex items-center justify-end gap-1 font-mono-data ${portfolioChange >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                {portfolioChange >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                <span className="text-lg font-medium">{portfolioChange >= 0 ? '+' : ''}{portfolioChange.toFixed(2)}%</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]">
              <p className="text-[10px] text-[#52525b] uppercase tracking-widest font-bold mb-1">Invested</p>
              <p className="text-lg font-medium text-[#fafafa] font-mono-data">$${(portfolioValue - balance).toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]">
              <p className="text-[10px] text-[#52525b] uppercase tracking-widest font-bold mb-1">ROI (30d)</p>
              <p className="text-lg font-medium text-[#22c55e] font-mono-data">+12.4%</p>
            </div>
            <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]">
              <p className="text-[10px] text-[#52525b] uppercase tracking-widest font-bold mb-1">Active Trades</p>
              <p className="text-lg font-medium text-[#3b82f6] font-mono-data">4</p>
            </div>
          </div>
        </div>

        <div className="panel-surface p-6">
          <p className="text-sm font-medium text-[#fafafa] mb-4">Asset Allocation</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  isAnimationActive={false}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#1f1f1f',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {data.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] text-[#a1a1aa]">{item.name}</span>
                <span className="text-[10px] text-[#fafafa] font-mono-data ml-auto">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel-surface overflow-hidden">
        <div className="p-4 border-b border-[rgba(255,255,255,0.05)] flex items-center justify-between bg-[rgba(255,255,255,0.02)]">
          <span className="text-sm font-medium text-[#fafafa]">Asset Breakdown</span>
          <button className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-[#52525b]">
            <MoreHorizontal size={16} />
          </button>
        </div>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-[#52525b] border-b border-[rgba(255,255,255,0.05)]">
              <th className="px-6 py-4 font-medium">Asset</th>
              <th className="px-6 py-4 font-medium">Balance</th>
              <th className="px-6 py-4 font-medium">Value (USD)</th>
              <th className="px-6 py-4 font-medium">Allocation</th>
              <th className="px-6 py-4 font-medium text-right">P&L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">
            {tickers.slice(0, 4).map((ticker, i) => (
              <tr key={ticker.symbol} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#1f1f1f] flex items-center justify-center border border-[rgba(255,255,255,0.05)]">
                      <span className="text-[10px] font-bold text-[#fafafa]">{ticker.symbol.split('/')[0]}</span>
                    </div>
                    <span className="font-medium text-[#fafafa]">{ticker.symbol.split('/')[0]}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-[#a1a1aa] font-mono-data">
                  {(1.245 * (i + 1)).toFixed(3)} {ticker.symbol.split('/')[0]}
                </td>
                <td className="px-6 py-4 text-[#fafafa] font-mono-data">
                  $${(ticker.price * 1.245 * (i + 1)).toLocaleString()}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                      <div className="h-full bg-[#22c55e] rounded-full" style={{ width: `${25 - i * 5}%` }} />
                    </div>
                    <span className="text-[10px] text-[#52525b] font-mono-data">{25 - i * 5}%</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right font-mono-data text-[#22c55e]">
                  +$${(124.50 * (i + 1)).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
