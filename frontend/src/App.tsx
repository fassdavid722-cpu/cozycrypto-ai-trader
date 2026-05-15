import React, { useEffect } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import AIModeBar from '@/components/layout/AIModeBar'
import Dashboard from '@/components/pages/Dashboard'
import MarketOverview from '@/components/pages/MarketOverview'
import Portfolio from '@/components/pages/Portfolio'
import AIChat from '@/components/pages/AIChat'
import Workflows from '@/components/pages/Workflows'
import Settings from '@/components/pages/Settings'
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
    return () => { clearInterval(marketInterval); clearInterval(portfolioInterval) }
  }, [])

  const fetchMarketData = async () => {
    try {
      const res = await fetch(`${API}/api/market/tickers`)
      if (res.ok) {
        const data = await res.json()
        // Map snake_case from Python backend
        const tickers = (data.tickers || []).map((t: any) => ({
          symbol:    t.symbol,
          price:     t.price,
          change24h: t.change_24h,
          volume:    t.volume,
          high24h:   t.high_24h,
          low24h:    t.low_24h,
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
        const allConnected = data.connected?.bitget && data.connected?.groq
        setAiStatus(allConnected ? 'online' : 'learning')
      }
    } catch {}
  }

  return (
    <div className="flex h-screen w-screen bg-bg-primary overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-hidden p-4">
          <PageContent />
        </main>
        <AIModeBar />
      </div>
    </div>
  )
}
