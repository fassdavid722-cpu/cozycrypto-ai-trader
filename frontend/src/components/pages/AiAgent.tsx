import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Sparkles, ScanLine, TrendingUp, BrainCircuit, Activity, BarChart3, Shield } from 'lucide-react'
import TopBar from '../components/TopBar'

interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  content: string
  timestamp: Date
  metadata?: {
    coin?: string
    confidence?: number
    source?: string
    indicators?: string[]
  }
}

const quickPrompts = [
  { label: 'Analyze BTC trend', icon: TrendingUp },
  { label: 'Scan Ethereum', icon: ScanLine },
  { label: 'Market fear index', icon: Activity },
  { label: 'Top movers today', icon: BarChart3 },
]

const sampleScans: Record<string, { content: string; metadata: ChatMessage['metadata'] }> = {
  'Analyze BTC trend': {
    content: `BTC/USDT Comprehensive Analysis

Price Action:
Current: $67,230.45 | 24h High: $68,120.00 | 24h Low: $65,890.50

AI Technical Assessment:
• RSI (14): 62.4 — Neutral-Bullish zone, not overbought
• MACD: Bullish crossover confirmed on 4H timeframe
• Bollinger Bands: Price at upper band, suggesting strong momentum
• Volume Profile: 23% above 20-day average

Key Levels:
Support: $65,800 → $64,200 → $62,500
Resistance: $68,500 → $70,100 → $72,000

On-Chain Intelligence:
• Whale wallets (+1k BTC) increased by 12 in past 48h
• Exchange outflows: $340M (bullish — coins leaving exchanges)
• Network hash rate at all-time high

AI Verdict: STRONG BUY with 94% confidence. Momentum building across all timeframes.`,
    metadata: { coin: 'BTC/USDT', confidence: 94, source: 'Technical + On-Chain Analysis', indicators: ['RSI', 'MACD', 'Bollinger Bands', 'Volume Profile'] },
  },
  'Scan Ethereum': {
    content: `ETH/USDT Deep Scan Results

Price Action:
Current: $3,420.18 | 24h: +1.87% | 7d: +5.23%

AI Technical Assessment:
• RSI (14): 58.2 — Healthy neutral zone
• MACD: Convergence forming, potential bullish crossover imminent
• Ichimoku: Price above cloud, bullish bias confirmed
• Stochastic: %K crossing above %D — momentum shift

Key Levels:
Support: $3,280 → $3,150 → $3,000
Resistance: $3,550 → $3,680 → $3,850

Fundamental Analysis:
• DeFi TVL: $52.3B (+3.2% weekly) — ecosystem growing
• Gas fees: Moderate (23 gwei) — network healthy
• Staking deposits: +180k ETH this week
• ETF inflows: $120M net positive

AI Verdict: MODERATE BUY with 89% confidence. Wait for MACD crossover confirmation for optimal entry.`,
    metadata: { coin: 'ETH/USDT', confidence: 89, source: 'Technical + Fundamental Analysis', indicators: ['RSI', 'MACD', 'Ichimoku', 'Stochastic'] },
  },
  'Market fear index': {
    content: `Crypto Fear & Greed Index: 72/100 — GREED

Market Sentiment Breakdown:
• Volatility (25%): 18/25 — Low volatility, stable conditions
• Market Momentum (25%): 20/25 — Strong buying pressure
• Social Media (15%): 9/15 — Elevated bullish sentiment
• Surveys (15%): 12/15 — Strong retail interest
• Dominance (10%): 7/10 — BTC dominance stable at 52%
• Trends (10%): 6/10 — Increasing search volume

Historical Context:
• Last 30 days average: 58 (Neutral-Greed)
• Current level suggests sustained optimism
• Previous times at 72: Rally continued 68% of the time

AI Insight: Market is in greed territory but not extreme. Corrections are possible but overall structure remains bullish. Consider taking partial profits on large positions.`,
    metadata: { confidence: 85, source: 'Sentiment Aggregator', indicators: ['Volatility', 'Momentum', 'Social', 'Surveys'] },
  },
  'Top movers today': {
    content: `Top Movers — 24 Hour Performance

Gainers:
1. DOGE/USDT: +12.45% | Volume: $2.1B
   AI Signal: Social-driven pump, exercise caution
   
2. PEPE/USDT: +8.92% | Volume: $890M
   AI Signal: Meme momentum, high risk
   
3. LINK/USDT: +6.78% | Volume: $450M
   AI Signal: Strong fundamentals, accumulation phase
   
4. AVAX/USDT: +5.34% | Volume: $320M
   AI Signal: Breakout confirmed, bullish continuation

Losers:
1. SHIB/USDT: -4.23% | Volume: $780M
   AI Signal: Profit taking after recent run
   
2. MATIC/USDT: -3.12% | Volume: $290M
   AI Signal: Consolidation, support holding

AI Recommendation: Focus on LINK and AVAX for quality exposure. Avoid chasing DOGE/PEPE without stop losses.`,
    metadata: { confidence: 82, source: 'Market Scanner', indicators: ['Price Action', 'Volume', 'Social Signals'] },
  },
}

