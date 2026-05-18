import { cfg } from "../lib/config.js";
import { log, safeErr } from "../lib/log.js";

const cache = new Map();
export const DEFAULT_ASSETS = [
  { symbol: "EURUSD", displayName: "EUR/USD", active: true, timeframes: ["1m", "5m", "15m"] },
  { symbol: "GBPUSD", displayName: "GBP/USD", active: true, timeframes: ["1m", "5m", "15m"] },
  { symbol: "BTCUSD", displayName: "Bitcoin", active: true, timeframes: ["1m", "5m", "15m", "1h"] },
  { symbol: "ETHUSD", displayName: "Ethereum", active: true, timeframes: ["1m", "5m", "15m", "1h"] },
  { symbol: "XAUUSD", displayName: "Gold", active: true, timeframes: ["5m", "15m", "1h"] },
];

function interval(timeframe) {
  return { "1m": "1min", "5m": "5min", "15m": "15min", "1h": "1h" }[timeframe] || "1min";
}

function normalizeSymbol(symbol = "EURUSD") {
  return String(symbol || "EURUSD").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "EURUSD";
}

function demoCandles(symbol, timeframe, count = 120) {
  const seed = Array.from(symbol).reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const tfMs = timeframe === "1h" ? 3600000 : Number(timeframe.replace("m", "")) * 60000 || 60000;
  let price = symbol.includes("BTC") ? 67000 : symbol.includes("ETH") ? 3500 : symbol.includes("XAU") ? 2350 : 1.08 + (seed % 20) / 1000;
  const now = Date.now();
  const candles = [];
  for (let i = count; i > 0; i -= 1) {
    const wave = Math.sin((count - i + seed) / 7) * price * 0.0018;
    const noise = Math.cos((count - i + seed) / 3) * price * 0.0007;
    const open = price;
    const close = Math.max(0.0001, open + wave + noise);
    const high = Math.max(open, close) + Math.abs(wave) * 0.7 + price * 0.0005;
    const low = Math.min(open, close) - Math.abs(noise) * 0.7 - price * 0.0005;
    price = close;
    candles.push({ time: new Date(now - i * tfMs).toISOString(), open, high, low, close, volume: 1000 + ((seed + i) % 700), source: "demo" });
  }
  return candles;
}

async function fetchProvider(symbol, timeframe) {
  if (!cfg.MARKET_DATA_API_KEY) return null;
  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", symbol.includes("USD") && symbol.length === 6 ? `${symbol.slice(0, 3)}/${symbol.slice(3)}` : symbol);
  url.searchParams.set("interval", interval(timeframe));
  url.searchParams.set("outputsize", "120");
  url.searchParams.set("apikey", cfg.MARKET_DATA_API_KEY);
  try {
    log.info("market.call.start", { provider: "generic", symbol, timeframe, keySet: true });
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const json = await response.json();
    if (!response.ok || !Array.isArray(json.values)) throw new Error(json.message || `HTTP ${response.status}`);
    const candles = json.values.reverse().map((v) => ({
      time: v.datetime,
      open: Number(v.open),
      high: Number(v.high),
      low: Number(v.low),
      close: Number(v.close),
      volume: Number(v.volume || 0),
      source: "provider",
    })).filter((c) => Number.isFinite(c.close));
    log.info("market.call.success", { provider: "generic", symbol, timeframe, candles: candles.length });
    return candles.length >= 30 ? candles : null;
  } catch (err) {
    log.error("market.call.failure", { provider: "generic", symbol, timeframe, err: safeErr(err) });
    return null;
  }
}

export async function getCandles(symbol = "EURUSD", timeframe = "1m") {
  const cleanSymbol = normalizeSymbol(symbol);
  const cleanTimeframe = ["1m", "5m", "15m", "1h"].includes(timeframe) ? timeframe : "1m";
  const key = `${cleanSymbol}:${cleanTimeframe}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < 30000) return hit.value;
  const provider = await fetchProvider(cleanSymbol, cleanTimeframe);
  const candles = provider || demoCandles(cleanSymbol, cleanTimeframe);
  const value = { symbol: cleanSymbol, timeframe: cleanTimeframe, candles, demo: !provider, delayed: !provider };
  cache.set(key, { ts: Date.now(), value });
  return value;
}

export function currentQuote(candles) {
  const last = candles.at(-1);
  const prev = candles.at(-2) || last;
  return { price: last.close, change: last.close - prev.close, changePct: prev.close ? ((last.close - prev.close) / prev.close) * 100 : 0 };
}
