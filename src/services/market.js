import { cfg } from "../lib/config.js";
import { log, safeErr } from "../lib/log.js";

const cache = new Map();
let missingProviderLogged = false;

export const SUPPORTED_TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"];

export const ASSET_CATEGORIES = [
  {
    name: "Forex pairs",
    note: "Common FX symbols. Provider availability varies.",
    assets: [
      { symbol: "EURUSD", displayName: "EUR/USD", active: true, timeframes: SUPPORTED_TIMEFRAMES },
      { symbol: "GBPUSD", displayName: "GBP/USD", active: true, timeframes: SUPPORTED_TIMEFRAMES },
      { symbol: "USDJPY", displayName: "USD/JPY", active: true, timeframes: SUPPORTED_TIMEFRAMES },
    ],
  },
  {
    name: "Crypto",
    note: "Crypto symbols are requested from the configured provider.",
    assets: [
      { symbol: "BTCUSD", displayName: "Bitcoin", active: true, timeframes: SUPPORTED_TIMEFRAMES },
      { symbol: "ETHUSD", displayName: "Ethereum", active: true, timeframes: SUPPORTED_TIMEFRAMES },
      { symbol: "SOLUSD", displayName: "Solana", active: true, timeframes: SUPPORTED_TIMEFRAMES },
    ],
  },
  {
    name: "Commodities and indices",
    note: "These require provider support and may fall back to labeled demo data.",
    assets: [
      { symbol: "XAUUSD", displayName: "Gold", active: true, timeframes: SUPPORTED_TIMEFRAMES },
      { symbol: "US30", displayName: "Dow Jones 30", active: true, timeframes: SUPPORTED_TIMEFRAMES },
      { symbol: "NAS100", displayName: "Nasdaq 100", active: true, timeframes: SUPPORTED_TIMEFRAMES },
      { symbol: "SPX500", displayName: "S&P 500", active: true, timeframes: SUPPORTED_TIMEFRAMES },
    ],
  },
];

export const DEFAULT_ASSETS = ASSET_CATEGORIES.flatMap((category) => category.assets);

function timeframeToMs(timeframe) {
  return {
    "1m": 60000,
    "5m": 300000,
    "15m": 900000,
    "1h": 3600000,
    "4h": 14400000,
    "1d": 86400000,
  }[timeframe] || 60000;
}

function providerInterval(timeframe) {
  return {
    "1m": "1min",
    "5m": "5min",
    "15m": "15min",
    "1h": "1h",
    "4h": "4h",
    "1d": "1day",
  }[timeframe] || timeframe;
}

export function normalizeSymbol(symbol = "EURUSD") {
  return String(symbol || "EURUSD").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16) || "EURUSD";
}

export function validateMarketInput(symbol = "EURUSD", timeframe = "1m") {
  const cleanSymbol = normalizeSymbol(symbol);
  const cleanTimeframe = String(timeframe || "1m").toLowerCase();
  if (!/^[A-Z0-9]{3,16}$/.test(cleanSymbol)) {
    return { ok: false, error: "Please use a symbol like EURUSD, BTCUSD, XAUUSD, US30, NAS100, or SPX500." };
  }
  if (!SUPPORTED_TIMEFRAMES.includes(cleanTimeframe)) {
    return { ok: false, error: `Unsupported timeframe. Use one of: ${SUPPORTED_TIMEFRAMES.join(", ")}. Example: /signal BTCUSD 5m` };
  }
  return { ok: true, symbol: cleanSymbol, timeframe: cleanTimeframe };
}

function basePrice(symbol) {
  const seed = Array.from(symbol).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  if (symbol.includes("BTC")) return 67000 + seed;
  if (symbol.includes("ETH")) return 3500 + seed / 10;
  if (symbol.includes("SOL")) return 145 + seed / 100;
  if (symbol.includes("XAU")) return 2350 + seed / 20;
  if (symbol.includes("JPY")) return 155 + seed / 1000;
  if (symbol.includes("US30")) return 39000 + seed;
  if (symbol.includes("NAS")) return 18500 + seed;
  if (symbol.includes("SPX")) return 5200 + seed / 10;
  return 1.08 + (seed % 20) / 1000;
}

function demoCandles(symbol, timeframe, count = 160) {
  const seed = Array.from(symbol).reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const tfMs = timeframeToMs(timeframe);
  let price = basePrice(symbol);
  const now = Date.now();
  const candles = [];
  for (let i = count; i > 0; i -= 1) {
    const drift = Math.sin((count - i + seed) / 18) * price * 0.00035;
    const wave = Math.sin((count - i + seed) / 7) * price * 0.0016;
    const noise = Math.cos((count - i + seed) / 3) * price * 0.00055;
    const open = price;
    const close = Math.max(0.0001, open + drift + wave + noise);
    const high = Math.max(open, close) + Math.abs(wave) * 0.8 + price * 0.00045;
    const low = Math.min(open, close) - Math.abs(noise) * 0.8 - price * 0.00045;
    price = close;
    candles.push({
      time: new Date(now - i * tfMs).toISOString(),
      open,
      high,
      low,
      close,
      volume: 1000 + ((seed + i) % 900),
      source: "demo",
    });
  }
  return candles;
}

