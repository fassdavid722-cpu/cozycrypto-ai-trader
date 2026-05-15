# CozyCrypto AI Trader V2

**Autonomous AI trading platform for Cozanet. Built for Bitget. Deployed on Vercel.**

> Multi-agent. Self-learning. Elite trader even on a $3 account.

## Deploy to Vercel

1. Import **this repo** at vercel.com → New Project
2. **Root Directory**: leave as `/` (repo root)
3. Add Environment Variables:
   - `GROQ_API_KEY` — your Groq key
   - `GROQ_API_KEY_2` — optional second key for failover
   - `BITGET_API_KEY` — Bitget API key
   - `BITGET_SECRET_KEY` — Bitget secret
   - `BITGET_PASSPHRASE` — Bitget passphrase
4. Click Deploy ✅

## Architecture
- `frontend/` — React 18 + Vite + Tailwind + Zustand
- `api/` — Vercel serverless functions (Node 20)
  - `chat.ts` — Multi-brain Groq AI (5 specialized brains)
  - `analyze.ts` — Multi-timeframe SMC analysis
  - `trade.ts` — Bitget spot order execution
  - `portfolio.ts` — Account & balance data
  - `market/tickers.ts` — Real-time prices
  - `workflows.ts` — Autonomous workflow status
- `backend/` — Optional FastAPI server (deploy on Render for full features)

## Blueprint Upgrades (V2)
- Multi-agent pipeline: Analyst → Risk Manager → Executor
- Confidence gating (65% threshold)
- Fear & Greed index monitoring
- Sentiment + on-chain learning
- Adaptive learner interval (10min on high volatility)
- Chain-of-thought reasoning per signal
