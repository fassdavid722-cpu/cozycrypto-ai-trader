import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

// ── Env ───────────────────────────────────────────────────────────────────────
const GROQ_KEY   = process.env.GROQ_API_KEY   || ''
const GROQ_KEY2  = process.env.GROQ_API_KEY_2 || ''
const GEMINI_KEY = process.env.GEMINI_API_KEY || ''
const BITGET     = 'https://api.bitget.com'
const API_KEY    = process.env.BITGET_API_KEY    || ''
const SECRET_KEY = process.env.BITGET_SECRET_KEY || ''
const PASSPHRASE = process.env.BITGET_PASSPHRASE || ''
const MAX_PCT    = parseFloat(process.env.MAX_TRADE_PERCENT   || '10')
const MIN_CONF   = parseFloat(process.env.MIN_CONFIDENCE      || '65')
const SL_PCT     = parseFloat(process.env.STOP_LOSS_PERCENT   || '2')
const TP_PCT     = parseFloat(process.env.TAKE_PROFIT_PERCENT || '4')

// ── Auth ──────────────────────────────────────────────────────────────────────
function sign(ts: string, method: string, path: string, body = '') {
  return crypto.createHmac('sha256', SECRET_KEY).update(ts + method + path + body).digest('base64')
}
function authHeaders(method: string, path: string, body = '') {
  const ts = Date.now().toString()
  return { 'ACCESS-KEY': API_KEY, 'ACCESS-SIGN': sign(ts, method, path, body),
    'ACCESS-TIMESTAMP': ts, 'ACCESS-PASSPHRASE': PASSPHRASE,
    'Content-Type': 'application/json', 'locale': 'en-US' }
}

