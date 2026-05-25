import React, { useEffect } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import Dashboard from '@/components/pages/Dashboard'
import MarketOverview from '@/components/pages/MarketOverview'
import Portfolio from '@/components/pages/Portfolio'
import AIChat from '@/components/pages/AIChat'
import Workflows from '@/components/pages/Workflows'
import Settings from '@/components/pages/Settings'
import Positions from '@/components/pages/Positions'
import Orders from '@/components/pages/Orders'
import { useStore } from '@/store/useStore'
import { useSSE } from '@/hooks/useSSE'

const API = import.meta.env.VITE_API_URL || ''

function PageContent() {
  const { activeTab } = useStore()
  switch (activeTab) {
    case 'dashboard':   return <Dashboard />
    case 'ai-chat':     return <AIChat />
    case 'market':      return <MarketOverview />
    case 'portfolio':   return <Portfolio />
    case 'workflows':   return <Workflows />
    case 'positions':   return <Positions />
    case 'orders':      return <Orders />
    case 'settings':    return <Settings />
    default:            return <Dashboard />
  }
}

export default function App() {
  const { setTickers, setPortfolio, setWorkflows, setAiStatus } = useStore()

  // Connect SSE for real-time notifications
  useSSE()

  useEffect(() => {
    fetchMarketData()
    fetchPortfolio()
    fetchWorkflows()
    fetchSettings()

    const marketInterval = setInterval(fetchMarketData, 15000)
    const portfolioInterval = setInterval(fetchPortfolio, 30000)

    return () => { 
      clearInterval(marketInterval)
      clearInterval(portfolioInterval) 
    }
  }, [])

  const fetchMarketData = async () => {
    try {
      const res = await fetch(`${API}/api/market/tickers`)
      if (res.ok) {
        const data = await res.json()
        const tickers = (data.tickers || []).map((t: any) => ({
          symbol:    t.symbol,
          price:     t.price,
          change24h: t.change24h,
          volume:    t.volume,
          high24h:   t.high24h,
          low24h:    t.low24h,
          sparkline: t.sparkline || [],
        }))
        setTickers(tickers)
      }
    } catch {}
  }

  const fetchPortfolio = async () => {
    try {
      const res = await fetch(`${API}/api/portfolio`)
      if (res.ok) {
        const data = await res.json()
        setPortfolio(data.value || 0, data.change || 0, data.history || [], data.balance || 0)
      }
    } catch {}
  }

  const fetchWorkflows = async () => {
    try {
      const res = await fetch(`${API}/api/workflows`)
      if (res.ok) {
        const data = await res.json()
        setWorkflows(data.workflows || [])
      }
    } catch {}
  }

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API}/api/settings`)
      if (res.ok) {
        const data = await res.json()
        const conn = data.connections || {}
        if (conn.bitget && conn.groq) setAiStatus('trading')
        else if (conn.groq) setAiStatus('learning')
        else setAiStatus('online')
      }
    } catch {}
  }

  return (
    <div className="flex h-screen w-screen bg-[#0e0e0e] overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <PageContent />
      </main>
    </div>
  )
}
