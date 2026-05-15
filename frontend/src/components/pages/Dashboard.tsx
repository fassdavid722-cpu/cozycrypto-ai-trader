import React, { useState, useRef, useEffect } from 'react'
import { BarChart2, Scan, Briefcase, Workflow, Send, Mic, Paperclip, Globe, Sparkles, Play, AlertCircle, Brain } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { useStore } from '@/store/useStore'
import Card from '@/components/ui/Card'
import MiniChart from '@/components/ui/MiniChart'
import Logo from '@/components/layout/Logo'

const API = import.meta.env.VITE_API_URL || ''

const quickActions = [
  { icon: BarChart2, label: 'Analyze Market',      color: 'text-blue-ai',    prompt: 'Analyze the current market conditions and give me the top 3 opportunities' },
  { icon: Scan,      label: 'Scan Opportunities',  color: 'text-gold',       prompt: 'Scan the market for the best scalping opportunity right now with entry, SL, and TP' },
  { icon: Briefcase, label: 'Check Portfolio',     color: 'text-green-trade',prompt: 'Check my portfolio and give me a summary of my positions and P&L' },
  { icon: Brain,     label: 'AI Insights',         color: 'text-purple-400', prompt: 'What has your learner picked up in the last cycle? Any important market events?' },
]

export default function Dashboard() {
  const { tickers, watchlist, portfolioValue, portfolioChange, portfolioHistory,
          workflows, alerts, messages, addMessage, isThinking, setThinking,
          aiStatus, setActiveTab } = useStore()

  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const displayMessages = messages.slice(-6)

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
        body: JSON.stringify({ message: text, session_id: sessionId, history: messages.slice(-10) })
      })
      const data = await res.json()
      if (data.session_id) setSessionId(data.session_id)
      addMessage({ id: (Date.now()+1).toString(), role: 'ai', content: data.reply, timestamp: Date.now() })
    } catch {
      addMessage({ id: (Date.now()+1).toString(), role: 'ai', content: "Connection issue — retrying shortly.", timestamp: Date.now() })
    } finally {
      setThinking(false)
    }
  }

  const watchlistTickers = tickers.filter(t => watchlist.includes(t.symbol))
  const marketTickers = tickers.slice(0, 5)
  const unreadAlerts = alerts.filter(a => !a.read).slice(0, 4)
  const activeWorkflows = workflows.filter(w => w.status === 'running' || w.status === 'scheduled').slice(0, 4)

  return (
    <div className="flex gap-4 h-full overflow-hidden">
      {/* LEFT */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-w-0">
        {/* AI Chat */}
        <Card glow="gold" className="flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Logo size={20} showText={false} />
            <span className="text-white text-xs font-semibold uppercase tracking-wider">CozyCrypto AI</span>
            <div className="flex items-center gap-1 ml-2">
              {['T','C','L','F','M'].map((b,i) => (
                <span key={i} className="text-[8px] px-1 py-0.5 bg-gold/20 text-gold rounded font-mono">{b}</span>
              ))}
              <span className="text-[8px] px-1 py-0.5 bg-purple-500/20 text-purple-400 rounded font-mono">G</span>
            </div>
            <span className={`ml-auto w-2 h-2 rounded-full pulse-dot ${aiStatus === 'online' ? 'bg-green-trade' : 'bg-gold'}`} />
          </div>

          {/* Messages */}
          <div className="min-h-[120px] max-h-[160px] overflow-y-auto mb-3 space-y-2">
            {displayMessages.length === 0 ? (
              <div className="bg-bg-secondary rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center">
                    <span className="text-gold text-[10px] font-bold">AI</span>
                  </div>
                  <span className="text-white text-xs font-medium">Good morning, Cozanet.</span>
                  <span className="ml-auto text-text-muted text-[10px] font-mono">{new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                </div>
                <p className="text-text-secondary text-xs mb-2">5-brain Governor AI online. Learner active — updates every 20 min.</p>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    {label:'Trade Brain', color:'text-gold'},
                    {label:'Fast Brain',  color:'text-blue-ai'},
                    {label:'Math Brain',  color:'text-green-trade'},
                    {label:'Code Brain',  color:'text-purple-400'},
                    {label:'Long Brain',  color:'text-orange-400'},
                    {label:'Gemini Fallback', color:'text-text-muted'},
                  ].map(b => (
                    <div key={b.label} className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-trade pulse-dot" />
                      <span className={`text-[9px] ${b.color}`}>{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : displayMessages.map(m => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                  m.role === 'user' ? 'bg-gold/20 text-white border border-gold/20' : 'bg-bg-secondary text-text-secondary border border-bg-border'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-bg-secondary rounded-lg px-3 py-2 text-xs border border-bg-border">
                  <span className="ai-thinking">Governor AI thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {quickActions.map(({ icon: Icon, label, color, prompt }) => (
              <button key={label} onClick={() => sendMessage(prompt)}
                className="flex flex-col items-center gap-1 p-2 bg-bg-secondary rounded-lg hover:bg-bg-border transition-colors border border-bg-border">
                <Icon size={14} className={color} />
                <span className="text-[9px] text-text-secondary text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="relative">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Ask anything... (Governor AI with 5 brains + Bitget trading)"
              className="w-full bg-bg-secondary border border-bg-border rounded-lg pl-3 pr-24 py-2.5 text-xs text-white placeholder-text-muted focus:outline-none focus:border-gold/50 transition-colors" />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              <button className="p-1 hover:text-gold text-text-muted"><Paperclip size={13} /></button>
              <button className="p-1 hover:text-gold text-text-muted"><Globe size={13} /></button>
              <button className="p-1 hover:text-gold text-text-muted"><Sparkles size={13} /></button>
              <button className="p-1 hover:text-gold text-text-muted"><Mic size={13} /></button>
              <button onClick={() => sendMessage()} className="p-1.5 bg-gold rounded-md hover:bg-gold-dim transition-colors">
                <Send size={12} className="text-black" />
              </button>
            </div>
          </div>
        </Card>

        {/* Workflows + Portfolio */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <span className="text-white text-xs font-semibold uppercase tracking-wider">Active Workflows</span>
              <button onClick={() => setActiveTab('workflows')} className="text-text-muted text-[10px] hover:text-gold">View all</button>
            </div>
            <div className="space-y-2">
              {activeWorkflows.length === 0
                ? <p className="text-text-muted text-xs">Loading...</p>
                : activeWorkflows.map(wf => (
                  <div key={wf.id} className="flex items-center gap-2 py-1">
                    <div className="w-6 h-6 rounded bg-bg-border flex items-center justify-center">
                      <BarChart2 size={12} className="text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{wf.name}</p>
                      <p className="text-text-muted text-[10px] truncate">{wf.description}</p>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                      wf.status === 'running' ? 'bg-green-trade/20 text-green-trade' : 'bg-blue-ai/20 text-blue-ai'}`}>
                      {wf.status}
                    </span>
                  </div>
                ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-1">
              <span className="text-white text-xs font-semibold uppercase tracking-wider">Portfolio</span>
              <button onClick={() => setActiveTab('portfolio')} className="text-text-muted text-[10px] hover:text-gold">View all</button>
            </div>
            <div className="flex items-end justify-between mb-2">
              <div>
                <p className="text-text-secondary text-[10px]">Total Value</p>
                <p className="text-white text-xl font-bold font-mono">
                  {portfolioValue > 0 ? `$${portfolioValue.toLocaleString('en-US',{minimumFractionDigits:2})}` : '—'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-text-secondary text-[10px]">24H</p>
                <p className={`text-sm font-bold font-mono ${portfolioChange >= 0 ? 'text-green-trade' : 'text-red-trade'}`}>
                  {portfolioChange >= 0 ? '+' : ''}{portfolioChange.toFixed(2)}%
                </p>
              </div>
            </div>
            <div className="h-16">
              {portfolioHistory.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={portfolioHistory} margin={{top:0,right:0,bottom:0,left:0}}>
                    <defs>
                      <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00D4A1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#00D4A1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" hide />
                    <Tooltip contentStyle={{background:'#16161E',border:'1px solid #1E1E2A',borderRadius:8,fontSize:11}} formatter={(v:number)=>[`$${v.toFixed(2)}`,'Value']}/>
                    <Area type="monotone" dataKey="value" stroke="#00D4A1" fill="url(#pg)" strokeWidth={1.5} dot={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-text-muted text-xs">Connect Bitget to see portfolio</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* RIGHT */}
      <div className="w-72 flex flex-col gap-4 overflow-y-auto shrink-0">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="text-white text-xs font-semibold uppercase tracking-wider">Market</span>
            <button onClick={() => setActiveTab('market')} className="text-text-muted text-[10px] hover:text-gold">View all</button>
          </div>
          <div className="space-y-2">
            {(marketTickers.length > 0 ? marketTickers : ['BTC/USDT','ETH/USDT','SOL/USDT','BNB/USDT','XRP/USDT'].map(s=>({symbol:s,price:0,change24h:0,volume:0,high24h:0,low24h:0,sparkline:[]}))).map(t => (
              <div key={t.symbol} className="flex items-center gap-2 py-0.5">
                <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-gold">{t.symbol[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs">{t.symbol}</p>
                </div>
                {(t as any).sparkline?.length > 1 && <MiniChart data={(t as any).sparkline} color={(t as any).change24h >= 0 ? '#00D4A1' : '#FF4757'} width={40} height={18}/>}
                <div className="text-right w-20">
                  <p className="text-white text-[11px] font-mono">{t.price > 0 ? `$${t.price.toLocaleString()}` : '—'}</p>
                  <p className={`text-[10px] font-mono ${(t as any).change24h >= 0 ? 'text-green-trade' : 'text-red-trade'}`}>
                    {t.price > 0 ? `${(t as any).change24h >= 0 ? '+' : ''}${(t as any).change24h?.toFixed(2)}%` : '...'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="text-white text-xs font-semibold uppercase tracking-wider">Alerts</span>
            <span className="text-[10px] text-gold font-mono">{unreadAlerts.length} new</span>
          </div>
          <div className="space-y-2">
            {unreadAlerts.length === 0
              ? <p className="text-text-muted text-xs">No alerts — all clear</p>
              : unreadAlerts.map(a => (
                <div key={a.id} className="flex items-start gap-2">
                  <AlertCircle size={13} className={`mt-0.5 ${a.type==='danger'?'text-red-trade':a.type==='warning'?'text-gold':a.type==='success'?'text-green-trade':'text-blue-ai'}`}/>
                  <div>
                    <p className="text-white text-[11px] leading-tight">{a.message}</p>
                    <p className="text-text-muted text-[10px] mt-0.5">{Math.round((Date.now()-a.timestamp)/60000)}m ago</p>
                  </div>
                </div>
              ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="text-white text-xs font-semibold uppercase tracking-wider">Watchlist</span>
          </div>
          <div className="space-y-2">
            {(watchlistTickers.length > 0 ? watchlistTickers : watchlist.slice(0,5).map(s=>({symbol:s,price:0,change24h:0}))).map((t:any) => (
              <div key={t.symbol} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-blue-ai/20 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-blue-ai">{t.symbol[0]}</span>
                </div>
                <span className="text-white text-xs flex-1">{t.symbol}</span>
                <span className="text-white text-[11px] font-mono">{t.price > 0 ? `$${t.price.toLocaleString()}` : '—'}</span>
                <span className={`text-[10px] font-mono w-14 text-right ${t.change24h >= 0 ? 'text-green-trade' : 'text-red-trade'}`}>
                  {t.price > 0 ? `${t.change24h >= 0 ? '+' : ''}${t.change24h?.toFixed(2)}%` : '...'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
