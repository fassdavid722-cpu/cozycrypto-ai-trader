import { useState, useRef, useEffect } from 'react'
import { useStore } from '@/store/useStore'
import TopBar from '../TopBar'
import { Send, Sparkles, BrainCircuit, Bot, User } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''

export default function AIChat() {
  const { messages, addMessage, isThinking, setThinking } = useStore()
  const [inputValue, setInputValue] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages])

  const handleSend = async () => {
    if (!inputValue.trim()) return

    const text = inputValue.trim()
    setInputValue('')
    addMessage({ id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() })
    setThinking(true)

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: 'main_chat', history: messages.slice(-10), save: true })
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

  return (
    <div className="p-6 h-full flex flex-col">
      <TopBar title="AI Intelligence" subtitle="Deep market analysis and strategy discussion" />

      <div className="flex-1 panel-surface flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[rgba(255,255,255,0.05)] flex items-center justify-between bg-[rgba(255,255,255,0.02)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[rgba(34,197,94,0.1)] flex items-center justify-center border border-[rgba(34,197,94,0.2)]">
              <BrainCircuit className="text-[#22c55e]" size={16} />
            </div>
            <div>
              <p className="text-xs font-medium text-[#fafafa]">CozyCrypto Brain v2.0</p>
              <p className="text-[10px] text-[#22c55e] uppercase tracking-widest font-bold">Online & Analyzing</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#52525b] uppercase tracking-widest font-bold">Model:</span>
            <span className="text-[10px] text-[#fafafa] font-mono-data bg-[#1f1f1f] px-2 py-1 rounded-md border border-[rgba(255,255,255,0.08)]">GROQ-LLAMA-3-70B</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center border ${
                msg.role === 'user' 
                  ? 'bg-[#1f1f1f] border-[rgba(255,255,255,0.08)]' 
                  : 'bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.2)]'
              }`}>
                {msg.role === 'user' ? <User size={16} className="text-[#a1a1aa]" /> : <Bot size={16} className="text-[#22c55e]" />}
              </div>
              <div className={`max-w-[70%] space-y-2 ${msg.role === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#22c55e] text-white rounded-tr-none'
                    : 'bg-[#1f1f1f] text-[#fafafa] border border-[rgba(255,255,255,0.08)] rounded-tl-none'
                }`}>
                  <p className="whitespace-pre-line">{msg.content}</p>
                </div>
                {msg.thinking && (
                  <div className="text-[10px] text-[#52525b] font-mono-data italic">
                    AI Thought: {msg.thinking}
                  </div>
                )}
                <p className="text-[10px] text-[#52525b] font-mono-data">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          {isThinking && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-lg bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.2)] flex items-center justify-center">
                <Sparkles size={16} className="text-[#22c55e]" />
              </div>
              <div className="bg-[#1f1f1f] border border-[rgba(255,255,255,0.08)] px-4 py-3 rounded-2xl rounded-tl-none">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-[#22c55e] rounded-full" />
                  <div className="w-1.5 h-1.5 bg-[#22c55e] rounded-full opacity-50" />
                  <div className="w-1.5 h-1.5 bg-[#22c55e] rounded-full opacity-20" />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-6 border-t border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.01)]">
          <div className="flex items-center gap-3 bg-[#1f1f1f] rounded-2xl border border-[rgba(255,255,255,0.08)] px-4 py-3 focus-within:border-[rgba(34,197,94,0.3)] transition-all">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask AI for deep market analysis..."
              className="flex-1 bg-transparent text-sm text-[#fafafa] placeholder:text-[#52525b] outline-none"
            />
            <button
              onClick={handleSend}
              className="p-2 rounded-xl bg-[#22c55e] text-white hover:bg-[#16a34a] transition-all"
            >
              <Send size={18} />
            </button>
          </div>
          <div className="flex items-center gap-4 mt-3 px-2">
            <span className="text-[10px] text-[#52525b] uppercase tracking-widest font-bold">Quick Prompts:</span>
            <button onClick={() => setInputValue('Analyze BTC/USDT SMC structure')} className="text-[10px] text-[#a1a1aa] hover:text-[#22c55e]">BTC SMC Analysis</button>
            <button onClick={() => setInputValue('Show current whale movements')} className="text-[10px] text-[#a1a1aa] hover:text-[#22c55e]">Whale Tracking</button>
            <button onClick={() => setInputValue('What is the risk level for SOL?')} className="text-[10px] text-[#a1a1aa] hover:text-[#22c55e]">SOL Risk Check</button>
          </div>
        </div>
      </div>
    </div>
  )
}
