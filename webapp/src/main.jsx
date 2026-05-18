import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

const tg = window.Telegram?.WebApp;
const screens = ["Dashboard", "Chart", "Signal Engine", "Indicators", "Strategy Builder", "Backtesting", "Trade Journal", "Risk Settings", "Alerts", "Admin"];
const fallbackTimeframes = ["1m", "5m", "15m", "1h", "4h", "1d"];

function initialParam(name, fallback) {
  return new URLSearchParams(window.location.search).get(name) || fallback;
}

function api(path, options = {}) {
  return fetch(path, { ...options, headers: { "Content-Type": "application/json", "x-telegram-init-data": tg?.initData || "", ...(options.headers || {}) } }).then(async (r) => {
    const json = await r.json().catch(() => ({}));
    if (!r.ok || json.ok === false) throw new Error(json.error || "Request failed");
    return json;
  });
}

function Card({ title, children }) {
  return <section className="glass rounded-3xl p-4 neon"><div className="text-electric text-xs uppercase tracking-[.22em] mb-2">{title}</div>{children}</section>;
}

function State({ loading, error, empty, children }) {
  if (loading) return <div className="glass rounded-3xl p-5 animate-pulse text-slate-300">Loading live dashboard data...</div>;
  if (error) return <div className="glass rounded-3xl p-5 border border-bear/40 text-bear">{error}</div>;
  if (empty) return <div className="glass rounded-3xl p-5 text-slate-300">No data yet. Choose an asset and timeframe to begin.</div>;
  return children;
}

function ChartViz({ candles = [] }) {
  const slice = candles.slice(-54);
  const highs = slice.map((c) => c.high);
  const lows = slice.map((c) => c.low);
  const max = Math.max(...highs, 1);
  const min = Math.min(...lows, 0);
  return <div className="glass rounded-3xl p-4 h-72 overflow-hidden"><div className="h-48 flex items-end justify-between border-b border-white/10">{slice.map((c, i) => { const h = Math.max(18, ((c.high - c.low) / (max - min || 1)) * 170); return <span key={i} className={`candle ${c.close >= c.open ? "bg-bull" : "bg-bear"}`} style={{ height: h }} title={`${c.open} ${c.close}`} />; })}</div><div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-300"><span>EMA trend</span><span>Support zone</span><span>Pattern markers</span></div></div>;
}

