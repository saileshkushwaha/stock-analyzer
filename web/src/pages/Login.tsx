import React, { useState } from "react";
import { login } from "../session";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = login(email.trim(), password);
    setBusy(false);
    if (!r.ok) setError(r.error ?? "Sign-in failed");
  };

  return (
    <div className="login-wrap">
      <div className="login-brand">
        <span className="brand-mark">▲</span>
        <h1>Stock Analyzer</h1>
        <p>Enterprise market intelligence — realtime analytics, paper trading, screening and alerts in one workspace.</p>
        <ul className="login-points">
          <li>Live & simulated market data</li>
          <li>Pro charting with 8+ indicators</li>
          <li>Order ticket, positions & P&L</li>
          <li>Screener, heatmap & alerts</li>
        </ul>
      </div>
      <form className="login-card" onSubmit={submit}>
        <h2>Sign in</h2>
        <p className="muted small">Demo environment — any valid email + 6-char password works.</p>
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@firm.com" autoFocus />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </label>
        {error && <div className="ticket-msg err">{error}</div>}
        <button className="submit-btn" type="submit" disabled={busy}>Sign in</button>
        <div className="muted small" style={{ textAlign: "center" }}>Session stays on this device</div>
      </form>
    </div>
  );
}