// AI Health Badge
function AiHealthBadge({ source, confidence, indicators }: { source: string; confidence: number; indicators?: string[] }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Shield size={10} className="text-[#22c55e]" />
        <span className="text-[10px] text-[#22c55e]">{confidence}% AI Confidence</span>
      </div>
      <span className="text-[10px] text-[#52525b]">Source: {source}</span>
      {indicators && indicators.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {indicators.map(ind => (
            <span key={ind} className="px-1.5 py-0.5 rounded bg-[rgba(59,130,246,0.1)] text-[9px] text-[#3b82f6]">{ind}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AiAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'ai',
      content: 'I am CozyCrypto AI, your dedicated crypto intelligence agent. I analyze real-time market data across multiple exchanges and on-chain sources. Every insight I provide includes a confidence score and data source trace.\n\nHow can I assist your trading today?',
      timestamp: new Date(),
      metadata: { source: 'CozyCrypto AI Core', confidence: 100 },
    },
  ])
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Vortex canvas effect
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let angle = 0
    const particles: { r: number; theta: number; speed: number; radius: number; opacity: number }[] = []

    for (let i = 0; i < 200; i++) {
      particles.push({
        r: Math.random() * 200 + 50,
        theta: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.02 + 0.005,
        radius: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.6 + 0.2,
      })
    }

    function render() {
      if (!canvas || !ctx) return
      canvas.width = canvas.clientWidth * window.devicePixelRatio
      canvas.height = canvas.clientHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      const cw = canvas.clientWidth
      const ch = canvas.clientHeight

      ctx.fillStyle = '#0e0e0e'
      ctx.fillRect(0, 0, cw, ch)

      const cx = cw / 2
      const cy = ch / 2

      // Draw spiral arms
      for (let arm = 0; arm < 3; arm++) {
        ctx.beginPath()
        const armOffset = (arm * Math.PI * 2) / 3
        for (let t = 0; t < 80; t++) {
          const a = angle * (0.5 + arm * 0.1) + t * 0.08 + armOffset
          const r = 30 + t * 3
          const x = cx + Math.cos(a) * r
          const y = cy + Math.sin(a) * r * 0.6
          if (t === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(armOffset) * 200, cy + Math.sin(armOffset) * 200)
        grad.addColorStop(0, 'rgba(34, 197, 94, 0.3)')
        grad.addColorStop(1, 'rgba(59, 130, 246, 0.1)')
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Draw particles
      particles.forEach(p => {
        p.theta += p.speed * (isProcessing ? 3 : 1)
        const x = cx + Math.cos(p.theta + angle) * p.r
        const y = cy + Math.sin(p.theta + angle) * p.r * 0.6

        ctx.beginPath()
        ctx.arc(x, y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(34, 197, 94, ${p.opacity * (isProcessing ? 0.8 : 0.4)})`
        ctx.fill()
      })

      // Center glow
      const centerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60)
      centerGrad.addColorStop(0, isProcessing ? 'rgba(34, 197, 94, 0.4)' : 'rgba(34, 197, 94, 0.15)')
      centerGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = centerGrad
      ctx.fillRect(cx - 60, cy - 60, 120, 120)

      angle += isProcessing ? 0.02 : 0.005
      animRef.current = requestAnimationFrame(render)
    }

    animRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animRef.current)
  }, [isProcessing])

  const handleSend = useCallback((text: string) => {
    if (!text.trim()) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsProcessing(true)

    setTimeout(() => {
      const scan = sampleScans[text] || {
        content: `I've analyzed your request: "${text}"\n\nBased on real-time data from multiple exchanges and on-chain sources:\n\n• Market conditions are favorable for selective entries\n• BTC dominance at 52% indicates altcoin opportunities\n• Volatility index at moderate levels\n\nFor a specific coin analysis, please use commands like "Scan BTC" or "Analyze Ethereum".`,
        metadata: { confidence: 75, source: 'General Analysis', indicators: ['Market Overview'] },
      }

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: scan.content,
        timestamp: new Date(),
        metadata: scan.metadata,
      }

      setMessages(prev => [...prev, aiMsg])
      setIsProcessing(false)
    }, 2000)
  }, [])

  return (
    <div className="p-6 h-full flex flex-col">
      <TopBar title="AI Agent" subtitle="Advanced crypto intelligence engine" />

      <div className="flex-1 grid grid-cols-5 gap-4 min-h-0">
        {/* Chat Panel */}
        <div className="col-span-2 panel-surface flex flex-col overflow-hidden">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin min-h-0">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[95%] px-4 py-3 rounded-xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#22c55e] text-white'
                      : 'bg-[#1f1f1f] text-[#fafafa] border border-[rgba(255,255,255,0.08)]'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.content}</p>
                </div>
                {msg.metadata && (
                  <div className="mt-2 px-1">
                    <AiHealthBadge
                      source={msg.metadata.source || 'AI Core'}
                      confidence={msg.metadata.confidence || 90}
                      indicators={msg.metadata.indicators}
                    />
                  </div>
                )}
              </div>
            ))}
            {isProcessing && (
              <div className="flex items-center gap-2 text-[#52525b] text-sm">
                <Sparkles size={14} className="animate-pulse text-[#22c55e]" />
                <span>AI processing multi-source data...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-4 py-2 border-t border-[rgba(255,255,255,0.08)]">
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt.label}
                  onClick={() => handleSend(prompt.label)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] text-[11px] text-[#a1a1aa] hover:text-[#fafafa] hover:border-[rgba(255,255,255,0.15)] transition-all"
                >
                  <prompt.icon size={11} />
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="p-4 border-t border-[rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-2 bg-[#1f1f1f] rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-3 focus-within:border-[rgba(34,197,94,0.3)] transition-colors">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
                placeholder="Ask AI to analyze or scan..."
                className="flex-1 bg-transparent text-sm text-[#fafafa] placeholder:text-[#52525b] outline-none"
              />
              <button
                onClick={() => handleSend(input)}
                disabled={isProcessing}
                className="p-2 rounded-lg bg-[#22c55e] text-white hover:bg-[#16a34a] transition-colors disabled:opacity-50"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Vortex Visualization */}
        <div className="col-span-3 panel-surface relative overflow-hidden flex items-center justify-center">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
          />

          {/* Overlay Info */}
          <div className="absolute bottom-6 left-6 right-6">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[rgba(14,14,14,0.9)] backdrop-blur-sm border border-[rgba(255,255,255,0.08)] rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <BrainCircuit size={14} className="text-[#22c55e]" />
                  <span className="text-[10px] text-[#a1a1aa]">AI Status</span>
                </div>
                <p className="text-sm font-medium text-[#fafafa]">{isProcessing ? 'Processing' : 'Active'}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${isProcessing ? 'bg-[#3b82f6] animate-pulse' : 'bg-[#22c55e]'}`} />
                  <span className="text-[10px] text-[#52525b]">{isProcessing ? 'Multi-source analysis' : 'Ready for scan'}</span>
                </div>
              </div>

              <div className="bg-[rgba(14,14,14,0.9)] backdrop-blur-sm border border-[rgba(255,255,255,0.08)] rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Activity size={14} className="text-[#3b82f6]" />
                  <span className="text-[10px] text-[#a1a1aa]">Data Sources</span>
                </div>
                <p className="text-sm font-medium text-[#fafafa]">12 Active</p>
                <p className="text-[10px] text-[#52525b] mt-1">Binance, Coinbase, On-chain</p>
              </div>

              <div className="bg-[rgba(14,14,14,0.9)] backdrop-blur-sm border border-[rgba(255,255,255,0.08)] rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={14} className="text-[#22c55e]" />
                  <span className="text-[10px] text-[#a1a1aa]">Accuracy Rate</span>
                </div>
                <p className="text-sm font-medium text-[#22c55e]">94.2%</p>
                <p className="text-[10px] text-[#52525b] mt-1">Last 30 days performance</p>
              </div>
            </div>
          </div>

          {/* Processing indicator */}
          {isProcessing && (
            <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(59,130,246,0.1)] border border-[rgba(59,130,246,0.3)]">
              <Sparkles size={14} className="text-[#3b82f6] animate-spin" />
              <span className="text-xs text-[#3b82f6]">Processing neural scan...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
