import React, { useState, useRef, useEffect } from 'react'
import { BarChart2, Scan, Briefcase, Brain, Send, Mic, Paperclip, Globe, Sparkles, TrendingUp, TrendingDown, Volume2 } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, LineChart, Line } from 'recharts'
import { useStore } from '@/store/useStore'
import Card from '@/components/ui/Card'

const API = import.meta.env.VITE_API_URL || ''

const quickActions = [
  { icon: BarChart2, label: 'Analyze', color: 'text-blue-ai', prompt: 'Analyze the current market conditions and give me the top 3 opportunities' },
  { icon: Scan, label: 'Scan', color: 'text-gold', prompt: 'Scan the market for the best setup right now with entry, SL, and TP' },
  { icon: Briefcase, label: 'Portfolio', color: 'text-green-trade', prompt: 'Check my portfolio and give me a summary of my positions and P&L' },
  { icon: Brain, label: 'Insights', color: 'text-purple-400', prompt: 'What has your learner picked up in the last cycle?' },
]

export default function Dashboard() {
  const { tickers, watchlist, portfolioValue, portfolioChange, portfolioHistory, workflows, alerts, messages, addMessage, isThinking, setThinking, aiStatus, setActiveTab } = useStore()
  
  const [input, setInput] = useState('')
  const [sessionId] = useState(`dash_${Date.now()}`)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const displayMessages = messages.slice(-5)

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
      addMessage({ id: (Date.now()+1).toString(), role: 'ai', content: data.reply, timestamp: Date.now() })
    } catch {
      addMessage({ id: (Date.now()+1).toString(), role: 'ai', content: 'Connection issue — retrying shortly.', timestamp: Date.now() })
    } finally {
      setThinking(false)
    }
  }

  const watchlistTickers = tickers.filter(t => watchlist.includes(t.symbol))
  const activeWorkflows = workflows.filter(w => w.status === 'running').slice(0, 3)
  const recentAlerts = alerts.slice(0, 3)

  return (
    <div className="flex gap-4 h-full overflow-hidden">
      {/* LEFT PANEL: Chart + Analysis */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-w-0">
        {/* Main Chart Card */}
        <Card className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-bg-border">
            <div>
              <h3 className="text-white text-sm font-semibold">BTC/USDT</h3>
              <p className="text-text-muted text-xs">1H Chart • Live Data</p>
            </div>
            <div className="flex items-center gap-3">
              {['1m', '5m', '15m', '1H', '4H', '1D'].map(tf => (
                <button key={tf} className={`text-xs px-2 py-1 rounded transition-colors ${tf === '1H' ? 'bg-gold/20 text-gold border border-gold/30' : 'text-text-muted hover:text-text-primary'}`}>
                  {tf}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={portfolioHistory.length > 0 ? portfolioHistory : [{time: '00:00', value: 50000}, {time: '04:00', value: 51000}, {time: '08:00', value: 50500}]}>
                <XAxis dataKey="time" stroke="#707080" style={{fontSize: '11px'}} />
                <Tooltip contentStyle={{background:'#16161E',border:'1px solid #2A2A3E',borderRadius:6,fontSize:11}} />
                <Line type="monotone" dataKey="value" stroke="#FFD700" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* AI Chat + Quick Actions */}
        <Card className="h-64 flex flex-col">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-bg-border">
            <span className="text-white text-xs font-semibold uppercase">AI Assistant</span>
            <span className={`w-2 h-2 rounded-full animate-pulse-dot ${aiStatus === 'online' ? 'bg-green-trade' : 'bg-gold'}`} />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto mb-3 space-y-2 min-h-0">
            {displayMessages.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-text-muted text-xs">Ask me anything about the market or your portfolio</p>
              </div>
            ) : displayMessages.map(m => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded px-3 py-2 text-xs leading-relaxed ${
                  m.role === 'user' ? 'bg-gold/20 text-white border border-gold/20' : 'bg-bg-tertiary text-text-secondary border border-bg-border'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-bg-tertiary rounded px-3 py-2 text-xs border border-bg-border">
                  <span className="ai-thinking">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {quickActions.map(({ icon: Icon, label, color, prompt }) => (
              <button key={label} onClick={() => sendMessage(prompt)}
                className="flex flex-col items-center gap-1 p-2 bg-bg-tertiary rounded hover:bg-bg-hover transition-colors border border-bg-border">
                <Icon size={14} className={color} />
                <span className="text-[9px] text-text-secondary text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="relative">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Ask anything..."
              className="w-full bg-bg-tertiary border border-bg-border rounded-lg pl-3 pr-24 py-2 text-xs text-white placeholder-text-muted focus:outline-none focus:border-gold/50 transition-colors" />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button className="p-1 hover:text-gold text-text-muted"><Paperclip size={12} /></button>
              <button className="p-1 hover:text-gold text-text-muted"><Mic size={12} /></button>
              <button onClick={() => sendMessage()} className="p-1.5 bg-gold rounded hover:bg-gold-dim transition-colors">
                <Send size={11} className="text-black" />
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* RIGHT PANEL: Watchlist + Workflows + Alerts */}
      <div className="w-80 flex flex-col gap-4 overflow-y-auto shrink-0">
        {/* Watchlist */}
        <Card>
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-bg-border">
            <span className="text-white text-xs font-semibold uppercase">Watchlist</span>
            <button className="text-text-muted text-[10px] hover:text-gold">+ Add</button>
          </div>
          <div className="space-y-2">
            {(watchlistTickers.length > 0 ? watchlistTickers : [{symbol:'BTC/USDT',price:50000,change24h:2.5},{symbol:'ETH/USDT',price:2800,change24h:-1.2}]).map(t => (
              <div key={t.symbol} className="flex items-center justify-between p-2 bg-bg-tertiary rounded hover:bg-bg-hover transition-colors cursor-pointer">
                <div className="flex-1">
                  <p className="text-white text-xs font-medium">{t.symbol}</p>
                  <p className="text-text-muted text-[10px]">${t.price.toLocaleString()}</p>
                </div>
                <div className={`text-right flex items-center gap-1 ${t.change24h >= 0 ? 'text-green-trade' : 'text-red-trade'}`}>
                  {t.change24h >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  <span className="text-xs font-mono">{t.change24h >= 0 ? '+' : ''}{t.change24h.toFixed(2)}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Active Workflows */}
        <Card>
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-bg-border">
            <span className="text-white text-xs font-semibold uppercase">Workflows</span>
            <span className="text-gold text-[10px] font-mono">{activeWorkflows.length} active</span>
          </div>
          <div className="space-y-2">
            {activeWorkflows.map(wf => (
              <div key={wf.id} className="p-2 bg-bg-tertiary rounded border border-green-trade/20">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-green-trade animate-pulse-dot" />
                  <p className="text-white text-xs font-medium flex-1">{wf.name}</p>
                </div>
                <p className="text-text-muted text-[9px]">{wf.description}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Alerts */}
        <Card>
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-bg-border">
            <span className="text-white text-xs font-semibold uppercase">Alerts</span>
            <span className="text-gold text-[10px] font-mono">{recentAlerts.length} new</span>
          </div>
          <div className="space-y-2">
            {recentAlerts.length === 0 ? (
              <p className="text-text-muted text-xs">No alerts</p>
            ) : recentAlerts.map(a => (
              <div key={a.id} className={`p-2 rounded border-l-2 ${
                a.type === 'danger' ? 'border-red-trade bg-red-trade/5' :
                a.type === 'warning' ? 'border-gold bg-gold/5' :
                a.type === 'success' ? 'border-green-trade bg-green-trade/5' : 'border-blue-ai bg-blue-ai/5'
              }`}>
                <p className="text-white text-xs leading-tight">{a.message}</p>
                <p className="text-text-muted text-[9px] mt-1">{Math.round((Date.now()-a.timestamp)/60000)}m ago</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
