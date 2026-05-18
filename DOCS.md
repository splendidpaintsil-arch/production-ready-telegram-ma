# Pocket Signal Bot Documentation

Pocket Signal is a Telegram bot with a hosted Telegram Mini App dashboard for educational, probability-based market analysis across many market symbols. It calculates indicators, detects candlestick patterns, generates risk-aware signal summaries, supports demo trade journaling, manages alerts, and runs bounded strategy simulations.

This bot does not execute trades and does not connect to real brokers. BUY, SELL, and NEUTRAL are analytical labels only.

## Public commands

/start
Shows the welcome message, risk disclaimer, supported examples, and buttons for the Mini App dashboard, quick signal, alerts, and help.

/help
Lists all public commands, supported examples, and explains that insights are educational, probability-based, and not financial advice.

/dashboard
Opens the Mini App dashboard if WEBAPP_PUBLIC_URL, RENDER_EXTERNAL_URL, or PUBLIC_BASE_URL is configured. If not configured, it sends setup guidance instead of crashing.

/chart SYMBOL TIMEFRAME
Opens or displays a live chart summary for the requested symbol and timeframe. The Mini App chart shows selected symbol, timeframe, latest price, trend label, recent candles, and latest signal.
Example: /chart BTCUSD 5m

/market SYMBOL TIMEFRAME
Shows market overview, current price, recent high/low, trend, volatility, support/resistance, and data mode.
Example: /market EURUSD 1h

/signal SYMBOL TIMEFRAME
Generates a BUY, SELL, or NEUTRAL analytical label with confidence, estimated probability, key technical reasons, support/resistance, volatility warning, validity window, AI summary when available, and disclaimer.
Example: /signal XAUUSD 15m

/assets
Lists supported example assets by category. Forex examples: EURUSD, GBPUSD, USDJPY. Crypto examples: BTCUSD, ETHUSD, SOLUSD. Commodity/index examples: XAUUSD, US30, NAS100, SPX500. Availability depends on your live provider.

/indicators SYMBOL TIMEFRAME
Shows RSI, MACD, EMA, SMA, Bollinger Bands, Stochastic RSI, VWAP, ATR, and contribution rows.
Example: /indicators ETHUSD 4h

/patterns SYMBOL TIMEFRAME
Shows detected candlestick patterns with bias, confidence contribution, and explanation.
Example: /patterns USDJPY 1d

/alerts
Shows alert capabilities for signal thresholds, candlestick patterns, volatility spikes, cooldowns, risk-limit events, and daily summaries.

/journal SYMBOL DIRECTION RESULT NOTES
Logs a demo trade entry. No real broker execution is connected.
Example: /journal EURUSD BUY win clean breakout

/risk
Shows risk settings including risk percentage, max daily loss, consecutive loss stop, cooldown period, volatility adjustment, and emotional trading alerts.

/backtest SYMBOL TIMEFRAME
Runs a bounded educational simulation using historical provider candles or clearly labeled demo candles. Results do not imply future profitability.
Example: /backtest SOLUSD 1h

/strategies
Shows strategy-builder options and saved/demo strategies.

/admin
Admin-only panel gated by ADMIN_TELEGRAM_IDS. If ADMIN_TELEGRAM_IDS is missing, admin features are disabled safely.

/reset
Clears stored conversation memory for the current user and chat.

## Symbols and timeframes

Supported timeframe validation includes 1m, 5m, 15m, 1h, 4h, and 1d.

The bot accepts user-provided market symbols instead of being hardcoded to one pair. Examples include EURUSD, GBPUSD, USDJPY, BTCUSD, ETHUSD, SOLUSD, XAUUSD, US30, NAS100, and SPX500. Live availability depends on MARKET_DATA_ENDPOINT provider support.

## Live data versus demo/sample data

If MARKET_DATA_ENDPOINT and MARKET_DATA_API_KEY are configured, the bot requests recent OHLCV candles from the provider. It logs provider request start, success, and failure without logging secrets.

If either value is missing, the provider times out, or the provider does not support the requested symbol, the bot returns generated demo/sample candles. Fallback data is always labeled as demo/delayed sample data and must never be treated as live market data.

## Mini App screens

Home overview: asset selector, timeframe selector, latest price, trend, volatility, data mode, latest signal, and risk status.
Asset search/selector: search symbols and switch between supported examples.
Timeframe selector: 1m, 5m, 15m, 1h, 4h, and 1d.
Live chart: selected symbol, timeframe, latest price, trend label, recent candles, support/resistance, and latest probability-based signal.
Signal panel: direction, confidence, probability, entry context, validity window, volatility warning, rationale, and disclaimer.
Alerts panel: configured alert count and supported alert types.
Journal panel: demo trade logs and simple stats.
Risk panel: risk percentage, max daily loss, loss stop, cooldown, volatility adjustment, and emotional trading prevention alerts.
Admin panel: protected system status when the Telegram ID is authorized.

The Mini App uses Telegram WebApp APIs including ready, expand, theme params, and disableVerticalSwipes when available.

## Environment variables

TELEGRAM_BOT_TOKEN: required Telegram bot token.
PORT: HTTP port for the bot and Mini App service. Defaults to 3000.
MONGODB_URI: optional MongoDB connection string for persistent users, settings, alerts, trades, backtests, signals, assets, and memory. If missing, the bot logs that persistence is disabled and uses limited in-memory behavior.
COOKMYBOTS_AI_ENDPOINT: CookMyBots AI Gateway base URL. Do not include /chat.
COOKMYBOTS_AI_KEY: optional CookMyBots AI Gateway key. If missing, AI summaries are disabled safely.
MARKET_DATA_ENDPOINT: optional generic market-data provider endpoint for OHLCV candles.
MARKET_DATA_API_KEY: optional generic market-data provider key. If missing or provider fails, demo/sample data is clearly labeled.
WEBAPP_PUBLIC_URL: optional public dashboard URL. If missing, RENDER_EXTERNAL_URL or PUBLIC_BASE_URL is used when available. If no URL is available, /dashboard and /chart send setup guidance.
ADMIN_TELEGRAM_IDS: optional comma-separated admin Telegram user IDs. If missing, admin features are disabled safely.
AI_TIMEOUT_MS: optional AI timeout, default 600000.
AI_MAX_RETRIES: optional AI retries, default 2.
CONCURRENCY: optional concurrency setting, default 20.

## AI usage

AI is used only to summarize computed market context and produce human-readable rationale from indicator and candle data. The bot never calls OpenAI directly. It calls POST {COOKMYBOTS_AI_ENDPOINT}/chat with Authorization: Bearer COOKMYBOTS_AI_KEY and reads normalized output.content.

Every AI chat request includes a runtime Bot Profile as the first system message. The Bot Profile describes the bot purpose, public commands, admin-only actions, educational-only signals, no broker execution, supported symbols/timeframes, demo-data rules, and risk disclaimers.

AI must not invent prices, candles, provider status, or pretend unavailable data is live.

## Database collections

MongoDB collections include users, assets, strategies, alerts, trades, backtests, signals, riskSettings, systemEvents, and memory_messages.

MongoDB writes follow createdAt safety rules. createdAt is insert-only. updatedAt is used for updates. Immutable fields are removed before $set.

## Running

Install root dependencies: npm run install:root
Install Mini App dependencies: npm run install:webapp
Build: npm run build
Start: npm start
Development: npm run dev

## Deployment

Deploy as one Node web service. The HTTP server listens on PORT. The Mini App is hosted at /app. The bot uses long polling with @grammyjs/runner in the same process, clears webhooks before polling, and retries polling conflicts with backoff.
