import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Sparkles, RefreshCw, Brain, Plus, Trash2, Clock, ChevronLeft, ChevronRight, MessageSquare, Zap } from 'lucide-react'
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

const quickPrompts = [
  { label: '📊 Scan Market',      text: 'Scan the market for the best trade setup right now' },
  { label: '💼 My Portfolio',     text: 'Check my portfolio and tell me my current balance and positions' },
  { label: '🔥 BTC Analysis',     text: 'Analyze BTC right now — give me entry, SL, TP and confidence' },
  { label: '📈 ETH Setup',        text: 'Analyze ETH on the 1H and 4H — any clean setup forming?' },
  { label: '🌊 Market Feed',      text: "What's trending right now? Show me gainers and losers" },
  { label: '⚙️ Workflows',        text: 'Show me the status of all my automated workflows' },
]

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

// Render markdown-style code blocks and bold in AI messages
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
        // Bold text between **
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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [toolsUsed, setToolsUsed] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load session list on mount
  useEffect(() => {
    loadSessionList()
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

  const startNewSession = useCallback(() => {
    setSessionId(newSessionId())
    setToolsUsed([])
    clearMessages()
  }, [clearMessages])

  const send = async (msg?: string) => {
    const text = (msg || input).trim()
    if (!text || isThinking) return
    setInput('')
    addMessage({ id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() })
    setThinking(true)
    setToolsUsed([])
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
      if (data.tools_called?.length) setToolsUsed(data.tools_called)
      addMessage({ 
        id: (Date.now()+1).toString(), 
        role: 'ai', 
        content: data.reply, 
        thinking: data.thinking,
        timestamp: Date.now() 
      })
      // Refresh session list after message
      loadSessionList()
    } catch {
      addMessage({ id: (Date.now()+1).toString(), role: 'ai', content: "Connection issue — retrying shortly. Make sure Vercel env vars are set.", timestamp: Date.now() })
    } finally {
      setThinking(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }, [input])

  return (
    <div className="h-full flex gap-3 overflow-hidden">

      {/* ── Session History Sidebar ─────────────────────────── */}
      <div className={`flex flex-col transition-all duration-200 ${sidebarOpen ? 'w-52' : 'w-10'} shrink-0`}>
        {sidebarOpen ? (
          <Card className="flex-1 flex flex-col overflow-hidden p-0">
            {/* Sidebar header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-bg-border">
              <span className="text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare size={11} className="text-gold" /> History
              </span>
              <div className="flex items-center gap-1">
                <button onClick={startNewSession} title="New chat"
                  className="p-1 rounded hover:bg-white/5 text-text-muted hover:text-gold transition-colors">
                  <Plus size={13} />
                </button>
                <button onClick={() => setSidebarOpen(false)}
                  className="p-1 rounded hover:bg-white/5 text-text-muted hover:text-white transition-colors">
                  <ChevronLeft size={13} />
                </button>
              </div>
            </div>

            {/* Current session indicator */}
            <div className="px-3 py-2 border-b border-bg-border">
              <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gold/10 rounded-lg border border-gold/20">
                <span className="w-1.5 h-1.5 rounded-full bg-gold pulse-dot shrink-0" />
                <span className="text-gold text-[10px] font-medium truncate">Current session</span>
              </div>
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto py-1">
              {loadingSessions && (
                <div className="px-3 py-4 text-center text-text-muted text-xs">Loading...</div>
              )}
              {!loadingSessions && sessions.length === 0 && (
                <div className="px-3 py-4 text-center text-text-muted text-xs">No saved sessions yet.<br/>Start chatting!</div>
              )}
              {sessions.map(s => (
                <button key={s.sessionId}
                  onClick={async () => {
                    setSessionId(s.sessionId)
                    setThinking(true)
                    try {
                      const res = await fetch(`${API}/api/chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: 'LOAD_HISTORY', session_id: s.sessionId, save: false })
                      })
                      const data = await res.json()
                      // The backend returns history in its internal format, we need to map it back
                      if (data.history) {
                        setMessages(data.history.map((m: any) => ({
                          id: Math.random().toString(),
                          role: m.role === 'assistant' ? 'ai' : m.role,
                          content: m.content,
                          timestamp: m.timestamp || Date.now()
                        })))
                      } else if (data.reply && data.reply !== 'LOAD_HISTORY_ACK') {
                        // If it's not a special ack, it might be the actual history or a message
                        // But based on our backend logic, we should probably add a specific history loader
                      }
                    } catch (e) {
                      console.error("Failed to load session", e)
                    } finally {
                      setThinking(false)
                    }
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-white/5 transition-colors border-b border-bg-border/50 group ${s.sessionId === sessionId ? 'bg-white/5' : ''}`}>
                  <p className="text-white text-[11px] truncate leading-tight">{s.title || 'Untitled session'}</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-text-muted text-[9px] flex items-center gap-1">
                      <Clock size={8} /> {formatDate(s.updatedAt)}
                    </span>
                    <span className="text-text-muted text-[9px]">{s.messageCount} msgs</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Refresh */}
            <div className="px-3 py-2 border-t border-bg-border">
              <button onClick={loadSessionList} className="w-full flex items-center justify-center gap-1.5 py-1.5 text-text-muted hover:text-white text-[10px] transition-colors">
                <RefreshCw size={10} /> Refresh
              </button>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col items-center gap-2 pt-2">
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg bg-bg-card border border-bg-border hover:border-gold/30 text-text-muted hover:text-gold transition-colors">
              <ChevronRight size={14} />
            </button>
            <button onClick={startNewSession} className="p-2 rounded-lg bg-bg-card border border-bg-border hover:border-gold/30 text-text-muted hover:text-gold transition-colors">
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── Main Chat ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Card className="flex-1 flex flex-col overflow-hidden p-0">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-bg-border shrink-0">
            <Logo size={30} />
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">CozyCrypto AI</p>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full pulse-dot shrink-0 ${aiStatus === 'online' ? 'bg-green-trade' : 'bg-gold'}`} />
                <span className="text-text-secondary text-[10px] capitalize truncate">{aiStatus} — 15 tools active</span>
              </div>
            </div>
            {toolsUsed.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-blue-ai/10 rounded-md border border-blue-ai/20">
                <Zap size={10} className="text-blue-ai" />
                <span className="text-blue-ai text-[9px] font-mono truncate max-w-[120px]">{toolsUsed.join(', ')}</span>
              </div>
            )}
            <button onClick={startNewSession} title="New chat"
              className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted hover:text-gold transition-colors shrink-0">
              <Plus size={15} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center pb-8">
                <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center mb-4">
                  <Brain size={26} className="text-gold" />
                </div>
                <p className="text-white font-semibold text-base mb-1">CozyCrypto AI</p>
                <p className="text-text-secondary text-sm max-w-xs mb-6">
                  Your autonomous trading copilot. Talk to me naturally, or ask me to do something — I'll actually do it.
                </p>
                {/* Quick prompts */}
                <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                  {quickPrompts.map(p => (
                    <button key={p.label} onClick={() => send(p.text)}
                      className="text-left px-3 py-2 rounded-xl bg-bg-secondary border border-bg-border hover:border-gold/30 hover:bg-white/5 transition-all">
                      <span className="text-white text-[11px] font-medium">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(m => (
              <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {m.role === 'ai' ? (
                  <div className="w-8 h-8 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-gold text-[10px] font-bold">AI</span>
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-ai/15 border border-blue-ai/30 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-blue-ai text-[10px] font-bold">You</span>
                  </div>
                )}
                <div className={`max-w-[78%] space-y-2`}>
                  {m.thinking && (
                    <div className="bg-black/20 border border-bg-border rounded-2xl rounded-tl-sm px-4 py-3 mb-2">
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-bg-border/50">
                        <Brain size={12} className="text-gold" />
                        <span className="text-[10px] font-semibold text-gold uppercase tracking-wider">Internal Thinking</span>
                      </div>
                      <div className="text-[11px] leading-relaxed text-text-muted italic">
                        {m.thinking}
                      </div>
                    </div>
                  )}
                  <div className={`rounded-2xl px-4 py-3 ${
                    m.role === 'user'
                      ? 'bg-gold/12 text-white border border-gold/20 rounded-tr-sm'
                      : 'bg-bg-secondary text-text-secondary border border-bg-border rounded-tl-sm'
                  }`}>
                    <RenderMessage content={m.content} />
                    <p className="text-[9px] text-text-muted mt-1.5 font-mono">{formatTime(m.timestamp)}</p>
                  </div>
                </div>
              </div>
            ))}

            {isThinking && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
                  <Sparkles size={13} className="text-gold animate-spin" />
                </div>
                <div className="bg-bg-secondary rounded-2xl rounded-tl-sm px-4 py-3 border border-bg-border">
                  <div className="flex items-center gap-2">
                    <span className="ai-thinking text-sm">Thinking</span>
                    <div className="flex gap-1">
                      {[0,1,2].map(i => <span key={i} className="w-1 h-1 rounded-full bg-gold pulse-dot" style={{animationDelay:`${i*0.2}s`}} />)}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-bg-border shrink-0">
            <div className="relative flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask anything, or say 'buy ETH', 'check my portfolio', 'analyze BTC'..."
                  rows={1}
                  className="w-full bg-bg-secondary border border-bg-border rounded-xl px-4 py-3 pr-4 text-sm text-white placeholder-text-muted focus:outline-none focus:border-gold/40 transition-colors resize-none min-h-[44px] max-h-[120px]"
                />
              </div>
              <button
                onClick={() => send()}
                disabled={isThinking || !input.trim()}
                className="p-2.5 bg-gold rounded-xl hover:bg-gold-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 mb-0.5">
                <Send size={15} className="text-black" />
              </button>
            </div>
            <p className="text-[9px] text-text-muted mt-1.5 text-center">Enter to send · Shift+Enter for new line · Tools fire automatically when needed</p>
          </div>
        </Card>
      </div>

      {/* ── Quick Actions Panel ────────────────────────────── */}
      <div className="w-44 flex flex-col gap-3 shrink-0">
        <Card className="p-3">
          <p className="text-white text-[10px] font-semibold uppercase tracking-wider mb-2.5">Quick Actions</p>
          <div className="space-y-1.5">
            {quickPrompts.map(p => (
              <button key={p.label} onClick={() => send(p.text)}
                className="w-full text-left px-2.5 py-2 rounded-lg bg-bg-secondary border border-bg-border hover:border-gold/30 hover:bg-white/5 transition-all group">
                <span className="text-text-secondary group-hover:text-white text-[10px] leading-tight block">{p.label}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-3">
          <p className="text-white text-[10px] font-semibold uppercase tracking-wider mb-2">AI Memory</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px]">
              <span className="text-text-secondary">Sessions</span>
              <span className="text-gold font-mono">{sessions.length}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-text-secondary">Messages</span>
              <span className="text-gold font-mono">{sessions.reduce((s,ss)=>s+ss.messageCount,0)}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-text-secondary">Storage</span>
              <span className="text-green-trade font-mono">GitHub</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-text-secondary">Tools</span>
              <span className="text-gold font-mono">15 active</span>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <p className="text-white text-[10px] font-semibold uppercase tracking-wider mb-2">Session</p>
          <div className="text-[9px] text-text-muted font-mono break-all leading-relaxed">
            {sessionId.slice(0,24)}...
          </div>
          <button onClick={startNewSession}
            className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-text-secondary hover:text-white bg-bg-secondary rounded-lg border border-bg-border hover:border-gold/20 transition-colors">
            <Plus size={10} /> New Session
          </button>
        </Card>
      </div>
    </div>
  )
}
