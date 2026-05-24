import React, { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, Globe, Sparkles, AlertCircle, Brain } from 'lucide-react'
import { useStore } from '@/store/useStore'
import Card from '@/components/ui/Card'
import Logo from '@/components/layout/Logo'

const API = import.meta.env.VITE_API_URL || ''

export default function Dashboard() {
  const { tickers, portfolioValue, portfolioChange, alerts, messages, addMessage, isThinking, setThinking } = useStore()

  const [input, setInput] = useState('')
  const [sessionId] = useState<string>(() => `dash_${Date.now()}`)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const displayMessages = messages.slice(-10)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async (msg?: string) => {
    const text = (msg || input).trim()
    if (!text) return
    setInput('')
    addMessage({ id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() })
    setThinking(true)
    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: sessionId, history: messages.slice(-10), save: true })
      })
      const data = await res.json()
      addMessage({ 
        id: (Date.now()+1).toString(), 
        role: 'ai', 
        content: data.reply, 
        thinking: data.thinking,
        timestamp: Date.now() 
      })
    } catch {
      addMessage({ id: (Date.now()+1).toString(), role: 'ai', content: "Connection issue — retrying shortly.", timestamp: Date.now() })
    } finally {
      setThinking(false)
    }
  }

  const marketTickers = tickers.slice(0, 8)
  const unreadAlerts = alerts.filter(a => !a.read).slice(0, 5)

  return (
    <div className="h-full overflow-y-auto pb-10 px-4 py-6">
      <div className="max-w-7xl mx-auto">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Content: AI Assistant */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="bg-bg-secondary/30 backdrop-blur-sm border-bg-border/40 flex flex-col h-[650px]">
              <div className="p-4 border-b border-bg-border/40 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                  <Logo size={24} showText={false} />
                  <div>
                    <h3 className="text-white font-bold text-sm">Autonomous AI Trader</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-[10px] text-text-muted uppercase tracking-widest font-medium">Live Heartbeat Active</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-text-muted text-[10px] uppercase tracking-widest">Portfolio</p>
                  <p className={`text-xs font-bold font-mono ${portfolioChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${portfolioValue.toLocaleString('en-US',{minimumFractionDigits:2})} ({portfolioChange >= 0 ? '+' : ''}{portfolioChange.toFixed(2)}%)
                  </p>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
                {displayMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-60">
                    <div className="p-4 rounded-full bg-gold/5 border border-gold/10">
                      <Sparkles size={32} className="text-gold" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">Autonomous Mode Active</p>
                      <p className="text-text-muted text-xs mt-1">I am scanning the markets and executing trades based on your goals.</p>
                    </div>
                  </div>
                ) : (
                  displayMessages.map(m => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[90%] space-y-2`}>
                        {m.thinking && (
                          <div className="bg-black/20 border border-bg-border/40 rounded-2xl rounded-tl-sm px-4 py-3 mb-2">
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-bg-border/20">
                              <Brain size={12} className="text-gold" />
                              <span className="text-[10px] font-bold text-gold uppercase tracking-widest">Internal Logic</span>
                            </div>
                            <p className="text-[11px] leading-relaxed text-text-muted italic">{m.thinking}</p>
                          </div>
                        )}
                        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          m.role === 'user' 
                            ? 'bg-gold text-black font-medium' 
                            : 'bg-bg-secondary border border-bg-border/60 text-white'
                        }`}>
                          {m.content}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {isThinking && (
                  <div className="flex justify-start">
                    <div className="bg-bg-secondary border border-bg-border/60 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-3">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style={{animationDelay:'0s'}} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style={{animationDelay:'0.2s'}} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style={{animationDelay:'0.4s'}} />
                      </div>
                      <span className="text-xs text-text-muted font-medium italic">AI is processing...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 bg-black/20">
                <div className="relative flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input 
                      value={input} 
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendMessage()}
                      placeholder="Ask the AI anything..."
                      className="w-full bg-bg-secondary border border-bg-border/60 rounded-2xl pl-4 pr-20 py-3 text-sm text-white placeholder-text-muted/50 focus:outline-none focus:border-gold/40 transition-all" 
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button className="p-1.5 hover:text-gold text-text-muted transition-colors"><Paperclip size={14} /></button>
                      <button className="p-1.5 hover:text-gold text-text-muted transition-colors"><Globe size={14} /></button>
                    </div>
                  </div>
                  <button 
                    onClick={() => sendMessage()} 
                    disabled={!input.trim() || isThinking}
                    className="p-3 bg-gold rounded-2xl hover:shadow-lg hover:shadow-gold/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send size={18} className="text-black" />
                  </button>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar Content */}
          <div className="lg:col-span-4 space-y-6">
            {/* Market Watchlist */}
            <Card className="bg-bg-secondary/30 backdrop-blur-sm border-bg-border/40 overflow-hidden">
              <div className="p-4 border-b border-bg-border/40 bg-white/5">
                <h3 className="text-white font-bold text-sm uppercase tracking-wider">Market Pulse</h3>
              </div>
              <div className="p-4 space-y-4">
                {marketTickers.map(t => (
                  <div key={t.symbol} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white">{t.symbol.split('USDT')[0]}</span>
                      </div>
                      <div>
                        <p className="text-white text-xs font-bold">{t.symbol}</p>
                        <p className="text-[10px] text-text-muted font-mono">${t.price.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-[10px] font-bold font-mono ${t.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {t.change24h >= 0 ? '+' : ''}{t.change24h.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Recent Alerts */}
            <Card className="bg-bg-secondary/30 backdrop-blur-sm border-bg-border/40 overflow-hidden">
              <div className="p-4 border-b border-bg-border/40 bg-white/5">
                <h3 className="text-white font-bold text-sm uppercase tracking-wider">Activity Log</h3>
              </div>
              <div className="p-4 space-y-4">
                {unreadAlerts.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-text-muted text-xs italic">No recent activity.</p>
                  </div>
                ) : (
                  unreadAlerts.map(a => (
                    <div key={a.id} className="flex items-start gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors">
                      <div className={`p-1.5 rounded-lg shrink-0 ${
                        a.type === 'danger' ? 'bg-red-500/10 text-red-400' : 
                        a.type === 'warning' ? 'bg-gold/10 text-gold' : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        <AlertCircle size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-[11px] leading-relaxed font-medium">{a.message}</p>
                        <p className="text-text-muted text-[9px] mt-1 uppercase tracking-widest">{Math.round((Date.now()-a.timestamp)/60000)}m ago</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
