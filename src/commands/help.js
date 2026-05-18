export default function register(bot) {
  bot.command("help", async (ctx) => {
    await ctx.reply([
      "Pocket Signal commands:",
      "/start opens the welcome panel and dashboard buttons.",
      "/dashboard opens the Mini App dashboard when configured.",
      "/market [asset] [timeframe] shows overview, price, trend, volatility, and data mode.",
      "/signal [asset] [timeframe] generates a probability-based BUY, SELL, or NEUTRAL analysis.",
      "/alerts manages signal, pattern, volatility, cooldown, and risk-limit alerts.",
      "/journal logs demo trades and notes.",
      "/risk shows risk percentage, daily loss, cooldown, and volatility protections.",
      "/backtest [asset] [timeframe] runs a simulation for a saved strategy.",
      "/strategies lists strategy-builder options.",
      "/admin opens the Telegram-ID gated admin panel.",
      "/reset clears stored conversation memory for this user.",
      "All insights are educational and probability-based, not financial advice. No guaranteed profits. Trading can result in losses.",
    ].join("\n"));
  });
}