function App() {
  const [screen, setScreen] = useState(initialParam("screen", "Dashboard"));
  const [asset, setAsset] = useState(initialParam("symbol", "EURUSD").toUpperCase());
  const [timeframe, setTimeframe] = useState(initialParam("timeframe", "1m"));
  const [query, setQuery] = useState("");
  const [boot, setBoot] = useState(null);
  const [market, setMarket] = useState(null);
  const [signal, setSignal] = useState(null);
  const [indicators, setIndicators] = useState(null);
  const [backtest, setBacktest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    tg?.ready();
    tg?.expand();
    tg?.disableVerticalSwipes?.();
    const p = tg?.themeParams || {};
    if (p.bg_color) document.body.style.backgroundColor = p.bg_color;
    api("/api/bootstrap").then(setBoot).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const [m, i, s] = await Promise.all([
        api(`/api/market?symbol=${encodeURIComponent(asset)}&timeframe=${encodeURIComponent(timeframe)}`),
        api(`/api/indicators?symbol=${encodeURIComponent(asset)}&timeframe=${encodeURIComponent(timeframe)}`),
        api("/api/signal", { method: "POST", body: JSON.stringify({ symbol: asset, timeframe }) }),
      ]);
      setMarket(m);
      setIndicators(i);
      setSignal(s.signal);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [asset, timeframe]);

  async function runBt() {
    setLoading(true);
    try {
      const r = await api("/api/backtest", { method: "POST", body: JSON.stringify({ symbol: asset, timeframe }) });
      setBacktest(r.result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const assets = boot?.assets || [];
  const timeframes = boot?.timeframes || fallbackTimeframes;
  const filteredAssets = useMemo(() => {
    const q = query.trim().toUpperCase();
    const source = assets.length ? assets : [{ symbol: "EURUSD" }, { symbol: "BTCUSD" }, { symbol: "XAUUSD" }, { symbol: "NAS100" }];
    return source.filter((a) => !q || a.symbol.includes(q) || String(a.displayName || "").toUpperCase().includes(q)).slice(0, 16);
  }, [assets, query]);
  const quote = market?.quote;
  const candles = market?.candles || [];
  const risk = boot?.risk || {};
  const journalStats = useMemo(() => ({ total: boot?.trades?.length || 0, wins: (boot?.trades || []).filter((t) => String(t.result).toLowerCase().includes("win")).length }), [boot]);

  return <main className="safe max-w-5xl mx-auto"><header className="mb-5"><div className="text-3xl font-black tracking-tight">Pocket Signal</div><p className="text-slate-300 mt-1">Live chart analysis when provider data is available. Demo/sample data is labeled. Not financial advice.</p></header><nav className="flex gap-2 overflow-x-auto pb-3 mb-4">{screens.map((s) => <button key={s} onClick={() => setScreen(s)} className={`tap px-4 rounded-2xl whitespace-nowrap ${screen === s ? "bg-electric text-navy font-bold" : "glass text-slate-200"}`}>{s}</button>)}</nav><section className="glass rounded-3xl p-4 mb-4"><div className="grid gap-3 md:grid-cols-3"><input className="tap rounded-2xl px-3 bg-white/10 border border-white/10" placeholder="Search EURUSD, BTCUSD, XAUUSD..." value={query} onChange={(e) => setQuery(e.target.value)} /><select className="tap rounded-2xl px-3 bg-white/10 border border-white/10" value={asset} onChange={(e) => setAsset(e.target.value)}>{filteredAssets.map((a) => <option key={a.symbol}>{a.symbol}</option>)}</select><select className="tap rounded-2xl px-3 bg-white/10 border border-white/10" value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>{timeframes.map((t) => <option key={t}>{t}</option>)}</select></div></section><State loading={loading && !market} error={error} empty={!market}>{screen === "Dashboard" && <div className="grid md:grid-cols-2 gap-4"><Card title="Current price"><div className="text-4xl font-black">{quote?.price?.toFixed(asset.includes("BTC") || asset.includes("US30") || asset.includes("NAS") || asset.includes("SPX") ? 2 : 5)}</div><div className={quote?.changePct >= 0 ? "text-bull" : "text-bear"}>{quote?.changePct?.toFixed(2)}% latest candle</div><p className="text-sm text-slate-300 mt-3">Trend: {market?.trendDirection}. Volatility: {signal?.volatilityScore}%.</p></Card><Card title="Latest signal"><div className={signal?.direction === "BUY" ? "text-bull text-3xl font-black" : signal?.direction === "SELL" ? "text-bear text-3xl font-black" : "text-slate-200 text-3xl font-black"}>{signal?.direction}</div><p>{signal?.confidence}% confidence, {signal?.probability}% estimated probability, {signal?.riskLevel} risk.</p><p className="text-xs text-slate-400 mt-2">{signal?.disclaimer}</p></Card><Card title="Risk status"><p>Risk per idea: {risk.riskPercent}%</p><p>Daily loss guard: {risk.maxDailyLoss}%</p><p>Cooldown: {risk.cooldownMinutes} minutes</p></Card><Card title="Data mode"><p>{market?.demo ? "Demo/delayed sample data, not live" : "Provider market data"}</p><p className="text-sm text-slate-400">Availability depends on MARKET_DATA_ENDPOINT provider support.</p></Card></div>}{screen === "Chart" && <div className="space-y-4"><Card title="Live chart"><div className="flex items-end justify-between"><div><div className="text-2xl font-black">{asset} {timeframe}</div><p className="text-slate-300">Latest: {quote?.price?.toFixed(asset.includes("BTC") ? 2 : 5)} | Trend: {market?.trendDirection}</p></div><span className={market?.demo ? "text-bear text-sm" : "text-bull text-sm"}>{market?.demo ? "Demo data" : "Live provider"}</span></div></Card><ChartViz candles={candles} /><Card title="Signal panel"><p>{signal?.direction} with {signal?.confidence}% confidence.</p><p>Support: {signal?.support?.map((v) => Number(v).toFixed(asset.includes("BTC") ? 2 : 5)).join(", ") || "n/a"}</p><p>Resistance: {signal?.resistance?.map((v) => Number(v).toFixed(asset.includes("BTC") ? 2 : 5)).join(", ") || "n/a"}</p></Card></div>}{screen === "Signal Engine" && <Card title="Signal engine"><div className="text-5xl font-black mb-2">{signal?.direction}</div><p>Confidence: {signal?.confidence}% | Probability: {signal?.probability}%</p><p>Entry: {signal?.entrySuggestion}</p><p>Validity: {signal?.suggestedExpirationWindow}</p><p>Risk: {signal?.riskLevel}</p><p className="mt-3 text-slate-300">{signal?.aiExplanation || signal?.rationale?.join(" ")}</p><p className="text-xs text-slate-400 mt-3">{signal?.disclaimer}</p></Card>}{screen === "Indicators" && <div className="grid md:grid-cols-2 gap-3">{(indicators?.rows || []).map((r) => <Card key={r.name} title={r.name}><p className="text-2xl font-bold">{r.value}</p><p>{r.interpretation}</p><p className="text-sm text-slate-400">Contribution: {r.contribution}</p></Card>)}</div>}{screen === "Strategy Builder" && <Card title="Strategy builder"><p>Combine RSI, MACD, EMA, SMA, Bollinger Bands, Stochastic RSI, VWAP, ATR, Fibonacci, support/resistance, and candlestick conditions.</p><button className="tap mt-4 px-4 rounded-2xl bg-violet font-bold" onClick={runBt}>Run simulation</button></Card>}{screen === "Backtesting" && <Card title="Backtesting"><button className="tap px-4 rounded-2xl bg-electric text-navy font-bold" onClick={runBt}>Run bounded educational simulation</button>{backtest && <div className="mt-4 space-y-1"><p>Win rate: {backtest.winRate}%</p><p>Drawdown: {backtest.drawdown}%</p><p>Profit factor: {backtest.profitFactor}</p><p>Sharpe-like ratio: {backtest.sharpeLikeRatio}</p><p>{backtest.disclaimer}</p></div>}</Card>}{screen === "Trade Journal" && <Card title="Trade journal"><p>Demo entries: {journalStats.total}</p><p>Wins logged: {journalStats.wins}</p><div className="h-24 mt-4 rounded-2xl bg-gradient-to-r from-bear/30 via-violet/30 to-bull/30" /><p className="text-sm text-slate-400 mt-3">Journal entries are stored in MongoDB when configured, otherwise in memory.</p></Card>}{screen === "Risk Settings" && <Card title="Risk settings"><p>Risk percentage: {risk.riskPercent}%</p><p>Max daily loss: {risk.maxDailyLoss}%</p><p>Consecutive loss stop: {risk.consecutiveLossStop}</p><p>Cooldown period: {risk.cooldownMinutes} minutes</p><p>Volatility-based adjustment and emotional trading alerts are enabled by default.</p></Card>}{screen === "Alerts" && <Card title="Alerts"><p>Configured alerts: {boot?.alerts?.length || 0}</p><p>Supported: confidence thresholds, patterns, volatility spikes, cooldowns, risk-limit events, and daily summaries.</p></Card>}{screen === "Admin" && <Card title="Admin"><p>{boot?.auth?.admin ? "Authorized admin context detected." : "Admin requires a Telegram ID in ADMIN_TELEGRAM_IDS."}</p><p>User count, active alerts, asset status, recent signal logs, health, and asset enable/disable controls are protected.</p></Card>}</State></main>;
}

createRoot(document.getElementById("root")).render(<App />);
