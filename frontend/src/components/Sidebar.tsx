import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
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

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: BarChart3, label: 'Market', path: '/market' },
  { icon: PieChart, label: 'Portfolio', path: '/portfolio' },
  { icon: Bot, label: 'AI Agent', path: '/ai-agent' },
  { icon: ClipboardList, label: 'Positions', path: '/positions' },
  { icon: Receipt, label: 'Orders', path: '/orders' },
  { icon: Settings, label: 'Settings', path: '/settings' },
]

interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  content: string
  timestamp: Date
  metadata?: {
    coin?: string
    confidence?: number
    source?: string
  }
}

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'ai',
      content: 'Welcome to CozyCrypto AI. I\'m your personal crypto intelligence agent. Ask me to scan any coin or analyze market conditions.',
      timestamp: new Date(),
      metadata: { source: 'System', confidence: 100 },
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleSend = () => {
    if (!inputValue.trim()) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    }

    setChatMessages(prev => [...prev, userMsg])
    setInputValue('')
    setIsTyping(true)

    // Simulate AI response
    setTimeout(() => {
      const lowerInput = inputValue.toLowerCase()
      let aiResponse: ChatMessage

      if (lowerInput.includes('btc') || lowerInput.includes('bitcoin')) {
        aiResponse = {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: 'BTC/USDT Analysis Complete:\n\nCurrent Price: $67,230.45\n24h Change: +2.34%\nAI Confidence: 94%\n\nTechnical Indicators:\n- RSI: 62.4 (Neutral-Bullish)\n- MACD: Bullish crossover detected\n- Support: $65,800 | Resistance: $68,500\n\nSentiment: Strong Buy signal from on-chain metrics. Whale accumulation increasing.',
          timestamp: new Date(),
          metadata: { coin: 'BTC/USDT', confidence: 94, source: 'Technical Analysis Engine' },
        }
      } else if (lowerInput.includes('eth') || lowerInput.includes('ethereum')) {
        aiResponse = {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: 'ETH/USDT Analysis Complete:\n\nCurrent Price: $3,420.18\n24h Change: +1.87%\nAI Confidence: 89%\n\nTechnical Indicators:\n- RSI: 58.2 (Neutral)\n- MACD: Convergence forming\n- Support: $3,280 | Resistance: $3,550\n\nSentiment: Moderate Buy. DeFi TVL growth positive. Network activity above average.',
          timestamp: new Date(),
          metadata: { coin: 'ETH/USDT', confidence: 89, source: 'Technical Analysis Engine' },
        }
      } else if (lowerInput.includes('scan') || lowerInput.includes('analyze')) {
        const coin = lowerInput.replace(/scan|analyze/g, '').trim().toUpperCase() || 'MARKET'
        aiResponse = {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: `${coin} Scan Initiated...\n\nScanning complete. AI has analyzed:\n- Price action across 12 timeframes\n- On-chain metrics and whale movements\n- Social sentiment from 50+ sources\n- Correlation with major indices\n\nResult: Bullish momentum building. Key resistance levels identified. Recommend viewing the detailed chart in the Market Overview.`,
          timestamp: new Date(),
          metadata: { coin: `${coin}/USDT`, confidence: 87, source: 'Multi-Source Analysis' },
        }
      } else {
        aiResponse = {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: 'I can analyze any cryptocurrency for you. Try asking:\n\n"Scan BTC" or "Analyze Ethereum"\n\nI\'ll provide technical indicators, sentiment analysis, and AI confidence scores based on real-time market data.',
          timestamp: new Date(),
          metadata: { source: 'NLP Router', confidence: 100 },
        }
      }

      setChatMessages(prev => [...prev, aiResponse])
      setIsTyping(false)
    }, 1500)
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
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-[#1f1f1f] text-[#fafafa] border border-[rgba(255,255,255,0.15)]'
                  : 'text-[#a1a1aa] hover:bg-[#1f1f1f] hover:text-[#fafafa]'
              }`}
            >
              <item.icon size={18} />
              <span className="font-medium">{item.label}</span>
              {item.label === 'AI Agent' && (
                <span className="ml-auto flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
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
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
            <span className="text-[10px] text-[#22c55e]">Online</span>
          </span>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto px-3 space-y-3 scrollbar-thin min-h-0">
          {chatMessages.map((msg) => (
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
              {msg.metadata && (
                <div className="flex items-center gap-2 mt-1 px-1">
                  {msg.metadata.confidence && (
                    <span className="text-[10px] text-[#22c55e] font-mono-data">
                      {msg.metadata.confidence}% confidence
                    </span>
                  )}
                  {msg.metadata.source && (
                    <span className="text-[10px] text-[#52525b]">
                      via {msg.metadata.source}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
          {isTyping && (
            <div className="flex items-center gap-2 text-[#52525b] text-xs">
              <Sparkles size={12} className="animate-pulse text-[#22c55e]" />
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
              onClick={() => {
                setInputValue(action.prompt)
                inputRef.current?.focus()
              }}
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
              onClick={handleSend}
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
            <p className="text-[10px] text-[#52525b]">Pro Plan</p>
          </div>
          <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
        </div>
      </div>
    </aside>
  )
}
