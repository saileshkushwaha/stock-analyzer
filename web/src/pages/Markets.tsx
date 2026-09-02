import React, { useState } from "react";
import type { AnalyzerResult, Candle, Quote } from "../types";
import { CandleChart, TIMEFRAMES, type ChartType, type Overlays } from "../components/CandleChart";
import { AnalyzerPanel } from "../components/AnalyzerPanel";
import { OrderTicket } from "../components/OrderTicket";
import { Positions } from "../components/Positions";
import { AlertsPanel } from "../components/AlertsPanel";
import { DepthPanel } from "../components/DepthPanel";
import { NewsFeed } from "../components/NewsFeed";
import { Screener } from "../components/Screener";
import { Heatmap } from "../components/Heatmap";
import { WatchList } from "../components/WatchList";

type RailTab = "trade" | "alerts" | "depth" | "news";
type CenterTab = "analyzer" | "screener";
type LeftTab = "list" | "heatmap";

export interface MarketProps {
  watchlist: string[];
  quotes: Record<string, Quote>;
  selected: string;
  candles: Candle[];
  analysis: AnalyzerResult | null;
  tfIndex: number;
  setTfIndex: (i: number) => void;
  chartType: ChartType;
  setChartType: (c: ChartType) => void;
  overlays: Overlays;
  setOverlays: (o: Overlays) => void;
  onSelect: (s: string) => void;
  onRemove: (s: string) => void;
  onAdd: (hit: { symbol: string }) => void;
}

export function Markets(p: MarketProps) {
  const [railTab, setRailTab] = useState<RailTab>("trade");
  const [centerTab, setCenterTab] = useState<CenterTab>("analyzer");
  const [leftTab, setLeftTab] = useState<LeftTab>("list");

  const quote = p.quotes[p.selected];
  const up = (quote?.change ?? 0) >= 0;
  const toggleOverlay = (k: keyof Overlays) => p.setOverlays({ ...p.overlays, [k]: !p.overlays[k] });

  return (
    <div className="page">
      <header className="page-head">
        <h1>Markets</h1>
        <p className="muted">Live charts, analysis and trading.</p>
      </header>

      <div className="markets-grid">
        <aside className="left-col">
          <div className="tab-row">
            <button className={leftTab === "list" ? "active" : ""} onClick={() => setLeftTab("list")}>List</button>
            <button className={leftTab === "heatmap" ? "active" : ""} onClick={() => setLeftTab("heatmap")}>Heatmap</button>
          </div>
          {leftTab === "list" ? (
            <WatchList watchlist={p.watchlist} quotes={p.quotes} selected={p.selected} onSelect={p.onSelect} onRemove={p.onRemove} />
          ) : (
            <Heatmap quotes={p.quotes} onSelect={p.onSelect} />
          )}
        </aside>

        <section className="center-col">
          <div className="chart-card card">
            <div className="chart-head">
              <div className="chart-title">
                <h1>{p.selected}</h1>
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
                    <button key={tf.label} className={p.tfIndex === i ? "active" : ""} onClick={() => p.setTfIndex(i)}>
                      {tf.label}
                    </button>
                  ))}
                </div>
                <div className="seg">
                  <button className={p.chartType === "candles" ? "active" : ""} onClick={() => p.setChartType("candles")}>🕯</button>
                  <button className={p.chartType === "line" ? "active" : ""} onClick={() => p.setChartType("line")}>📈</button>
                </div>
                <div className="seg">
                  {(["sma", "bb", "volume", "rsi", "macd"] as const).map((k) => (
                    <button key={k} className={p.overlays[k] ? "active" : ""} onClick={() => toggleOverlay(k)}>
                      {k.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <CandleChart candles={p.candles} chartType={p.chartType} overlays={p.overlays} up={up} symbol={p.selected} />
          </div>

          <div className="tab-row center-tabs">
            <button className={centerTab === "analyzer" ? "active" : ""} onClick={() => setCenterTab("analyzer")}>Analyzer</button>
            <button className={centerTab === "screener" ? "active" : ""} onClick={() => setCenterTab("screener")}>Screener</button>
          </div>
          {centerTab === "analyzer" ? (
            <AnalyzerPanel analysis={p.analysis} />
          ) : (
            <Screener symbols={p.watchlist} />
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
              <Positions quotes={p.quotes} />
            </>
          )}
          {railTab === "alerts" && <AlertsPanel quote={quote ?? null} />}
          {railTab === "depth" && <DepthPanel quote={quote ?? null} />}
          {railTab === "news" && <NewsFeed symbol={p.selected} />}
        </aside>
      </div>
    </div>
  );
}
