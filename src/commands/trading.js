const log = {
  info:  (...a) => console.log(...a),
  warn:  (...a) => console.warn(...a),
  error: (...a) => console.error(...a),
};

import { InlineKeyboard } from "grammy";
import { cfg, isAdminTelegramId } from "../lib/config.js";

import { generateSignal, formatSignal } from "../services/signal.js";
import { getCandles, currentQuote, SUPPORTED_TIMEFRAMES, validateMarketInput } from "../services/market.js";
import { computeIndicators, indicatorRows } from "../services/indicators.js";
import { detectPatterns } from "../services/patterns.js";
import { runBacktest, formatBacktest } from "../services/backtest.js";
import { adminStats, getRiskSettings, listAlerts, listAssetCategories, listAssets, listStrategies, saveJournalTrade, saveSignal } from "../services/store.js";
import { clearUserMemory } from "../lib/memory.js";

function args(ctx) {
  return String(ctx.message?.text || "").split(/\s+/).slice(1);
}

function fmt(n) {
  return Number(n).toFixed(Math.abs(Number(n)) >= 100 ? 2 : 5);
}

async function parseMarketArgs(ctx, defaults = {}) {
  const [rawSymbol = defaults.symbol || "EURUSD", rawTimeframe = defaults.timeframe || "1m"] = args(ctx);
  const valid = validateMarketInput(rawSymbol, rawTimeframe);
  if (!valid.ok) {
    await ctx.reply(`${valid.error}\nSupported timeframes: ${SUPPORTED_TIMEFRAMES.join(", ")}.\nExample: /signal BTCUSD 5m`);
    return null;
  }
  return valid;
}

