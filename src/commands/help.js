export default function register(bot) {
  bot.command("help", async (ctx) => {
    await ctx.reply([
      "Pocket Signal commands:",
      "/start opens the welcome panel and dashboard buttons.",
      "/dashboard opens the Mini App dashboard when configured.",
      "/chart SYMBOL TIMEFRAME opens or displays a live chart summary. Example: /chart BTCUSD 5m",
      "/market SYMBOL TIMEFRAME shows overview, price, trend, volatility, and data mode.",
      "/signal SYMBOL TIMEFRAME generates a probability-based BUY, SELL, or NEUTRAL analysis.",
      "/assets lists example forex, crypto, commodity, and index symbols.",
      "/indicators SYMBOL TIMEFRAME shows technical indicator rows.",
      "/patterns SYMBOL TIMEFRAME shows detected candlestick patterns.",
      "/alerts manages signal, pattern, volatility, cooldown, and risk-limit alerts.",
      "/journal logs demo trades and notes.",
      "/risk shows risk percentage, daily loss, cooldown, and volatility protections.",
      "/backtest SYMBOL TIMEFRAME runs a bounded educational simulation.",
      "/strategies lists strategy-builder options.",
      "/admin opens the Telegram-ID gated admin panel.",
      "/reset clears stored conversation memory for this user.",
      "Supported timeframes: 1m, 5m, 15m, 1h, 4h, 1d.",
      "Example symbols: EURUSD, GBPUSD, USDJPY, BTCUSD, ETHUSD, SOLUSD, XAUUSD, US30, NAS100, SPX500.",
      "All insights are educational and probability-based, not financial advice. Demo/sample data is clearly labeled when live provider data is unavailable.",
    ].join("\n"));
  });
}
