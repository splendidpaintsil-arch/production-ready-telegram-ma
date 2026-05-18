import { Bot } from "grammy";
import { cfg } from "./lib/config.js";
import { log, safeErr } from "./lib/log.js";
import { touchUser } from "./services/store.js";
import { generateSignal, formatSignal } from "./services/signal.js";

export function createBot() {
  const bot = new Bot(cfg.TELEGRAM_BOT_TOKEN);

  bot.use(async (ctx, next) => {
    try {
      await touchUser(ctx);
    } catch (err) {
      log.error("user.touch.failed", { err: safeErr(err) });
    }
    return next();
  });

  bot.callbackQuery("quick_signal", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Generating educational signal..." });
    const signal = await generateSignal({ symbol: "EURUSD", timeframe: "1m", withAi: true });
    await ctx.reply(formatSignal(signal));
  });

  bot.callbackQuery("open_alerts", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("Use /alerts to view alert status, or open the Mini App Alerts screen to configure thresholds and risk events.");
  });

  bot.callbackQuery("open_help", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("Use /help to see commands, supported symbols, timeframes, and the risk disclaimer.");
  });

  bot.callbackQuery("dashboard_missing", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Dashboard URL not configured" });
    log.warn("miniapp.url.fallback", { callback: "dashboard_missing", dashboardUrlSet: false });
    await ctx.reply("The Mini App URL is not configured yet. Set WEBAPP_PUBLIC_URL or deploy on Render so RENDER_EXTERNAL_URL is available. The app is served at /app.");
  });

  bot.catch((err) => {
    log.error("telegram.bot.catch", { err: safeErr(err.error || err) });
  });

  return bot;
}
