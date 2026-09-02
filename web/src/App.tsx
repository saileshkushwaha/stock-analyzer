import React from "react";

import { useCallback, useEffect, useRef, useState } from "react";
import { connectStream, fetchHistory, searchSymbols } from "./api";
import type { AnalyzerResult, Quote, SearchHit } from "./types";
import { TickerTape } from "./components/TickerTape";
import { SearchBox } from "./components/SearchBox";
import { WatchList } from "./components/WatchList";
import { StockChart } from "./components/StockChart";
import { AnalyzerPanel } from "./components/AnalyzerPanel";

const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN"];

export default function App() {
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST);
  const [selected, setSelected] = useState<string>("AAPL");
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [analysis, setAnalysis] = useState<AnalyzerResult | null>(null);
  const [series, setSeries] = useState<{ t: number; c: number }[]>([]);
  const [connected, setConnected] = useState(false);

  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // Load daily series whenever the selected symbol changes
  useEffect(() => {
    let alive = true;
    setSeries([]);
    setAnalysis(null);
    fetchHistory(selected).then((s) => alive && setSeries(s));
    return () => { alive = false; };
  }, [selected]);

  // Live stream
  useEffect(() => {
    const close = connectStream(watchlist, ({ quote, analysis: a }) => {
      setQuotes((prev) => ({ ...prev, [quote.symbol]: quote }));
      if (quote.symbol === selectedRef.current) {
        setAnalysis(a);
        setSeries((prev) => {
          if (!prev.length) return prev;
          const next = [...prev];
          const last = { ...next[next.length - 1] };
          if (quote.ts - last.t < 5 * 60_000) {
            last.c = quote.price;
            next[next.length - 1] = last;
          } else {
            next.push({ t: quote.ts, c: quote.price });
          }
          return next;
        });
      }
    });
    const t = setTimeout(() => setConnected(true), 800);
    return () => { close(); clearTimeout(t); };
  }, [watchlist]);

  const addSymbol = useCallback(async (hit: SearchHit) => {
    const sym = hit.symbol.toUpperCase();
    setWatchlist((prev) => (prev.includes(sym) ? prev : [...prev, sym]));
    setSelected(sym);
  }, []);

  const removeSymbol = useCallback((sym: string) => {
    setWatchlist((prev) => prev.filter((s) => s !== sym));
  }, []);

  const quote = quotes[selected];
  const up = (quote?.change ?? 0) >= 0;

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
      </header>

      <main className="layout">
        <WatchList
          watchlist={watchlist}
          quotes={quotes}
          selected={selected}
          onSelect={setSelected}
          onRemove={removeSymbol}
        />

        <section className="detail card">
          {quote ? (
            <div className="detail-head">
              <div>
                <h1>{selected}</h1>
                <p className="muted">{quote.name}</p>
              </div>
              <div className="price-block">
                <span className={`price ${up ? "up" : "down"}`}>
                  {quote.price.toFixed(2)}
                </span>
                <span className={`chip ${up ? "up" : "down"}`}>
                  {up ? "▲" : "▼"} {Math.abs(quote.change).toFixed(2)}{" "}
                  ({quote.changePercent.toFixed(2)}%)
                </span>
                {quote.source === "simulated" && (
                  <span className="chip sim">simulated feed</span>
                )}
              </div>
            </div>
          ) : (
            <div className="detail-head">
              <div>
                <h1>{selected}</h1>
                <p className="muted">loading…</p>
              </div>
            </div>
          )}

          <StockChart series={series} up={up} />

          <AnalyzerPanel analysis={analysis} />
        </section>
      </main>

      <footer className="footer muted">
        Realtime quotes via Yahoo Finance · analyzer signals are informational, not
        investment advice.
      </footer>
    </div>
  );
}
