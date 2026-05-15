# CozyCrypto AI Trader

**Autonomous AI trading platform for Cozanet. Built for Bitget. Deployed on Vercel.**

> Self-motivated. Self-learning. Elite trader even on a $3 account.

## Features
- 🤖 Autonomous AI trading with Groq LLM brain
- 📈 Real-time Bitget market data
- 🧠 Self-learning — improves from every trade
- 💤 Learn-only mode when no balance (keeps training)
- ⚡ Risk management for micro accounts ($3+)
- 🎯 Market scanner, signal bot, portfolio rebalancer
- 💬 Natural language trading commands

## Deploy to Vercel

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "CozyCrypto AI Trader v1.0"
git remote add origin https://github.com/YOUR_USERNAME/cozycrypto-trader.git
git push -u origin main
```

### 2. Import to Vercel
1. Go to vercel.com → New Project
2. Import your GitHub repo
3. Vercel auto-detects the config

### 3. Add Environment Variables
In Vercel → Project Settings → Environment Variables:
```
BITGET_API_KEY = your_key
BITGET_SECRET_KEY = your_secret
BITGET_PASSPHRASE = your_passphrase
GROQ_API_KEY = your_groq_key
```

### 4. Deploy!

## Get Bitget API Keys
1. bitget.com → Login → Profile → API Management
2. Create API → Name: "CozyCrypto Trader"
3. Enable: Spot Trading + Read
4. Set IP: No restriction (for Vercel)
5. Copy Key, Secret, Passphrase

## Architecture
- `frontend/` — React + Vite + Tailwind UI
- `api/` — Vercel serverless functions
  - `chat.ts` — Groq AI chat
  - `market/tickers.ts` — Real-time prices
  - `portfolio.ts` — Bitget account data
  - `trade.ts` — Order execution
  - `workflows.ts` — Autonomous workflows
