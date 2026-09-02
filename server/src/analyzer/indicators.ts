/** Pure technical-indicator math. No deps, no side effects. */

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let acc = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    acc = values[i] * k + acc * (1 - k);
  }
  return acc;
}

/** Wilder's RSI. */
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function macd(closes: number[], fast = 12, slow = 26, signalPeriod = 9) {
  if (closes.length < slow + signalPeriod) {
    return { macd: null, signal: null, hist: null } as const;
  }
  const emaSeries = (period: number): number[] => {
    const k = 2 / (period + 1);
    const out: number[] = [];
    let acc = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    out.push(acc);
    for (let i = period; i < closes.length; i++) {
      acc = closes[i] * k + acc * (1 - k);
      out.push(acc);
    }
    return out;
  };
  const fastSeries = emaSeries(fast);
  const slowSeries = emaSeries(slow);
  const offset = fastSeries.length - slowSeries.length;
  const macdLine = fastSeries.slice(offset).map((f, i) => f - slowSeries[i]);
  const k = 2 / (signalPeriod + 1);
  let sig = macdLine.slice(0, signalPeriod).reduce((a, b) => a + b, 0) / signalPeriod;
  const signalSeries: number[] = [];
  for (let i = signalPeriod; i < macdLine.length; i++) {
    sig = macdLine[i] * k + sig * (1 - k);
    signalSeries.push(sig);
  }
  const macdVal = macdLine[macdLine.length - 1];
  const signalVal = signalSeries[signalSeries.length - 1] ?? sig;
  return { macd: macdVal, signal: signalVal, hist: macdVal - signalVal } as const;
}

export function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function bollinger(closes: number[], period = 20, mult = 2) {
  if (closes.length < period) return { upper: null, lower: null } as const;
  const slice = closes.slice(-period);
  const mid = slice.reduce((a, b) => a + b, 0) / period;
  const sd = stdev(slice);
  return { upper: mid + mult * sd, lower: mid - mult * sd } as const;
}

/** % change over the last `lookback` closes. */
export function momentumPct(closes: number[], lookback = 5): number | null {
  if (closes.length <= lookback) return null;
  const then = closes[closes.length - 1 - lookback];
  const now = closes[closes.length - 1];
  return ((now - then) / then) * 100;
}
