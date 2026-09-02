import type { AnalyzerResult, Quote, SearchHit } from "./types";

export async function searchSymbols(q: string): Promise<SearchHit[]> {
  const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
  const d = await r.json();
  return d.quotes ?? [];
}

export async function fetchHistory(symbol: string): Promise<{ t: number; c: number }[]> {
  const r = await fetch(`/api/history?symbol=${encodeURIComponent(symbol)}&range=1d&interval=5m`);
  const d = await r.json();
  return (d.candles ?? []).map((c: any) => ({ t: c.t, c: c.c }));
}

export type TickHandler = (data: { quote: Quote; analysis: AnalyzerResult | null }) => void;

/** Live websocket with auto-reconnect and resubscribe. */
export function connectStream(symbols: string[], onTick: TickHandler) {
  let socket: WebSocket | null = null;
  let closed = false;
  let retry: ReturnType<typeof setTimeout>;

  const connect = () => {
    if (closed) return;
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
      if (!closed) retry = setTimeout(connect, 2000);
    };
  };
  connect();

  return () => {
    closed = true;
    clearTimeout(retry);
    socket?.close();
  };
}
