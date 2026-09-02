/** CSV export helpers — trigger browser downloads. */

function download(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","));
  return [headers.join(","), ...lines].join("\n");
}

export function exportOrdersCsv(orders: Array<Record<string, unknown>>) {
  download(`orders-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(orders));
}

export function exportPositionsCsv(positions: Array<Record<string, unknown>>) {
  download(`positions-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(positions));
}
