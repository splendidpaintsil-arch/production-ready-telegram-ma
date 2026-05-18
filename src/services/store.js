import { getDb, safeInsert, safeUpsert } from "../lib/db.js";
import { ASSET_CATEGORIES, DEFAULT_ASSETS } from "./market.js";
import { log, safeErr } from "../lib/log.js";

const mem = {
  users: new Map(),
  risk: new Map(),
  alerts: new Map(),
  trades: new Map(),
  strategies: new Map(),
  signals: [],
  backtests: [],
};

export async function touchUser(ctx) {
  const telegramId = String(ctx.from?.id || "");
  if (!telegramId) return;
  const mutable = {
    username: ctx.from?.username || "",
    firstName: ctx.from?.first_name || "",
    defaultAsset: "EURUSD",
    defaultTimeframe: "1m",
    lastSeenAt: new Date(),
  };
  mem.users.set(telegramId, { ...(mem.users.get(telegramId) || {}), telegramId, ...mutable });
  await safeUpsert("users", { telegramId }, mutable, { telegramId, acceptedRiskDisclaimerAt: new Date() });
}

export async function listAssets() {
  const db = await getDb();
  if (!db) return DEFAULT_ASSETS;
  try {
    const rows = await db.collection("assets").find({}).sort({ symbol: 1 }).toArray();
    if (!rows.length) {
      for (const asset of DEFAULT_ASSETS) await safeUpsert("assets", { symbol: asset.symbol }, asset, { symbol: asset.symbol });
      return DEFAULT_ASSETS;
    }
    return rows;
  } catch (err) {
    log.error("db.read.failed", { collection: "assets", operation: "find", err: safeErr(err) });
    return DEFAULT_ASSETS;
  }
}

export function listAssetCategories() {
  return ASSET_CATEGORIES;
}

export async function saveSignal(telegramId, signal) {
  mem.signals.unshift({ telegramId: String(telegramId || ""), ...signal });
  mem.signals = mem.signals.slice(0, 200);
  await safeInsert("signals", { telegramId: String(telegramId || ""), ...signal });
}

export async function getRiskSettings(telegramId) {
  const id = String(telegramId || "");
  const fallback = { telegramId: id, riskPercent: 1, maxDailyLoss: 3, consecutiveLossStop: 3, cooldownMinutes: 30, volatilityAdjustment: true, emotionalAlerts: true };
  const db = await getDb();
  if (!db) return mem.risk.get(id) || fallback;
  try {
    const row = await db.collection("riskSettings").findOne({ telegramId: id });
    return row || fallback;
  } catch (err) {
    log.error("db.read.failed", { collection: "riskSettings", operation: "findOne", err: safeErr(err) });
    return fallback;
  }
}

export async function saveJournalTrade(telegramId, trade) {
  const id = String(telegramId || "");
  const clean = { telegramId: id, ...trade, mode: "demo", createdAt: new Date() };
  const arr = mem.trades.get(id) || [];
  arr.unshift(clean);
  mem.trades.set(id, arr.slice(0, 100));
  await safeInsert("trades", clean);
  return clean;
}

export async function listTrades(telegramId) {
  const id = String(telegramId || "");
  const db = await getDb();
  if (!db) return mem.trades.get(id) || [];
  try {
    return await db.collection("trades").find({ telegramId: id }).sort({ createdAt: -1 }).limit(100).toArray();
  } catch (err) {
    log.error("db.read.failed", { collection: "trades", operation: "find", err: safeErr(err) });
    return mem.trades.get(id) || [];
  }
}

export async function listAlerts(telegramId) {
  const id = String(telegramId || "");
  const db = await getDb();
  if (!db) return mem.alerts.get(id) || [];
  try {
    return await db.collection("alerts").find({ telegramId: id }).sort({ updatedAt: -1 }).limit(50).toArray();
  } catch (err) {
    log.error("db.read.failed", { collection: "alerts", operation: "find", err: safeErr(err) });
    return mem.alerts.get(id) || [];
  }
}

export async function saveAlert(telegramId, alert) {
  const id = String(telegramId || "");
  const clean = {
    telegramId: id,
    symbol: String(alert.symbol || "EURUSD").toUpperCase().slice(0, 16),
    timeframe: String(alert.timeframe || "1m").slice(0, 8),
    threshold: Number(alert.threshold || 70),
    type: alert.type || "signal_confidence",
    active: true,
  };
  const arr = mem.alerts.get(id) || [];
  arr.unshift({ ...clean, updatedAt: new Date() });
  mem.alerts.set(id, arr.slice(0, 50));
  await safeInsert("alerts", clean);
  return clean;
}

export async function listStrategies(telegramId) {
  const id = String(telegramId || "");
  return mem.strategies.get(id) || [{ name: "Balanced RSI MACD", rules: ["RSI confirmation", "MACD histogram", "EMA trend filter", "ATR volatility guard"], demo: true }];
}

export async function adminStats() {
  const db = await getDb();
  if (!db) return { mode: "memory", users: mem.users.size, activeAlerts: [...mem.alerts.values()].flat().length, signals: mem.signals.length, health: "limited demo mode" };
  try {
    const [users, activeAlerts, signals, trades] = await Promise.all([
      db.collection("users").countDocuments(),
      db.collection("alerts").countDocuments({ active: true }),
      db.collection("signals").countDocuments(),
      db.collection("trades").countDocuments(),
    ]);
    return { mode: "mongo", users, activeAlerts, signals, trades, health: "ok" };
  } catch (err) {
    log.error("db.read.failed", { collection: "system", operation: "adminStats", err: safeErr(err) });
    return { mode: "error", health: safeErr(err) };
  }
}
