import { InlineKeyboard } from "grammy";
import { cfg, isAdminTelegramId } from "../lib/config.js";
import { generateSignal, formatSignal } from "../services/signal.js";
import { getCandles, currentQuote } from "../services/market.js";
import { computeIndicators, indicatorRows } from "../services/indicators.js";
import { detectPatterns } from "../services/patterns.js";
import { runBacktest, formatBacktest } from "../services/backtest.js";
import { adminStats, getRiskSettings, listAlerts, listAssets, listStrategies, saveJournalTrade, saveSignal } from "../services/store.js";
import { clearUserMemory } from "../lib/memory.js";

function args(ctx) {
  return String(ctx.message?.text || "").split(/\s+/).slice(1);
}

function dashboardKeyboard() {
  const keyboard = new InlineKeyboard();
  if (cfg.DASHBOARD_URL) keyboard.webApp("Open Pocket Signal Dashboard", cfg.DASHBOARD_URL);
  else keyboard.text("Dashboard URL not configured", "dashboard_missing");
  return keyboard;
}

export default function register(bot) {
  bot.command("dashboard", async (ctx) => {
    await ctx.reply(cfg.DASHBOARD_URL ? "Open the Pocket Signal Mini App dashboard below." : "Dashboard URL is not configured yet. Set WEBAPP_PUBLIC_URL or deploy with RENDER_EXTERNAL_URL.", { reply_markup: dashboardKeyboard() });
  });

  bot.command("market", async (ctx) => {
    const [symbol = "EURUSD", timeframe = "1m"] = args(ctx);
    const market = await getCandles(symbol, timeframe);
    const quote = currentQuote(market.candles);
    const indicators = computeIndicators(market.candles);
    await ctx.reply([
      `Market overview: ${market.symbol} ${market.timeframe}`,
      market.demo ? "Data mode: demo/delayed sample data" : "Data mode: provider market data",
      `Price: ${quote.price.toFixed(Math.abs(quote.price) > 100 ? 2 : 5)} (${quote.changePct.toFixed(2)}%)`,
      `Trend: ${indicators.ema9 > indicators.ema21 ? "upward" : "downward or mixed"}`,
      `Volatility ATR: ${indicators.atr?.toFixed(5) || "n/a"}`,
      `Support: ${indicators.zones.support.map((v) => v.toFixed(5)).join(", ")}`,
      `Resistance: ${indicators.zones.resistance.map((v) => v.toFixed(5)).join(", ")}`,
      "Educational analysis only, not financial advice.",
    ].join("\n"));
  });

  bot.command("signal", async (ctx) => {
    const [symbol = "EURUSD", timeframe = "1m"] = args(ctx);
    const signal = await generateSignal({ symbol, timeframe, withAi: true });
    await saveSignal(ctx.from?.id, signal);
    await ctx.reply(formatSignal(signal));
  });

  bot.command("alerts", async (ctx) => {
    const alerts = await listAlerts(ctx.from?.id);
    await ctx.reply([
      "Alerts can track signal confidence thresholds, pattern detection, volatility spikes, cooldowns, and risk-limit events.",
      alerts.length ? `Active/saved alerts: ${alerts.length}` : "No alerts configured yet. Use the Mini App Alerts screen to create one.",
      "Alerts use safe cooldowns to avoid spam.",
    ].join("\n"), { reply_markup: dashboardKeyboard() });
  });

  bot.command("journal", async (ctx) => {
    const [asset = "EURUSD", direction = "NEUTRAL", result = "pending", ...noteParts] = args(ctx);
    const trade = await saveJournalTrade(ctx.from?.id, { asset, direction, result, notes: noteParts.join(" ") });
    await ctx.reply([
      "Demo trade journal entry saved.",
      `Asset: ${trade.asset}`,
      `Direction: ${trade.direction}`,
      `Result: ${trade.result}`,
      "This journal is for demo/educational tracking only. No broker execution is connected.",
    ].join("\n"));
  });

  bot.command("risk", async (ctx) => {
    const risk = await getRiskSettings(ctx.from?.id);
    await ctx.reply([
      "Risk settings:",
      `Risk per idea: ${risk.riskPercent}%`,
      `Max daily loss: ${risk.maxDailyLoss}%`,
      `Consecutive loss stop: ${risk.consecutiveLossStop}`,
      `Cooldown: ${risk.cooldownMinutes} minutes`,
      `Volatility adjustment: ${risk.volatilityAdjustment ? "on" : "off"}`,
      `Emotional trading alerts: ${risk.emotionalAlerts ? "on" : "off"}`,
      "Stop-trading recommendations are educational safeguards, not financial advice.",
    ].join("\n"));
  });

  bot.command("backtest", async (ctx) => {
    const [symbol = "EURUSD", timeframe = "1m"] = args(ctx);
    const result = await runBacktest({ symbol, timeframe });
    await ctx.reply(formatBacktest(result));
  });

  bot.command("strategies", async (ctx) => {
    const strategies = await listStrategies(ctx.from?.id);
    await ctx.reply([
      "Strategy Builder:",
      ...strategies.map((s, i) => `${i + 1}) ${s.name}: ${Array.isArray(s.rules) ? s.rules.join(", ") : "custom rules"}`),
      "Use the Mini App to combine RSI, MACD, EMA, SMA, Bollinger Bands, Stochastic RSI, VWAP, ATR, Fibonacci, support/resistance, and pattern filters.",
    ].join("\n"), { reply_markup: dashboardKeyboard() });
  });

  bot.command("admin", async (ctx) => {
    if (!isAdminTelegramId(ctx.from?.id)) {
      await ctx.reply("Admin features are disabled or your Telegram ID is not authorized.");
      return;
    }
    const stats = await adminStats();
    await ctx.reply([
      "Admin panel:",
      `Mode: ${stats.mode}`,
      `Users: ${stats.users ?? "n/a"}`,
      `Active alerts: ${stats.activeAlerts ?? "n/a"}`,
      `Signals: ${stats.signals ?? "n/a"}`,
      `Trades: ${stats.trades ?? "n/a"}`,
      `Health: ${stats.health}`,
    ].join("\n"), { reply_markup: dashboardKeyboard() });
  });

  bot.command("reset", async (ctx) => {
    await clearUserMemory({ platform: "telegram", userId: ctx.from?.id, chatId: ctx.chat?.id });
    await ctx.reply("Stored memory for this chat was cleared.");
  });

  bot.command("assets", async (ctx) => {
    const assets = await listAssets();
    await ctx.reply(["Supported assets:", ...assets.map((a) => `${a.symbol} ${a.displayName || ""} (${(a.timeframes || a.allowedTimeframes || ["1m"]).join(", ")})`)].join("\n"));
  });

  bot.command("indicators", async (ctx) => {
    const [symbol = "EURUSD", timeframe = "1m"] = args(ctx);
    const market = await getCandles(symbol, timeframe);
    const quote = currentQuote(market.candles);
    const rows = indicatorRows(computeIndicators(market.candles), quote.price);
    await ctx.reply([`Indicators: ${market.symbol} ${market.timeframe}`, ...rows.map((r) => `${r.name}: ${r.value} | ${r.interpretation} | score ${r.contribution}`)].join("\n"));
  });

  bot.command("patterns", async (ctx) => {
    const [symbol = "EURUSD", timeframe = "1m"] = args(ctx);
    const market = await getCandles(symbol, timeframe);
    const patterns = detectPatterns(market.candles);
    await ctx.reply(patterns.length ? [`Patterns: ${market.symbol} ${market.timeframe}`, ...patterns.map((p) => `${p.name}: ${p.bias}, score ${p.confidenceContribution}. ${p.tooltip}`)].join("\n") : "No strong candlestick pattern detected right now.");
  });
}
