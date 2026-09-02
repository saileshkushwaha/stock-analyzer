import React from "react";

import { useCallback, useEffect, useRef, useState } from "react";
import { connectStream, fetchHistory, searchSymbols } from "./api";
import { checkAlerts, recordEquity, useAccount } from "./store";
import { useSession } from "./session";
import { useHashRoute, type Route } from "./router";
import type { AnalyzerResult, Candle, Quote } from "./types";
import { TickerTape } from "./components/TickerTape";
import { SearchBox } from "./components/SearchBox";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Markets } from "./pages/Markets";
import { Portfolio } from "./pages/Portfolio";
import { Tools } from "./pages/Tools";
import { SettingsPage, loadSettings, type Settings } from "./pages/Settings";
import type { ChartType, Overlays } from "./components/CandleChart";

const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN"];
const NAV: { route: Route; icon: string; label: string }[] = [
  { route: "dashboard", icon: "▦", label: "Dashboard" },
  { route: "markets", icon: "📈", label: "Markets" },
  { route: "portfolio", icon: "▤", label: "Portfolio" },
  { route: "tools", icon: "🛠", label: "Tools" },
  { route: "settings", icon: "⚙", label: "Settings" },
];

export default function App() {
  const session = useSession();
  const [route, go] = useHashRoute();

  // market state (shared across pages)
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST);
  const [selected, setSelected] = useState<string>("AAPL");
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [analysis, setAnalysis] = useState<AnalyzerResult | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [connected, setConnected] = useState(false);
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings());
  const [tfIndex, setTfIndex] = useState(0);
  const [chartType, setChartType] = useState<ChartType>(settings.defaultChart);
  const [overlays, setOverlays] = useState<Overlays>(settings.defaultOverlays);
  const [theme, setTheme] = useState<"dark" | "light">(
    () => (localStorage.getItem("sa.theme") as "dark" | "light") ?? "dark"
  );
  const [navOpen, setNavOpen] = useState(false);

  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const account = useAccount();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("sa.theme", theme);
  }, [theme]);

  const setSettings = useCallback((s: Settings) => {
    setSettingsState(s);
    setChartType(s.defaultChart);
    setOverlays(s.defaultOverlays);
  }, []);

  // candles per symbol+timeframe
  useEffect(() => {
    if (!session) return;
    let alive = true;
    setCandles([]);
    setAnalysis(null);
    const tf = ["1d:5m", "5d:15m", "1mo:1h", "6mo:1d", "1y:1wk"][tfIndex].split(":");
    fetchHistory(selected, tf[0], tf[1]).then((s) => alive && setCandles(s));
    return () => { alive = false; };
  }, [selected, tfIndex, session]);

  // live stream
  useEffect(() => {
    if (!session) return;
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
  }, [watchlist, session]);

  // record equity for the dashboard curve
  useEffect(() => {
    const marketValue = account.positions.reduce(
      (s, p) => s + p.qty * (quotes[p.symbol]?.price ?? p.avgPrice), 0
    );
    recordEquity(account.cash + marketValue);
  }, [quotes, account]);

  const addSymbol = useCallback(async (hit: { symbol: string }) => {
    const sym = hit.symbol.toUpperCase();
    setWatchlist((prev) => (prev.includes(sym) ? prev : [...prev, sym]));
    setSelected(sym);
  }, []);

  const removeSymbol = useCallback((sym: string) => {
    setWatchlist((prev) => prev.filter((s) => s !== sym));
  }, []);

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

  if (!session) return <Login />;

  const goMarkets = (sym?: string) => { if (sym) setSelected(sym); go("markets"); };
  const displayName = settings.displayName || session.name;

  return (
    <div className={`shell ${navOpen ? "nav-open" : ""}`}>
      <TickerTape quotes={Object.values(quotes)} />

      <div className="shell-body">
        <nav className="sidebar">
          <div className="side-brand">
            <span className="brand-mark">▲</span>
            <span>Stock Analyzer</span>
          </div>
          <ul>
            {NAV.map((n) => (
              <li key={n.route}>
                <button
                  className={route === n.route ? "active" : ""}
                  onClick={() => { go(n.route); setNavOpen(false); }}
                >
                  <span className="nav-ico">{n.icon}</span> {n.label}
                </button>
              </li>
            ))}
          </ul>
          <div className="side-user">
            <div className="avatar">{displayName.slice(0, 1).toUpperCase()}</div>
            <div>
              <b>{displayName}</b>
              <span className="muted small">{session.email}</span>
            </div>
          </div>
        </nav>

        <div className="main-area">
          <header className="topbar">
            <button className="burger" onClick={() => setNavOpen(!navOpen)}>☰</button>
            <SearchBox onPick={(h) => { addSymbol(h); go("markets"); }} search={searchSymbols} />
            <div className="header-right">
              <span className={`conn ${connected ? "on" : "off"}`}>{connected ? "● live" : "○ connecting"}</span>
              <button className="theme-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? "☀" : "☾"}
              </button>
            </div>
          </header>

          <main className="content">
            {route === "dashboard" && <Dashboard quotes={quotes} watchlist={watchlist} onGo={goMarkets} />}
            {route === "markets" && (
              < Markets
                watchlist={watchlist}
                quotes={quotes}
                selected={selected}
                candles={candles}
                analysis={analysis}
                tfIndex={tfIndex}
                setTfIndex={setTfIndex}
                chartType={chartType}
                setChartType={setChartType}
                overlays={overlays}
                setOverlays={setOverlays}
                onSelect={setSelected}
                onRemove={removeSymbol}
                onAdd={addSymbol}
              />
            )}
            {route === "portfolio" && <Portfolio quotes={quotes} />}
            {route === "tools" && <Tools watchlist={watchlist} quotes={quotes} onSelect={goMarkets} />}
            {route === "settings" && (
              <SettingsPage settings={settings} setSettings={setSettings} theme={theme} setTheme={setTheme} />
            )}
          </main>

          <footer className="footer muted">
            Paper trading · {Object.values(quotes)[0]?.source === "simulated" ? "demo feed" : "Yahoo Finance live"} ·
            analyzer signals are informational, not investment advice.
          </footer>
        </div>
      </div>
    </div>
  );
}
