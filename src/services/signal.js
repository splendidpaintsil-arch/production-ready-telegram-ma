import { getCandles, currentQuote } from "./market.js";
import { computeIndicators, indicatorRows } from "./indicators.js";
import { detectPatterns } from "./patterns.js";
import { explainSignalWithAI } from "../lib/ai.js";

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function fmt(n) { return Number(n).toFixed(Math.abs(n) >= 100 ? 2 : 5); }

export async function generateSignal({ symbol = "EURUSD", timeframe = "1m", withAi = true } = {}) {
  const market = await getCandles(symbol, timeframe);
  const quote = currentQuote(market.candles);
  const indicators = computeIndicators(market.candles);
  const rows = indicatorRows(indicators, quote.price);
  const patterns = detectPatterns(market.candles);
  let score = rows.reduce((sum, r) => sum + (Number(r.contribution) || 0), 0);
  score += patterns.reduce((sum, p) => sum + (Number(p.confidenceContribution) || 0), 0);
  const emaTrend = indicators.ema9 && indicators.ema21 ? indicators.ema9 - indicators.ema21 : 0;
  const volatilityPct = indicators.atr ? (indicators.atr / quote.price) * 100 : 0.2;
  if (volatilityPct > 0.7) score *= 0.82;
  const direction = Math.abs(score) < 8 ? "NEUTRAL" : score > 0 ? "BUY" : "SELL";
  const confidence = clamp(50 + Math.abs(score) * 1.2, 50, 88);
  const probability = clamp(confidence + (direction === "NEUTRAL" ? -8 : 0), 45, 86);
  const riskLevel = volatilityPct > 0.9 ? "high" : volatilityPct > 0.45 ? "medium" : "controlled";
  const expiration = timeframe === "1m" ? "2 to 5 candles" : timeframe === "5m" ? "1 to 3 candles" : "1 to 2 candles";
  const rationale = [
    `Trend: ${emaTrend >= 0 ? "short-term upward pressure" : "short-term downward pressure"}`,
    `Momentum: RSI ${indicators.rsi?.toFixed(1) || "n/a"}, MACD ${indicators.macd?.histogram > 0 ? "positive" : "negative"}`,
    `Patterns: ${patterns.length ? patterns.map((p) => p.name).join(", ") : "no strong pattern confirmation"}`,
    `Volatility: ${volatilityPct.toFixed(2)}% ATR-relative, risk ${riskLevel}`,
  ];
  const signal = {
    symbol: market.symbol,
    timeframe: market.timeframe,
    price: quote.price,
    direction,
    confidence: Math.round(confidence),
    probability: Math.round(probability),
    expectedStrength: confidence > 75 ? "strong" : confidence > 62 ? "moderate" : "weak or mixed",
    riskLevel,
    volatilityScore: Number(volatilityPct.toFixed(2)),
    suggestedExpirationWindow: expiration,
    entrySuggestion: direction === "NEUTRAL" ? "Wait for cleaner confirmation" : `Near ${fmt(quote.price)} after candle confirmation`,
    support: indicators.zones.support,
    resistance: indicators.zones.resistance,
    indicators: rows,
    patterns,
    rationale,
    demo: market.demo,
    disclaimer: "Educational probability-based analysis only. Not financial advice. No guaranteed profits. Past performance does not predict future results.",
    generatedAt: new Date().toISOString(),
  };
  if (withAi) signal.aiExplanation = await explainSignalWithAI(signal, { symbol: market.symbol, timeframe: market.timeframe });
  return signal;
}

export function formatSignal(signal) {
  return [
    `Pocket Signal: ${signal.symbol} ${signal.timeframe}`,
    signal.demo ? "Data mode: demo/delayed sample data" : "Data mode: provider market data",
    `Price: ${fmt(signal.price)}`,
    `Analytical label: ${signal.direction}`,
    `Confidence: ${signal.confidence}% | Probability band: ${signal.probability}%`,
    `Expiration window: ${signal.suggestedExpirationWindow}`,
    `Risk: ${signal.riskLevel} | Volatility: ${signal.volatilityScore}%`,
    `Entry context: ${signal.entrySuggestion}`,
    "Why: " + signal.rationale.join("; "),
    signal.aiExplanation ? `AI explanation: ${signal.aiExplanation}` : "AI explanation: disabled or unavailable; technical scoring shown above.",
    signal.disclaimer,
  ].join("\n");
}
