import React from 'react'
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useStore } from '@/store/useStore'
import Card from '@/components/ui/Card'

export default function Portfolio() {
  const { portfolioValue, portfolioChange, portfolioHistory, trades, balance } = useStore()

  const closedTrades = trades.filter(t => t.status === 'closed')
  const openTrades = trades.filter(t => t.status === 'open')
  const totalPnL = closedTrades.reduce((acc, t) => acc + (t.pnl || 0), 0)

  return (
    <div className="h-full overflow-y-auto space-y-4">
      <h2 className="text-white font-semibold text-lg">Portfolio</h2>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Value', value: `$${portfolioValue.toFixed(2)}`, sub: `${portfolioChange >= 0 ? '+' : ''}${portfolioChange.toFixed(2)}% today`, color: portfolioChange >= 0 ? 'text-green-trade' : 'text-red-trade' },
          { label: 'Available Balance', value: `$${balance.toFixed(2)}`, sub: 'Bitget', color: 'text-text-secondary' },
          { label: 'Open Trades', value: openTrades.length.toString(), sub: 'Active positions', color: 'text-blue-ai' },
          { label: 'Total P&L', value: `${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`, sub: 'All time', color: totalPnL >= 0 ? 'text-green-trade' : 'text-red-trade' },
        ].map(s => (
          <Card key={s.label}>
            <p className="text-text-muted text-[10px] uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-white text-xl font-bold font-mono">{s.value}</p>
            <p className={`text-xs mt-1 ${s.color}`}>{s.sub}</p>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card>
        <p className="text-white text-xs font-semibold uppercase tracking-wider mb-3">Portfolio Performance</p>
        <div className="h-48">
          {portfolioHistory.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={portfolioHistory}>
                <defs>
                  <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D4A1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00D4A1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2A" />
                <XAxis dataKey="time" tick={{ fill: '#555570', fontSize: 10 }} />
                <YAxis tick={{ fill: '#555570', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#16161E', border: '1px solid #1E1E2A', borderRadius: 8, fontSize: 11 }} />
                <Area type="monotone" dataKey="value" stroke="#00D4A1" fill="url(#pGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <DollarSign size={32} className="text-text-muted mx-auto mb-2" />
                <p className="text-text-muted text-sm">No trading history yet</p>
                <p className="text-text-muted text-xs mt-1">The AI will start trading once connected to Bitget</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Trade History */}
      <Card>
        <p className="text-white text-xs font-semibold uppercase tracking-wider mb-3">Recent Trades</p>
        {trades.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-6">No trades yet — AI is learning the market</p>
        ) : (
          <div className="space-y-2">
            {trades.slice(0, 20).map(t => (
              <div key={t.id} className="flex items-center gap-3 py-1.5 border-b border-bg-border last:border-0">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.side === 'buy' ? 'bg-green-trade/20 text-green-trade' : 'bg-red-trade/20 text-red-trade'}`}>
                  {t.side.toUpperCase()}
                </span>
                <span className="text-white text-xs font-medium">{t.symbol}</span>
                <span className="text-text-secondary text-xs font-mono">{t.quantity} @ ${t.price.toFixed(4)}</span>
                {t.pnl !== undefined && (
                  <span className={`ml-auto text-xs font-mono font-bold ${t.pnl >= 0 ? 'text-green-trade' : 'text-red-trade'}`}>
                    {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(4)}
                  </span>
                )}
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${t.status === 'open' ? 'bg-blue-ai/20 text-blue-ai' : 'bg-bg-border text-text-muted'}`}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
