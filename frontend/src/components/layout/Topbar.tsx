import React, { useState } from 'react'
import { Search, Bell, Sparkles, ChevronDown } from 'lucide-react'
import { useStore } from '@/store/useStore'
import Logo from './Logo'

export default function Topbar() {
  const { alerts, isThinking } = useStore()
  const unread = alerts.filter(a => !a.read).length
  const [search, setSearch] = useState('')

  return (
    <header className="h-14 bg-bg-secondary border-b border-bg-border flex items-center px-6 gap-4 shrink-0">
      {/* Mobile logo */}
      <div className="lg:hidden">
        <Logo size={28} showText={false} />
      </div>

      {/* Page title area */}
      <div className="hidden lg:flex flex-col leading-none">
        <h1 className="text-white font-semibold text-base">Welcome back, Cozanet.</h1>
        <p className="text-text-secondary text-xs">Your AI. Your edge. Your vision.</p>
      </div>

      {/* PRO badge */}
      <span className="hidden lg:flex items-center px-2 py-0.5 bg-gold/10 border border-gold/30 rounded text-gold text-[10px] font-bold tracking-wider">
        PRO
      </span>

      {/* Search */}
      <div className="flex-1 max-w-sm ml-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search anything..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-bg-card border border-bg-border rounded-lg pl-9 pr-12 py-1.5 text-sm text-white placeholder-text-muted focus:outline-none focus:border-gold/50 transition-colors"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text-muted font-mono bg-bg-border px-1 rounded">⌘K</kbd>
        </div>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* AI Thinking indicator */}
        {isThinking && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-ai/10 rounded-full border border-blue-ai/20">
            <Sparkles size={12} className="text-blue-ai animate-pulse" />
            <span className="text-blue-ai text-xs font-mono">AI THINKING...</span>
          </div>
        )}

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-white/5 transition-colors">
          <Bell size={18} className="text-text-secondary" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-gold rounded-full text-[9px] font-bold text-black flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>

        {/* AI sparkle */}
        <button className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <Sparkles size={18} className="text-text-secondary hover:text-gold transition-colors" />
        </button>

        {/* Avatar */}
        <button className="flex items-center gap-2 p-1 rounded-lg hover:bg-white/5 transition-colors">
          <div className="w-7 h-7 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center">
            <span className="text-gold text-xs font-bold">C</span>
          </div>
        </button>
      </div>
    </header>
  )
}
