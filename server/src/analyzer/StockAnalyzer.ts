import type { AnalyzerResult, Candle } from "../types.js";
import { bollinger, ema, macd, momentumPct, rsi, sma, stdev } from "./indicators.js";

/**
 * StockAnalyzer — the analysis engine.
 *
 * Consumes a candle series, computes a basket of classic indicators and
 * blends them into a single composite score (-100..100) mapped to a signal:
 * STRONG_BUY / BUY / HOLD / SELL / STRONG_SELL, with human-readable reasons.
 */
export class StockAnalyzer {
  analyze(symbol: string, candles: Candle[], price?: number): AnalyzerResult | null {
    if (candles.length < 10) return null;
    const closes = candles.map((c) => c.c);
    const last = price ?? closes[closes.length - 1];

    const rsiVal = rsi(closes, 14);
    const sma20 = sma(closes, 20);
    const sma50 = sma(closes, 50);
    const ema12 = ema(closes, 12);
    const ema26 = ema(closes, 26);
    const { macd: macdVal, signal: macdSig, hist: macdHist } = macd(closes);
    const { upper: bbUpper, lower: bbLower } = bollinger(closes, 20, 2);
    const recent = closes.slice(-20);
    const volPct = recent.length > 1 ? (stdev(recent) / last) * 100 : null;
    const mom5 = momentumPct(closes, 5);

    let score = 0;
    const reasons: string[] = [];

    // Trend: price vs moving averages (max ±30)
    if (sma20 != null) {
      const d = ((last - sma20) / sma20) * 100;
      score += clamp(d * 4, -15, 15);
      if (d > 1) reasons.push(`Price ${d.toFixed(2)}% above SMA20 — short-term uptrend`);
      else if (d < -1) reasons.push(`Price ${Math.abs(d).toFixed(2)}% below SMA20 — short-term weakness`);
    }
    if (sma20 != null && sma50 != null) {
      if (sma20 > sma50) {
        score += 15;
        reasons.push("Golden alignment: SMA20 above SMA50");
      } else {
        score -= 15;
        reasons.push("Death alignment: SMA20 below SMA50");
      }
    }

    // RSI (max ±25)
    if (rsiVal != null) {
      if (rsiVal >= 70) {
        score -= 20;
        reasons.push(`RSI ${rsiVal.toFixed(0)} — overbought, pullback risk`);
      } else if (rsiVal <= 30) {
        score += 20;
        reasons.push(`RSI ${rsiVal.toFixed(0)} — oversold, bounce potential`);
      } else if (rsiVal > 55) {
        score += 12;
        reasons.push(`RSI ${rsiVal.toFixed(0)} — bullish momentum`);
      } else if (rsiVal < 45) {
        score -= 12;
        reasons.push(`RSI ${rsiVal.toFixed(0)} — bearish momentum`);
      }
    }

    // MACD (max ±20)
    if (macdHist != null) {
      const rel = (macdHist / last) * 100;
      score += clamp(rel * 30, -20, 20);
      if (macdHist > 0) reasons.push("MACD above signal line — bullish crossover");
      else reasons.push("MACD below signal line — bearish crossover");
    }

    // Momentum (max ±15)
    if (mom5 != null) {
      score += clamp(mom5 * 5, -15, 15);
      if (Math.abs(mom5) > 1.5)
        reasons.push(`5-period momentum ${mom5 > 0 ? "+" : ""}${mom5.toFixed(2)}%`);
    }

    // Bollinger position (±10)
    if (bbUpper != null && bbLower != null) {
      const range = bbUpper - bbLower;
      if (range > 0) {
        const pos = (last - bbLower) / range; // 0..1
        if (pos > 0.95) {
          score -= 10;
          reasons.push("Riding upper Bollinger band — extended");
        } else if (pos < 0.05) {
          score += 10;
          reasons.push("At lower Bollinger band — stretched to the downside");
        }
      }
    }

    // High volatility trims conviction
    if (volPct != null && volPct > 4) {
      score *= 0.8;
      reasons.push(`Elevated volatility (${volPct.toFixed(2)}%) — conviction reduced`);
    }

    score = Math.round(clamp(score, -100, 100));
    const signal = toSignal(score);

    return {
      symbol,
      score,
      signal,
      price: last,
      indicators: {
        rsi: round(rsiVal),
        sma20: round(sma20),
        sma50: round(sma50),
        ema12: round(ema12),
        ema26: round(ema26),
        macd: round(macdVal),
        macdSignal: round(macdSig),
        macdHist: round(macdHist),
        bollingerUpper: round(bbUpper),
        bollingerLower: round(bbLower),
        volatilityPct: round(volPct),
        momentum5: round(mom5),
      },
      reasons,
      ts: Date.now(),
    };
  }
}

function toSignal(score: number): AnalyzerResult["signal"] {
  if (score >= 50) return "STRONG_BUY";
  if (score >= 15) return "BUY";
  if (score <= -50) return "STRONG_SELL";
  if (score <= -15) return "SELL";
  return "HOLD";
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function round(v: number | null | undefined, dp = 2): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return Number(v.toFixed(dp));
}
