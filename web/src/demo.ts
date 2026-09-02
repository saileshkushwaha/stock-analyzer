import type { Candle, Quote } from "./types";

/** Client-side simulated market feed — used when no backend is reachable (e.g. GitHub Pages demo). */

const SIM_SEEDS = new Map<string, { base: number; drift: number; last: number }>();

function seedFor(symbol: string) {
  let s = SIM_SEEDS.get(symbol);
  if (!s) {
    let hash = 0;
    for (const ch of symbol) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
    const base = 20 + (Math.abs(hash) % 48000) / 100;
    s = { base, drift: (((hash % 7) - 3) / 3) * 0.02, last: base };
    SIM_SEEDS.set(symbol, s);
  }
  return s;
}

export function simulateQuote(symbol: string): Quote {
  const s = seedFor(symbol);
  const shock = (Math.random() - 0.5) * 0.01;
  s.last = Math.max(0.5, s.last * (1 + s.drift + shock));
  const prev = s.base;
  return {
    symbol,
    price: Number(s.last.toFixed(2)),
    previousClose: prev,
    change: Number((s.last - prev).toFixed(2)),
    changePercent: Number((((s.last - prev) / prev) * 100).toFixed(2)),
    currency: "USD",
    name: `${symbol} (demo feed)`,
    source: "simulated",
    ts: Date.now(),
  };
}

export function simulateHistory(symbol: string, points = 150): Candle[] {
  const s = seedFor(symbol);
  const now = Date.now();
  const out: Candle[] = [];
  let p = s.base * 0.98;
  for (let i = points; i > 0; i--) {
    const wave = Math.sin(i / 9) * 0.004 + Math.sin(i / 23) * 0.006;
    p = p * (1 + s.drift + wave + (Math.random() - 0.5) * 0.008);
    out.push({
      t: now - i * 5 * 60_000,
      o: p,
      h: p * 1.002,
      l: p * 0.998,
      c: p * (1 + (Math.random() - 0.5) * 0.001),
      v: 1000 + Math.floor(Math.random() * 9000),
    });
  }
  s.last = out[out.length - 1].c;
  return out;
}
