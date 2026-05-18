const base = (process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");
const MINI_APP_URL = base ? `${base}/app` : "";

function normalizeDashboardUrl(value = "") {
  const clean = String(value || "").replace(/\/+$/, "");
  if (!clean) return "";
  return clean.endsWith("/app") ? clean : `${clean}/app`;
}

function adminIds() {
  return String(process.env.ADMIN_TELEGRAM_IDS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export const cfg = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
  PORT: Number(process.env.PORT || 3000),
  MONGODB_URI: process.env.MONGODB_URI || "",
  COOKMYBOTS_AI_ENDPOINT: (process.env.COOKMYBOTS_AI_ENDPOINT || "https://api.cookmybots.com/api/ai").replace(/\/+$/, ""),
  COOKMYBOTS_AI_KEY: process.env.COOKMYBOTS_AI_KEY || "",
  AI_TIMEOUT_MS: Number(process.env.AI_TIMEOUT_MS || 600000),
  AI_MAX_RETRIES: Number(process.env.AI_MAX_RETRIES || 2),
  CONCURRENCY: Number(process.env.CONCURRENCY || 20),
  MARKET_DATA_ENDPOINT: (process.env.MARKET_DATA_ENDPOINT || "").replace(/\/+$/, ""),
  MARKET_DATA_API_KEY: process.env.MARKET_DATA_API_KEY || "",
  WEBAPP_PUBLIC_URL: normalizeDashboardUrl(process.env.WEBAPP_PUBLIC_URL || ""),
  MINI_APP_URL,
  DASHBOARD_URL: normalizeDashboardUrl(process.env.WEBAPP_PUBLIC_URL || "") || MINI_APP_URL,
  ADMIN_TELEGRAM_IDS: adminIds(),
  NODE_ENV: process.env.NODE_ENV || "development",
};

export function envHealth() {
  return {
    TELEGRAM_BOT_TOKEN: Boolean(cfg.TELEGRAM_BOT_TOKEN),
    MONGODB_URI: Boolean(cfg.MONGODB_URI),
    COOKMYBOTS_AI_ENDPOINT: Boolean(cfg.COOKMYBOTS_AI_ENDPOINT),
    COOKMYBOTS_AI_KEY: Boolean(cfg.COOKMYBOTS_AI_KEY),
    MARKET_DATA_ENDPOINT: Boolean(cfg.MARKET_DATA_ENDPOINT),
    MARKET_DATA_API_KEY: Boolean(cfg.MARKET_DATA_API_KEY),
    WEBAPP_PUBLIC_URL: Boolean(cfg.WEBAPP_PUBLIC_URL),
    ADMIN_TELEGRAM_IDS: cfg.ADMIN_TELEGRAM_IDS.length > 0,
    DASHBOARD_URL: Boolean(cfg.DASHBOARD_URL),
  };
}

export function isAdminTelegramId(id) {
  if (!id || cfg.ADMIN_TELEGRAM_IDS.length === 0) return false;
  return cfg.ADMIN_TELEGRAM_IDS.includes(String(id));
}
