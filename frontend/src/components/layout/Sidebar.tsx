import React from 'react'
import { LayoutDashboard, MessageSquare, BarChart2, LineChart, Briefcase, Bell, Workflow, Plug, Brain, Settings, TrendingUp } from 'lucide-react'
import Logo from './Logo'
import { useStore } from '@/store/useStore'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'ai-chat', label: 'AI Chat', icon: MessageSquare },
  { id: 'market', label: 'Market Overview', icon: BarChart2 },
  { id: 'analysis', label: 'Trading Analysis', icon: LineChart },
  { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'workflows', label: 'Workflows', icon: Workflow },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'memory', label: 'Memory Center', icon: Brain },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const { activeTab, setActiveTab, aiStatus } = useStore()

  return (
    <aside className="w-56 bg-bg-secondary border-r border-bg-border flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="p-4 border-b border-bg-border">
        <Logo size={36} />
        <p className="text-text-secondary text-[10px] mt-2 uppercase tracking-widest font-mono">
          Your Personal<br/>Trading Copilot
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all ${
              activeTab === id
                ? 'bg-gold/10 text-gold border-r-2 border-gold font-medium'
                : 'text-text-secondary hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* User + AI Status */}
      <div className="p-4 border-t border-bg-border">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center">
            <span className="text-gold text-xs font-bold">C</span>
          </div>
          <div>
            <p className="text-white text-xs font-medium">Cozanet</p>
            <p className="text-text-muted text-[10px]">Pro User</p>
          </div>
          <TrendingUp size={14} className="ml-auto text-green-trade" />
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full pulse-dot ${
            aiStatus === 'online' ? 'bg-green-trade' :
            aiStatus === 'learning' ? 'bg-gold' :
            aiStatus === 'trading' ? 'bg-blue-ai' : 'bg-red-trade'
          }`} />
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-secondary">
            AI Status: <span className={
              aiStatus === 'online' ? 'text-green-trade' :
              aiStatus === 'learning' ? 'text-gold' :
              aiStatus === 'trading' ? 'text-blue-ai' : 'text-red-trade'
            }>{aiStatus}</span>
          </span>
        </div>
      </div>
    </aside>
  )
}
