import type { AnalyzerResult, Quote, SearchHit } from "./types";
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

export async function fetchHistory(symbol: string): Promise<{ t: number; c: number }[]> {
  if (await isDemo()) {
    return simulateHistory(symbol).map((c) => ({ t: c.t, c: c.c }));
  }
  const r = await fetch(`/api/history?symbol=${encodeURIComponent(symbol)}&range=1d&interval=5m`);
  const d = await r.json();
  return (d.candles ?? []).map((c: any) => ({ t: c.t, c: c.c }));
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