function dashboardUrl(params = {}) {
  if (!cfg.DASHBOARD_URL) return "";
  const url = new URL(cfg.DASHBOARD_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function dashboardKeyboard(params = {}) {
  const keyboard = new InlineKeyboard();
  const url = dashboardUrl(params);
  if (url) keyboard.webApp(params.screen === "Chart" ? "Open Live Chart" : "Open Pocket Signal Dashboard", url);
  else keyboard.text("Dashboard URL not configured", "dashboard_missing");
  return keyboard;
}

export default function register(bot) {
  bot.command("dashboard", async (ctx) => {
    if (!cfg.DASHBOARD_URL) {
      log.warn("miniapp.url.fallback", { command: "dashboard", dashboardUrlSet: false });
      await ctx.reply("Dashboard URL is not configured yet. Set WEBAPP_PUBLIC_URL or deploy with RENDER_EXTERNAL_URL so the Mini App can open at /app.");
      return;
    }
    await ctx.reply("Open the Pocket Signal live chart dashboard below.", { reply_markup: dashboardKeyboard({ screen: "Dashboard" }) });
  });

  bot.command("chart", async (ctx) => {
    const parsed = await parseMarketArgs(ctx);
    if (!parsed) return;
    const market = await getCandles(parsed.symbol, parsed.timeframe);
    const quote = currentQuote(market.candles);
    const indicators = computeIndicators(market.candles);
    const lines = [
      `Chart: ${market.symbol} ${market.timeframe}`,
      market.demo ? "Data mode: demo/delayed sample data, not live market data" : "Data mode: provider market data",
      `Latest price: ${fmt(quote.price)} (${quote.changePct.toFixed(2)}%)`,
      `Trend: ${market.trendDirection}`,
      `Recent high/low: ${fmt(market.recentHigh)} / ${fmt(market.recentLow)}`,
      `Support: ${indicators.zones.support.map(fmt).join(", ") || "n/a"}`,
      `Resistance: ${indicators.zones.resistance.map(fmt).join(", ") || "n/a"}`,
    ];
    if (!cfg.DASHBOARD_URL) {
      log.warn("chart.url.fallback", { symbol: market.symbol, timeframe: market.timeframe, dashboardUrlSet: false });
      await ctx.reply(`${lines.join("\n")}\n\nLive chart dashboard is not configured yet. Set WEBAPP_PUBLIC_URL or deploy with RENDER_EXTERNAL_URL so /chart can open the Mini App.`);
      return;
    }
    await ctx.reply(lines.join("\n"), { reply_markup: dashboardKeyboard({ screen: "Chart", symbol: market.symbol, timeframe: market.timeframe }) });
  });

  bot.command("market", async (ctx) => {
    const parsed = await parseMarketArgs(ctx);
    if (!parsed) return;
    const market = await getCandles(parsed.symbol, parsed.timeframe);
    const quote = currentQuote(market.candles);
    const indicators = computeIndicators(market.candles);
    await ctx.reply([
      `Market overview: ${market.symbol} ${market.timeframe}`,
      market.demo ? "Data mode: demo/delayed sample data, not live market data" : "Data mode: provider market data",
      `Price: ${fmt(quote.price)} (${quote.changePct.toFixed(2)}%)`,
      `Recent high/low: ${fmt(market.recentHigh)} / ${fmt(market.recentLow)}`,
      `Trend: ${market.trendDirection}`,
      `Volatility range: ${market.rangeVolatilityPct}% | ATR: ${indicators.atr?.toFixed(5) || "n/a"}`,
      `Support: ${indicators.zones.support.map(fmt).join(", ") || "n/a"}`,
      `Resistance: ${indicators.zones.resistance.map(fmt).join(", ") || "n/a"}`,
      "Educational analysis only, not financial advice.",
    ].join("\n"));
  });

  bot.command("signal", async (ctx) => {
    const parsed = await parseMarketArgs(ctx);
    if (!parsed) return;
    const signal = await generateSignal({ symbol: parsed.symbol, timeframe: parsed.timeframe, withAi: true });
    await saveSignal(ctx.from?.id, signal);
    await ctx.reply(formatSignal(signal));
  });

  bot.command("alerts", async (ctx) => {
    const alerts = await listAlerts(ctx.from?.id);
    await ctx.reply([
      "Alerts can track signal confidence thresholds, pattern detection, volatility spikes, cooldowns, and risk-limit events.",
      alerts.length ? `Active/saved alerts: ${alerts.length}` : "No alerts configured yet. Use the Mini App Alerts screen to create one.",
      "Alerts use safe cooldowns to avoid spam.",
    ].join("\n"), { reply_markup: dashboardKeyboard({ screen: "Alerts" }) });
  });

  bot.command("journal", async (ctx) => {
    const [asset = "EURUSD", direction = "NEUTRAL", result = "pending", ...noteParts] = args(ctx);
    const trade = await saveJournalTrade(ctx.from?.id, { asset: String(asset).toUpperCase().slice(0, 16), direction, result, notes: noteParts.join(" ") });
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
    const parsed = await parseMarketArgs(ctx);
    if (!parsed) return;
    const result = await runBacktest({ symbol: parsed.symbol, timeframe: parsed.timeframe });
    await ctx.reply(formatBacktest(result));
  });

  bot.command("strategies", async (ctx) => {
    const strategies = await listStrategies(ctx.from?.id);
    await ctx.reply([
      "Strategy Builder:",
      ...strategies.map((s, i) => `${i + 1}) ${s.name}: ${Array.isArray(s.rules) ? s.rules.join(", ") : "custom rules"}`),
      "Use the Mini App to combine RSI, MACD, EMA, SMA, Bollinger Bands, Stochastic RSI, VWAP, ATR, Fibonacci, support/resistance, and pattern filters.",
    ].join("\n"), { reply_markup: dashboardKeyboard({ screen: "Strategy Builder" }) });
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
    ].join("\n"), { reply_markup: dashboardKeyboard({ screen: "Admin" }) });
  });

  bot.command("reset", async (ctx) => {
    await clearUserMemory({ platform: "telegram", userId: ctx.from?.id, chatId: ctx.chat?.id });
    await ctx.reply("Stored memory for this chat was cleared.");
  });

  bot.command("assets", async (ctx) => {
    await listAssets();
    const categories = listAssetCategories();
    await ctx.reply([
      "Supported example assets:",
      ...categories.flatMap((category) => [
        `${category.name}:`,
        category.assets.map((a) => `${a.symbol} ${a.displayName || ""}`).join(", "),
        category.note,
      ]),
      `Timeframes: ${SUPPORTED_TIMEFRAMES.join(", ")}`,
      "Availability depends on your live market-data provider. If provider data is unavailable, responses are clearly labeled demo/sample data.",
    ].join("\n"));
  });

  bot.command("indicators", async (ctx) => {
    const parsed = await parseMarketArgs(ctx);
    if (!parsed) return;
    const market = await getCandles(parsed.symbol, parsed.timeframe);
    const quote = currentQuote(market.candles);
    const rows = indicatorRows(computeIndicators(market.candles), quote.price);
    await ctx.reply([`Indicators: ${market.symbol} ${market.timeframe}`, market.demo ? "Data mode: demo/delayed sample data" : "Data mode: provider market data", ...rows.map((r) => `${r.name}: ${r.value} | ${r.interpretation} | score ${r.contribution}`)].join("\n"));
  });

  bot.command("patterns", async (ctx) => {
    const parsed = await parseMarketArgs(ctx);
    if (!parsed) return;
    const market = await getCandles(parsed.symbol, parsed.timeframe);
    const patterns = detectPatterns(market.candles);
    await ctx.reply(patterns.length ? [`Patterns: ${market.symbol} ${market.timeframe}`, market.demo ? "Data mode: demo/delayed sample data" : "Data mode: provider market data", ...patterns.map((p) => `${p.name}: ${p.bias}, score ${p.confidenceContribution}. ${p.tooltip}`)].join("\n") : `No strong candlestick pattern detected right now for ${market.symbol} ${market.timeframe}.`);
  });
}
