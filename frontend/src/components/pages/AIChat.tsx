import { useState, useRef, useEffect } from 'react'
import { useStore } from '@/store/useStore'
import TopBar from '../TopBar'
import {
  Send, Sparkles, BrainCircuit, Bot, User, ChevronDown, ChevronUp,
  BarChart2, Wallet, Activity, ListOrdered, Layers, Settings2, Target, BookOpen
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''

// Quick command chips — each one queries a specific page/tool
const QUICK_COMMANDS = [
  { icon: Wallet,      label: 'Portfolio',      text: 'Show me my full portfolio and USDT balance' },
  { icon: Layers,      label: 'Positions',      text: 'What are my open positions and PnL?' },
  { icon: ListOrdered, label: 'Orders',         text: 'Show all my pending orders' },
  { icon: BarChart2,   label: 'Market',         text: 'Give me a market overview of BTC, ETH and SOL' },
  { icon: Activity,    label: 'Analyze BTC',    text: 'Analyze BTCUSDT with SMC — give me a trade setup' },
  { icon: Target,      label: 'Workflows',      text: 'What are my current trading goals and workflows?' },
  { icon: BookOpen,    label: 'Insights',       text: 'What have you learned so far? Show me your insights' },
  { icon: Settings2,   label: 'Risk Check',     text: 'Check my risk — I have $10 and want to trade BTC at current price with 2% SL' },
]

interface Message {
  id: string
  role: 'user' | 'ai'
  content: string
  thinking?: string
  timestamp: number
}

export default function AIChat() {
  const { messages, addMessage, isThinking, setThinking } = useStore()
  const [inputValue, setInputValue] = useState('')
  const [expandedThinking, setExpandedThinking] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  const send = async (text: string) => {
    if (!text.trim()) return
    setInputValue('')
    addMessage({ id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() })
    setThinking(true)

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: (messages as Message[]).slice(-12)
        })
      })
      const data = await res.json()
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: data.reply || data.error || 'No response received.',
        thinking: data.thinking,
        timestamp: Date.now()
      })
    } catch {
      addMessage({ id: (Date.now() + 1).toString(), role: 'ai', content: '⚠️ Connection issue — check if the API is live.', timestamp: Date.now() })
    } finally {
      setThinking(false)
    }
  }

  const handleSend = () => send(inputValue)
  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }

  return (
    <div className="p-6 h-full flex flex-col gap-4">
      <TopBar title="AI Intelligence" subtitle="Full dashboard access — portfolio, positions, orders, market & more" />

      {/* Quick commands */}
      <div className="flex flex-wrap gap-2">
        {QUICK_COMMANDS.map(cmd => (
          <button
            key={cmd.label}
            onClick={() => send(cmd.text)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[11px] text-[#a1a1aa] hover:text-white hover:border-[rgba(34,197,94,0.4)] hover:bg-[rgba(34,197,94,0.06)] transition-all"
          >
            <cmd.icon size={11} />
            {cmd.label}
          </button>
        ))}
      </div>

      {/* Chat window */}
      <div className="flex-1 panel-surface flex flex-col overflow-hidden min-h-0">
        {/* Header */}
        <div className="p-4 border-b border-[rgba(255,255,255,0.05)] flex items-center gap-3 bg-[rgba(255,255,255,0.02)] flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[rgba(34,197,94,0.1)] flex items-center justify-center">
            <BrainCircuit size={16} className="text-[#22c55e]" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">COZANET</p>
            <p className="text-[10px] text-[#52525b]">Autonomous AI Trader • 15 Tools Active</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
            <span className="text-[10px] text-[#22c55e]">LIVE</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {(messages as Message[]).length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
              <div className="w-16 h-16 rounded-2xl bg-[rgba(34,197,94,0.08)] flex items-center justify-center">
                <Sparkles size={28} className="text-[#22c55e]" />
              </div>
              <div>
                <p className="text-white font-medium mb-1">COZANET is ready</p>
                <p className="text-[#52525b] text-sm max-w-xs">Ask me anything about your portfolio, positions, market conditions, or let me run a trade analysis.</p>
              </div>
            </div>
          )}

          {(messages as Message[]).map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'ai' && (
                <div className="w-7 h-7 rounded-lg bg-[rgba(34,197,94,0.1)] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot size={13} className="text-[#22c55e]" />
                </div>
              )}
              <div className={`flex flex-col gap-1 max-w-[78%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {/* Thinking toggle */}
                {msg.role === 'ai' && msg.thinking && (
                  <button
                    onClick={() => setExpandedThinking(expandedThinking === msg.id ? null : msg.id)}
                    className="flex items-center gap-1 text-[10px] text-[#52525b] hover:text-[#22c55e] transition-colors"
                  >
                    <BrainCircuit size={10} />
                    {expandedThinking === msg.id ? 'Hide thinking' : 'Show thinking'}
                    {expandedThinking === msg.id ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                  </button>
                )}
                {msg.role === 'ai' && msg.thinking && expandedThinking === msg.id && (
                  <div className="p-3 rounded-lg bg-[rgba(34,197,94,0.04)] border border-[rgba(34,197,94,0.12)] text-[11px] text-[#71717a] leading-relaxed font-mono whitespace-pre-wrap">
                    {msg.thinking}
                  </div>
                )}
                {/* Main message */}
                <div className={`px-4 py-3 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.2)] text-white'
                    : 'bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[#e4e4e7]'
                }`}>
                  {msg.content}
                </div>
                <span className="text-[9px] text-[#3f3f46]">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-[rgba(255,255,255,0.06)] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User size={13} className="text-[#a1a1aa]" />
                </div>
              )}
            </div>
          ))}

          {isThinking && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-lg bg-[rgba(34,197,94,0.1)] flex items-center justify-center flex-shrink-0">
                <Bot size={13} className="text-[#22c55e]" />
              </div>
              <div className="px-4 py-3 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)]">
                <div className="flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="text-[10px] text-[#52525b] ml-1">COZANET is analyzing...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[rgba(255,255,255,0.05)] flex-shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about your portfolio, positions, market setup... or say 'analyze BTC'"
              rows={2}
              className="flex-1 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-sm text-white placeholder-[#3f3f46] focus:outline-none focus:border-[rgba(34,197,94,0.4)] resize-none transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isThinking}
              className="p-3 rounded-xl bg-[#22c55e] text-black hover:bg-[#16a34a] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-[9px] text-[#3f3f46] mt-2 text-center">
            COZANET has access to: Portfolio · Positions · Orders · Market Data · Trade History · Workflows · Insights
          </p>
        </div>
      </div>
    </div>
  )
}
