export interface Candle {
  t: number; o: number; h: number; l: number; c: number; v: number;
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

export type Signal = "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";

export interface AnalyzerResult {
  symbol: string;
  score: number;
  signal: Signal;
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

export interface SearchHit {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}
