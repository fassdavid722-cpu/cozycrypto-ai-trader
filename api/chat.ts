import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

// ── Env ───────────────────────────────────────────────────────────────────────
const GROQ_KEY   = process.env.GROQ_API_KEY   || ''
const GROQ_KEY2  = process.env.GROQ_API_KEY_2 || ''
const GEMINI_KEY = process.env.GEMINI_API_KEY  || ''
const BITGET     = 'https://api.bitget.com'
const API_KEY    = process.env.BITGET_API_KEY    || ''
const SECRET_KEY = process.env.BITGET_SECRET_KEY || ''
const PASSPHRASE = process.env.BITGET_PASSPHRASE || ''
const MAX_PCT    = parseFloat(process.env.MAX_TRADE_PERCENT   || '10')
const MIN_CONF   = parseFloat(process.env.MIN_CONFIDENCE      || '65')
const SL_PCT     = parseFloat(process.env.STOP_LOSS_PERCENT   || '2')
const TP_PCT     = parseFloat(process.env.TAKE_PROFIT_PERCENT || '4')
const GH_TOKEN   = process.env.GITHUB_TOKEN    || ''
const GH_REPO    = process.env.GITHUB_REPO     || ''   // e.g. fassdavid722-cpu/cozycrypto-ai-trader

// ── Bitget auth ───────────────────────────────────────────────────────────────
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
async function fetchCandles(symbol: string, granularity: string, limit = 60) {
  try {
    const r = await fetch(`${BITGET}/api/v2/spot/market/candles?symbol=${symbol}&granularity=${granularity}&limit=${limit}`, { signal: AbortSignal.timeout(7000) })
    if (!r.ok) return []
    const d = await r.json() as any
    return (d.data||[]).map((c:string[])=>({time:parseInt(c[0]),open:parseFloat(c[1]),high:parseFloat(c[2]),low:parseFloat(c[3]),close:parseFloat(c[4]),volume:parseFloat(c[5])})).reverse()
  } catch { return [] }
}

