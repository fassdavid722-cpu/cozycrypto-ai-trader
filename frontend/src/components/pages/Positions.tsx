import { useStore } from '@/store/useStore'
import TopBar from '../TopBar'
import { MoreHorizontal, Shield, Target, AlertCircle } from 'lucide-react'

export default function Positions() {
  const { trades } = useStore()
  const openPositions = trades.filter(t => t.status === 'open')

  return (
    <div className="p-6 min-h-full">
      <TopBar title="Open Positions" subtitle="Manage your active trading positions" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="panel-surface p-4">
          <p className="text-[10px] text-[#52525b] uppercase tracking-widest font-bold mb-1">Total Positions</p>
          <p className="text-xl font-medium text-[#fafafa] font-mono-data">{openPositions.length}</p>
        </div>
        <div className="panel-surface p-4">
          <p className="text-[10px] text-[#52525b] uppercase tracking-widest font-bold mb-1">Total Value</p>
          <p className="text-xl font-medium text-[#fafafa] font-mono-data">$${openPositions.reduce((acc, p) => acc + (p.price * p.quantity), 0).toLocaleString()}</p>
        </div>
        <div className="panel-surface p-4">
          <p className="text-[10px] text-[#52525b] uppercase tracking-widest font-bold mb-1">Unrealized P&L</p>
          <p className="text-xl font-medium text-[#22c55e] font-mono-data">+,065.63</p>
        </div>
        <div className="panel-surface p-4">
          <p className="text-[10px] text-[#52525b] uppercase tracking-widest font-bold mb-1">Avg. AI Confidence</p>
          <p className="text-xl font-medium text-[#3b82f6] font-mono-data">86%</p>
        </div>
      </div>

      <div className="panel-surface overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-[#52525b] border-b border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)]">
              <th className="px-6 py-4 font-medium">Pair</th>
              <th className="px-6 py-4 font-medium">Side</th>
              <th className="px-6 py-4 font-medium">Size</th>
              <th className="px-6 py-4 font-medium">Entry Price</th>
              <th className="px-6 py-4 font-medium">Current Price</th>
              <th className="px-6 py-4 font-medium">P&L (USD)</th>
              <th className="px-6 py-4 font-medium">AI Confidence</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">
            {openPositions.length > 0 ? openPositions.map((pos) => (
              <tr key={pos.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                <td className="px-6 py-4 font-medium text-[#fafafa]">{pos.symbol}</td>
                <td className="px-6 py-4">
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${pos.side === 'buy' ? 'bg-[rgba(34,197,94,0.1)] text-[#22c55e]' : 'bg-[rgba(239,68,68,0.1)] text-[#ef4444]'}`}>
                    {pos.side === 'buy' ? 'LONG' : 'SHORT'}
                  </span>
                </td>
                <td className="px-6 py-4 text-[#a1a1aa] font-mono-data">{pos.quantity} {pos.symbol.split('/')[0]}</td>
                <td className="px-6 py-4 text-[#a1a1aa] font-mono-data">$${pos.price.toLocaleString()}</td>
                <td className="px-6 py-4 text-[#fafafa] font-mono-data">$${(pos.price * 1.02).toLocaleString()}</td>
                <td className="px-6 py-4">
                  <div className="font-mono-data text-[#22c55e]">
                    +$${(pos.price * pos.quantity * 0.02).toFixed(2)}
                    <span className="text-[10px] ml-1.5 opacity-70">(+2.15%)</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden w-16">
                      <div className="h-full bg-[#3b82f6] rounded-full" style={{ width: '92%' }} />
                    </div>
                    <span className="text-[10px] text-[#3b82f6] font-mono-data">92%</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-[#52525b]">
                    <MoreHorizontal size={16} />
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-[#52525b]">
                    <AlertCircle size={24} />
                    <p className="text-sm">No open positions found</p>
                    <p className="text-[10px] uppercase tracking-widest">AI is currently scanning for opportunities</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Risk Overview */}
      <div className="mt-6 grid grid-cols-3 gap-6">
        <div className="panel-surface p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={16} className="text-[#22c55e]" />
            <span className="text-sm font-medium text-[#fafafa]">Risk Management</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#a1a1aa]">Total Exposure</span>
              <span className="text-xs text-[#fafafa] font-mono-data">64.3%</span>
            </div>
            <div className="w-full h-1.5 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
              <div className="h-full bg-[#22c55e] rounded-full" style={{ width: '64.3%' }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#a1a1aa]">Risk Level</span>
              <span className="px-2 py-0.5 rounded-full bg-[rgba(34,197,94,0.1)] text-[10px] text-[#22c55e] font-bold uppercase">Low</span>
            </div>
          </div>
        </div>

        <div className="panel-surface p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target size={16} className="text-[#3b82f6]" />
            <span className="text-sm font-medium text-[#fafafa]">Take Profit / Stop Loss</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#a1a1aa]">Avg. TP Distance</span>
              <span className="text-[#22c55e] font-mono-data">+4.5%</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#a1a1aa]">Avg. SL Distance</span>
              <span className="text-[#ef4444] font-mono-data">-1.5%</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#a1a1aa]">Risk/Reward Ratio</span>
              <span className="text-[#fafafa] font-mono-data">1:3.0</span>
            </div>
          </div>
        </div>

        <div className="panel-surface p-4 flex flex-col justify-center items-center text-center">
          <p className="text-[10px] text-[#52525b] uppercase tracking-widest font-bold mb-2">Autonomous Mode</p>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.2)]">
            <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
            <span className="text-xs font-bold text-[#22c55e] uppercase tracking-widest">Active</span>
          </div>
          <p className="text-[10px] text-[#52525b] mt-2">AI is managing orders automatically</p>
        </div>
      </div>
    </div>
  )
}
