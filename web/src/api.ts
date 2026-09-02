import type { AnalyzerResult, Candle, NewsItem, Quote, ScreenerRow, SearchHit } from "./types";
import { simulateHistory, simulateQuote } from "./demo";
import { StockAnalyzer } from "./analyzer/StockAnalyzer";

/**
 * API layer. Talks to the Node backend when reachable; falls back to a
 * fully client-side demo feed (GitHub Pages deploy) automatically.
 */

let demo: boolean | null = null;

async function isDemo(): Promise<boolean> {
  if (demo == null) {
    try {
      const r = await fetch("/api/health", { signal: AbortSignal.timeout(1500) });
      demo = !r.ok;
    } catch {
      demo = true;
    }
  }
  return demo;
}

export async function searchSymbols(q: string): Promise<SearchHit[]> {
  if (await isDemo()) {
    const sym = q.trim().toUpperCase();
    return sym
      ? [{ symbol: sym, name: `${sym} (demo feed)`, exchange: "DEMO", type: "EQUITY" }]
      : [];
  }
  const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
  const d = await r.json();
  return d.quotes ?? [];
}

export async function fetchHistory(symbol: string, range = "1d", interval = "5m"): Promise<Candle[]> {
  if (await isDemo()) {
    return simulateHistory(symbol);
  }
  const r = await fetch(`/api/history?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=${interval}`);
  const d = await r.json();
  return (d.candles ?? []).map((c: any) => ({ t: c.t, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v }));
}

export async function fetchNews(symbol?: string): Promise<NewsItem[]> {
  if (await isDemo()) {
    const s = (symbol ?? "SPY").toUpperCase();
    return [
      { title: `${s} rallies as volume surges past 20-day average`, publisher: "MarketWire", link: "#", ts: Date.now() - 30 * 60_000, relatedSymbols: [s] },
      { title: `Analysts lift ${s} price target on stronger guidance`, publisher: "Bloomberg", link: "#", ts: Date.now() - 2 * 3600_000, relatedSymbols: [s] },
      { title: `${s} options activity hints at hedging into earnings`, publisher: "Reuters", link: "#", ts: Date.now() - 5 * 3600_000, relatedSymbols: [s] },
    ];
  }
  const r = await fetch(`/api/news${symbol ? `?symbol=${encodeURIComponent(symbol)}` : ""}`);
  const d = await r.json();
  return d.news ?? [];
}

export async function runScreener(symbols: string[]): Promise<ScreenerRow[]> {
  if (await isDemo()) {
    const analyzer = new StockAnalyzer();
    return symbols.map((sym) => {
      const candles = simulateHistory(sym, 60);
      const a = analyzer.analyze(sym, candles);
      const q = simulateQuote(sym);
      return {
        symbol: sym,
        name: q.name,
        price: q.price,
        changePercent: q.changePercent,
        score: a?.score ?? 0,
        signal: a?.signal ?? "HOLD",
        rsi: a?.indicators.rsi ?? null,
        momentum5: a?.indicators.momentum5 ?? null,
        volatilityPct: a?.indicators.volatilityPct ?? null,
        source: "simulated",
      };
    });
  }
  const r = await fetch("/api/screener", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbols }),
  });
  const d = await r.json();
  return d.rows ?? [];
}

export type TickHandler = (data: { quote: Quote; analysis: AnalyzerResult | null }) => void;

/** Live stream with auto-reconnect and resubscribe; runs a local engine in demo mode. */
export function connectStream(symbols: string[], onTick: TickHandler) {
  if (symbols.length === 0) return () => {};

  isDemo().then((isDemoMode) => {
    if (isDemoMode) startDemo(symbols, onTick);
    else startWebSocket(symbols, onTick);
  });

  return () => {
    stopRequested = true;
    clearTimeout(retry);
    if (socket) { socket.close(); socket = null; }
    if (demoTimer) { clearInterval(demoTimer); demoTimer = null; }
  };
}

// ---------- websocket mode ----------

let socket: WebSocket | null = null;
let stopRequested = false;
let retry: ReturnType<typeof setTimeout> | undefined;

function startWebSocket(symbols: string[], onTick: TickHandler) {
  stopRequested = false;

  const connect = () => {
    if (stopRequested) return;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    socket = new WebSocket(`${proto}://${location.host}/ws`);
    socket.onopen = () => {
      socket!.send(JSON.stringify({ action: "subscribe", symbols }));
    };
    socket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "ticks" && msg.payload?.quote) onTick(msg.payload);
      } catch { /* ignore malformed frames */ }
    };
    socket.onclose = () => {
      if (!stopRequested) retry = setTimeout(connect, 2000);
    };
  };
  connect();
}

// ---------- demo mode ----------

let demoTimer: ReturnType<typeof setInterval> | null = null;

function startDemo(symbols: string[], onTick: TickHandler) {
  const analyzer = new StockAnalyzer();
  const candles = new Map<string, { t: number; o: number; h: number; l: number; c: number; v: number }[]>();

  const tick = () => {
    for (const sym of symbols) {
      if (!candles.has(sym)) candles.set(sym, simulateHistory(sym));
      const series = candles.get(sym)!;
      const quote = simulateQuote(sym);
      const last = series[series.length - 1];
      if (quote.ts - last.t > 3 * 60_000) {
        series.push({ t: quote.ts, o: quote.price, h: quote.price, l: quote.price, c: quote.price, v: 0 });
        if (series.length > 500) series.shift();
      } else {
        last.c = quote.price;
      }
      onTick({ quote, analysis: analyzer.analyze(sym, series, quote.price) });
    }
  };
  tick();
  demoTimer = setInterval(tick, 3000);
}
