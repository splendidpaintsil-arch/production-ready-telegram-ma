function avg(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export function sma(values, period) {
  if (values.length < period) return null;
  return avg(values.slice(-period));
}

export function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let current = avg(values.slice(0, period));
  for (const value of values.slice(period)) current = value * k + current * (1 - k);
  return current;
}

export function rsi(closes, period = 14) {
  if (closes.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i += 1) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

export function macd(closes) {
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  if (fast == null || slow == null) return null;
  const line = fast - slow;
  const recent = closes.slice(-35).map((_, i, arr) => {
    const sub = arr.slice(0, i + 1);
    const f = ema(sub, 12);
    const s = ema(sub, 26);
    return f != null && s != null ? f - s : null;
  }).filter((v) => v != null);
  const signal = ema(recent, 9) ?? line;
  return { line, signal, histogram: line - signal };
}

export function bollinger(closes, period = 20, mult = 2) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const middle = avg(slice);
  const variance = avg(slice.map((v) => Math.pow(v - middle, 2)));
  const sd = Math.sqrt(variance);
  return { upper: middle + mult * sd, middle, lower: middle - mult * sd, width: middle ? (4 * sd) / middle : 0 };
}

export function atr(candles, period = 14) {
  if (candles.length <= period) return null;
  const trs = [];
  for (let i = candles.length - period; i < candles.length; i += 1) {
    const c = candles[i];
    const prev = candles[i - 1];
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close)));
  }
  return avg(trs);
}

export function stochasticRsi(closes, period = 14) {
  if (closes.length < period * 2) return null;
  const values = [];
  for (let i = closes.length - period; i < closes.length; i += 1) {
    const sub = closes.slice(0, i + 1);
    const value = rsi(sub, period);
    if (value != null) values.push(value);
  }
  const current = values.at(-1);
  const low = Math.min(...values);
  const high = Math.max(...values);
  if (current == null || high === low) return null;
  return ((current - low) / (high - low)) * 100;
}

export function vwap(candles) {
  const recent = candles.slice(-30);
  const volume = recent.reduce((sum, c) => sum + (c.volume || 0), 0);
  if (!volume) return null;
  return recent.reduce((sum, c) => sum + ((c.high + c.low + c.close) / 3) * (c.volume || 0), 0) / volume;
}

export function fibonacci(candles) {
  const recent = candles.slice(-80);
  const high = Math.max(...recent.map((c) => c.high));
  const low = Math.min(...recent.map((c) => c.low));
  const range = high - low || 1;
  return { high, low, levels: [0.236, 0.382, 0.5, 0.618, 0.786].map((r) => ({ ratio: r, price: high - range * r })) };
}

export function supportResistance(candles) {
  const recent = candles.slice(-80);
  const lows = recent.map((c) => c.low).sort((a, b) => a - b);
  const highs = recent.map((c) => c.high).sort((a, b) => a - b);
  return {
    support: [lows[Math.floor(lows.length * 0.1)], lows[Math.floor(lows.length * 0.25)]].filter(Boolean),
    resistance: [highs[Math.floor(highs.length * 0.75)], highs[Math.floor(highs.length * 0.9)]].filter(Boolean),
  };
}

export function computeIndicators(candles) {
  const closes = candles.map((c) => c.close);
  const result = {
    rsi: rsi(closes),
    macd: macd(closes),
    ema9: ema(closes, 9),
    ema21: ema(closes, 21),
    sma20: sma(closes, 20),
    bollinger: bollinger(closes),
    stochasticRsi: stochasticRsi(closes),
    vwap: vwap(candles),
    atr: atr(candles),
    fibonacci: fibonacci(candles),
    zones: supportResistance(candles),
  };
  return result;
}

export function indicatorRows(indicators, price) {
  return [
    { name: "RSI", value: indicators.rsi?.toFixed(1) || "n/a", interpretation: indicators.rsi > 70 ? "overbought" : indicators.rsi < 30 ? "oversold" : "balanced", contribution: indicators.rsi > 55 ? 6 : indicators.rsi < 45 ? -6 : 0 },
    { name: "MACD", value: indicators.macd ? indicators.macd.histogram.toFixed(5) : "n/a", interpretation: indicators.macd?.histogram > 0 ? "bullish momentum" : "bearish momentum", contribution: indicators.macd?.histogram > 0 ? 8 : -8 },
    { name: "EMA", value: `${indicators.ema9?.toFixed(5) || "n/a"} / ${indicators.ema21?.toFixed(5) || "n/a"}`, interpretation: indicators.ema9 > indicators.ema21 ? "short trend up" : "short trend down", contribution: indicators.ema9 > indicators.ema21 ? 7 : -7 },
    { name: "SMA", value: indicators.sma20?.toFixed(5) || "n/a", interpretation: price > indicators.sma20 ? "price above average" : "price below average", contribution: price > indicators.sma20 ? 4 : -4 },
    { name: "Bollinger Bands", value: indicators.bollinger ? indicators.bollinger.width.toFixed(4) : "n/a", interpretation: indicators.bollinger?.width > 0.01 ? "expanded volatility" : "contained volatility", contribution: 0 },
    { name: "Stochastic RSI", value: indicators.stochasticRsi?.toFixed(1) || "n/a", interpretation: indicators.stochasticRsi > 80 ? "upper momentum extreme" : indicators.stochasticRsi < 20 ? "lower momentum extreme" : "mid range", contribution: indicators.stochasticRsi > 60 ? 4 : indicators.stochasticRsi < 40 ? -4 : 0 },
    { name: "VWAP", value: indicators.vwap?.toFixed(5) || "n/a", interpretation: indicators.vwap && price > indicators.vwap ? "above fair value" : "below fair value", contribution: indicators.vwap && price > indicators.vwap ? 3 : -3 },
    { name: "ATR", value: indicators.atr?.toFixed(5) || "n/a", interpretation: "volatility gauge", contribution: 0 },
  ];
}
