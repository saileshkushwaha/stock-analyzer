import React, { useState } from "react";
import { resetAccount, useAccount, STARTING_CASH } from "../store";
import { logout, useSession } from "../session";
import type { ChartType, Overlays } from "../components/CandleChart";

export interface Settings {
  displayName: string;
  defaultChart: ChartType;
  defaultOverlays: Overlays;
  confirmOrders: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  displayName: "",
  defaultChart: "candles",
  defaultOverlays: { sma: true, bb: false, volume: true, rsi: false, macd: false },
  confirmOrders: false,
};

const SETTINGS_KEY = "sa.settings.v1";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function SettingsPage({
  settings,
  setSettings,
  theme,
  setTheme,
}: {
  settings: Settings;
  setSettings: (s: Settings) => void;
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
}) {
  const session = useSession();
  const account = useAccount();
  const [draft, setDraft] = useState<Settings>(settings);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const set = (patch: Partial<Settings>) => setDraft({ ...draft, ...patch });

  const save = () => {
    saveSettings(draft);
    setSettings(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="page narrow">
      <header className="page-head">
        <h1>Settings</h1>
        <p className="muted">Profile, appearance, trading defaults and data.</p>
      </header>

      <div className="card pad-card setting-card">
        <h3>Profile</h3>
        <div className="calc-grid">
          <label className="field">
            <span>Display name</span>
            <input
              value={draft.displayName}
              onChange={(e) => set({ displayName: e.target.value })}
              placeholder={session?.name ?? "Your name"}
            />
          </label>
          <label className="field">
            <span>Email (session)</span>
            <input value={session?.email ?? ""} disabled />
          </label>
        </div>
      </div>

      <div className="card pad-card setting-card">
        <h3>Appearance</h3>
        <div className="setting-row">
          <span>Theme</span>
          <div className="seg">
            <button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>Dark</button>
            <button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}>Light</button>
          </div>
        </div>
        <div className="setting-row">
          <span>Default chart type</span>
          <div className="seg">
            <button className={draft.defaultChart === "candles" ? "active" : ""} onClick={() => set({ defaultChart: "candles" })}>Candles</button>
            <button className={draft.defaultChart === "line" ? "active" : ""} onClick={() => set({ defaultChart: "line" })}>Line</button>
          </div>
        </div>
        <div className="setting-row">
          <span>Default overlays</span>
          <div className="seg">
            {(["sma", "bb", "volume", "rsi", "macd"] as const).map((k) => (
              <button
                key={k}
                className={draft.defaultOverlays[k] ? "active" : ""}
                onClick={() => set({ defaultOverlays: { ...draft.defaultOverlays, [k]: !draft.defaultOverlays[k] } })}
              >
                {k.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card pad-card setting-card">
        <h3>Trading</h3>
        <div className="setting-row">
          <span>Confirm orders before placing</span>
          <button
            className={`side-btn mini ${draft.confirmOrders ? "buy active" : ""}`}
            onClick={() => set({ confirmOrders: !draft.confirmOrders })}
          >
            {draft.confirmOrders ? "On" : "Off"}
          </button>
        </div>
        <div className="setting-row">
          <span>Reset paper account</span>
          {confirmReset ? (
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="muted small">Wipe {account.orders.length} orders?</span>
              <button className="side-btn mini sell active" onClick={() => { resetAccount(); setConfirmReset(false); }}>Yes, reset</button>
              <button className="side-btn mini" onClick={() => setConfirmReset(false)}>Cancel</button>
            </span>
          ) : (
            <button className="side-btn mini sell" onClick={() => setConfirmReset(true)}>Reset to ${STARTING_CASH.toLocaleString()}</button>
          )}
        </div>
      </div>

      <div className="card pad-card setting-card">
        <h3>Session</h3>
        <div className="setting-row">
          <span className="muted small">Signed in as {session?.email}</span>
          <button className="side-btn mini sell" onClick={logout}>Sign out</button>
        </div>
      </div>

      <button className="submit-btn" style={{ maxWidth: 300 }} onClick={save}>
        {saved ? "Saved ✓" : "Save settings"}
      </button>
    </div>
  );
}
