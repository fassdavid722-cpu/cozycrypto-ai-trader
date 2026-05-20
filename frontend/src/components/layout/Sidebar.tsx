import React from 'react'
import { ChevronLeft, ChevronRight, BarChart3, TrendingUp, Wallet, MessageSquare, Zap, Settings, LogOut } from 'lucide-react'
import Logo from './Logo'
import { useStore } from '@/store/useStore'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'market', label: 'Market', icon: TrendingUp },
  { id: 'portfolio', label: 'Portfolio', icon: Wallet },
  { id: 'ai-chat', label: 'AI Chat', icon: MessageSquare },
  { id: 'workflows', label: 'Workflows', icon: Zap },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const { activeTab, setActiveTab, sidebarOpen, setSidebarOpen } = useStore()

  return (
    <aside className={`flex flex-col h-screen bg-bg-primary border-r border-bg-border transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-bg-border">
        {sidebarOpen && <Logo showText={true} size={32} />}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 hover:bg-bg-hover rounded-lg transition-colors text-text-secondary hover:text-gold"
        >
          {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <div className="space-y-1">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                activeTab === id
                  ? 'bg-gold/20 text-gold border border-gold/30 shadow-glow-gold'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent'
              }`}
              title={!sidebarOpen ? label : ''}
            >
              <Icon size={18} className="flex-shrink-0" />
              {sidebarOpen && <span className="text-sm font-medium flex-1 text-left">{label}</span>}
            </button>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-bg-border p-3 space-y-2">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-text-secondary hover:text-red-trade hover:bg-bg-hover transition-colors">
          <LogOut size={18} className="flex-shrink-0" />
          {sidebarOpen && <span className="text-sm">Disconnect</span>}
        </button>
        {sidebarOpen && (
          <div className="px-3 py-2 bg-bg-secondary rounded-lg border border-bg-border">
            <p className="text-xs text-text-muted">Status</p>
            <p className="text-sm text-green-trade font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-trade animate-pulse-dot" />
              Connected
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
