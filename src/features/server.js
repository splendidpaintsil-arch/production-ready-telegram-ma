import express from "express";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { cfg, isAdminTelegramId } from "../lib/config.js";
import { log, safeErr } from "../lib/log.js";
import { generateSignal } from "../services/signal.js";
import { getCandles, currentQuote } from "../services/market.js";
import { computeIndicators, indicatorRows } from "../services/indicators.js";
import { detectPatterns } from "../services/patterns.js";
import { runBacktest } from "../services/backtest.js";
import { adminStats, getRiskSettings, listAlerts, listAssets, listStrategies, listTrades, saveAlert, saveJournalTrade } from "../services/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const distDir = path.join(rootDir, "webapp", "dist");
const rate = new Map();

function rateLimit(req, res, next) {
  const key = req.ip || "local";
  const now = Date.now();
  const bucket = rate.get(key) || { count: 0, reset: now + 60000 };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + 60000;
  }
  bucket.count += 1;
  rate.set(key, bucket);
  if (bucket.count > 120) return res.status(429).json({ ok: false, error: "Rate limit reached. Try again soon." });
  return next();
}

function parseInitData(initData = "") {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !cfg.TELEGRAM_BOT_TOKEN) return { valid: false, user: null };
  params.delete("hash");
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(cfg.TELEGRAM_BOT_TOKEN).digest();
  const expected = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  const valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash));
  let user = null;
  try { user = JSON.parse(params.get("user") || "null"); } catch {}
  return { valid, user };
}

function webUser(req) {
  const initData = req.get("x-telegram-init-data") || req.body?.initData || req.query?.initData || "";
  const parsed = parseInitData(initData);
  if (parsed.valid && parsed.user?.id) return { id: String(parsed.user.id), valid: true, admin: isAdminTelegramId(parsed.user.id), user: parsed.user };
  return { id: "demo", valid: false, admin: false, user: null };
}

function sendIndex(req, res) {
  res.sendFile(path.join(distDir, "index.html"), (err) => {
    if (err) {
      res.type("html").send("<html><body style='background:#050816;color:#eaf2ff;font-family:Arial;padding:24px'><h1>Pocket Signal</h1><p>Mini App build is not available yet. Run npm run build before deployment.</p></body></html>");
    }
  });
}

export function createServer() {
  const app = express();
  app.use(express.json({ limit: "128kb" }));
  app.use(rateLimit);
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });

  app.get("/health", (req, res) => res.json({ ok: true, service: "pocket-signal", dashboard: Boolean(cfg.DASHBOARD_URL), mongo: Boolean(cfg.MONGODB_URI) }));

  app.get("/api/bootstrap", async (req, res) => {
    try {
      const auth = webUser(req);
      const [assets, risk, alerts, strategies, trades] = await Promise.all([
        listAssets(),
        getRiskSettings(auth.id),
        listAlerts(auth.id),
        listStrategies(auth.id),
        listTrades(auth.id),
      ]);
      res.json({ ok: true, auth, assets, risk, alerts, strategies, trades, adminEnabled: cfg.ADMIN_TELEGRAM_IDS.length > 0, disclaimer: "Educational probability-based analysis only. Not financial advice. Trading can result in losses." });
    } catch (err) {
      log.error("api.bootstrap.error", { err: safeErr(err) });
      res.status(500).json({ ok: false, error: "Unable to load dashboard data." });
    }
  });

  app.get("/api/market", async (req, res) => {
    try {
      const symbol = String(req.query.symbol || "EURUSD");
      const timeframe = String(req.query.timeframe || "1m");
      const market = await getCandles(symbol, timeframe);
      const quote = currentQuote(market.candles);
      res.json({ ok: true, ...market, quote, candles: market.candles.slice(-80) });
    } catch (err) {
      log.error("api.market.error", { err: safeErr(err) });
      res.status(500).json({ ok: false, error: "Market data unavailable. Demo data may be used shortly." });
    }
  });

  app.get("/api/indicators", async (req, res) => {
    try {
      const market = await getCandles(String(req.query.symbol || "EURUSD"), String(req.query.timeframe || "1m"));
      const quote = currentQuote(market.candles);
      const indicators = computeIndicators(market.candles);
      res.json({ ok: true, demo: market.demo, rows: indicatorRows(indicators, quote.price), indicators, patterns: detectPatterns(market.candles) });
    } catch (err) {
      log.error("api.indicators.error", { err: safeErr(err) });
      res.status(500).json({ ok: false, error: "Indicator calculation failed." });
    }
  });

  app.post("/api/signal", async (req, res) => {
    try {
      const signal = await generateSignal({ symbol: req.body?.symbol || "EURUSD", timeframe: req.body?.timeframe || "1m", withAi: true });
      res.json({ ok: true, signal });
    } catch (err) {
      log.error("api.signal.error", { err: safeErr(err) });
      res.status(500).json({ ok: false, error: "Signal generation failed." });
    }
  });

  app.post("/api/backtest", async (req, res) => {
    try {
      const result = await runBacktest({ symbol: req.body?.symbol, timeframe: req.body?.timeframe, strategy: req.body?.strategy });
      res.json({ ok: true, result });
    } catch (err) {
      log.error("api.backtest.error", { err: safeErr(err) });
      res.status(500).json({ ok: false, error: "Backtest simulation failed." });
    }
  });

  app.post("/api/journal", async (req, res) => {
    try {
      const auth = webUser(req);
      const trade = await saveJournalTrade(auth.id, {
        asset: String(req.body?.asset || "EURUSD").slice(0, 16),
        direction: String(req.body?.direction || "NEUTRAL").slice(0, 16),
        entry: Number(req.body?.entry || 0),
        result: String(req.body?.result || "pending").slice(0, 24),
        notes: String(req.body?.notes || "").slice(0, 500),
        tags: Array.isArray(req.body?.tags) ? req.body.tags.slice(0, 8) : [],
      });
      res.json({ ok: true, trade });
    } catch (err) {
      log.error("api.journal.error", { err: safeErr(err) });
      res.status(500).json({ ok: false, error: "Journal save failed." });
    }
  });

  app.post("/api/alerts", async (req, res) => {
    try {
      const auth = webUser(req);
      const alert = await saveAlert(auth.id, req.body || {});
      res.json({ ok: true, alert });
    } catch (err) {
      log.error("api.alerts.error", { err: safeErr(err) });
      res.status(500).json({ ok: false, error: "Alert save failed." });
    }
  });

  app.get("/api/admin/status", async (req, res) => {
    try {
      const auth = webUser(req);
      if (!auth.admin) return res.status(403).json({ ok: false, error: "Admin access is disabled or not authorized." });
      res.json({ ok: true, stats: await adminStats() });
    } catch (err) {
      log.error("api.admin.error", { err: safeErr(err) });
      res.status(500).json({ ok: false, error: "Admin status unavailable." });
    }
  });

  app.use("/app/assets", express.static(path.join(distDir, "assets"), { immutable: true, maxAge: "1y" }));
  app.get("/app", sendIndex);
  app.get("/app/*splat", sendIndex);

  return app;
}
