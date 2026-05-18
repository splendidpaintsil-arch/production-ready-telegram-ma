# Pocket Signal Bot Documentation

Pocket Signal is a Telegram bot with a hosted Telegram Mini App dashboard for educational, probability-based market analysis. It calculates indicators, detects candlestick patterns, generates risk-aware signal summaries, supports demo trade journaling, manages alerts, and runs strategy simulations.

This bot does not execute trades and does not connect to real brokers.

## Public commands

/start
Shows the welcome message, strong risk disclaimer, and buttons for the Mini App dashboard, quick signal, alerts, and help.

/help
Lists all public commands and explains that insights are educational, probability-based, and not financial advice.

/dashboard
Opens the Mini App dashboard if WEBAPP_PUBLIC_URL, RENDER_EXTERNAL_URL, or PUBLIC_BASE_URL is configured. If not configured, it sends a safe setup message.

/market [asset] [timeframe]
Shows current market overview, price, trend, volatility, support/resistance, and data mode.
Example: /market EURUSD 1m

/signal [asset] [timeframe]
Generates a BUY, SELL, or NEUTRAL analytical label with confidence, probability, risk level, expiration window, rationale, and disclaimer.
Example: /signal BTCUSD 5m

/alerts
Shows alert capabilities for signal thresholds, candlestick patterns, volatility spikes, cooldowns, risk-limit events, and daily summaries.

/journal [asset] [direction] [result] [notes]
Logs a demo trade entry. No real broker execution is connected.
Example: /journal EURUSD BUY win clean breakout

/risk
Shows risk settings including risk percentage, max daily loss, consecutive loss stop, cooldown period, volatility adjustment, and emotional trading alerts.

/backtest [asset] [timeframe]
Runs a bounded JavaScript simulation using historical or demo candles and returns win rate, drawdown, profit factor, Sharpe-like ratio, average duration, and stability notes.
Example: /backtest EURUSD 1m

/strategies
Shows strategy-builder options and saved/demo strategies.

/assets
Lists supported assets and timeframes.

/indicators [asset] [timeframe]
Shows RSI, MACD, EMA, SMA, Bollinger Bands, Stochastic RSI, VWAP, ATR, Fibonacci/support/resistance contribution rows.

/patterns [asset] [timeframe]
Shows detected candlestick patterns with bias, confidence contribution, and tooltip.

/admin
Admin-only panel gated by ADMIN_TELEGRAM_IDS. If ADMIN_TELEGRAM_IDS is missing, admin features are disabled safely.

/reset
Clears stored conversation memory for the current user and chat.

## Mini App screens

Dashboard: asset selector, timeframe selector, current price, candle timer context, volatility, trend, latest signal, and risk status.
Chart: candlestick-style visualization, timeframe switching, overlays, support/resistance, pattern markers, loading, empty, and error states.
Signal Engine: direction, confidence, probability, entry suggestion, expiration, volatility, risk, rationale, and disclaimer.
Indicators: RSI, MACD, EMA, SMA, Bollinger Bands, Stochastic RSI, VWAP, ATR, Fibonacci, and support/resistance zones.
Strategy Builder: combine indicators, define simple conditions, save strategy concepts, run simulations, and compare results.
Backtesting: select asset/timeframe/strategy and view simulation metrics.
Trade Journal: log demo trades and review basic analytics.
Risk Settings: view risk percentage, max daily loss, loss stop, cooldown, volatility adjustment, and emotional trading prevention alerts.
Alerts: configure signal, pattern, volatility, cooldown, and risk-limit alerts.
Admin: user count, active alerts, signal logs, system health, and asset controls when authorized.

## Environment variables

TELEGRAM_BOT_TOKEN: required Telegram bot token.
PORT: HTTP port for the bot and Mini App service.
MONGODB_URI: optional MongoDB connection string for persistent users, settings, alerts, trades, backtests, signals, assets, and memory.
COOKMYBOTS_AI_ENDPOINT: CookMyBots AI Gateway base URL.
COOKMYBOTS_AI_KEY: CookMyBots AI Gateway key.
MARKET_DATA_API_KEY: optional market data provider key.
WEBAPP_PUBLIC_URL: optional public dashboard URL for Telegram Web App launch buttons.
ADMIN_TELEGRAM_IDS: optional comma-separated admin Telegram user IDs.
AI_TIMEOUT_MS: optional AI timeout, default 600000.
AI_MAX_RETRIES: optional AI retries, default 2.
CONCURRENCY: optional concurrency setting, default 20.

## Database collections

users, assets, strategies, alerts, trades, backtests, signals, riskSettings, systemEvents, and memory_messages.

MongoDB writes follow createdAt safety rules. createdAt is insert-only. updatedAt is used for updates. Immutable fields are removed before $set.

## Market data and demo mode

If MARKET_DATA_API_KEY is missing or the provider fails, Pocket Signal uses safe generated demo/delayed candles. Responses clearly label demo data.

## AI usage

AI is used only for natural-language explanation, summarization, educational reasoning, and risk-aware interpretation of computed technical data. The bot never calls OpenAI directly. It uses the CookMyBots AI Gateway and parses normalized output.content.

If AI env vars are missing, AI explanations are disabled safely and deterministic technical analysis still works.

## Running

Install: npm run install:root and npm run install:webapp
Build: npm run build
Start: npm start
Development: npm run dev

## Deployment

Deploy as one Node web service. The HTTP server listens on PORT. The Mini App is hosted at /app. The bot uses long polling and @grammyjs/runner in the same process.
