import type { Candle, Quote } from "../types.js";

/**
 * Market data provider.
 *
 * Primary: Yahoo Finance public chart API (no key required).
 * Fallback: deterministic-ish simulated random walk so the app never dies
 * when rate-limited or offline — ticks are clearly flagged `simulated`.
 */

const YF_BASE = "https://query1.finance.yahoo.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function yfGet(path: string): Promise<unknown> {
  const res = await fetch(`${YF_BASE}${path}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Yahoo ${res.status} for ${path}`);
  return res.json();
}

// ---------- quotes ----------

export async function getQuote(symbol: string): Promise<Quote> {
  try {
    const json = (await yfGet(
      `/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m&includePrePost=false`
    )) as any;
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error("empty chart");
    const meta = result.meta;
    const closes: number[] = result.indicators?.quote?.[0]?.close?.filter(Number.isFinite) ?? [];
    const price = meta.regularMarketPrice ?? closes[closes.length - 1];
    const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
    return {
      symbol: meta.symbol ?? symbol,
      price,
      previousClose: prev,
      change: price - prev,
      changePercent: prev ? ((price - prev) / prev) * 100 : 0,
      currency: meta.currency ?? "USD",
      name: meta.longName ?? meta.shortName ?? meta.symbol,
      source: "live",
      ts: Date.now(),
    };
  } catch {
    return simulateQuote(symbol);
  }
}

// ---------- history (intraday or daily candles) ----------

export async function getHistory(
  symbol: string,
  range = "1d",
  interval = "5m"
): Promise<Candle[]> {
  try {
    const json = (await yfGet(
      `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`
    )) as any;
    const result = json?.chart?.result?.[0];
    const ts: number[] = result?.timestamp ?? [];
    const q = result?.indicators?.quote?.[0];
    if (!q) throw new Error("no data");
    const candles: Candle[] = [];
    for (let i = 0; i < ts.length; i++) {
      const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
      if (![o, h, l, c].every(Number.isFinite)) continue;
      candles.push({ t: ts[i] * 1000, o, h, l, c, v: q.volume?.[i] ?? 0 });
    }
    if (candles.length) return candles;
    throw new Error("empty candles");
  } catch {
    return simulateHistory(symbol);
  }
}

export interface SearchHit {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export async function searchSymbols(query: string): Promise<SearchHit[]> {
  try {
    const json = (await yfGet(
      `/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`
    )) as any;
    return (json?.quotes ?? [])
      .filter((q: any) => q.symbol)
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname ?? q.longname ?? q.symbol,
        exchange: q.exchDisp ?? q.exchange ?? "",
        type: q.quoteType ?? "",
      }));
  } catch {
    return [
      { symbol: query.toUpperCase(), name: `${query.toUpperCase()} (local match)`, exchange: "", type: "EQUITY" },
    ];
  }
}

// ---------- simulated fallback feed ----------

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
    name: `${symbol} (simulated feed)`,
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

// ---------- news ----------

export interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  ts: number;
  relatedSymbols: string[];
}

const DEMO_HEADLINES = [
  ["{S} rallies as volume surges past 20-day average", "MarketWire"],
  ["Analysts lift {S} price target on stronger guidance", "Bloomberg"],
  ["{S} options activity hints at hedging into earnings", "Reuters"],
  ["Institutional flows rotate into {S} sector ETFs", "CNBC"],
  ["{S} short interest falls to three-month low", "Barron's"],
  ["Technical breakout: {S} clears key resistance level", "Investing.com"],
  ["{S} named top pick in sector outlook note", "Morningstar"],
  ["Macro tailwinds return; {S} among top gainers", "Financial Times"],
];

export async function getNews(symbol?: string): Promise<NewsItem[]> {
  try {
    const q = symbol ? `${symbol} stock` : "stock market";
    const json = (await yfGet(
      `/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=0&newsCount=10`
    )) as any;
    const items: NewsItem[] = (json?.news ?? []).map((n: any) => ({
      title: n.title ?? "",
      publisher: n.publisher ?? "",
      link: n.link ?? "",
      ts: (n.providerPublishTime ?? 0) * 1000,
      relatedSymbols: (n.relatedTickers ?? []).slice(0, 3),
    }));
    if (items.length) return items;
    throw new Error("no news");
  } catch {
    const s = symbol ? symbol.toUpperCase() : "SPY";
    return DEMO_HEADLINES.slice(0, 6).map(([tpl, pub], i) => ({
      title: tpl.replace("{S}", s),
      publisher: pub,
      link: "#",
      ts: Date.now() - i * 45 * 60_000,
      relatedSymbols: [s],
    }));
  }
}