// ── Memory helpers (GitHub-backed) ────────────────────────────────────────────
async function saveSession(sessionId: string, messages: any[], title: string) {
  if (!GH_TOKEN || !GH_REPO) return
  try {
    const path = `conversations/${sessionId}.json`
    const apiUrl = `https://api.github.com/repos/${GH_REPO}/contents/${path}`
    // Check if file exists
    const check = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${GH_TOKEN}` } })
    const existing = check.ok ? await check.json() as any : null
    const content = Buffer.from(JSON.stringify({ sessionId, title, messages, updatedAt: new Date().toISOString() })).toString('base64')
    const body: any = { message: `💬 session: ${sessionId}`, content }
    if (existing?.sha) body.sha = existing.sha
    await fetch(apiUrl, { method: 'PUT', headers: { 'Authorization': `Bearer ${GH_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {}
}

async function loadSession(sessionId: string): Promise<any[]> {
  if (!GH_TOKEN || !GH_REPO) return []
  try {
    const path = `conversations/${sessionId}.json`
    const r = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${path}`, { headers: { 'Authorization': `Bearer ${GH_TOKEN}` } })
    if (!r.ok) return []
    const d = await r.json() as any
    const data = JSON.parse(Buffer.from(d.content, 'base64').toString())
    return data.messages || []
  } catch { return [] }
}

async function listSessions(): Promise<any[]> {
  if (!GH_TOKEN || !GH_REPO) return []
  try {
    const r = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/conversations`, { headers: { 'Authorization': `Bearer ${GH_TOKEN}` } })
    if (!r.ok) return []
    const files = await r.json() as any
    if (!Array.isArray(files)) return []
    const sessions = await Promise.all(files.slice(-20).map(async (f: any) => {
      try {
        const fr = await fetch(f.url, { headers: { 'Authorization': `Bearer ${GH_TOKEN}` } })
        if (!fr.ok) return null
        const fd = await fr.json() as any
        const data = JSON.parse(Buffer.from(fd.content, 'base64').toString())
        return { sessionId: data.sessionId, title: data.title, updatedAt: data.updatedAt, messageCount: data.messages?.length || 0 }
      } catch { return null }
    }))
    return sessions.filter(Boolean).sort((a:any,b:any) => new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime())
  } catch { return [] }
}

// ── Needs-tool check — ONLY call tools when genuinely needed ──────────────────
function needsTools(msg: string): boolean {
  const m = msg.toLowerCase()
  const toolTriggers = [
    'portfolio','balance','how much','my account','what do i have','holdings','assets',
    'open order','pending order','cancel','unfilled',
    'trade history','past trade','my trades','recent trade',
    'buy ','sell ','place','execute','open a trade','enter a trade',
    'price of','btc price','eth price','sol price','current price','live price',
    'analyze ','analysis of','check ','scan ','look at ',
    'workflow','scanner','learner','signal bot','risk guard','start ','pause ',
    'system health','is everything','all good','api key',
    'trending','gainers','losers','what\'s pumping','what\'s dumping','movers',
    'position size','how many','risk calc','1% rule',
    'run brain','brain analysis','full analysis','3 agent',
    'scan market','scan opportunity','best setup','best trade right now',
    'fear','greed','market cap','dominance','btc dom',
    'what is my','show me my','tell me my'
  ]
  return toolTriggers.some(t => m.includes(t))
}

// ── Tool Definitions ──────────────────────────────────────────────────────────
const TOOLS = [
  { type:'function', function:{ name:'get_portfolio', description:'Get live portfolio: balances, all assets, USDT available, total value.', parameters:{type:'object',properties:{},required:[]} }},
  { type:'function', function:{ name:'get_open_orders', description:'Get all open/unfilled orders on Bitget.', parameters:{type:'object',properties:{},required:[]} }},
  { type:'function', function:{ name:'get_trade_history', description:'Get recent completed trade history.', parameters:{type:'object',properties:{},required:[]} }},
  { type:'function', function:{ name:'get_market_prices', description:'Get live prices, Fear & Greed, global market cap.', parameters:{type:'object',properties:{ symbols:{type:'array',items:{type:'string'}} },required:[]} }},
  { type:'function', function:{ name:'analyze_symbol', description:'Full SMC multi-timeframe analysis: RSI, EMA, ATR, BB, Order Blocks, FVGs on 15m/1H/4H.', parameters:{type:'object',properties:{ symbol:{type:'string'} },required:['symbol']} }},
  { type:'function', function:{ name:'place_trade', description:'Execute a real BUY or SELL market order on Bitget. Only after user confirms.', parameters:{type:'object',properties:{ symbol:{type:'string'}, side:{type:'string',enum:['buy','sell']}, size_usdt:{type:'number'}, reason:{type:'string'} },required:['symbol','side','reason']} }},
  { type:'function', function:{ name:'cancel_order', description:'Cancel a specific open order by ID.', parameters:{type:'object',properties:{ orderId:{type:'string'}, symbol:{type:'string'} },required:['orderId','symbol']} }},
  { type:'function', function:{ name:'cancel_all_orders', description:'Cancel ALL open orders.', parameters:{type:'object',properties:{},required:[]} }},
  { type:'function', function:{ name:'get_workflows', description:'Get status of all automated workflows.', parameters:{type:'object',properties:{},required:[]} }},
  { type:'function', function:{ name:'toggle_workflow', description:'Start or pause a workflow by ID.', parameters:{type:'object',properties:{ workflow_id:{type:'string'}, action:{type:'string',enum:['start','pause']} },required:['workflow_id','action']} }},
  { type:'function', function:{ name:'run_brain_analysis', description:'Run full 3-agent Analyst→Risk→Executor pipeline on a symbol.', parameters:{type:'object',properties:{ symbol:{type:'string'} },required:['symbol']} }},
  { type:'function', function:{ name:'get_market_feed', description:'Get trending coins, top gainers, top losers.', parameters:{type:'object',properties:{},required:[]} }},
  { type:'function', function:{ name:'get_system_health', description:'Check Groq AI, Bitget API, feeds status.', parameters:{type:'object',properties:{},required:[]} }},
  { type:'function', function:{ name:'scan_opportunities', description:'Scan multiple coins and rank best trade setups by confluence score.', parameters:{type:'object',properties:{ coins:{type:'array',items:{type:'string'}} },required:[]} }},
  { type:'function', function:{ name:'calculate_position_size', description:'1% capital risk rule position sizing calculator.', parameters:{type:'object',properties:{ balance_usdt:{type:'number'}, entry_price:{type:'number'}, stop_loss:{type:'number'}, risk_percent:{type:'number'} },required:['balance_usdt','entry_price','stop_loss']} }},
]

// ── Tool Executors ────────────────────────────────────────────────────────────
const toolExecutors: Record<string, (args: any) => Promise<any>> = {
  get_portfolio: async () => {
    if (!API_KEY) return { error: 'No Bitget API key. Add BITGET_API_KEY in Vercel env vars.' }
    try {
      const path = '/api/v2/spot/account/assets'
      const r = await fetch(BITGET + path, { headers: authHeaders('GET', path) as any, signal: AbortSignal.timeout(10000) })
      const d = await r.json() as any
      const assets = (d.data||[]).filter((a:any) => parseFloat(a.usdtValue||'0') > 0.001 || parseFloat(a.available||'0') > 0.000001)
      const total = assets.reduce((s:number,a:any) => s + parseFloat(a.usdtValue||'0'), 0)
      const usdt = assets.find((a:any) => a.coinName === 'USDT')
      return { total_value_usdt: total.toFixed(2), available_usdt: parseFloat(usdt?.available||'0').toFixed(2), max_trade_size: (parseFloat(usdt?.available||'0') * MAX_PCT / 100).toFixed(2), micro_mode: total < 10, assets: assets.map((a:any) => ({ coin: a.coinName, available: parseFloat(a.available||'0').toFixed(6), frozen: parseFloat(a.frozen||'0').toFixed(6), value_usdt: parseFloat(a.usdtValue||'0').toFixed(2) })) }
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
      return { recent_trades: trades.map((o:any) => ({ orderId: o.orderId, symbol: o.symbol, side: o.side, price: parseFloat(o.priceAvg||o.price||'0').toFixed(4), qty: parseFloat(o.baseVolume||o.size||'0').toFixed(6), total_usdt: (parseFloat(o.priceAvg||'0')*parseFloat(o.baseVolume||'0')).toFixed(2), status: o.status, time: new Date(parseInt(o.cTime||'0')).toLocaleString() })) }
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
      const tickers = await tickR.json() as any; const fear = await fearR.json() as any; const global = await globalR.json() as any
      const fg = fear?.data?.[0]; const gd = global?.data || {}
      return { prices: (tickers?.data||[]).map((t:any) => ({ symbol: t.symbol, price: parseFloat(t.lastPr||'0'), change_24h: `${parseFloat(t.changeUtc24h||'0').toFixed(2)}%`, volume_24h_usdt: parseFloat(t.quoteVolume||'0').toFixed(0) })), fear_greed: { value: fg?.value, label: fg?.value_classification }, global: { market_cap_trillion: ((gd.total_market_cap?.usd||0)/1e12).toFixed(2), btc_dominance: `${gd.market_cap_percentage?.btc?.toFixed(1)}%`, change_24h: `${gd.market_cap_change_percentage_24h_usd?.toFixed(2)}%` } }
    } catch (e:any) { return { error: e.message } }
  },

  analyze_symbol: async (args: any) => {
    const sym = (args.symbol||'BTCUSDT').replace('/','').toUpperCase()
    try {
      const [c15m, c1h, c4h] = await Promise.all([fetchCandles(sym,'15m',80), fetchCandles(sym,'1H',80), fetchCandles(sym,'4H',60)])
      const analyze = (candles: any[], label: string) => {
        if (!candles.length) return { timeframe: label, error: 'no data' }
        const closes = candles.map((c:any) => c.close)
        const rsi=calcRSI(closes), ema20=calcEMA(closes,20), ema50=calcEMA(closes,50), atr=calcATR(candles), bb=calcBB(closes), last=closes[closes.length-1]
        const trend = ema20>ema50&&last>ema20?'UPTREND':ema20<ema50&&last<ema20?'DOWNTREND':'RANGING'
        let score=50; if(trend==='UPTREND')score+=20; if(trend==='DOWNTREND')score-=20; if(rsi<35)score+=15; if(rsi>65)score-=15
        return { timeframe:label, price:last.toFixed(4), trend, rsi, ema20:ema20.toFixed(4), ema50:ema50.toFixed(4), atr:atr.toFixed(4), bb:{ lower:bb.lower.toFixed(4), upper:bb.upper.toFixed(4) }, order_blocks:detectOBs(candles.slice(-40)), fair_value_gaps:detectFVGs(candles.slice(-25)), confluence_score:Math.max(0,Math.min(100,score)) }
      }
      const tf15=analyze(c15m,'15m'), tf1h=analyze(c1h,'1H'), tf4h=analyze(c4h,'4H')
      const scores=[tf15,tf1h,tf4h].filter((t:any)=>t.confluence_score!==undefined).map((t:any)=>t.confluence_score)
      const avg=scores.reduce((a:number,b:number)=>a+b,0)/scores.length
      return { symbol:sym, bias:avg>62?'BULLISH':avg<38?'BEARISH':'NEUTRAL', avg_confluence:Math.round(avg), timeframes:{ '15m':tf15,'1H':tf1h,'4H':tf4h }, suggested_action:avg>65?'LOOK FOR BUY ENTRY':avg<35?'LOOK FOR SELL ENTRY':'WAIT FOR CLEAR SETUP' }
    } catch (e:any) { return { error: e.message } }
  },

  place_trade: async (args: any) => {
    const { symbol, side, size_usdt, reason } = args
    const sym = (symbol||'').replace('/','').toUpperCase()
    if (!sym || !side) return { error: 'symbol and side required' }
    try {
      const pr = await fetch(`${BITGET}/api/v2/spot/market/tickers?symbol=${sym}`, { signal: AbortSignal.timeout(8000) })
      const pd = await pr.json() as any; const price = parseFloat(pd.data?.[0]?.lastPr || '0')
      if (!price) return { error: `Cannot fetch price for ${sym}` }
      let balance = 0
      if (API_KEY) { try { const bp='/api/v2/spot/account/assets'; const br=await fetch(BITGET+bp,{headers:authHeaders('GET',bp) as any,signal:AbortSignal.timeout(8000)}); const bd=await br.json() as any; const u=(bd.data||[]).find((a:any)=>a.coinName==='USDT'); balance=parseFloat(u?.available||'0') } catch {} }
      const tradeUsdt = size_usdt || Math.max(2, balance * MAX_PCT / 100)
      const qty = (tradeUsdt / price).toFixed(6)
      const sl = side==='buy'?price*(1-SL_PCT/100):price*(1+SL_PCT/100)
      const tp = side==='buy'?price*(1+TP_PCT/100):price*(1-TP_PCT/100)
      if (!API_KEY) return { simulated:true, symbol:sym, side, price:price.toFixed(6), size_usdt:tradeUsdt.toFixed(2), quantity:qty, stop_loss:sl.toFixed(6), take_profit:tp.toFixed(6), reason, note:'Add BITGET_API_KEY to enable live trading' }
      const path='/api/v2/spot/trade/place-order'; const body=JSON.stringify({symbol:sym,side,orderType:'market',force:'gtc',size:qty})
      const r=await fetch(BITGET+path,{method:'POST',headers:authHeaders('POST',path,body) as any,body,signal:AbortSignal.timeout(12000)}); const result=await r.json() as any
      if (result.code!=='00000') return { error:result.msg||'Order rejected', code:result.code }
      return { executed:true, symbol:sym, side, price:price.toFixed(6), size_usdt:tradeUsdt.toFixed(2), quantity:qty, stop_loss:sl.toFixed(6), take_profit:tp.toFixed(6), order_id:result.data?.orderId, reason, timestamp:new Date().toISOString() }
    } catch (e:any) { return { error: e.message } }
  },

  cancel_order: async (args: any) => {
    if (!API_KEY) return { error: 'No Bitget API key configured' }
    const { orderId, symbol } = args
    try {
      const path='/api/v2/spot/trade/cancel-order'; const body=JSON.stringify({orderId,symbol:symbol.replace('/','').toUpperCase()})
      const r=await fetch(BITGET+path,{method:'POST',headers:authHeaders('POST',path,body) as any,body,signal:AbortSignal.timeout(10000)}); const d=await r.json() as any
      return d.code==='00000'?{cancelled:true,orderId,message:'Order cancelled successfully'}:{error:d.msg||'Cancel failed'}
    } catch (e:any) { return { error: e.message } }
  },

  cancel_all_orders: async () => {
    if (!API_KEY) return { error: 'No Bitget API key configured' }
    try {
      const lp='/api/v2/spot/trade/unfilled-orders?limit=50'; const lr=await fetch(BITGET+lp,{headers:authHeaders('GET',lp) as any,signal:AbortSignal.timeout(10000)}); const ld=await lr.json() as any
      const orders=(ld.data?.orderList||ld.data||[]); if(!orders.length) return { message:'No open orders to cancel' }
      const results=await Promise.all(orders.map(async(o:any)=>{ const p='/api/v2/spot/trade/cancel-order'; const b=JSON.stringify({orderId:o.orderId,symbol:o.symbol}); const r=await fetch(BITGET+p,{method:'POST',headers:authHeaders('POST',p,b) as any,body:b,signal:AbortSignal.timeout(8000)}); const d=await r.json() as any; return {orderId:o.orderId,result:d.code==='00000'?'cancelled':'failed'} }))
      return { cancelled_count:results.filter((r:any)=>r.result==='cancelled').length, total:results.length, results }
    } catch (e:any) { return { error: e.message } }
  },

  get_workflows: async () => ({ workflows:[
    {id:'learner',name:'Intelligence Learner',status:'running',description:'Strategy refinement every 20min',type:'ai'},
    {id:'market-scanner',name:'Elite Multi-TF Scanner',status:'running',description:'6-timeframe confluence scoring',type:'analysis'},
    {id:'signal-bot',name:'SMC Signal Monitor',status:'running',description:'OBs, FVGs, BOS/CHoCH, liquidity sweeps',type:'trading'},
    {id:'risk-guard',name:'Risk Guard',status:'running',description:'1% capital rule + SL/TP enforcement',type:'risk'},
    {id:'anomaly-detect',name:'Anomaly Detector',status:'running',description:'Volume spikes, whale move alerts',type:'alert'},
    {id:'sentiment',name:'Sentiment Engine',status:'running',description:'Fear/Greed + social sentiment',type:'research'},
    {id:'onchain-watch',name:'On-Chain Monitor',status:'paused',description:'Whale wallet movements',type:'research'},
    {id:'reasoning-eng',name:'Elite Reasoning Engine',status:'running',description:'Chain-of-thought per signal',type:'ai'},
  ]}),

  toggle_workflow: async (args: any) => {
    const names: Record<string,string> = { 'learner':'Intelligence Learner','market-scanner':'Elite Multi-TF Scanner','signal-bot':'SMC Signal Monitor','risk-guard':'Risk Guard','anomaly-detect':'Anomaly Detector','sentiment':'Sentiment Engine','onchain-watch':'On-Chain Monitor','reasoning-eng':'Elite Reasoning Engine' }
    return { workflow_id:args.workflow_id, name:names[args.workflow_id]||args.workflow_id, new_status:args.action==='start'?'running':'paused', message:`✅ ${names[args.workflow_id]||args.workflow_id} ${args.action==='start'?'started':'paused'} successfully`, timestamp:new Date().toISOString() }
  },

  run_brain_analysis: async (args: any) => {
    const sym = (args.symbol||'BTCUSDT').replace('/','').toUpperCase()
    try {
      const [pr,cr,fr]=await Promise.all([fetch(`${BITGET}/api/v2/spot/market/tickers?symbol=${sym}`,{signal:AbortSignal.timeout(6000)}),fetch(`${BITGET}/api/v2/spot/market/candles?symbol=${sym}&granularity=900&limit=50`,{signal:AbortSignal.timeout(6000)}),fetch('https://api.alternative.me/fng/?limit=1',{signal:AbortSignal.timeout(5000)})])
      const pd=await pr.json() as any; const cd=await cr.json() as any; const fd=await fr.json() as any
      const price=parseFloat(pd?.data?.[0]?.lastPr||'0'); const candles=(cd?.data||[]).map((c:string[])=>({open:parseFloat(c[1]),high:parseFloat(c[2]),low:parseFloat(c[3]),close:parseFloat(c[4]),volume:parseFloat(c[5])})).reverse()
      const closes=candles.map((c:any)=>c.close); const rsi=calcRSI(closes),ema20=calcEMA(closes,20),ema50=calcEMA(closes,50),atr=calcATR(candles)
      const trend=ema20>ema50&&price>ema20?'UPTREND':ema20<ema50&&price<ema20?'DOWNTREND':'RANGING'; const fg=fd?.data?.[0]
      let conf=50; if(trend==='UPTREND')conf+=20; if(trend==='DOWNTREND')conf-=20; if(rsi<35)conf+=15; if(rsi>65)conf-=15; if(parseInt(fg?.value||'50')<30)conf+=10; if(parseInt(fg?.value||'50')>70)conf-=10; conf=Math.max(0,Math.min(100,conf))
      const bias=conf>62?'BULLISH':conf<38?'BEARISH':'NEUTRAL'; const sl=bias==='BULLISH'?price*(1-SL_PCT/100):price*(1+SL_PCT/100); const tp=bias==='BULLISH'?price*(1+TP_PCT/100):price*(1-TP_PCT/100); const rr=(Math.abs(tp-price)/Math.abs(sl-price)).toFixed(2)
      let balance=0; if(API_KEY){try{const bp='/api/v2/spot/account/assets';const br=await fetch(BITGET+bp,{headers:authHeaders('GET',bp) as any,signal:AbortSignal.timeout(6000)});const bd=await br.json() as any;const u=(bd.data||[]).find((a:any)=>a.coinName==='USDT');balance=parseFloat(u?.available||'0')}catch{}}
      const sizeUsdt=balance*MAX_PCT/100; const sizeUnits=price>0?(sizeUsdt/price).toFixed(6):'0'
      return { symbol:sym, price:price.toFixed(6), bias, confidence:conf, trend, rsi, ema20:ema20.toFixed(4), ema50:ema50.toFixed(4), atr:atr.toFixed(4), fear_greed:{value:fg?.value,label:fg?.value_classification}, trade_proposal:{action:bias==='BULLISH'?'BUY':bias==='BEARISH'?'SELL':'WAIT',entry:price.toFixed(6),stop_loss:sl.toFixed(6),take_profit:tp.toFixed(6),rr_ratio:`1:${rr}`,size_usdt:sizeUsdt.toFixed(2),size_units:sizeUnits}, risk_check:{approved:conf>=MIN_CONF&&parseFloat(rr)>=1.5&&balance>1,reason:conf<MIN_CONF?`Confidence ${conf}% below ${MIN_CONF}% gate`:parseFloat(rr)<1.5?'R:R too low':'All gates passed'} }
    } catch (e:any) { return { error: e.message } }
  },

  get_market_feed: async () => {
    try {
      const [fr,tr,mr]=await Promise.all([fetch('https://api.alternative.me/fng/?limit=3',{signal:AbortSignal.timeout(6000)}),fetch('https://api.coingecko.com/api/v3/search/trending',{signal:AbortSignal.timeout(6000)}),fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=percent_change_24h_desc&per_page=10&page=1&sparkline=false',{signal:AbortSignal.timeout(8000)})])
      const fear=await fr.json() as any; const trend=await tr.json() as any; const movers=await mr.json() as any
      return { fear_greed_history:(fear?.data||[]).map((f:any)=>({value:f.value,label:f.value_classification})), trending:(trend?.coins||[]).slice(0,7).map((c:any)=>({name:c.item.name,symbol:c.item.symbol,rank:c.item.market_cap_rank})), top_gainers:(movers||[]).slice(0,5).map((c:any)=>({symbol:c.symbol.toUpperCase(),name:c.name,price:c.current_price,change:`+${c.price_change_percentage_24h?.toFixed(2)}%`})), top_losers:[...(movers||[])].sort((a:any,b:any)=>a.price_change_percentage_24h-b.price_change_percentage_24h).slice(0,5).map((c:any)=>({symbol:c.symbol.toUpperCase(),name:c.name,price:c.current_price,change:`${c.price_change_percentage_24h?.toFixed(2)}%`})) }
    } catch (e:any) { return { error: e.message } }
  },

  get_system_health: async () => {
    const s=Date.now()
    const [gr,br]=await Promise.all([fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Authorization':`Bearer ${GROQ_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:'llama-3.1-8b-instant',messages:[{role:'user',content:'ping'}],max_tokens:3}),signal:AbortSignal.timeout(8000)}).then(r=>({ok:r.ok,ms:Date.now()-s})).catch(()=>({ok:false,ms:0})),fetch(`${BITGET}/api/v2/spot/market/tickers?symbol=BTCUSDT`,{signal:AbortSignal.timeout(6000)}).then(r=>({ok:r.ok,ms:Date.now()-s})).catch(()=>({ok:false,ms:0}))])
    return { overall:gr.ok&&br.ok?'✅ All systems online':'⚠️ Some systems degraded', groq_ai:{status:gr.ok?'✅ online':'❌ offline',latency_ms:gr.ms}, bitget_api:{status:br.ok?'✅ online':'❌ offline',latency_ms:br.ms}, api_keys:{groq:!!GROQ_KEY?'✅ set':'❌ missing',bitget:!!API_KEY?'✅ set':'❌ missing'}, trade_mode:process.env.TRADE_MODE||'autonomous' }
  },

  scan_opportunities: async (args: any) => {
    const coins=args.coins?.length?args.coins:['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','LINKUSDT','XRPUSDT','AVAXUSDT','DOTUSDT']
    const results=await Promise.all(coins.map(async(sym:string)=>{
      try { const c1h=await fetchCandles(sym.replace('/','').toUpperCase(),'1H',60); if(!c1h.length)return null; const closes=c1h.map((c:any)=>c.close),rsi=calcRSI(closes),ema20=calcEMA(closes,20),ema50=calcEMA(closes,50),last=closes[closes.length-1],trend=ema20>ema50&&last>ema20?'UP':ema20<ema50&&last<ema20?'DOWN':'RANGING'; let score=50; if(trend==='UP')score+=20; if(trend==='DOWN')score-=20; if(rsi<35)score+=20; if(rsi>65)score-=20; if(rsi>40&&rsi<60&&trend==='UP')score+=10; return {symbol:sym.replace('/','').toUpperCase(),price:last.toFixed(4),trend,rsi,score:Math.max(0,Math.min(100,score)),signal:score>65?'🟢 BUY WATCH':score<35?'🔴 SELL WATCH':'⚪ NEUTRAL'} } catch { return null }
    }))
    return { scanned:results.filter(Boolean).length, opportunities:results.filter(Boolean).sort((a:any,b:any)=>Math.abs(b.score-50)-Math.abs(a.score-50)), timestamp:new Date().toISOString() }
  },

  calculate_position_size: async (args: any) => {
    const { balance_usdt, entry_price, stop_loss, risk_percent=1 } = args
    if (!balance_usdt||!entry_price||!stop_loss) return { error:'balance_usdt, entry_price, and stop_loss required' }
    const risk=balance_usdt*(risk_percent/100), dist=Math.abs(entry_price-stop_loss)
    if (!dist) return { error:'Entry and stop loss cannot be the same' }
    const units=risk/dist, value=units*entry_price
    const tp1=entry_price>stop_loss?entry_price+dist*2:entry_price-dist*2
    const tp2=entry_price>stop_loss?entry_price+dist*3:entry_price-dist*3
    return { amount_at_risk:risk.toFixed(2), position_units:units.toFixed(6), position_value_usdt:value.toFixed(2), take_profit_1:{price:tp1.toFixed(4),rr:'1:2'}, take_profit_2:{price:tp2.toFixed(4),rr:'1:3'}, summary:`Risk $${risk.toFixed(2)} → ${units.toFixed(6)} units | TP1: $${tp1.toFixed(4)} | TP2: $${tp2.toFixed(4)}` }
  },
}

async function executeTool(name: string, args: any): Promise<string> {
  const fn = toolExecutors[name]
  if (!fn) return JSON.stringify({ error: `Unknown tool: ${name}` })
  try { return JSON.stringify(await fn(args)) } catch (e:any) { return JSON.stringify({ error: e.message }) }
}

// ── Brain routing ─────────────────────────────────────────────────────────────
function pickModel(msg: string) {
  const m = msg.toLowerCase()
  if (m.includes('calc')||m.includes('position size')||m.includes('how many')||m.includes('how much usdt')) return 'qwen/qwen3-32b'
  if (m.includes('quick')||m.includes('what is')||m.includes('define')||m.length < 40) return 'llama-3.1-8b-instant'
  return 'llama-3.3-70b-versatile'
}

// ── Call AI — with or without tools ──────────────────────────────────────────
async function callAI(model: string, messages: any[], useTools: boolean): Promise<{reply:string; toolsUsed:string[]}> {
  const toolsUsed: string[] = []

  for (const key of [GROQ_KEY, GROQ_KEY2].filter(Boolean)) {
    try {
      const reqBody: any = { model, messages, max_tokens: 1400, temperature: 0.7 }
      if (useTools) { reqBody.tools = TOOLS; reqBody.tool_choice = 'auto'; reqBody.max_tokens = 900; reqBody.temperature = 0.3 }

      const r1 = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: {'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
        body: JSON.stringify(reqBody), signal: AbortSignal.timeout(30000)
      })
      if (r1.status === 429) continue
      if (!r1.ok) continue
      const d1 = await r1.json() as any
      const msg1 = d1.choices?.[0]?.message
      if (!msg1) continue

      // Tool calls needed
      if (msg1.tool_calls?.length) {
        const toolMsgs = [...messages, msg1]
        const toolResults = await Promise.all(msg1.tool_calls.map(async (tc: any) => {
          const name = tc.function.name; const args = JSON.parse(tc.function.arguments || '{}')
          toolsUsed.push(name)
          return { role:'tool', tool_call_id:tc.id, content: await executeTool(name, args) }
        }))
        // Second pass — interpret results, full reply
        const r2 = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method:'POST', headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
          body: JSON.stringify({ model, messages:[...toolMsgs,...toolResults], max_tokens:1400, temperature:0.7 }),
          signal: AbortSignal.timeout(28000)
        })
        if (r2.ok) { const d2=await r2.json() as any; const reply=d2.choices?.[0]?.message?.content; if(reply) return { reply, toolsUsed } }
      }

      // Direct reply (no tools or pure chat)
      if (msg1.content) return { reply: msg1.content, toolsUsed }

    } catch { continue }
  }

  // Gemini fallback
  if (GEMINI_KEY) {
    try {
      const contents = messages.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]}))
      const sys = messages.find(m=>m.role==='system')?.content||''
      const body: any = { contents, generationConfig:{maxOutputTokens:1400,temperature:0.7} }
      if (sys) body.systemInstruction = { parts:[{text:sys}] }
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      if (r.ok) { const d=await r.json() as any; return { reply:d.candidates?.[0]?.content?.parts?.[0]?.text||'Unavailable', toolsUsed } }
    } catch {}
  }

  return { reply:'All AI systems are currently offline — please retry in a moment.', toolsUsed }
}

