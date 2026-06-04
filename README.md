# CozyCrypto AI Autonomous Trader 🦅🎯

An elite, autonomous AI trading platform built with **React**, **Vite**, **Vercel**, and **Groq AI**. This system is designed to be a "True AI Trader" that scans, learns, and executes trades with institutional-level precision.

## 🚀 Elite Features

### 1. Eagle Eye Multi-Timeframe Confluence
The AI doesn't just look at one chart. It analyzes the **4H (Trend)**, **1H (Structure)**, and **15m (Sniper Entry)** timeframes simultaneously to find high-probability setups.

### 2. Liquidity Hunter
Detects **BSL (Buy-side Liquidity)** and **SSL (Sell-side Liquidity)** zones. It specifically looks for **Liquidity Sweeps** and **Inducement** to avoid retail traps and enter with the "Big Money."

### 3. Dynamic Risk Engine
Protects capital using **ATR-based position sizing**. It dynamically adjusts Stop-Loss and Take-Profit levels based on market volatility, ensuring a healthy Risk-to-Reward ratio.

### 4. Self-Learning Feedback Loop
The AI reviews its own trade history to identify "The Gold" (what works) and "The Trash" (what doesn't). It generates **Hard Rules** in its memory to evolve its strategy over time.

### 5. Autonomous Heartbeat
Powered by **GitHub Actions**, the AI "wakes up" every 5 minutes to scan the top 50 coins on Bitget. It operates 24/7 without needing any user prompts.

## 🛠 Tech Stack
- **Frontend:** React + Tailwind CSS + Framer Motion (Mobile-Sharp UI)
- **Backend:** Vercel Serverless Functions (TypeScript)
- **AI Brain:** Groq Llama-3.3-70B (Chain of Thought Reasoning)
- **Automation:** GitHub Actions (Heartbeat Trigger)
- **Exchange:** Bitget API (Spot Trading)

## 📦 Setup & Deployment

### Environment Variables (Vercel)
- `GROQ_API_KEY`: Your Groq API key.
- `BITGET_API_KEY`, `BITGET_SECRET_KEY`, `BITGET_PASSPHRASE`: Your Bitget API credentials.
- `GITHUB_TOKEN`: A PAT with `repo` permissions.
- `GITHUB_REPO`: Your repo in `username/repo` format.
- `CRON_SECRET`: A secure string to authorize the heartbeat.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`: For real-time trade alerts.

### GitHub Secrets
- `CRON_SECRET`: Must match the Vercel variable.
- `VERCEL_URL`: Your project's live URL.

## 🧠 Memory Files
- `logs/learned_insights.json`: Stores AI lessons and Hard Rules.
- `goals/active_goals.json`: Tracks paper and live trades.
- `logs/system_logs.json`: Chronological heartbeat and execution logs.

---
*Built with ❤️ for the next generation of autonomous traders.*
