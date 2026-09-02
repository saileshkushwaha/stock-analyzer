export interface Candle {
  t: number; // epoch ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface Quote {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  currency: string;
  name?: string;
  source: "live" | "simulated";
  ts: number;
}

export interface AnalyzerResult {
  symbol: string;
  score: number; // -100..100
  signal: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  price: number;
  indicators: {
    rsi: number | null;
    sma20: number | null;
    sma50: number | null;
    ema12: number | null;
    ema26: number | null;
    macd: number | null;
    macdSignal: number | null;
    macdHist: number | null;
    bollingerUpper: number | null;
    bollingerLower: number | null;
    volatilityPct: number | null;
    momentum5: number | null;
  };
  reasons: string[];
  ts: number;
}

export interface StreamTick {
  type: "tick";
  quote: Quote;
  analysis?: AnalyzerResult;
}

export interface StreamMessage {
  type: "subscribed" | "unsubscribed" | "ticks" | "error";
  payload: unknown;
}
