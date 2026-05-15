import React, { useState, useRef, useEffect } from 'react'
import { Send, Mic, Sparkles, RefreshCw, Brain } from 'lucide-react'
import { useStore } from '@/store/useStore'
import Card from '@/components/ui/Card'
import Logo from '@/components/layout/Logo'

const suggestions = [
  'What\'s the best trade right now?',
  'Analyze BTC trend for next 24h',
  'Show me arbitrage opportunities',
  'What\'s my portfolio risk level?',
  'Create a scalping strategy for SOL',
  'When should I take profit on ETH?',
]

export default function AIChat() {
  const { messages, addMessage, isThinking, setThinking, aiStatus } = useStore()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (msg?: string) => {
    const text = (msg || input).trim()
    if (!text) return
    setInput('')
    addMessage({ id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() })
    setThinking(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: messages.slice(-20) })
      })
      const data = await res.json()
      addMessage({ id: (Date.now()+1).toString(), role: 'ai', content: data.reply, timestamp: Date.now() })
    } catch {
      addMessage({ id: (Date.now()+1).toString(), role: 'ai', content: "Connection issue with the AI. Retrying...", timestamp: Date.now() })
    } finally {
      setThinking(false)
    }
  }

  return (
    <div className="h-full flex gap-4">
      {/* Chat */}
      <div className="flex-1 flex flex-col">
        <Card className="flex-1 flex flex-col overflow-hidden p-0">
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-bg-border">
            <Logo size={32} />
            <div>
              <p className="text-white font-semibold text-sm">CozyCrypto AI</p>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full pulse-dot ${aiStatus === 'online' ? 'bg-green-trade' : 'bg-gold'}`} />
                <span className="text-text-secondary text-[10px] capitalize">{aiStatus} — Elite Trading Mode</span>
              </div>
            </div>
            <button className="ml-auto p-2 hover:bg-white/5 rounded-lg transition-colors">
              <RefreshCw size={14} className="text-text-muted" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Brain size={48} className="text-gold/30 mb-4" />
                <p className="text-white font-semibold mb-2">CozyCrypto AI is ready</p>
                <p className="text-text-secondary text-sm max-w-sm">
                  I'm your autonomous trading copilot. I analyze markets, execute trades, and continuously learn to be an elite trader — even on a $3 account.
                </p>
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {m.role === 'ai' ? (
                  <div className="w-8 h-8 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center shrink-0 mt-1">
                    <span className="text-gold text-xs font-bold">AI</span>
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-ai/20 border border-blue-ai/30 flex items-center justify-center shrink-0 mt-1">
                    <span className="text-blue-ai text-xs font-bold">C</span>
                  </div>
                )}
                <div className={`max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-gold/15 text-white border border-gold/20 rounded-tr-sm'
                    : 'bg-bg-secondary text-text-secondary border border-bg-border rounded-tl-sm'
                }`}>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  <p className="text-[10px] text-text-muted mt-1 font-mono">
                    {new Date(m.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                  </p>
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center shrink-0">
                  <Sparkles size={14} className="text-gold animate-spin" />
                </div>
                <div className="bg-bg-secondary rounded-xl rounded-tl-sm px-4 py-3 border border-bg-border">
                  <span className="ai-thinking text-sm">Analyzing markets and thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-bg-border">
            <div className="relative">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Ask anything about markets, strategies, portfolio..."
                rows={2}
                className="w-full bg-bg-secondary border border-bg-border rounded-xl pl-4 pr-24 py-3 text-sm text-white placeholder-text-muted focus:outline-none focus:border-gold/50 transition-colors resize-none"
              />
              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                <button className="p-1.5 hover:text-gold text-text-muted transition-colors">
                  <Mic size={16} />
                </button>
                <button onClick={() => send()} className="p-2 bg-gold rounded-lg hover:bg-gold-dim transition-colors">
                  <Send size={14} className="text-black" />
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Suggestions */}
      <div className="w-56 space-y-4">
        <Card>
          <p className="text-white text-xs font-semibold uppercase tracking-wider mb-3">Quick Ask</p>
          <div className="space-y-2">
            {suggestions.map(s => (
              <button key={s} onClick={() => send(s)}
                className="w-full text-left text-text-secondary text-xs p-2 rounded-lg bg-bg-secondary hover:bg-bg-border hover:text-white transition-colors border border-transparent hover:border-gold/20">
                {s}
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <p className="text-white text-xs font-semibold uppercase tracking-wider mb-2">AI Memory</p>
          <p className="text-text-muted text-xs">The AI remembers your trading style, risk tolerance, and past decisions to improve over time.</p>
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-text-secondary">Sessions learned</span>
              <span className="text-gold font-mono">—</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-text-secondary">Strategies tested</span>
              <span className="text-gold font-mono">—</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-text-secondary">Win rate</span>
              <span className="text-green-trade font-mono">—</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
