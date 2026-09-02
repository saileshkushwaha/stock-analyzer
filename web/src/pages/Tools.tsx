import React, { useMemo, useState } from "react";
import { Screener } from "../components/Screener";
import { Heatmap } from "../components/Heatmap";
import type { Quote } from "../types";

export function Tools({
  watchlist,
  quotes,
  onSelect,
}: {
  watchlist: string[];
  quotes: Record<string, Quote>;
  onSelect: (s: string) => void;
}) {
  const [tab, setTab] = useState<"screener" | "heatmap" | "calc">("screener");

  return (
    <div className="page">
      <header className="page-head">
        <h1>Tools</h1>
        <p className="muted">Screening, market breadth and trade calculators.</p>
      </header>

      <div className="tab-row" style={{ maxWidth: 420 }}>
        <button className={tab === "screener" ? "active" : ""} onClick={() => setTab("screener")}>Screener</button>
        <button className={tab === "heatmap" ? "active" : ""} onClick={() => setTab("heatmap")}>Heatmap</button>
        <button className={tab === "calc" ? "active" : ""} onClick={() => setTab("calc")}>Calculators</button>
      </div>

      {tab === "screener" && <Screener symbols={watchlist} />}
      {tab === "heatmap" && (
        <div style={{ maxWidth: 720 }}>
          <Heatmap quotes={quotes} onSelect={onSelect} />
        </div>
      )}
      {tab === "calc" && <Calculators price={quotes[watchlist[0]]?.price ?? 100} />}
    </div>
  );
}

function Calculators({ price }: { price: number }) {
  const [capital, setCapital] = useState("100000");
  const [riskPct, setRiskPct] = useState("1");
  const [stopPct, setStopPct] = useState("2");
  const [years, setYears] = useState("10");
  const [rate, setRate] = useState("12");

  const positionSize = useMemo(() => {
    const cap = parseFloat(capital), risk = parseFloat(riskPct), stop = parseFloat(stopPct);
    if (![cap, risk, stop].every(Number.isFinite) || cap <= 0 || risk <= 0 || stop <= 0) return null;
    const riskAmt = (cap * risk) / 100;
    const perShare = price * (stop / 100);
    return { riskAmt, qty: Math.floor(riskAmt / perShare), perShare };
  }, [capital, riskPct, stopPct, price]);

  const comp = useMemo(() => {
    const cap = parseFloat(capital), r = parseFloat(rate), y = parseFloat(years);
    if (![cap, r, y].every(Number.isFinite) || cap <= 0 || y <= 0) return null;
    return (cap * Math.pow(1 + r / 100, y)).toFixed(0);
  }, [capital, rate, years]);

  return (
    <div className="dash-grid two">
      <div className="card pad-card">
        <h3>Position sizing</h3>
        <p className="muted small">How many shares to buy so a stop-out loses only your risk budget.</p>
        <div className="calc-grid">
          <NumField label="Capital ($)" value={capital} onChange={setCapital} />
          <NumField label="Risk per trade (%)" value={riskPct} onChange={setRiskPct} />
          <NumField label="Stop distance (%)" value={stopPct} onChange={setStopPct} />
        </div>
        {positionSize && (
          <div className="calc-result">
            <span>Risk amount <b>${positionSize.riskAmt.toFixed(0)}</b></span>
            <span>Per-share risk <b>${positionSize.perShare.toFixed(2)}</b></span>
            <span className="big">Buy <b className="up">{positionSize.qty}</b> shares @ ${price.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="card pad-card">
        <h3>Compounding projection</h3>
        <p className="muted small">Where your capital lands at a steady annual return.</p>
        <div className="calc-grid">
          <NumField label="Capital ($)" value={capital} onChange={setCapital} />
          <NumField label="Annual return (%)" value={rate} onChange={setRate} />
          <NumField label="Years" value={years} onChange={setYears} />
        </div>
        {comp && (
          <div className="calc-result">
            <span className="big">${Number(comp).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            <span className="muted small">after {years} years at {rate}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
