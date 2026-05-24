import React, { useState, useRef, useEffect } from 'react'
import { BarChart2, Scan, Briefcase, Send, Mic, Paperclip, Globe, Sparkles, AlertCircle, Brain, TrendingUp, Activity, Layers } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { useStore } from '@/store/useStore'
import Card from '@/components/ui/Card'
import MiniChart from '@/components/ui/MiniChart'
import Logo from '@/components/layout/Logo'

const API = import.meta.env.VITE_API_URL || ''

const quickActions = [
  { icon: BarChart2, label: 'Market Analysis', color: 'text-blue-400', prompt: 'Analyze the current market conditions and give me the top 3 opportunities' },
  { icon: Scan,      label: 'Scan Setups',     color: 'text-gold',     prompt: 'Scan the market for the best scalping opportunity right now with entry, SL, and TP' },
  { icon: Briefcase, label: 'Portfolio Audit', color: 'text-green-400', prompt: 'Check my portfolio and give me a summary of my positions and P&L' },
  { icon: Brain,     label: 'AI Insights',    color: 'text-purple-400', prompt: 'What has your learner picked up in the last cycle? Any important market events?' },
]

export default function Dashboard() {
  const { tickers, watchlist, portfolioValue, portfolioChange, portfolioHistory,
          workflows, alerts, messages, addMessage, isThinking, setThinking,
          aiStatus, setActiveTab } = useStore()

  const [input, setInput] = useState('')
  const [sessionId] = useState<string>(() => `dash_${Date.now()}`)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const displayMessages = messages.slice(-4)

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

  const marketTickers = tickers.slice(0, 6)
  const unreadAlerts = alerts.filter(a => !a.read).slice(0, 3)
  const activeWorkflows = workflows.filter(w => w.status === 'running' || w.status === 'scheduled').slice(0, 3)

  return (
    <div className="h-full overflow-y-auto pb-10 px-4 py-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-bg-secondary/30 backdrop-blur-sm border-bg-border/40 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-gold/10 border border-gold/20">
                <TrendingUp size={18} className="text-gold" />
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${portfolioChange >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {portfolioChange >= 0 ? '+' : ''}{portfolioChange.toFixed(2)}%
              </span>
            </div>
            <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Total Portfolio Value</p>
            <h3 className="text-2xl font-bold text-white mt-1 font-mono">
              {portfolioValue > 0 ? `$${portfolioValue.toLocaleString('en-US',{minimumFractionDigits:2})}` : '$0.00'}
            </h3>
          </Card>

          <Card className="bg-bg-secondary/30 backdrop-blur-sm border-bg-border/40 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Activity size={18} className="text-blue-400" />
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                {activeWorkflows.length} Active
              </span>
            </div>
            <p className="text-text-muted text-xs font-medium uppercase tracking-wider">System Heartbeat</p>
            <h3 className="text-2xl font-bold text-white mt-1">Autonomous</h3>
          </Card>

          <Card className="bg-bg-secondary/30 backdrop-blur-sm border-bg-border/40 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <Layers size={18} className="text-purple-400" />
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400">
                {tickers.length} Pairs
              </span>
            </div>
            <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Market Coverage</p>
            <h3 className="text-2xl font-bold text-white mt-1">Elite Scanner</h3>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Content: AI Assistant */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="bg-bg-secondary/30 backdrop-blur-sm border-bg-border/40 flex flex-col h-[500px]">
              <div className="p-4 border-b border-bg-border/40 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                  <Logo size={24} showText={false} />
                  <div>
                    <h3 className="text-white font-bold text-sm">Cozanet AI Assistant</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-[10px] text-text-muted uppercase tracking-widest font-medium">Governor Mode Active</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {['SMC','Risk','Learn'].map(tag => (
                    <span key={tag} className="text-[9px] px-2 py-0.5 bg-white/5 border border-white/10 text-text-muted rounded-full font-mono">{tag}</span>
                  ))}
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
                      <p className="text-white font-semibold">Welcome back, Chief.</p>
                      <p className="text-text-muted text-xs mt-1">I've been scanning the markets. How can I assist you today?</p>
                    </div>
                  </div>
                ) : (
                  displayMessages.map(m => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] space-y-2`}>
                        {m.thinking && (
                          <div className="bg-black/20 border border-bg-border/40 rounded-2xl rounded-tl-sm px-4 py-3 mb-2">
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-bg-border/20">
                              <Brain size={12} className="text-gold" />
                              <span className="text-[10px] font-bold text-gold uppercase tracking-widest">Thinking</span>
                            </div>
                            <p className="text-[11px] leading-relaxed text-text-muted italic">{m.thinking}</p>
                          </div>
                        )}
                        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          m.role === 'user' 
                            ? 'bg-gold text-black font-medium shadow-lg shadow-gold/10' 
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
                      <span className="text-xs text-text-muted font-medium italic">AI is processing market data...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Actions */}
              <div className="px-6 py-3 border-t border-bg-border/40 bg-black/10">
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                  {quickActions.map(({ icon: Icon, label, color, prompt }) => (
                    <button key={label} onClick={() => sendMessage(prompt)}
                      className="flex items-center gap-2 px-3 py-2 bg-bg-secondary/50 border border-bg-border/40 rounded-xl hover:border-gold/40 hover:bg-white/5 transition-all shrink-0 group">
                      <Icon size={14} className={`${color} group-hover:scale-110 transition-transform`} />
                      <span className="text-[10px] text-text-secondary font-medium whitespace-nowrap">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Area */}
              <div className="p-4 bg-black/20">
                <div className="relative flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input 
                      value={input} 
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendMessage()}
                      placeholder="Ask anything or give a command..."
                      className="w-full bg-bg-secondary border border-bg-border/60 rounded-2xl pl-4 pr-20 py-3 text-sm text-white placeholder-text-muted/50 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-all" 
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
              <div className="p-4 border-b border-bg-border/40 flex items-center justify-between bg-white/5">
                <h3 className="text-white font-bold text-sm uppercase tracking-wider">Market Pulse</h3>
                <button onClick={() => setActiveTab('market')} className="text-gold text-[10px] font-bold hover:underline">VIEW ALL</button>
              </div>
              <div className="p-4 space-y-4">
                {marketTickers.map(t => (
                  <div key={t.symbol} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-gold/30 transition-colors">
                        <span className="text-[10px] font-bold text-white">{t.symbol.split('USDT')[0]}</span>
                      </div>
                      <div>
                        <p className="text-white text-xs font-bold">{t.symbol}</p>
                        <p className="text-[10px] text-text-muted font-mono">Vol: ${(t.volume/1000000).toFixed(1)}M</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white text-xs font-bold font-mono">${t.price.toLocaleString()}</p>
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
              <div className="p-4 border-b border-bg-border/40 flex items-center justify-between bg-white/5">
                <h3 className="text-white font-bold text-sm uppercase tracking-wider">System Alerts</h3>
                <span className="text-[10px] bg-gold/10 text-gold px-2 py-0.5 rounded-full font-bold">{unreadAlerts.length} NEW</span>
              </div>
              <div className="p-4 space-y-4">
                {unreadAlerts.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-text-muted text-xs italic">No critical alerts detected.</p>
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
