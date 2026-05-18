function body(c) { return Math.abs(c.close - c.open); }
function range(c) { return Math.max(0.0000001, c.high - c.low); }
function upperWick(c) { return c.high - Math.max(c.open, c.close); }
function lowerWick(c) { return Math.min(c.open, c.close) - c.low; }
function bullish(c) { return c.close > c.open; }
function bearish(c) { return c.close < c.open; }

function pattern(name, bias, contribution, explanation) {
  return { name, bias, confidenceContribution: contribution, tooltip: explanation };
}

export function detectPatterns(candles) {
  const out = [];
  if (candles.length < 3) return out;
  const c = candles.at(-1);
  const p = candles.at(-2);
  const pp = candles.at(-3);

  if (body(c) / range(c) < 0.12) out.push(pattern("Doji", "neutral", 0, "Small body shows indecision and lower follow-through confidence."));
  if (lowerWick(c) > body(c) * 2 && upperWick(c) < body(c) * 1.2 && bullish(c)) out.push(pattern("Hammer", "bullish", 8, "Long lower wick suggests buyers defended lower prices."));
  if (upperWick(c) > body(c) * 2 && lowerWick(c) < body(c) * 1.2 && bearish(c)) out.push(pattern("Shooting Star", "bearish", -8, "Long upper wick suggests rejection from higher prices."));
  if (bullish(c) && bearish(p) && c.close > p.open && c.open < p.close) out.push(pattern("Bullish Engulfing", "bullish", 10, "Current candle fully overpowers the previous bearish body."));
  if (bearish(c) && bullish(p) && c.open > p.close && c.close < p.open) out.push(pattern("Bearish Engulfing", "bearish", -10, "Current candle fully overpowers the previous bullish body."));
  if (bearish(pp) && body(p) / range(p) < 0.35 && bullish(c) && c.close > (pp.open + pp.close) / 2) out.push(pattern("Morning Star", "bullish", 9, "Three-candle reversal structure after weakness."));
  if (bullish(pp) && body(p) / range(p) < 0.35 && bearish(c) && c.close < (pp.open + pp.close) / 2) out.push(pattern("Evening Star", "bearish", -9, "Three-candle reversal structure after strength."));
  if ([pp, p, c].every(bullish) && c.close > p.close && p.close > pp.close) out.push(pattern("Three White Soldiers", "bullish", 11, "Series of strong bullish closes shows trend pressure."));
  if ([pp, p, c].every(bearish) && c.close < p.close && p.close < pp.close) out.push(pattern("Three Black Crows", "bearish", -11, "Series of bearish closes shows sustained selling pressure."));
  if (lowerWick(c) > range(c) * 0.55 || upperWick(c) > range(c) * 0.55) out.push(pattern("Pin Bar", lowerWick(c) > upperWick(c) ? "bullish" : "bearish", lowerWick(c) > upperWick(c) ? 5 : -5, "Long wick shows rejection of one side of the candle."));
  if (c.high < p.high && c.low > p.low) out.push(pattern("Inside Bar", "neutral", 0, "Compression candle; breakout direction is not confirmed yet."));

  return out;
}
