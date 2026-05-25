import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'
import { TrendingUp, TrendingDown, Activity, Zap, Shield, Clock } from 'lucide-react'
import TopBar from '../TopBar'
import { useStore } from '@/store/useStore'

// AI Health Badge Component
function AiHealthBadge({ source, confidence }: { source: string; confidence: number }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)]">
      <Shield size={10} className="text-[#22c55e]" />
      <span className="text-[10px] text-[#22c55e]">{confidence}%</span>
      <span className="text-[10px] text-[#52525b]">{source}</span>
    </div>
  )
}

export default function Dashboard() {
  const { tickers, portfolioValue, portfolioChange, portfolioHistory, trades, aiStatus } = useStore()
  const [activeTimeframe, setActiveTimeframe] = useState('1D')
  
  const timeframes = ['1H', '1D', '1W', '1M']
  
  const btcTicker = tickers.find(t => t.symbol === 'BTC/USDT') || { price: 0, change24h: 0 }
  const ethTicker = tickers.find(t => t.symbol === 'ETH/USDT') || { price: 0, change24h: 0 }
  const solTicker = tickers.find(t => t.symbol === 'SOL/USDT') || { price: 0, change24h: 0 }
  const bnbTicker = tickers.find(t => t.symbol === 'BNB/USDT') || { price: 0, change24h: 0 }

  const predictions = [
    { coin: 'BTC', price: `$${btcTicker.price.toLocaleString()}`, prediction: `${btcTicker.change24h >= 0 ? '+' : ''}${btcTicker.change24h}%`, bullish: btcTicker.change24h >= 0, sparkline: btcTicker.sparkline },
    { coin: 'ETH', price: `$${ethTicker.price.toLocaleString()}`, prediction: `${ethTicker.change24h >= 0 ? '+' : ''}${ethTicker.change24h}%`, bullish: ethTicker.change24h >= 0, sparkline: ethTicker.sparkline },
    { coin: 'SOL', price: `$${solTicker.price.toLocaleString()}`, prediction: `${solTicker.change24h >= 0 ? '+' : ''}${solTicker.change24h}%`, bullish: solTicker.change24h >= 0, sparkline: solTicker.sparkline },
    { coin: 'BNB', price: `$${bnbTicker.price.toLocaleString()}`, prediction: `${bnbTicker.change24h >= 0 ? '+' : ''}${bnbTicker.change24h}%`, bullish: bnbTicker.change24h >= 0, sparkline: bnbTicker.sparkline },
  ]

  return (
    <div className="p-6 min-h-full">
      <TopBar title="Dashboard" subtitle="Overview of market activity" />

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="panel-surface p-4 hover:border-[rgba(255,255,255,0.15)] transition-all group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#a1a1aa]">Total Equity</span>
            <AiHealthBadge source="Portfolio Engine" confidence={99} />
          </div>
          <p className="text-2xl font-medium text-[#fafafa] font-mono-data">$${portfolioValue.toLocaleString()}</p>
          <div className="flex items-center gap-1 mt-1">
            {portfolioChange >= 0 ? <TrendingUp size={12} className="text-[#22c55e]" /> : <TrendingDown size={12} className="text-[#ef4444]" />}
            <span className={`text-xs ${portfolioChange >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{portfolioChange >= 0 ? '+' : ''}{portfolioChange.toFixed(2)}%</span>
            <span className="text-[10px] text-[#52525b] ml-1">vs last 24h</span>
          </div>
        </div>

        <div className="panel-surface p-4 hover:border-[rgba(255,255,255,0.15)] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#a1a1aa]">AI Status</span>
            <AiHealthBadge source="Core Brain" confidence={100} />
          </div>
          <p className="text-2xl font-medium text-[#fafafa] font-mono-data uppercase tracking-widest">{aiStatus}</p>
          <div className="mt-1">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgba(34,197,94,0.1)] text-[10px] ${aiStatus === 'trading' ? 'text-[#22c55e]' : 'text-gold'}`}>
              <Activity size={10} />
              {aiStatus === 'trading' ? 'Autonomous Mode Active' : 'AI is Learning'}
            </span>
          </div>
        </div>

        <div className="panel-surface p-4 hover:border-[rgba(255,255,255,0.15)] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#a1a1aa]">Market Sentiment</span>
            <AiHealthBadge source="NLP Engine" confidence={88} />
          </div>
          <p className="text-2xl font-medium text-[#fafafa] font-mono-data">BULLISH</p>
          <div className="flex items-center gap-1 mt-1">
            <TrendingUp size={12} className="text-[#22c55e]" />
            <span className="text-xs text-[#22c55e]">72/100</span>
            <span className="text-[10px] text-[#52525b] ml-1">Greed</span>
          </div>
        </div>

        <div className="panel-surface p-4 hover:border-[rgba(255,255,255,0.15)] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#a1a1aa]">Recent P&L</span>
            <AiHealthBadge source="Trade Tracker" confidence={97} />
          </div>
          <p className="text-2xl font-medium text-[#fafafa] font-mono-data">+,245.30</p>
          <div className="flex items-center gap-1 mt-1">
            <TrendingUp size={12} className="text-[#22c55e]" />
            <span className="text-xs text-[#22c55e]">+4.2%</span>
            <span className="text-[10px] text-[#52525b] ml-1">last 7 trades</span>
          </div>
        </div>
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="col-span-3 panel-surface p-4 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-[#22c55e]" />
              <span className="text-sm font-medium text-[#fafafa]">Live Market Chart</span>
              <AiHealthBadge source="Bitget API" confidence={99} />
            </div>
            <div className="flex items-center gap-1 bg-[rgba(255,255,255,0.03)] rounded-lg p-0.5">
              {timeframes.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setActiveTimeframe(tf)}
                  className={`px-3 py-1 rounded-md text-xs transition-all ${
                    activeTimeframe === tf
                      ? 'bg-[#1f1f1f] text-[#fafafa] border border-[rgba(255,255,255,0.15)]'
                      : 'text-[#52525b] hover:text-[#a1a1aa]'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div className="relative h-64">
            <div className="relative z-10 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={portfolioHistory.length > 0 ? portfolioHistory : [{time: '00:00', value: 0}]}>
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: '#52525b', fontSize: 10 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#52525b', fontSize: 10 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    tickLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#1f1f1f',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#chartGradient)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="col-span-2 space-y-4">
          <div className="panel-surface p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} className="text-[#3b82f6]" />
              <span className="text-sm font-medium text-[#fafafa]">AI Predictions (24h)</span>
              <AiHealthBadge source="ML Models" confidence={92} />
            </div>
            <div className="space-y-3">
              {predictions.map((pred) => (
                <div key={pred.coin} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#1f1f1f] flex items-center justify-center">
                    <span className="text-xs font-semibold text-[#fafafa]">{pred.coin}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#fafafa] font-mono-data">{pred.price}</span>
                      <span className={`text-xs font-medium font-mono-data ${pred.bullish ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                        {pred.prediction}
                      </span>
                    </div>
                    <div className="h-6 mt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={(pred.sparkline || []).map((v, i) => ({ i, v }))}>
                          <Line
                            type="monotone"
                            dataKey="v"
                            stroke={pred.bullish ? '#22c55e' : '#ef4444'}
                            strokeWidth={1.5}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel-surface p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={16} className="text-[#22c55e]" />
              <span className="text-sm font-medium text-[#fafafa]">System Status</span>
              <AiHealthBadge source="Health Check" confidence={100} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#a1a1aa]">Market Scanning</span>
                <span className="text-[10px] text-[#22c55e] font-bold uppercase tracking-widest">Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#a1a1aa]">Strategy Execution</span>
                <span className="text-[10px] text-[#22c55e] font-bold uppercase tracking-widest">Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#a1a1aa]">Risk Monitoring</span>
                <span className="text-[10px] text-[#22c55e] font-bold uppercase tracking-widest">Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#a1a1aa]">Learning & Adapting</span>
                <span className="text-[10px] text-gold font-bold uppercase tracking-widest">Processing</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="panel-surface p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-[#a1a1aa]" />
              <span className="text-sm font-medium text-[#fafafa]">Recent Trades</span>
            </div>
            <button className="text-[10px] text-[#52525b] hover:text-[#a1a1aa] uppercase tracking-widest font-bold">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[#52525b] border-b border-[rgba(255,255,255,0.05)]">
                  <th className="pb-2 font-medium">Pair</th>
                  <th className="pb-2 font-medium">Side</th>
                  <th className="pb-2 font-medium">Price</th>
                  <th className="pb-2 font-medium">P&L</th>
                  <th className="pb-2 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">
                {trades.slice(0, 5).map((trade, i) => (
                  <tr key={i} className="group">
                    <td className="py-2.5 font-medium text-[#fafafa]">{trade.symbol}</td>
                    <td className="py-2.5">
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${trade.side === 'buy' ? 'bg-[rgba(34,197,94,0.1)] text-[#22c55e]' : 'bg-[rgba(239,68,68,0.1)] text-[#ef4444]'}`}>
                        {trade.side}
                      </span>
                    </td>
                    <td className="py-2.5 text-[#a1a1aa] font-mono-data">$${trade.price.toLocaleString()}</td>
                    <td className={`py-2.5 font-mono-data ${(trade.pnl || 0) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {(trade.pnl || 0) >= 0 ? '+' : ''}$${(trade.pnl || 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 text-[#52525b] text-right font-mono-data">{new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel-surface p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-[#a1a1aa]" />
              <span className="text-sm font-medium text-[#fafafa]">Market Heatmap</span>
            </div>
            <button className="text-[10px] text-[#52525b] hover:text-[#a1a1aa] uppercase tracking-widest font-bold">Full Map</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {tickers.slice(0, 9).map((ticker) => (
              <div key={ticker.symbol} className="p-3 rounded-lg bg-[#1f1f1f] border border-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.15)] transition-all">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-[#fafafa]">{ticker.symbol.split('/')[0]}</span>
                  <span className={`text-[10px] font-bold ${ticker.change24h >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                    {ticker.change24h >= 0 ? '+' : ''}{ticker.change24h}%
                  </span>
                </div>
                <p className="text-[10px] text-[#52525b] font-mono-data">$${ticker.price.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
