import React from "react";

const SHORTCUTS: [string, string][] = [
  ["/", "Focus symbol search"],
  ["B", "Set order ticket to Buy"],
  ["S", "Set order ticket to Sell"],
  ["?", "Toggle this help"],
  ["Esc", "Close dialogs"],
];

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Keyboard shortcuts</h3>
        <table className="mini-table">
          <tbody>
            {SHORTCUTS.map(([k, d]) => (
              <tr key={k}>
                <td><kbd>{k}</kbd></td>
                <td>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="modal-actions">
          <button className="side-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
