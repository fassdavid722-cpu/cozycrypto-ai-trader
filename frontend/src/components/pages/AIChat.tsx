import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Sparkles, RefreshCw, Brain, Plus, Trash2, Clock, ChevronLeft, ChevronRight, MessageSquare, Zap, History, Lightbulb, Target, X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import Card from '@/components/ui/Card'
import Logo from '@/components/layout/Logo'

const API = import.meta.env.VITE_API_URL || ''

interface Session {
  sessionId: string
  title: string
  updatedAt: string
  messageCount: number
}

interface Insight {
  lessons: string[]
  adjustments: Record<string, any>
}

function formatTime(ts: string | number) {
  const d = new Date(typeof ts === 'number' ? ts : ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(ts: string) {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function newSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2,8)}`
}

function RenderMessage({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g)
  return (
    <div className="text-sm leading-relaxed space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const code = part.replace(/^```[a-z]*\n?/, '').replace(/```$/, '')
          return (
            <pre key={i} className="bg-black/40 border border-bg-border rounded-lg px-3 py-2 font-mono text-[11px] text-green-trade overflow-x-auto whitespace-pre-wrap">
              {code}
            </pre>
          )
        }
        const boldParts = part.split(/(\*\*[^*]+\*\*)/g)
        return (
          <span key={i} className="whitespace-pre-wrap">
            {boldParts.map((bp, j) =>
              bp.startsWith('**') && bp.endsWith('**')
                ? <strong key={j} className="text-white font-semibold">{bp.slice(2,-2)}</strong>
                : <span key={j}>{bp}</span>
            )}
          </span>
        )
      })}
    </div>
  )
}

export default function AIChat() {
  const { messages, addMessage, setMessages, clearMessages, isThinking, setThinking, aiStatus } = useStore()
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState(() => newSessionId())
  const [sessions, setSessions] = useState<Session[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [insights, setInsights] = useState<Insight | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    loadSessionList()
    loadInsights()
  }, [])

  const loadSessionList = async () => {
    setLoadingSessions(true)
    try {
      const res = await fetch(`${API}/api/chat`)
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions || [])
      }
    } catch {}
    setLoadingSessions(false)
  }

  const loadInsights = async () => {
    try {
      const res = await fetch(`${API}/api/insights`)
      if (res.ok) {
        const data = await res.json()
        setInsights(data)
      }
    } catch {}
  }

  const startNewSession = useCallback(() => {
    setSessionId(newSessionId())
    clearMessages()
    setHistoryOpen(false)
  }, [clearMessages])

  const send = async (msg?: string) => {
    const text = (msg || input).trim()
    if (!text || isThinking) return
    setInput('')
    addMessage({ id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() })
    setThinking(true)
    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-20),
          session_id: sessionId,
          save: true
        })
      })
      const data = await res.json()
      addMessage({ 
        id: (Date.now()+1).toString(), 
        role: 'ai', 
        content: data.reply, 
        thinking: data.thinking,
        timestamp: Date.now() 
      })
      loadSessionList()
      loadInsights()
    } catch {
      addMessage({ id: (Date.now()+1).toString(), role: 'ai', content: "Connection issue — retrying shortly.", timestamp: Date.now() })
    } finally {
      setThinking(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="h-full flex flex-col md:flex-row gap-4 overflow-hidden relative">
      
      {/* ── Mobile Header ─────────────────────────────────────────── */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-bg-primary border-b border-bg-border/40 shrink-0">
        <div className="flex items-center gap-2">
          <Logo size={24} />
          <span className="text-white font-bold text-sm">CozyCrypto AI</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setHistoryOpen(!historyOpen)} className="p-2 rounded-lg bg-white/5 text-text-muted">
            <History size={18} />
          </button>
          <button onClick={() => setMemoryOpen(!memoryOpen)} className="p-2 rounded-lg bg-white/5 text-gold">
            <Brain size={18} />
          </button>
        </div>
      </div>

      {/* ── Session History Drawer (Mobile & Desktop) ────────────────── */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-bg-primary border-r border-bg-border/40 transform transition-transform duration-300 ease-in-out ${historyOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 md:w-64 md:z-0 ${historyOpen ? 'flex' : 'hidden md:flex'} flex-col`}>
        <div className="p-4 border-b border-bg-border/40 flex items-center justify-between bg-black/10">
          <h3 className="text-white font-bold text-xs uppercase tracking-widest">Chat History</h3>
          <button onClick={() => setHistoryOpen(false)} className="md:hidden p-1 text-text-muted"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <button onClick={startNewSession} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gold text-black font-bold text-xs mb-4">
            <Plus size={14} /> New Conversation
          </button>
          {sessions.map(s => (
            <button key={s.sessionId} onClick={() => { setSessionId(s.sessionId); setHistoryOpen(false); }}
              className={`w-full text-left px-3 py-3 rounded-xl transition-all ${s.sessionId === sessionId ? 'bg-white/10 border border-white/10' : 'hover:bg-white/5'}`}>
              <p className="text-white text-xs font-medium truncate">{s.title || 'Untitled session'}</p>
              <p className="text-text-muted text-[10px] mt-1">{formatDate(s.updatedAt)} • {s.messageCount} msgs</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Chat Area ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-bg-secondary/30 backdrop-blur-sm border-x border-bg-border/40 relative">
        
        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between px-6 py-4 border-b border-bg-border/40 bg-black/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gold/10 border border-gold/20">
              <MessageSquare size={18} className="text-gold" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">AI Assistant</h3>
              <p className="text-[10px] text-text-muted uppercase tracking-widest font-medium">Autonomous Execution Mode</p>
            </div>
          </div>
          <button onClick={() => setMemoryOpen(!memoryOpen)} className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${memoryOpen ? 'bg-gold text-black border-gold' : 'bg-white/5 text-gold border-gold/20 hover:bg-gold/10'}`}>
            <Brain size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">AI Memory</span>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-hide">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-60">
              <div className="p-6 rounded-full bg-gold/5 border border-gold/10 animate-pulse">
                <Sparkles size={48} className="text-gold" />
              </div>
              <div className="max-w-sm">
                <h4 className="text-white font-bold text-lg">How can I help you trade?</h4>
                <p className="text-text-muted text-sm mt-2 leading-relaxed">I am your autonomous copilot. I can scan markets, analyze SMC patterns, and manage your Bitget portfolio.</p>
              </div>
            </div>
          ) : (
            messages.map(m => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[90%] md:max-w-[80%] space-y-3">
                  {m.thinking && (
                    <div className="bg-black/30 border border-bg-border/60 rounded-2xl rounded-tl-sm px-4 py-3 shadow-inner">
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-bg-border/20">
                        <Brain size={12} className="text-gold" />
                        <span className="text-[10px] font-bold text-gold uppercase tracking-widest">Internal Logic</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-text-muted italic">{m.thinking}</p>
                    </div>
                  )}
                  <div className={`rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm ${
                    m.role === 'user' ? 'bg-gold text-black font-medium' : 'bg-bg-secondary border border-bg-border/60 text-white'
                  }`}>
                    <RenderMessage content={m.content} />
                  </div>
                </div>
              </div>
            ))
          )}
          {isThinking && (
            <div className="flex justify-start">
              <div className="bg-bg-secondary border border-bg-border/60 rounded-2xl rounded-tl-sm px-5 py-3.5 flex items-center gap-4">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gold animate-bounce" style={{animationDelay:'0s'}} />
                  <span className="w-2 h-2 rounded-full bg-gold animate-bounce" style={{animationDelay:'0.2s'}} />
                  <span className="w-2 h-2 rounded-full bg-gold animate-bounce" style={{animationDelay:'0.4s'}} />
                </div>
                <span className="text-xs text-text-muted font-medium italic">AI is processing market data...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 bg-black/20 border-t border-bg-border/40">
          <div className="max-w-4xl mx-auto relative flex items-center gap-3">
            <div className="flex-1 relative">
              <textarea 
                ref={textareaRef}
                value={input} 
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Type your command..."
                rows={1}
                className="w-full bg-bg-secondary border border-bg-border/60 rounded-2xl pl-5 pr-12 py-3.5 text-sm text-white placeholder-text-muted/50 focus:outline-none focus:border-gold/40 transition-all resize-none scrollbar-hide" 
              />
              <button className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:text-gold text-text-muted transition-colors">
                <Zap size={16} />
              </button>
            </div>
            <button 
              onClick={() => send()} 
              disabled={!input.trim() || isThinking}
              className="p-4 bg-gold rounded-2xl hover:shadow-xl hover:shadow-gold/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Send size={20} className="text-black" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Living Memory Panel (Mobile & Desktop) ────────────────── */}
      <div className={`fixed inset-y-0 right-0 z-50 w-80 bg-bg-primary border-l border-bg-border/40 transform transition-transform duration-300 ease-in-out ${memoryOpen ? 'translate-x-0' : 'translate-x-full'} md:relative md:translate-x-0 md:w-72 md:z-0 ${memoryOpen ? 'flex' : 'hidden md:flex'} flex-col`}>
        <div className="p-4 border-b border-bg-border/40 flex items-center justify-between bg-black/10">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-gold" />
            <h3 className="text-white font-bold text-xs uppercase tracking-widest">Living Memory</h3>
          </div>
          <button onClick={() => setMemoryOpen(false)} className="p-1 text-text-muted"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
          
          {/* Learned Lessons */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gold">
              <Lightbulb size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Learned Lessons</span>
            </div>
            <div className="space-y-2">
              {insights?.lessons.map((lesson, i) => (
                <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-text-secondary leading-relaxed">
                  {lesson}
                </div>
              ))}
            </div>
          </div>

          {/* Strategy Adjustments */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-blue-400">
              <Target size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Strategy Adjustments</span>
            </div>
            <div className="space-y-2">
              {insights && Object.entries(insights.adjustments).map(([pair, adj]) => (
                <div key={pair} className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-white text-[11px] font-bold">{pair}</span>
                    <span className="text-green-400 text-[10px] font-mono">Active</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-text-muted">
                    <span>Min Confidence</span>
                    <span className="text-white">{adj.min_confidence}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Health */}
          <div className="p-4 rounded-2xl bg-green-400/5 border border-green-400/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">System Healthy</span>
            </div>
            <p className="text-[10px] text-text-muted leading-relaxed">AI is currently scanning 50+ pairs. Memory sync is active and updating every heartbeat.</p>
          </div>
        </div>
      </div>

      {/* Overlay for mobile drawers */}
      {(historyOpen || memoryOpen) && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => { setHistoryOpen(false); setMemoryOpen(false); }}
        />
      )}
    </div>
  )
}
