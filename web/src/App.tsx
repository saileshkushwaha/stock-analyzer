import React from "react";

import { useCallback, useEffect, useRef, useState } from "react";
import { connectStream, fetchHistory, searchSymbols } from "./api";
import { checkAlerts, useAccount } from "./store";
import type { AnalyzerResult, Candle, Quote } from "./types";
import { TickerTape } from "./components/TickerTape";
import { SearchBox } from "./components/SearchBox";
import { WatchList } from "./components/WatchList";
import { CandleChart, TIMEFRAMES, type ChartType, type Overlays } from "./components/CandleChart";
import { AnalyzerPanel } from "./components/AnalyzerPanel";
import { OrderTicket } from "./components/OrderTicket";
import { Positions } from "./components/Positions";
import { AlertsPanel } from "./components/AlertsPanel";
import { DepthPanel } from "./components/DepthPanel";
import { NewsFeed } from "./components/NewsFeed";
import { Screener } from "./components/Screener";
import { Heatmap } from "./components/Heatmap";

const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN"];
type RailTab = "trade" | "alerts" | "depth" | "news";
type CenterTab = "analyzer" | "screener";
type LeftTab = "list" | "heatmap";

export default function App() {
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST);
  const [selected, setSelected] = useState<string>("AAPL");
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [analysis, setAnalysis] = useState<AnalyzerResult | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [connected, setConnected] = useState(false);

  const [tfIndex, setTfIndex] = useState(0);
  const [chartType, setChartType] = useState<ChartType>("candles");
  const [overlays, setOverlays] = useState<Overlays>({ sma: true, bb: false, volume: true, rsi: false, macd: false });

  const [theme, setTheme] = useState<"dark" | "light">(
    () => (localStorage.getItem("sa.theme") as "dark" | "light") ?? "dark"
  );
  const [railTab, setRailTab] = useState<RailTab>("trade");
  const [centerTab, setCenterTab] = useState<CenterTab>("analyzer");
  const [leftTab, setLeftTab] = useState<LeftTab>("list");

  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const account = useAccount();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("sa.theme", theme);
  }, [theme]);

  // Load candles whenever symbol or timeframe changes
  useEffect(() => {
    let alive = true;
    setCandles([]);
    setAnalysis(null);
    const tf = TIMEFRAMES[tfIndex];
    fetchHistory(selected, tf.range, tf.interval).then((s) => alive && setCandles(s));
    return () => { alive = false; };
  }, [selected, tfIndex]);

  // Live stream
  useEffect(() => {
    const close = connectStream(watchlist, ({ quote, analysis: a }) => {
      setQuotes((prev) => ({ ...prev, [quote.symbol]: quote }));
      checkAlerts(quote);
      if (quote.symbol === selectedRef.current) {
        setAnalysis(a);
        setCandles((prev) => {
          if (!prev.length) return prev;
          const next = [...prev];
          const last = { ...next[next.length - 1] };
          if (quote.ts - last.t > 3 * 60_000) {
            next.push({ t: quote.ts, o: quote.price, h: quote.price, l: quote.price, c: quote.price, v: 0 });
            if (next.length > 500) next.shift();
          } else {
            last.c = quote.price;
            last.h = Math.max(last.h, quote.price);
            last.l = Math.min(last.l, quote.price);
            next[next.length - 1] = last;
          }
          return next;
        });
      }
    });
    const t = setTimeout(() => setConnected(true), 800);
    return () => { close(); clearTimeout(t); };
  }, [watchlist]);

  const addSymbol = useCallback(async (hit: { symbol: string }) => {
    const sym = hit.symbol.toUpperCase();
    setWatchlist((prev) => (prev.includes(sym) ? prev : [...prev, sym]));
    setSelected(sym);
  }, []);

  const removeSymbol = useCallback((sym: string) => {
    setWatchlist((prev) => prev.filter((s) => s !== sym));
  }, []);

  // keyboard: "/" focuses search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && (e.target as HTMLElement)?.tagName !== "INPUT") {
        e.preventDefault();
        (document.getElementById("sym-search") as HTMLInputElement | null)?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const quote = quotes[selected];
  const up = (quote?.change ?? 0) >= 0;
  const equity =
    account.cash +
    account.positions.reduce((s, p) => s + p.qty * (quotes[p.symbol]?.price ?? p.avgPrice), 0);

  const toggleOverlay = (k: keyof Overlays) => setOverlays((o) => ({ ...o, [k]: !o[k] }));

  return (
    <div className="app">
      <TickerTape quotes={Object.values(quotes)} />

      <header className="header">
        <div className="brand">
          <span className="brand-mark">▲</span>
          <span className="brand-name">Stock Analyzer</span>
          <span className={`conn ${connected ? "on" : "off"}`}>
            {connected ? "● live" : "○ connecting"}
          </span>
        </div>
        <SearchBox onPick={addSymbol} search={searchSymbols} />
        <div className="header-right">
          <span className="equity-chip" title="Paper account equity">
            ${equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <button className="theme-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </header>

      <main className="layout">
        <aside className="left-col">
          <div className="tab-row">
            <button className={leftTab === "list" ? "active" : ""} onClick={() => setLeftTab("list")}>List</button>
            <button className={leftTab === "heatmap" ? "active" : ""} onClick={() => setLeftTab("heatmap")}>Heatmap</button>
          </div>
          {leftTab === "list" ? (
            <WatchList watchlist={watchlist} quotes={quotes} selected={selected} onSelect={setSelected} onRemove={removeSymbol} />
          ) : (
            <Heatmap quotes={quotes} onSelect={setSelected} />
          )}
        </aside>

        <section className="center-col">
          <div className="chart-card card">
            <div className="chart-head">
              <div className="chart-title">
                <h1>{selected}</h1>
                {quote && (
                  <>
                    <span className={`price ${up ? "up" : "down"}`}>{quote.price.toFixed(2)}</span>
                    <span className={`chip ${up ? "up" : "down"}`}>
                      {up ? "▲" : "▼"} {quote.changePercent.toFixed(2)}%
                    </span>
                    {quote.source === "simulated" && <span className="chip sim">demo</span>}
                  </>
                )}
              </div>
              <div className="toolbar">
                <div className="seg">
                  {TIMEFRAMES.map((tf, i) => (
                    <button key={tf.label} className={tfIndex === i ? "active" : ""} onClick={() => setTfIndex(i)}>
                      {tf.label}
                    </button>
                  ))}
                </div>
                <div className="seg">
                  <button className={chartType === "candles" ? "active" : ""} onClick={() => setChartType("candles")}>🕯</button>
                  <button className={chartType === "line" ? "active" : ""} onClick={() => setChartType("line")}>📈</button>
                </div>
                <div className="seg">
                  {(["sma", "bb", "volume", "rsi", "macd"] as const).map((k) => (
                    <button key={k} className={overlays[k] ? "active" : ""} onClick={() => toggleOverlay(k)}>
                      {k.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <CandleChart candles={candles} chartType={chartType} overlays={overlays} up={up} symbol={selected} />
          </div>

          <div className="tab-row center-tabs">
            <button className={centerTab === "analyzer" ? "active" : ""} onClick={() => setCenterTab("analyzer")}>Analyzer</button>
            <button className={centerTab === "screener" ? "active" : ""} onClick={() => setCenterTab("screener")}>Screener</button>
          </div>
          {centerTab === "analyzer" ? (
            <AnalyzerPanel analysis={analysis} />
          ) : (
            <Screener symbols={watchlist} />
          )}
        </section>

        <aside className="rail">
          <div className="tab-row">
            <button className={railTab === "trade" ? "active" : ""} onClick={() => setRailTab("trade")}>Trade</button>
            <button className={railTab === "alerts" ? "active" : ""} onClick={() => setRailTab("alerts")}>Alerts</button>
            <button className={railTab === "depth" ? "active" : ""} onClick={() => setRailTab("depth")}>DOM</button>
            <button className={railTab === "news" ? "active" : ""} onClick={() => setRailTab("news")}>News</button>
          </div>
          {railTab === "trade" && (
            <>
              <OrderTicket quote={quote ?? null} />
              <Positions quotes={quotes} />
            </>
          )}
          {railTab === "alerts" && <AlertsPanel quote={quote ?? null} />}
          {railTab === "depth" && <DepthPanel quote={quote ?? null} />}
          {railTab === "news" && <NewsFeed symbol={selected} />}
        </aside>
      </main>

      <footer className="footer muted">
        Paper trading · {quote?.source === "simulated" ? "demo feed" : "Yahoo Finance live"} · analyzer
        signals are informational, not investment advice.
      </footer>
    </div>
  );
}
