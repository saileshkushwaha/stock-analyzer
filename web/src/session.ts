import { useEffect, useState } from "react";

/** Demo auth session — client-side only, persisted to localStorage. */

export interface Session {
  email: string;
  name: string;
  loginAt: number;
}

const KEY = "sa.session.v1";
let session: Session | null = load();

const subs = new Set<() => void>();

function load(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function login(email: string, password: string): { ok: boolean; error?: string } {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter a valid email" };
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters" };
  const name = email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  session = { email, name, loginAt: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(session));
  for (const fn of subs) fn();
  return { ok: true };
}

export function logout() {
  session = null;
  localStorage.removeItem(KEY);
  for (const fn of subs) fn();
}

export function getSession(): Session | null {
  return session;
}

export function useSession(): Session | null {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    subs.add(fn);
    return () => { subs.delete(fn); };
  }, []);
  return session;
}
