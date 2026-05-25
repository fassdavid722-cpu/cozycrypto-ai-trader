import { useState, useRef, useEffect } from 'react'
import {
  LayoutDashboard,
  BarChart3,
  PieChart,
  Bot,
  Settings,
  ClipboardList,
  Receipt,
  Send,
  Sparkles,
  ScanLine,
  TrendingUp,
  Activity,
  BrainCircuit,
} from 'lucide-react'
import { useStore } from '@/store/useStore'

const navItems = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'market', icon: BarChart3, label: 'Market' },
  { id: 'portfolio', icon: PieChart, label: 'Portfolio' },
  { id: 'ai-chat', icon: Bot, label: 'AI Agent' },
  { id: 'workflows', icon: ClipboardList, label: 'Workflows' },
  { id: 'settings', icon: Settings, label: 'Settings' },
]

const API = import.meta.env.VITE_API_URL || ''

export default function Sidebar() {
  const { activeTab, setActiveTab, messages, addMessage, isThinking, setThinking, aiStatus } = useStore()
  const [inputValue, setInputValue] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages])

  const handleSend = async (msg?: string) => {
    const text = (msg || inputValue).trim()
    if (!text) return

    setInputValue('')
    addMessage({ id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() })
    setThinking(true)

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: 'sidebar_chat', history: messages.slice(-10), save: true })
      })
      const data = await res.json()
      addMessage({ 
        id: (Date.now() + 1).toString(), 
        role: 'ai', 
        content: data.reply, 
        thinking: data.thinking,
        timestamp: Date.now() 
      })
    } catch {
      addMessage({ id: (Date.now() + 1).toString(), role: 'ai', content: "Connection issue — retrying shortly.", timestamp: Date.now() })
    } finally {
      setThinking(false)
    }
  }

  const quickActions = [
    { label: 'Scan BTC', icon: ScanLine, prompt: 'Scan BTC' },
    { label: 'Scan ETH', icon: ScanLine, prompt: 'Scan ETH' },
    { label: 'Market Overview', icon: TrendingUp, prompt: 'Analyze market overview' },
    { label: 'Fear & Greed', icon: Activity, prompt: 'Show fear and greed index' },
  ]

  return (
    <aside className="w-[320px] h-full bg-[#111111] border-r border-[rgba(255,255,255,0.08)] flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-4 flex items-center gap-3 border-b border-[rgba(255,255,255,0.08)]">
        <img src="/images/logo-cozy-crypto.png" alt="CozyCrypto AI" className="w-8 h-8" />
        <div>
          <h1 className="text-sm font-semibold text-[#fafafa] tracking-tight">CozyCrypto AI</h1>
          <p className="text-[10px] text-[#52525b]">Intelligence Dashboard</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-[#1f1f1f] text-[#fafafa] border border-[rgba(255,255,255,0.15)]'
                  : 'text-[#a1a1aa] hover:bg-[#1f1f1f] hover:text-[#fafafa]'
              }`}
            >
              <item.icon size={18} />
              <span className="font-medium">{item.label}</span>
              {item.id === 'ai-chat' && (
                <span className="ml-auto flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${aiStatus === 'trading' ? 'bg-[#22c55e]' : 'bg-gold'}`} />
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* AI Chat Interface */}
      <div className="flex-1 flex flex-col min-h-0 border-t border-[rgba(255,255,255,0.08)] mt-2">
        {/* Chat Header */}
        <div className="px-4 py-3 flex items-center gap-2">
          <BrainCircuit size={16} className="text-[#22c55e]" />
          <span className="text-xs font-medium text-[#fafafa]">AI Assistant</span>
          <span className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.3)]">
            <span className={`w-1.5 h-1.5 rounded-full ${aiStatus === 'trading' ? 'bg-[#22c55e]' : 'bg-gold'}`} />
            <span className="text-[10px] text-[#22c55e] uppercase tracking-widest font-bold">{aiStatus}</span>
          </span>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto px-3 space-y-3 scrollbar-thin min-h-0">
          {messages.slice(-20).map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[95%] px-3 py-2 rounded-lg text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#22c55e] text-white'
                    : 'bg-[#1f1f1f] text-[#fafafa] border border-[rgba(255,255,255,0.08)]'
                }`}
              >
                <p className="whitespace-pre-line">{msg.content}</p>
              </div>
            </div>
          ))}
          {isThinking && (
            <div className="flex items-center gap-2 text-[#52525b] text-xs">
              <Sparkles size={12} className="text-[#22c55e]" />
              <span>AI analyzing...</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick Actions */}
        <div className="px-3 py-2 flex flex-wrap gap-1.5">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => handleSend(action.prompt)}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] text-[10px] text-[#a1a1aa] hover:text-[#fafafa] hover:border-[rgba(255,255,255,0.15)] transition-all"
            >
              <action.icon size={10} />
              {action.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-2 bg-[#1f1f1f] rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-2 focus-within:border-[rgba(34,197,94,0.3)] transition-colors">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask AI to scan a coin..."
              className="flex-1 bg-transparent text-xs text-[#fafafa] placeholder:text-[#52525b] outline-none"
            />
            <button
              onClick={() => handleSend()}
              className="p-1 rounded-md bg-[#22c55e] text-white hover:bg-[#16a34a] transition-colors"
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* User Profile */}
      <div className="p-3 border-t border-[rgba(255,255,255,0.08)]">
        <div className="flex items-center gap-2.5">
          <img
            src="/images/avatar-user.jpg"
            alt="User"
            className="w-8 h-8 rounded-full border border-[rgba(255,255,255,0.08)]"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#fafafa] truncate">Admin</p>
            <p className="text-[10px] text-[#52525b]">Autonomous Mode</p>
          </div>
          <div className={`w-2 h-2 rounded-full ${aiStatus === 'trading' ? 'bg-[#22c55e]' : 'bg-gold'}`} />
        </div>
      </div>
    </aside>
  )
}
