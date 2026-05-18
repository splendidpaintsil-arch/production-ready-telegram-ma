import { InlineKeyboard } from "grammy";
import { cfg } from "../lib/config.js";

export default function register(bot) {
  bot.command("start", async (ctx) => {
    const keyboard = new InlineKeyboard();
    if (cfg.DASHBOARD_URL) keyboard.webApp("Open Dashboard", cfg.DASHBOARD_URL).row();
    else keyboard.text("Dashboard URL not configured", "dashboard_missing").row();
    keyboard.text("Quick Signal", "quick_signal").text("Configure Alerts", "open_alerts").row().text("Help", "open_help");

    await ctx.reply([
      "Pocket Signal helps you read markets with probability-based analysis, indicators, patterns, demo journaling, alerts, and backtesting.",
      "Risk disclaimer: this is educational analysis only, not financial advice. BUY, SELL, and NEUTRAL are analytical labels, not instructions. No profits are guaranteed. Past performance does not predict future results. Trading can result in losses.",
      cfg.DASHBOARD_URL ? "Use the button below to open the Mini App dashboard." : "The Mini App URL is not configured yet. Set WEBAPP_PUBLIC_URL or deploy with RENDER_EXTERNAL_URL.",
    ].join("\n\n"), { reply_markup: keyboard });
  });
}
