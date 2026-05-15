import { create } from 'zustand'

export interface MarketTicker {
  symbol: string
  price: number
  change24h: number
  volume: number
  high24h: number
  low24h: number
  sparkline?: number[]
}

export interface Trade {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  price: number
  pnl?: number
  status: 'open' | 'closed' | 'pending'
  timestamp: number
  reason: string
}

export interface Alert {
  id: string
  message: string
  type: 'info' | 'warning' | 'success' | 'danger'
  timestamp: number
  read: boolean
}

export interface Workflow {
  id: string
  name: string
  description: string
  status: 'running' | 'paused' | 'scheduled' | 'stopped'
  nextRun?: string
  lastRun?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  content: string
  timestamp: number
  thinking?: boolean
}

export interface PortfolioPoint {
  time: string
  value: number
}

interface AppState {
  // Market
  tickers: MarketTicker[]
  watchlist: string[]
  setTickers: (t: MarketTicker[]) => void

  // Portfolio
  portfolioValue: number
  portfolioChange: number
  portfolioHistory: PortfolioPoint[]
  balance: number
  setPortfolio: (v: number, c: number, h: PortfolioPoint[], b: number) => void

  // Trades
  trades: Trade[]
  addTrade: (t: Trade) => void

  // Alerts
  alerts: Alert[]
  addAlert: (a: Alert) => void
  markAlertRead: (id: string) => void

  // Workflows
  workflows: Workflow[]
  setWorkflows: (w: Workflow[]) => void

  // Chat
  messages: ChatMessage[]
  addMessage: (m: ChatMessage) => void
  isThinking: boolean
  setThinking: (v: boolean) => void

  // AI Status
  aiStatus: 'online' | 'learning' | 'trading' | 'offline'
  aiMode: 'chat' | 'analyze' | 'automate' | 'build' | 'research'
  setAiMode: (m: AppState['aiMode']) => void
  setAiStatus: (s: AppState['aiStatus']) => void

  // UI
  activeTab: string
  setActiveTab: (t: string) => void
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
}

export const useStore = create<AppState>((set) => ({
  tickers: [],
  watchlist: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'LINK/USDT', 'MATIC/USDT'],
  setTickers: (tickers) => set({ tickers }),

  portfolioValue: 0,
  portfolioChange: 0,
  portfolioHistory: [],
  balance: 0,
  setPortfolio: (portfolioValue, portfolioChange, portfolioHistory, balance) =>
    set({ portfolioValue, portfolioChange, portfolioHistory, balance }),

  trades: [],
  addTrade: (t) => set((s) => ({ trades: [t, ...s.trades].slice(0, 100) })),

  alerts: [],
  addAlert: (a) => set((s) => ({ alerts: [a, ...s.alerts].slice(0, 50) })),
  markAlertRead: (id) => set((s) => ({ alerts: s.alerts.map(a => a.id === id ? { ...a, read: true } : a) })),

  workflows: [],
  setWorkflows: (workflows) => set({ workflows }),

  messages: [],
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  isThinking: false,
  setThinking: (isThinking) => set({ isThinking }),

  aiStatus: 'online',
  aiMode: 'chat',
  setAiMode: (aiMode) => set({ aiMode }),
  setAiStatus: (aiStatus) => set({ aiStatus }),

  activeTab: 'dashboard',
  setActiveTab: (activeTab) => set({ activeTab }),
  sidebarOpen: true,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}))