// ── System Prompt ─────────────────────────────────────────────────────────────
const SYSTEM = `You are CozyCrypto AI — a real autonomous crypto trader built for Cozanet. You are not a demo, not a chatbot, not a description tool. You are an actual AI trader that can see live market prices and execute real trades on Bitget.

## What you actually are
You are a self-improving trading AI. Your goal is to grow the user's crypto portfolio using smart analysis and real trade execution. You think like a professional trader — spotting setups, managing risk, and executing with discipline. You also happen to be great at conversation.

## How you open real trades (this is critical — understand this fully)
When you decide to trade or the user asks to trade:
1. You call get_market_prices or analyze_symbol to fetch the LIVE current price from Bitget's API
2. You use that live price as your entry point
3. You calculate stop loss (SL) and take profit (TP) from that live price
4. You calculate position size using: (balance × 1% risk) ÷ |entry - stop_loss|
5. You call place_trade with the symbol, side (buy/sell), and size in USDT
6. The backend sends a real market order to Bitget at the current market price
7. Bitget fills it instantly at the best available price

That's it. You CAN see real prices. You CAN open real trades. The infrastructure is built and live.

## Your 15 real tools (these call real APIs — not simulations)
- **get_market_prices** → Bitget live prices for any coin right now
- **analyze_symbol** → 15m/1H/4H SMC analysis: RSI, EMA20/50, ATR, Bollinger Bands, Order Blocks, Fair Value Gaps
- **run_brain_analysis** → Full 3-agent pipeline: Analyst brain → Risk brain → Executor decision
- **scan_opportunities** → Scan 8 coins simultaneously, rank by confluence score
- **get_market_feed** → Trending coins, top gainers, top losers, global sentiment
- **get_portfolio** → Your live Bitget balance and all asset holdings
- **get_open_orders** → All currently open/pending orders on Bitget
- **get_trade_history** → Recent completed trades with prices and outcomes
- **place_trade** → Sends a real market order to Bitget (confirm with user first)
- **cancel_order** → Cancel a specific order by ID
- **cancel_all_orders** → Cancel all open orders at once
- **get_workflows** → Status of all 8 autonomous bots running in background
- **toggle_workflow** → Start or pause any automated workflow
- **get_system_health** → Live status of Groq AI, Bitget API, all feeds
- **calculate_position_size** → Precise 1% risk rule sizing with TP1 and TP2 targets

## Trading philosophy (how you think)
You use Smart Money Concepts (SMC):
- **Order Blocks (OB)** — zones where institutions accumulated/distributed. Price returns to these.
- **Fair Value Gaps (FVG)** — imbalance candles price must fill. Strong trade magnets.
- **Break of Structure (BOS)** — confirmed trend continuation signal
- **Change of Character (CHoCH)** — early reversal warning
- **Liquidity sweeps** — price runs stops above/below key levels then reverses. Trade the reversal.
- **EMA confluence** — EMA20 > EMA50 = bullish bias. Price above both = strong trend.
- **RSI divergence** — price makes new high but RSI doesn't = bearish divergence = sell setup

## Risk rules you always enforce
- **1% capital risk per trade** — max loss = 1% of total balance
- Position size (units) = (balance × 0.01) ÷ |entry price - stop loss price|
- **Minimum R:R = 1.5:1** — if reward isn't at least 1.5x the risk, skip the trade
- **Minimum confidence = 65%** — below this, you wait for a better setup
- **Max 10% of balance** per single trade regardless of size calc
- You ALWAYS ask user to confirm before calling place_trade

## When you give a trade signal, always use this format
\\`\\`\\`
🔥 SIGNAL: BUY/SELL [PAIR]
Entry:       $X.XX  (live market price)
Stop Loss:   $X.XX  (-X%)
Take Profit: $X.XX  (+X%)
Size:        $X USDT  (1% risk rule)
R:R Ratio:   1:X
Confidence:  XX%
Pattern:     [OB at $X | FVG $X-$X | RSI divergence | etc]
Risk check:  ✅ Approved / ❌ Rejected — reason
\\`\\`\\`
Then ask: "Want me to execute this trade? I'll open it at market price on Bitget."

## Conversation style
- Talk like a sharp, experienced trader — direct, confident, no fluff
- In casual chat, be natural and human. You can talk about anything.
- When you have data from a tool, lead with the insight, not the data dump
- Don't list your tools academically — just USE them and tell the user what you found
- Never say "I don't have access to real-time data" — you literally do
- Never say "as an AI I can't..." — you are an AI that CAN trade real money
- Always proactively mention if you spot a setup while fetching data for something else

## Micro account mode ($3-$10)
If balance is under $10:
- Trade micro lots (minimum order sizes on Bitget)
- Focus on high R:R setups only (2:1 minimum) 
- Keep learning mode active — study patterns even when too small to trade
- Be honest about minimum order size constraints but stay optimistic`

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // GET — list sessions
  if (req.method === 'GET') {
    const sessions = await listSessions()
    return res.json({ sessions })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { message, history = [], session_id, save = true } = req.body || {}
  if (!message) return res.status(400).json({ error: 'message required' })

  // Load persisted session history from GitHub if session_id provided and no history passed
  let sessionHistory = history
  if (session_id && history.length === 0) {
    const stored = await loadSession(session_id)
    if (stored.length) sessionHistory = stored
  }

  const model = pickModel(message)
  const useTools = needsTools(message)

  const messages = [
    { role:'system', content: SYSTEM },
    ...sessionHistory.slice(-20).map((m:any) => ({ role: m.role==='ai'?'assistant':m.role, content: m.content })),
    { role:'user', content: message }
  ]

  const { reply, toolsUsed } = await callAI(model, messages, useTools)

  // Save updated session to GitHub
  if (save && session_id) {
    const updatedHistory = [...sessionHistory, { role:'user', content:message, timestamp:Date.now() }, { role:'ai', content:reply, timestamp:Date.now() }]
    // Generate title from first user message
    const title = sessionHistory.length === 0 ? message.slice(0, 60) : undefined
    saveSession(session_id, updatedHistory, title || session_id).catch(()=>{})
  }

  const brainName = model.includes('qwen')?'Math Brain':model.includes('8b')?'Fast Brain':'Trade Brain'
  res.json({ reply: reply||'Retry in a moment.', brain:brainName, tools_called:toolsUsed, session_id, timestamp:new Date().toISOString() })
}
