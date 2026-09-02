import React from "react";
import { useToasts } from "../store";

export function ToastHost() {
  const toasts = useToasts();
  if (!toasts.length) return null;
  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