function normalizeProviderSymbol(symbol) {
  if (/^[A-Z]{6}$/.test(symbol) && symbol.endsWith("USD")) return `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
  return symbol;
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeCandle(row) {
  if (Array.isArray(row)) {
    const [time, open, high, low, close, volume] = row;
    return { time: new Date(time).toISOString(), open: asNumber(open), high: asNumber(high), low: asNumber(low), close: asNumber(close), volume: asNumber(volume) || 0, source: "provider" };
  }
  const rawTime = row.time || row.datetime || row.timestamp || row.t || row.date;
  const open = asNumber(row.open ?? row.o);
  const high = asNumber(row.high ?? row.h);
  const low = asNumber(row.low ?? row.l);
  const close = asNumber(row.close ?? row.c ?? row.price);
  const volume = asNumber(row.volume ?? row.v) || 0;
  return { time: rawTime ? new Date(rawTime).toISOString() : new Date().toISOString(), open, high, low, close, volume, source: "provider" };
}

function extractCandles(json) {
  const source = json?.candles || json?.data?.candles || json?.data?.values || json?.values || json?.ohlcv || json?.data || [];
  const rows = Array.isArray(source) ? source : [];
  return rows
    .map(normalizeCandle)
    .filter((c) => Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

async function fetchProvider(symbol, timeframe) {
  if (!cfg.MARKET_DATA_ENDPOINT || !cfg.MARKET_DATA_API_KEY) {
    if (!missingProviderLogged) {
      log.warn("market.provider.disabled", {
        endpointSet: Boolean(cfg.MARKET_DATA_ENDPOINT),
        keySet: Boolean(cfg.MARKET_DATA_API_KEY),
      });
      missingProviderLogged = true;
    }
    return null;
  }

  try {
    const url = new URL(cfg.MARKET_DATA_ENDPOINT);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("providerSymbol", normalizeProviderSymbol(symbol));
    url.searchParams.set("timeframe", timeframe);
    url.searchParams.set("interval", providerInterval(timeframe));
    url.searchParams.set("limit", "160");
    url.searchParams.set("outputsize", "160");

    log.info("market.call.start", { provider: "generic", symbol, timeframe, endpointSet: true, keySet: true });
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cfg.MARKET_DATA_API_KEY}`,
        "x-api-key": cfg.MARKET_DATA_API_KEY,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    if (!response.ok) throw new Error(json?.error?.message || json?.message || text.slice(0, 180) || `HTTP ${response.status}`);
    const candles = extractCandles(json);
    if (candles.length < 30) throw new Error("Provider returned too few candles");
    log.info("market.call.success", { provider: "generic", symbol, timeframe, candles: candles.length });
    return candles;
  } catch (err) {
    log.error("market.call.failure", { provider: "generic", symbol, timeframe, err: safeErr(err) });
    return null;
  }
}

export async function getCandles(symbol = "EURUSD", timeframe = "1m") {
  const valid = validateMarketInput(symbol, timeframe);
  const cleanSymbol = valid.ok ? valid.symbol : normalizeSymbol(symbol);
  const cleanTimeframe = valid.ok ? valid.timeframe : "1m";
  const key = `${cleanSymbol}:${cleanTimeframe}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < 30000) return hit.value;

  const provider = await fetchProvider(cleanSymbol, cleanTimeframe);
  const candles = provider || demoCandles(cleanSymbol, cleanTimeframe);
  const stats = marketStats(candles);
  const value = {
    symbol: cleanSymbol,
    timeframe: cleanTimeframe,
    candles,
    demo: !provider,
    delayed: !provider,
    dataMode: provider ? "provider market data" : "demo/delayed sample data",
    providerAvailable: Boolean(provider),
    ...stats,
  };
  cache.set(key, { ts: Date.now(), value });
  return value;
}

export function currentQuote(candles) {
  const last = candles.at(-1);
  const prev = candles.at(-2) || last;
  return { price: last.close, change: last.close - prev.close, changePct: prev.close ? ((last.close - prev.close) / prev.close) * 100 : 0 };
}

export function marketStats(candles = []) {
  const recent = candles.slice(-80);
  const quote = currentQuote(candles);
  const recentHigh = Math.max(...recent.map((c) => c.high));
  const recentLow = Math.min(...recent.map((c) => c.low));
  const first = recent.at(0) || candles.at(0);
  const trendDirection = first && quote.price > first.close * 1.002 ? "upward" : first && quote.price < first.close * 0.998 ? "downward" : "mixed/ranging";
  const volatility = quote.price ? ((recentHigh - recentLow) / quote.price) * 100 : 0;
  return { recentHigh, recentLow, trendDirection, rangeVolatilityPct: Number(volatility.toFixed(2)) };
}