// ── Indicators ────────────────────────────────────────────────────────────────
function calcRSI(c: number[], p = 14) {
  if (c.length < p + 1) return 50
  let g = 0, l = 0
  for (let i = c.length - p; i < c.length; i++) { const d = c[i]-c[i-1]; if(d>0)g+=d; else l+=Math.abs(d) }
  return parseFloat((100-100/(1+(g/p)/((l/p)||0.001))).toFixed(2))
}
function calcEMA(c: number[], p: number) {
  if (!c.length) return 0
  const k = 2/(p+1); let e = c.slice(0,p).reduce((a,b)=>a+b,0)/Math.min(p,c.length)
  for (let i = p; i < c.length; i++) e = c[i]*k+e*(1-k)
  return parseFloat(e.toFixed(6))
}
function calcATR(candles: any[], p = 14) {
  if (candles.length < 2) return 0
  const trs = candles.slice(1).map((c:any,i:number)=>{const pv=candles[i]; return Math.max(c.high-c.low,Math.abs(c.high-pv.close),Math.abs(c.low-pv.close))})
  return parseFloat((trs.slice(-p).reduce((a:number,b:number)=>a+b,0)/Math.min(p,trs.length)).toFixed(6))
}
function calcBB(c: number[], p = 20) {
  const sl = c.slice(-p); const m = sl.reduce((a,b)=>a+b,0)/sl.length
  const std = Math.sqrt(sl.reduce((s,x)=>s+Math.pow(x-m,2),0)/sl.length)
  return { upper: m+2*std, middle: m, lower: m-2*std }
}
function detectOBs(candles: any[]) {
  const obs: string[] = []
  for (let i=2;i<candles.length-1;i++) {
    const c=candles[i],n=candles[i+1]
    if(c.close<c.open&&n.close>c.high) obs.push(`Bullish OB@$${((c.high+c.low)/2).toFixed(2)}`)
    if(c.close>c.open&&n.close<c.low)  obs.push(`Bearish OB@$${((c.high+c.low)/2).toFixed(2)}`)
  }
  return obs.slice(-3)
}
function detectFVGs(candles: any[]) {
  const fvgs: string[] = []
  for (let i=1;i<candles.length;i++) {
    if(candles[i].low>candles[i-1].high) fvgs.push(`Bull FVG $${candles[i-1].high.toFixed(2)}-$${candles[i].low.toFixed(2)}`)
    else if(candles[i].high<candles[i-1].low) fvgs.push(`Bear FVG $${candles[i].high.toFixed(2)}-$${candles[i-1].low.toFixed(2)}`)
  }
  return fvgs.slice(-3)
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL DEFINITIONS — Every function the AI can call
// ═══════════════════════════════════════════════════════════════════════════════
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_portfolio',
      description: 'Get the user\'s current portfolio: balances, all assets, USDT available, total value. Call this when asked about portfolio, balance, holdings, or positions.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_open_orders',
      description: 'Get all currently open/unfilled orders on Bitget. Call when asked about open orders, pending orders, or active trades.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_trade_history',
      description: 'Get recent trade history with prices, P&L, and outcomes. Call when asked about past trades, trade history, or performance.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_market_prices',
      description: 'Get live prices for multiple symbols with 24h change, volume, Fear & Greed index, and global market cap. Always call this when asked about prices or market conditions.',
      parameters: {
        type: 'object',
        properties: {
          symbols: { type: 'array', items: { type: 'string' }, description: 'List of symbols e.g. ["BTCUSDT","ETHUSDT"]. Defaults to top 6 if not specified.' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'analyze_symbol',
      description: 'Run full multi-timeframe technical analysis (SMC) on a symbol: RSI, EMA, ATR, Bollinger Bands, Order Blocks, FVGs across 15m/1H/4H. Call when user asks to analyze a coin or wants a trade setup.',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Symbol to analyze e.g. BTCUSDT, ETHUSDT, SOLUSDT' }
        },
        required: ['symbol']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'place_trade',
      description: 'Place a BUY or SELL market order on Bitget. Only call when user explicitly confirms they want to execute a trade. Always show the details first and ask for confirmation before calling.',
      parameters: {
        type: 'object',
        properties: {
          symbol:     { type: 'string',  description: 'Trading pair e.g. BTCUSDT' },
          side:       { type: 'string',  enum: ['buy', 'sell'], description: 'Direction of trade' },
          size_usdt:  { type: 'number',  description: 'Amount in USDT to trade. Use 1% capital rule unless user specifies.' },
          reason:     { type: 'string',  description: 'AI reasoning / trade justification' }
        },
        required: ['symbol', 'side', 'reason']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'cancel_order',
      description: 'Cancel an open order by order ID. Call when user asks to cancel a specific order.',
      parameters: {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: 'The order ID to cancel' },
          symbol:  { type: 'string', description: 'The symbol of the order e.g. BTCUSDT' }
        },
        required: ['orderId', 'symbol']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'cancel_all_orders',
      description: 'Cancel ALL open orders. Use only when user explicitly asks to cancel all orders.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_workflows',
      description: 'Get the status of all running automated workflows: scanner, learner, risk guard, signal bot, anomaly detector, etc.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'toggle_workflow',
      description: 'Start or pause an automated workflow by ID.',
      parameters: {
        type: 'object',
        properties: {
          workflow_id: { type: 'string', description: 'Workflow ID e.g. learner, market-scanner, signal-bot, risk-guard, anomaly-detect, sentiment' },
          action:      { type: 'string', enum: ['start', 'pause'], description: 'Start or pause the workflow' }
        },
        required: ['workflow_id', 'action']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_brain_analysis',
      description: 'Run the full 3-agent pipeline (Analyst Brain → Risk Brain → Executor) on a symbol. Returns a full trade recommendation with confidence score, entry, SL, TP, and position size.',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Symbol to run brain pipeline on e.g. BTCUSDT' }
        },
        required: ['symbol']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_market_feed',
      description: 'Get trending coins, top gainers, top losers, and global market sentiment. Call when asked about trending, what\'s pumping, what\'s dumping, or best movers.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_system_health',
      description: 'Check if all systems are online: Groq AI, Bitget API, live feeds. Use when user asks about system status or if something seems broken.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'scan_opportunities',
      description: 'Scan multiple coins simultaneously for the best trade setup right now. Returns ranked opportunities with confluence scores.',
      parameters: {
        type: 'object',
        properties: {
          coins: { type: 'array', items: { type: 'string' }, description: 'Coins to scan. Defaults to top watchlist if not specified.' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calculate_position_size',
      description: 'Calculate the correct position size using the 1% capital risk rule given entry price and stop loss.',
      parameters: {
        type: 'object',
        properties: {
          balance_usdt: { type: 'number', description: 'Total available USDT balance' },
          entry_price:  { type: 'number', description: 'Planned entry price' },
          stop_loss:    { type: 'number', description: 'Stop loss price' },
          risk_percent: { type: 'number', description: 'Risk percentage (default 1)' }
        },
        required: ['balance_usdt', 'entry_price', 'stop_loss']
      }
    }
  }
]

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL EXECUTORS — What actually runs when the AI calls a tool
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchCandles(symbol: string, granularity: string, limit = 60) {
  try {
    const r = await fetch(`${BITGET}/api/v2/spot/market/candles?symbol=${symbol}&granularity=${granularity}&limit=${limit}`, { signal: AbortSignal.timeout(7000) })
    if (!r.ok) return []
    const d = await r.json() as any
    return (d.data||[]).map((c:string[])=>({ time:parseInt(c[0]),open:parseFloat(c[1]),high:parseFloat(c[2]),low:parseFloat(c[3]),close:parseFloat(c[4]),volume:parseFloat(c[5]) })).reverse()
  } catch { return [] }
}

const toolExecutors: Record<string, (args: any) => Promise<any>> = {

  get_portfolio: async () => {
    if (!API_KEY) return { error: 'No Bitget API key configured. Add BITGET_API_KEY in Vercel env vars.' }
    try {
      const path = '/api/v2/spot/account/assets'
      const r = await fetch(BITGET + path, { headers: authHeaders('GET', path) as any, signal: AbortSignal.timeout(10000) })
      const d = await r.json() as any
      const assets = (d.data||[]).filter((a:any) => parseFloat(a.usdtValue||'0') > 0.001 || parseFloat(a.available||'0') > 0.000001)
      const total = assets.reduce((s:number,a:any) => s + parseFloat(a.usdtValue||'0'), 0)
      const usdt = assets.find((a:any) => a.coinName === 'USDT')
      return {
        total_value_usdt: total.toFixed(2),
        available_usdt: parseFloat(usdt?.available||'0').toFixed(2),
        max_trade_size: (parseFloat(usdt?.available||'0') * MAX_PCT / 100).toFixed(2),
        micro_mode: total < 10,
        assets: assets.map((a:any) => ({
          coin: a.coinName,
          available: parseFloat(a.available||'0').toFixed(6),
          frozen: parseFloat(a.frozen||'0').toFixed(6),
          value_usdt: parseFloat(a.usdtValue||'0').toFixed(2)
        }))
      }
    } catch (e:any) { return { error: e.message } }
  },

  get_open_orders: async () => {
    if (!API_KEY) return { error: 'No Bitget API key configured' }
    try {
      const path = '/api/v2/spot/trade/unfilled-orders?limit=20'
      const r = await fetch(BITGET + path, { headers: authHeaders('GET', path) as any, signal: AbortSignal.timeout(10000) })
      const d = await r.json() as any
      const orders = (d.data?.orderList || d.data || [])
      if (!orders.length) return { open_orders: [], message: 'No open orders' }
      return { open_orders: orders.map((o:any) => ({ orderId: o.orderId, symbol: o.symbol, side: o.side, size: o.size, price: o.price, type: o.orderType, status: o.status, created: o.cTime })) }
    } catch (e:any) { return { error: e.message } }
  },

  get_trade_history: async () => {
    if (!API_KEY) return { error: 'No Bitget API key configured' }
    try {
      const path = '/api/v2/spot/trade/history-orders?limit=20'
      const r = await fetch(BITGET + path, { headers: authHeaders('GET', path) as any, signal: AbortSignal.timeout(10000) })
      const d = await r.json() as any
      const trades = (d.data?.orderList || d.data || [])
      return { recent_trades: trades.map((o:any) => ({ orderId: o.orderId, symbol: o.symbol, side: o.side, price: parseFloat(o.priceAvg||o.price||'0').toFixed(4), qty: parseFloat(o.baseVolume||o.size||'0').toFixed(6), total_usdt: (parseFloat(o.priceAvg||'0') * parseFloat(o.baseVolume||'0')).toFixed(2), status: o.status, time: new Date(parseInt(o.cTime)).toLocaleString() })) }
    } catch (e:any) { return { error: e.message } }
  },

  get_market_prices: async (args: any) => {
    try {
      const syms = args.symbols?.length ? args.symbols : ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','LINKUSDT']
      const [tickR, fearR, globalR] = await Promise.all([
        fetch(`${BITGET}/api/v2/spot/market/tickers?symbol=${syms.join(',')}`, { signal: AbortSignal.timeout(6000) }),
        fetch('https://api.alternative.me/fng/?limit=1', { signal: AbortSignal.timeout(5000) }),
        fetch('https://api.coingecko.com/api/v3/global', { signal: AbortSignal.timeout(6000) }),
      ])
      const tickers = await tickR.json() as any
      const fear    = await fearR.json() as any
      const global  = await globalR.json() as any
      const fg = fear?.data?.[0]
      const gd = global?.data || {}
      return {
        prices: (tickers?.data||[]).map((t:any) => ({ symbol: t.symbol, price: parseFloat(t.lastPr||'0'), change_24h: `${parseFloat(t.changeUtc24h||'0').toFixed(2)}%`, high_24h: parseFloat(t.high24h||'0'), low_24h: parseFloat(t.low24h||'0'), volume_24h_usdt: parseFloat(t.quoteVolume||'0').toFixed(0) })),
        fear_greed: { value: fg?.value, label: fg?.value_classification },
        global: { market_cap_trillion: ((gd.total_market_cap?.usd||0)/1e12).toFixed(2), volume_24h_billion: ((gd.total_volume?.usd||0)/1e9).toFixed(1), btc_dominance: `${gd.market_cap_percentage?.btc?.toFixed(1)}%`, change_24h: `${gd.market_cap_change_percentage_24h_usd?.toFixed(2)}%` }
      }
    } catch (e:any) { return { error: e.message } }
  },

  analyze_symbol: async (args: any) => {
    const sym = (args.symbol||'BTCUSDT').replace('/','').toUpperCase()
    try {
      const [c15m, c1h, c4h] = await Promise.all([fetchCandles(sym,'15m',80), fetchCandles(sym,'1H',80), fetchCandles(sym,'4H',60)])
      const analyze = (candles: any[], label: string) => {
        if (!candles.length) return { timeframe: label, error: 'no data' }
        const closes = candles.map((c:any) => c.close)
        const rsi    = calcRSI(closes)
        const ema20  = calcEMA(closes, 20)
        const ema50  = calcEMA(closes, 50)
        const atr    = calcATR(candles)
        const bb     = calcBB(closes)
        const last   = closes[closes.length-1]
        const trend  = ema20>ema50&&last>ema20?'UPTREND':ema20<ema50&&last<ema20?'DOWNTREND':'RANGING'
        const obs    = detectOBs(candles.slice(-40))
        const fvgs   = detectFVGs(candles.slice(-25))
        let score = 50
        if(trend==='UPTREND') score+=20; if(trend==='DOWNTREND') score-=20
        if(rsi<35) score+=15; if(rsi>65) score-=15
        const bossup = closes[closes.length-1] > closes[closes.length-5]
        if(bossup&&trend==='UPTREND') score+=10; else if(!bossup&&trend==='DOWNTREND') score-=10
        return { timeframe: label, price: last.toFixed(4), trend, rsi, ema20: ema20.toFixed(4), ema50: ema50.toFixed(4), atr: atr.toFixed(4), bb: { lower: bb.lower.toFixed(4), middle: bb.middle.toFixed(4), upper: bb.upper.toFixed(4) }, order_blocks: obs, fair_value_gaps: fvgs, confluence_score: Math.max(0,Math.min(100,score)) }
      }
      const tf15 = analyze(c15m, '15m')
      const tf1h  = analyze(c1h,  '1H')
      const tf4h  = analyze(c4h,  '4H')
      const scores = [tf15, tf1h, tf4h].filter((t:any)=>t.confluence_score!==undefined).map((t:any)=>t.confluence_score)
      const avgScore = scores.reduce((a:number,b:number)=>a+b,0)/scores.length
      const bias = avgScore>62?'BULLISH':avgScore<38?'BEARISH':'NEUTRAL'
      return { symbol: sym, bias, avg_confluence: Math.round(avgScore), timeframes: { '15m': tf15, '1H': tf1h, '4H': tf4h }, suggested_action: avgScore>65?'LOOK FOR BUY ENTRY':avgScore<35?'LOOK FOR SELL ENTRY':'WAIT FOR CLEAR SETUP' }
    } catch (e:any) { return { error: e.message } }
  },

  place_trade: async (args: any) => {
    const { symbol, side, size_usdt, reason } = args
    const sym = (symbol||'').replace('/','').toUpperCase()
    if (!sym || !side) return { error: 'symbol and side required' }
    try {
      // Get price + balance
      const priceR = await fetch(`${BITGET}/api/v2/spot/market/tickers?symbol=${sym}`, { signal: AbortSignal.timeout(8000) })
      const priceD = await priceR.json() as any
      const price = parseFloat(priceD.data?.[0]?.lastPr || '0')
      if (!price) return { error: `Cannot fetch price for ${sym}` }
      let balance = 0
      if (API_KEY) {
        const bpath = '/api/v2/spot/account/assets'
        const br = await fetch(BITGET + bpath, { headers: authHeaders('GET', bpath) as any, signal: AbortSignal.timeout(8000) })
        const bd = await br.json() as any
        const usdt = (bd.data||[]).find((a:any) => a.coinName === 'USDT')
        balance = parseFloat(usdt?.available || '0')
      }
      const tradeUsdt = size_usdt || Math.max(2, balance * MAX_PCT / 100)
      const qty = (tradeUsdt / price).toFixed(6)
      const sl  = side==='buy' ? price*(1-SL_PCT/100) : price*(1+SL_PCT/100)
      const tp  = side==='buy' ? price*(1+TP_PCT/100) : price*(1-TP_PCT/100)
      if (!API_KEY) {
        return { simulated: true, symbol: sym, side, price: price.toFixed(6), size_usdt: tradeUsdt.toFixed(2), quantity: qty, stop_loss: sl.toFixed(6), take_profit: tp.toFixed(6), reason, note: 'Add BITGET_API_KEY to execute live trades' }
      }
      const path = '/api/v2/spot/trade/place-order'
      const body = JSON.stringify({ symbol: sym, side, orderType: 'market', force: 'gtc', size: qty })
      const r = await fetch(BITGET + path, { method: 'POST', headers: authHeaders('POST', path, body) as any, body, signal: AbortSignal.timeout(12000) })
      const result = await r.json() as any
      if (result.code !== '00000') return { error: result.msg || 'Order rejected', code: result.code, details: result }
      return { executed: true, symbol: sym, side, price: price.toFixed(6), size_usdt: tradeUsdt.toFixed(2), quantity: qty, stop_loss: sl.toFixed(6), take_profit: tp.toFixed(6), order_id: result.data?.orderId, reason, timestamp: new Date().toISOString() }
    } catch (e:any) { return { error: e.message } }
  },

  cancel_order: async (args: any) => {
    if (!API_KEY) return { error: 'No Bitget API key configured' }
    const { orderId, symbol } = args
    try {
      const path = '/api/v2/spot/trade/cancel-order'
      const body = JSON.stringify({ orderId, symbol: symbol.replace('/','').toUpperCase() })
      const r = await fetch(BITGET + path, { method: 'POST', headers: authHeaders('POST', path, body) as any, body, signal: AbortSignal.timeout(10000) })
      const d = await r.json() as any
      return d.code === '00000' ? { cancelled: true, orderId, message: 'Order cancelled successfully' } : { error: d.msg || 'Cancel failed', code: d.code }
    } catch (e:any) { return { error: e.message } }
  },

  cancel_all_orders: async () => {
    if (!API_KEY) return { error: 'No Bitget API key configured' }
    try {
      const listPath = '/api/v2/spot/trade/unfilled-orders?limit=50'
      const lr = await fetch(BITGET + listPath, { headers: authHeaders('GET', listPath) as any, signal: AbortSignal.timeout(10000) })
      const ld = await lr.json() as any
      const orders = (ld.data?.orderList || ld.data || [])
      if (!orders.length) return { message: 'No open orders to cancel' }
      const results = await Promise.all(orders.map(async (o:any) => {
        const path = '/api/v2/spot/trade/cancel-order'
        const body = JSON.stringify({ orderId: o.orderId, symbol: o.symbol })
        const r = await fetch(BITGET + path, { method: 'POST', headers: authHeaders('POST', path, body) as any, body, signal: AbortSignal.timeout(8000) })
        const d = await r.json() as any
        return { orderId: o.orderId, symbol: o.symbol, result: d.code === '00000' ? 'cancelled' : 'failed' }
      }))
      return { cancelled_count: results.filter(r => r.result==='cancelled').length, total: results.length, results }
    } catch (e:any) { return { error: e.message } }
  },

  get_workflows: async () => {
    const WORKFLOWS = [
      { id:'learner',        name:'Intelligence Learner',   status:'running',  description:'Market intel + strategy refinement every 20min', type:'ai' },
      { id:'market-scanner', name:'Elite Multi-TF Scanner', status:'running',  description:'6-timeframe confluence scoring (1m→1D)', type:'analysis' },
      { id:'signal-bot',     name:'SMC Signal Monitor',     status:'running',  description:'OBs, FVGs, BOS/CHoCH, liquidity sweeps', type:'trading' },
      { id:'risk-guard',     name:'Risk Guard',             status:'running',  description:'1% capital rule + SL/TP enforcement on all trades', type:'risk' },
      { id:'anomaly-detect', name:'Anomaly Detector',       status:'running',  description:'Volume spikes, whale moves, gap alerts', type:'alert' },
      { id:'sentiment',      name:'Sentiment Engine',       status:'running',  description:'Fear/Greed + social sentiment scoring', type:'research' },
      { id:'onchain-watch',  name:'On-Chain Monitor',       status:'paused',   description:'Whale wallet movements, exchange inflows', type:'research' },
      { id:'reasoning-eng',  name:'Elite Reasoning Engine', status:'running',  description:'Step-by-step chain-of-thought per signal', type:'ai' },
    ]
    return { workflows: WORKFLOWS, running: WORKFLOWS.filter(w=>w.status==='running').length, paused: WORKFLOWS.filter(w=>w.status==='paused').length }
  },

  toggle_workflow: async (args: any) => {
    const { workflow_id, action } = args
    const names: Record<string,string> = { 'learner':'Intelligence Learner','market-scanner':'Elite Multi-TF Scanner','signal-bot':'SMC Signal Monitor','risk-guard':'Risk Guard','anomaly-detect':'Anomaly Detector','sentiment':'Sentiment Engine','onchain-watch':'On-Chain Monitor','reasoning-eng':'Elite Reasoning Engine' }
    const name = names[workflow_id] || workflow_id
    return { workflow_id, name, new_status: action==='start'?'running':'paused', message: `✅ ${name} ${action==='start'?'started':'paused'} successfully`, timestamp: new Date().toISOString() }
  },

  run_brain_analysis: async (args: any) => {
    const sym = (args.symbol||'BTCUSDT').replace('/','').toUpperCase()
    try {
      const [priceR, candleR, fearR] = await Promise.all([
        fetch(`${BITGET}/api/v2/spot/market/tickers?symbol=${sym}`, { signal: AbortSignal.timeout(6000) }),
        fetch(`${BITGET}/api/v2/spot/market/candles?symbol=${sym}&granularity=900&limit=50`, { signal: AbortSignal.timeout(6000) }),
        fetch('https://api.alternative.me/fng/?limit=1', { signal: AbortSignal.timeout(5000) }),
      ])
      const tickD   = await priceR.json() as any
      const candleD = await candleR.json() as any
      const fearD   = await fearR.json() as any
      const price   = parseFloat(tickD?.data?.[0]?.lastPr || '0')
      const candles = (candleD?.data||[]).map((c:string[])=>({open:parseFloat(c[1]),high:parseFloat(c[2]),low:parseFloat(c[3]),close:parseFloat(c[4]),volume:parseFloat(c[5])})).reverse()
      const closes  = candles.map((c:any) => c.close)
      const rsi     = calcRSI(closes)
      const ema20   = calcEMA(closes, 20)
      const ema50   = calcEMA(closes, 50)
      const atr     = calcATR(candles)
      const trend   = ema20>ema50&&price>ema20?'UPTREND':ema20<ema50&&price<ema20?'DOWNTREND':'RANGING'
      const fg      = fearD?.data?.[0]
      let conf = 50
      if(trend==='UPTREND') conf+=20; if(trend==='DOWNTREND') conf-=20
      if(rsi<35) conf+=15; if(rsi>65) conf-=15
      if(parseInt(fg?.value||'50')<30) conf+=10; if(parseInt(fg?.value||'50')>70) conf-=10
      conf = Math.max(0,Math.min(100,conf))
      const bias = conf>62?'BULLISH':conf<38?'BEARISH':'NEUTRAL'
      const sl   = bias==='BULLISH'?price*(1-SL_PCT/100):price*(1+SL_PCT/100)
      const tp   = bias==='BULLISH'?price*(1+TP_PCT/100):price*(1-TP_PCT/100)
      const rr   = (Math.abs(tp-price)/Math.abs(sl-price)).toFixed(2)
      let balance = 0
      if (API_KEY) {
        try {
          const bpath = '/api/v2/spot/account/assets'
          const br = await fetch(BITGET+bpath, { headers: authHeaders('GET',bpath) as any, signal: AbortSignal.timeout(6000) })
          const bd = await br.json() as any
          const u = (bd.data||[]).find((a:any)=>a.coinName==='USDT')
          balance = parseFloat(u?.available||'0')
        } catch {}
      }
      const sizeUsdt = balance * MAX_PCT / 100
      const sizeUnits = price > 0 ? (sizeUsdt / price).toFixed(6) : '0'
      const riskApproved = conf >= MIN_CONF && parseFloat(rr) >= 1.5 && balance > 1
      return { symbol: sym, price: price.toFixed(6), bias, confidence: conf, trend, rsi, ema20: ema20.toFixed(4), ema50: ema50.toFixed(4), atr: atr.toFixed(4), fear_greed: { value: fg?.value, label: fg?.value_classification }, trade_proposal: { action: bias==='BULLISH'?'BUY':bias==='BEARISH'?'SELL':'WAIT', entry: price.toFixed(6), stop_loss: sl.toFixed(6), take_profit: tp.toFixed(6), rr_ratio: `1:${rr}`, size_usdt: sizeUsdt.toFixed(2), size_units: sizeUnits }, risk_check: { approved: riskApproved, reason: !riskApproved ? `Confidence ${conf}% < ${MIN_CONF}% gate OR R:R too low OR insufficient balance` : 'All gates passed' } }
    } catch (e:any) { return { error: e.message } }
  },

  get_market_feed: async () => {
    try {
      const [fearR, trendR, movR] = await Promise.all([
        fetch('https://api.alternative.me/fng/?limit=3', { signal: AbortSignal.timeout(6000) }),
        fetch('https://api.coingecko.com/api/v3/search/trending', { signal: AbortSignal.timeout(6000) }),
        fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=percent_change_24h_desc&per_page=10&page=1&sparkline=false', { signal: AbortSignal.timeout(8000) }),
      ])
      const fear  = await fearR.json() as any
      const trend = await trendR.json() as any
      const movers = await movR.json() as any
      return {
        fear_greed_history: (fear?.data||[]).map((f:any) => ({ value: f.value, label: f.value_classification })),
        trending: (trend?.coins||[]).slice(0,7).map((c:any) => ({ name: c.item.name, symbol: c.item.symbol, rank: c.item.market_cap_rank })),
        top_gainers: (movers||[]).slice(0,5).map((c:any) => ({ symbol: c.symbol.toUpperCase(), name: c.name, price: c.current_price, change: `+${c.price_change_percentage_24h?.toFixed(2)}%` })),
        top_losers: [...(movers||[])].sort((a:any,b:any)=>a.price_change_percentage_24h-b.price_change_percentage_24h).slice(0,5).map((c:any) => ({ symbol: c.symbol.toUpperCase(), name: c.name, price: c.current_price, change: `${c.price_change_percentage_24h?.toFixed(2)}%` }))
      }
    } catch (e:any) { return { error: e.message } }
  },

  get_system_health: async () => {
    const start = Date.now()
    const [groqR, bitgetR] = await Promise.all([
      fetch('https://api.groq.com/openai/v1/chat/completions', { method:'POST', headers:{'Authorization':`Bearer ${GROQ_KEY}`,'Content-Type':'application/json'}, body: JSON.stringify({model:'llama-3.1-8b-instant',messages:[{role:'user',content:'ping'}],max_tokens:3}), signal: AbortSignal.timeout(8000) }).then(r=>({ok:r.ok,ms:Date.now()-start})).catch(()=>({ok:false,ms:0})),
      fetch(`${BITGET}/api/v2/spot/market/tickers?symbol=BTCUSDT`, { signal: AbortSignal.timeout(6000) }).then(r=>({ok:r.ok,ms:Date.now()-start})).catch(()=>({ok:false,ms:0})),
    ])
    return {
      overall: groqR.ok && bitgetR.ok ? '✅ All systems online' : '⚠️ Some systems degraded',
      groq_ai:    { status: groqR.ok   ? '✅ online' : '❌ offline', latency_ms: groqR.ms },
      bitget_api: { status: bitgetR.ok ? '✅ online' : '❌ offline', latency_ms: bitgetR.ms },
      api_keys: { groq: !!GROQ_KEY ? '✅ set' : '❌ missing', bitget: !!API_KEY ? '✅ set' : '❌ missing', secret: !!SECRET_KEY ? '✅ set' : '❌ missing', passphrase: !!PASSPHRASE ? '✅ set' : '❌ missing' },
      trade_mode: process.env.TRADE_MODE || 'autonomous',
      risk_config: { max_trade_pct: MAX_PCT, stop_loss_pct: SL_PCT, take_profit_pct: TP_PCT, min_confidence: MIN_CONF }
    }
  },

  scan_opportunities: async (args: any) => {
    const coins = args.coins?.length ? args.coins : ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','LINKUSDT','XRPUSDT','AVAXUSDT','DOTUSDT']
    const results = await Promise.all(coins.map(async (sym: string) => {
      try {
        const c1h = await fetchCandles(sym.replace('/','').toUpperCase(), '1H', 60)
        if (!c1h.length) return null
        const closes = c1h.map((c:any) => c.close)
        const rsi    = calcRSI(closes)
        const ema20  = calcEMA(closes, 20)
        const ema50  = calcEMA(closes, 50)
        const last   = closes[closes.length-1]
        const trend  = ema20>ema50&&last>ema20?'UP':ema20<ema50&&last<ema20?'DOWN':'RANGING'
        let score = 50
        if(trend==='UP') score+=20; if(trend==='DOWN') score-=20
        if(rsi<35) score+=20; if(rsi>65) score-=20
        if(rsi>40&&rsi<60&&trend==='UP') score+=10
        return { symbol: sym.replace('/','').toUpperCase(), price: last.toFixed(4), trend, rsi, score: Math.max(0,Math.min(100,score)), signal: score>65?'🟢 BUY WATCH':score<35?'🔴 SELL WATCH':'⚪ NEUTRAL' }
      } catch { return null }
    }))
    const valid = results.filter(Boolean).sort((a:any,b:any) => Math.abs(b.score-50)-Math.abs(a.score-50))
    return { scanned: valid.length, opportunities: valid, best_setup: valid[0] || null, timestamp: new Date().toISOString() }
  },

  calculate_position_size: async (args: any) => {
    const { balance_usdt, entry_price, stop_loss, risk_percent = 1 } = args
    if (!balance_usdt || !entry_price || !stop_loss) return { error: 'balance_usdt, entry_price, and stop_loss are required' }
    const riskAmount = balance_usdt * (risk_percent / 100)
    const riskPerUnit = Math.abs(entry_price - stop_loss)
    if (riskPerUnit === 0) return { error: 'Entry and stop loss cannot be the same price' }
    const positionUnits = riskAmount / riskPerUnit
    const positionUsdt  = positionUnits * entry_price
    const tp1 = entry_price > stop_loss ? entry_price + (riskPerUnit * 2) : entry_price - (riskPerUnit * 2)
    const tp2 = entry_price > stop_loss ? entry_price + (riskPerUnit * 3) : entry_price - (riskPerUnit * 3)
    return { balance_usdt, risk_percent, amount_at_risk: riskAmount.toFixed(2), entry_price, stop_loss, rr_distance: riskPerUnit.toFixed(6), position_units: positionUnits.toFixed(6), position_value_usdt: positionUsdt.toFixed(2), take_profit_1: { price: tp1.toFixed(6), rr: '1:2' }, take_profit_2: { price: tp2.toFixed(6), rr: '1:3' }, summary: `Risk $${riskAmount.toFixed(2)} on ${positionUnits.toFixed(6)} units @ $${entry_price} | SL: $${stop_loss} | TP1: $${tp1.toFixed(4)} | TP2: $${tp2.toFixed(4)}` }
  }
}

// ── Execute a tool call ───────────────────────────────────────────────────────
async function executeTool(name: string, args: any): Promise<string> {
  const executor = toolExecutors[name]
  if (!executor) return JSON.stringify({ error: `Unknown tool: ${name}` })
  try {
    const result = await executor(args)
    return JSON.stringify(result)
  } catch (e: any) {
    return JSON.stringify({ error: e.message })
  }
}

// ── Brain routing ─────────────────────────────────────────────────────────────
function pickModel(msg: string) {
  const m = msg.toLowerCase()
  if (m.includes('calc') || m.includes('size') || m.includes('how much') || m.includes('%')) return 'qwen/qwen3-32b'
  if (m.includes('quick') || m.includes('what is') || m.includes('define')) return 'llama-3.1-8b-instant'
  return 'llama-3.3-70b-versatile'
}

// ── AI call with tool loop ────────────────────────────────────────────────────
async function callAIWithTools(model: string, messages: any[]): Promise<{ reply: string; toolsUsed: string[] }> {
  const toolsUsed: string[] = []

  // Groq supports tool calling natively
  for (const key of [GROQ_KEY, GROQ_KEY2].filter(Boolean)) {
    try {
      // First call — AI decides which tools to use
      const r1 = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, tools: TOOLS, tool_choice: 'auto', max_tokens: 1000, temperature: 0.4 }),
        signal: AbortSignal.timeout(30000)
      })
      if (r1.status === 429) continue
      if (!r1.ok) continue
      const d1 = await r1.json() as any
      const msg1 = d1.choices?.[0]?.message
      if (!msg1) continue

      // If the model made tool calls, execute them
      if (msg1.tool_calls?.length) {
        const toolMessages = [...messages, msg1]

        // Execute all tool calls in parallel
        const toolResults = await Promise.all(msg1.tool_calls.map(async (tc: any) => {
          const toolName = tc.function.name
          const toolArgs = JSON.parse(tc.function.arguments || '{}')
          toolsUsed.push(toolName)
          const result = await executeTool(toolName, toolArgs)
          return { role: 'tool', tool_call_id: tc.id, content: result }
        }))

        // Second call — AI interprets tool results and replies to user
        const r2 = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages: [...toolMessages, ...toolResults], max_tokens: 1400, temperature: 0.7 }),
          signal: AbortSignal.timeout(28000)
        })
        if (r2.ok) {
          const d2 = await r2.json() as any
          return { reply: d2.choices?.[0]?.message?.content || 'Done.', toolsUsed }
        }
      }

      // No tool calls — direct reply
      if (msg1.content) return { reply: msg1.content, toolsUsed }

    } catch { continue }
  }

  // Gemini fallback (no tool calling — direct answer)
  if (GEMINI_KEY) {
    try {
      const contents = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
      const sys = messages.find(m => m.role === 'system')?.content || ''
      const body: any = { contents, generationConfig: { maxOutputTokens: 1400, temperature: 0.7 } }
      if (sys) body.systemInstruction = { parts: [{ text: sys }] }
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (r.ok) {
        const d = await r.json() as any
        return { reply: d.candidates?.[0]?.content?.parts?.[0]?.text || 'Unavailable', toolsUsed }
      }
    } catch {}
  }

  return { reply: 'All AI systems are currently offline — please retry.', toolsUsed }
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM = `You are CozyCrypto AI — an elite autonomous trading system built for Cozanet. You are NOT a chatbot. You are a TRADER that talks.

## Your Capabilities (Tools you can call)
You have REAL tool access to every function in the app. Call tools proactively — don't ask the user to "check" something themselves:

- get_portfolio → fetch live balances, assets, available USDT
- get_open_orders → see all active orders on Bitget
- get_trade_history → see recent completed trades and P&L
- get_market_prices → live prices for any symbols + Fear & Greed + global cap
- analyze_symbol → full SMC multi-timeframe analysis (OBs, FVGs, RSI, EMA, BB, confluence score)
- place_trade → execute a real BUY or SELL on Bitget (ask for confirmation first)
- cancel_order → cancel a specific open order
- cancel_all_orders → cancel everything open
- get_workflows → list all running automated processes
- toggle_workflow → start or pause any workflow
- run_brain_analysis → 3-agent Analyst→Risk→Executor pipeline for a symbol
- get_market_feed → trending coins, top gainers, top losers
- get_system_health → check if Groq, Bitget, and feeds are online
- scan_opportunities → scan 8 coins simultaneously and rank best setups
- calculate_position_size → 1% capital rule position sizing calculator

## Intelligence Framework (always applied)
When analyzing, use Smart Money Concepts:
1. Identify structure: BOS (Break of Structure) or CHoCH (Change of Character)
2. Find institutional zones: Order Blocks (OBs), Fair Value Gaps (FVGs)
3. Check liquidity: equal highs/lows, stop hunt zones
4. Confirm: RSI divergence, EMA20/50 cross, ATR for volatility
5. Size: 1% capital risk rule — (balance × 1%) ÷ |entry - stop_loss|

## Risk Rules (enforce always)
- Never suggest a trade without showing Entry, SL, TP, R:R, and Size
- Minimum R:R 1.5:1 — refuse any trade below this
- Minimum confidence 65% — below this: wait
- Max 10% of balance per trade
- Always ask for confirmation before calling place_trade

## Trade Signal Format
\`\`\`
🔥 SIGNAL: BUY/SELL [PAIR]
Entry:       $X.XX
Stop Loss:   $X.XX  (-X%)
Take Profit: $X.XX  (+X%)
Size:        $X USDT
R:R Ratio:   1:X
Confidence:  XX%
Pattern:     [OB | FVG | BOS | RSI div]
Risk check:  ✅ Approved
\`\`\`

## Personality
- Direct and confident — you are a trader, not a chatbot
- Call tools IMMEDIATELY when relevant — don't ask the user to go look somewhere
- Proactively spot opportunities from tool results
- Flag extreme Fear & Greed readings immediately
- Always end with next action or key level to watch`

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { message, history = [] } = req.body || {}
  if (!message) return res.status(400).json({ error: 'message required' })

  const model = pickModel(message)
  const messages = [
    { role: 'system', content: SYSTEM },
    ...history.slice(-14).map((m: any) => ({ role: m.role === 'ai' ? 'assistant' : m.role, content: m.content })),
    { role: 'user', content: message }
  ]

  const { reply, toolsUsed } = await callAIWithTools(model, messages)
  const brainName = model.includes('qwen') ? 'Math Brain' : model.includes('8b') ? 'Fast Brain' : 'Trade Brain'

  res.json({
    reply: reply || 'Brain offline — retry in a moment.',
    brain: brainName,
    tools_called: toolsUsed,
    tools_available: Object.keys(toolExecutors).length,
    timestamp: new Date().toISOString()
  })
}
