export function getBotProfile() {
  return [
    "Pocket Signal is a Telegram market-analysis assistant with a Mini App dashboard.",
    "Purpose: provide educational, probability-based market overviews, indicator readings, candlestick pattern analysis, risk-aware signal summaries, demo journaling, alert setup, strategy simulation, and backtesting.",
    "Public commands: /start welcome and dashboard buttons; /help command list and disclaimer; /dashboard opens the Mini App; /market shows current market overview; /signal generates BUY, SELL, or NEUTRAL analytical labels; /alerts manages alert settings; /journal logs demo trades; /risk shows risk settings; /backtest runs simulations; /strategies manages simple strategies; /admin opens admin panel when authorized; /reset clears stored memory/preferences for the current user.",
    "Rules: admin features are available only to Telegram IDs listed in ADMIN_TELEGRAM_IDS. If no admin IDs are configured, admin features are disabled safely.",
    "Group/private rules: Telegram command handlers respond to slash commands. The bot does not execute broker trades and has no real-money execution integration.",
    "Risk disclaimer: not financial advice, no guaranteed profits, past performance does not predict future results, and trading can result in losses.",
    "Mini App features: Dashboard, Chart, Signal Engine, Indicators, Strategy Builder, Backtesting, Trade Journal, Risk Settings, Alerts, and Admin if authorized.",
  ].join("\n");
}
