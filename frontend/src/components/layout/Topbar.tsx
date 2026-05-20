import React, { useState } from 'react'
import { Search, Bell, Settings, TrendingUp, TrendingDown } from 'lucide-react'
import { useStore } from '@/store/useStore'

export default function Topbar() {
  const { portfolioValue, portfolioChange, aiStatus, alerts } = useStore()
  const [search, setSearch] = useState('')
  const unread = alerts.filter(a => !a.read).length

  const statusColor = {
    'online': 'text-green-trade',
    'learning': 'text-gold',
    'trading': 'text-blue-ai',
    'offline': 'text-red-trade',
  }[aiStatus] || 'text-text-muted'

  return (
    <header className="h-16 bg-bg-secondary border-b border-bg-border flex items-center justify-between px-6 gap-4 shrink-0">
      {/* Left: Search */}

      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search symbols, strategies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-bg-tertiary border border-bg-border rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold/50 transition-colors"
          />
        </div>
      </div>

      {/* Center: Key Metrics */}
      <div className="flex items-center gap-6">
        {/* Portfolio Value */}
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-xs uppercase tracking-wider">Portfolio</span>
          <span className="text-white text-lg font-bold font-mono">
            {portfolioValue > 0 ? `$${portfolioValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
          </span>
          <div className={`flex items-center gap-1 ${portfolioChange >= 0 ? 'text-green-trade' : 'text-red-trade'}`}>
            {portfolioChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span className="text-xs font-mono">{portfolioChange >= 0 ? '+' : ''}{portfolioChange.toFixed(2)}%</span>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-bg-border" />

        {/* AI Status */}
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-xs uppercase tracking-wider">AI</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${statusColor} animate-pulse-dot`} />
            <span className={`text-xs font-medium uppercase tracking-wider ${statusColor}`}>{aiStatus}</span>
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        <button className="p-2 hover:bg-bg-hover rounded-lg transition-colors text-text-secondary hover:text-gold relative">
          <Bell size={18} />
          {unread > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-trade rounded-full" />}
        </button>
        <button className="p-2 hover:bg-bg-hover rounded-lg transition-colors text-text-secondary hover:text-gold">
          <Settings size={18} />
        </button>
        <div className="w-8 h-8 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-gold text-xs font-bold">
          C
        </div>
      </div>
    </header>
  )
}
