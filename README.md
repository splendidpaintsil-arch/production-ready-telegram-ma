# Pocket Signal Bot

Pocket Signal is a Telegram bot and Telegram Mini App dashboard for probability-based market analysis, live chart viewing when provider data is available, demo journaling, risk controls, alerts, strategy simulation, and backtesting.

This project runs as one Node.js service. The same process hosts the Telegram bot, API routes, scheduler loop, and Mini App at /app.

## Risk disclaimer

Pocket Signal is educational software only. It is not financial advice. BUY, SELL, and NEUTRAL are analytical labels only, not trade instructions. No profits are guaranteed. Past performance does not predict future results. Trading can result in losses.

## Features

1) Telegram commands using grammY.
2) Telegram Mini App with home overview, asset search, timeframe selector, live chart, signal panel, alerts panel, journal panel, risk panel, indicators, backtesting, strategy builder, and admin screen.
3) Multi-symbol market support for examples like EURUSD, GBPUSD, USDJPY, BTCUSD, ETHUSD, SOLUSD, XAUUSD, US30, NAS100, and SPX500.
4) Supported timeframe validation for 1m, 5m, 15m, 1h, 4h, and 1d.
5) Generic market data adapter through MARKET_DATA_ENDPOINT and MARKET_DATA_API_KEY.
6) Safe demo/sample fallback when provider data is unavailable. Fallback data is clearly labeled and never presented as live.
7) JavaScript indicators: RSI, MACD, EMA, SMA, Bollinger Bands, Stochastic RSI, VWAP, ATR, Fibonacci, and support/resistance.
8) Candlestick patterns: doji, hammer, shooting star, engulfing, morning star, evening star, three white soldiers, three black crows, pin bars, and inside bars.
9) Risk-aware signal scoring with optional CookMyBots AI explanation.
10) MongoDB persistence when MONGODB_URI is configured, with in-memory limited mode when missing.
11) Admin controls gated by ADMIN_TELEGRAM_IDS.

## Commands

/start shows welcome text, risk disclaimer, Mini App button, quick signal, alerts, and help.
/help lists public commands and explains educational probability-based use.
/dashboard opens the Mini App if WEBAPP_PUBLIC_URL, RENDER_EXTERNAL_URL, or PUBLIC_BASE_URL is available.
/chart BTCUSD 5m opens or displays a live chart summary.
/market EURUSD 1h shows current market overview.
/signal XAUUSD 15m generates probability-based analysis.
/assets lists supported example assets by category.
/indicators ETHUSD 4h shows technical indicator rows.
/patterns USDJPY 1d shows candlestick patterns.
/alerts shows alert capabilities and saved alert count.
/journal EURUSD BUY win notes logs a demo trade.
/risk shows risk settings.
/backtest SOLUSD 1h runs a bounded educational simulation.
/strategies lists strategy-builder options.
/admin shows admin status when the Telegram ID is authorized.
/reset clears stored conversation memory for the user and chat.

## Environment variables

TELEGRAM_BOT_TOKEN is required for the Telegram bot.
PORT is used by the Node HTTP server, default 3000.
MONGODB_URI is optional but recommended for persistence.
COOKMYBOTS_AI_ENDPOINT is the CookMyBots AI Gateway base URL.
COOKMYBOTS_AI_KEY enables AI explanations.
AI_TIMEOUT_MS defaults to 600000.
AI_MAX_RETRIES defaults to 2.
CONCURRENCY defaults to 20.
MARKET_DATA_ENDPOINT is the optional generic OHLCV provider endpoint.
MARKET_DATA_API_KEY is the optional generic OHLCV provider key.
WEBAPP_PUBLIC_URL can point to the public /app URL for Telegram buttons.
ADMIN_TELEGRAM_IDS is a comma-separated allowlist for admin features.

Secrets are never logged. Startup logs only show boolean presence.

## Setup

1) Install root dependencies: npm run install:root
2) Install Mini App dependencies: npm run install:webapp
3) Copy .env.sample to .env and set TELEGRAM_BOT_TOKEN.
4) Build: npm run build
5) Start: npm start

## Database

MongoDB collections used by the bot include users, assets, strategies, alerts, trades, backtests, signals, riskSettings, systemEvents, and memory_messages.

Indexes are created only for application fields. The code never recreates the automatic _id index. Upserts store createdAt only in $setOnInsert and updatedAt in $set.

If MONGODB_URI is missing, the bot starts with limited in-memory behavior. Data may be lost on restart.

## Market data fallback mode

When MARKET_DATA_ENDPOINT and MARKET_DATA_API_KEY are configured, the adapter attempts to fetch OHLCV candles from the provider. If either is missing or the provider fails, Pocket Signal uses generated demo/sample candles and labels responses clearly.

## AI Gateway

AI explanations use POST {COOKMYBOTS_AI_ENDPOINT}/chat with Authorization: Bearer COOKMYBOTS_AI_KEY. The bot reads normalized responses from output.content. If AI variables are missing, technical analysis still works without AI explanation.

Every AI chat request includes a runtime Bot Profile describing purpose, commands, admin rules, group/private behavior, risk disclaimer, no broker execution, and Mini App features.

## Deployment

Use one Render web service. Set build command to npm run build and start command to npm start. The service must expose PORT. Telegram polling is long polling via @grammyjs/runner. The bot clears webhooks with drop_pending_updates before polling and retries conflicts with backoff.

Required Render env: TELEGRAM_BOT_TOKEN.
Recommended env: MONGODB_URI, COOKMYBOTS_AI_ENDPOINT, COOKMYBOTS_AI_KEY, MARKET_DATA_ENDPOINT, MARKET_DATA_API_KEY, ADMIN_TELEGRAM_IDS.

## Troubleshooting

If the bot exits immediately, check TELEGRAM_BOT_TOKEN is set.
If the dashboard button says URL not configured, set WEBAPP_PUBLIC_URL or deploy on Render so RENDER_EXTERNAL_URL exists.
If AI explanations are missing, check COOKMYBOTS_AI_ENDPOINT and COOKMYBOTS_AI_KEY.
If provider data is unavailable, the bot will continue with clearly labeled demo/sample data.
If admin access fails, confirm your numeric Telegram ID is in ADMIN_TELEGRAM_IDS.

## Extending

Add new Telegram commands in src/commands and export a default register(bot) function. Add shared logic under src/services or src/lib. Update /help, DOCS.md, README.md, and command docs whenever public commands change.
