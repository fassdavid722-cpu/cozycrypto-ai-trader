import React from 'react'
import { ChevronLeft, ChevronRight, BarChart3, TrendingUp, Wallet, MessageSquare, LogOut, ShieldCheck } from 'lucide-react'
import Logo from './Logo'
import { useStore } from '@/store/useStore'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'market', label: 'Market', icon: TrendingUp },
  { id: 'portfolio', label: 'Portfolio', icon: Wallet },
  { id: 'ai-chat', label: 'AI Chat', icon: MessageSquare },
]

export default function Sidebar() {
  const { activeTab, setActiveTab, sidebarOpen, setSidebarOpen } = useStore()

  return (
    <aside className={`flex flex-col h-screen bg-bg-primary border-r border-bg-border/40 transition-all duration-500 ease-in-out ${sidebarOpen ? 'w-64' : 'w-20'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-bg-border/40 bg-black/10">
        {sidebarOpen ? (
          <div className="flex items-center gap-3">
            <Logo showText={false} size={28} />
            <div className="flex flex-col">
              <span className="text-white font-bold text-sm tracking-tight">CozyCrypto</span>
              <span className="text-[9px] text-gold font-bold uppercase tracking-[0.2em]">AI Trader</span>
            </div>
          </div>
        ) : (
          <div className="mx-auto">
            <Logo showText={false} size={28} />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 scrollbar-hide">
        <div className="space-y-1.5">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-300 group ${
                activeTab === id
                  ? 'bg-gold text-black font-bold shadow-lg shadow-gold/20'
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              }`}
              title={!sidebarOpen ? label : ''}
            >
              <Icon size={18} className={`flex-shrink-0 ${activeTab === id ? 'text-black' : 'group-hover:text-gold transition-colors'}`} />
              {sidebarOpen && <span className="text-sm tracking-wide">{label}</span>}
            </button>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 space-y-3 bg-black/10 border-t border-bg-border/40">
        {sidebarOpen && (
          <div className="px-4 py-3 bg-bg-secondary/50 rounded-2xl border border-bg-border/40 backdrop-blur-sm">
            <p className="text-[11px] text-white font-medium flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              AI Autonomous
            </p>
          </div>
        )}
        
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-text-secondary hover:text-red-400 hover:bg-red-400/5 transition-all group">
          <LogOut size={18} className="flex-shrink-0 group-hover:rotate-180 transition-transform duration-500" />
          {sidebarOpen && <span className="text-sm font-medium">Disconnect</span>}
        </button>
        
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="w-full flex items-center justify-center p-2 hover:bg-white/5 rounded-xl transition-colors text-text-muted"
        >
          {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
    </aside>
  )
}
