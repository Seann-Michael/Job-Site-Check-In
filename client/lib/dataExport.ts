/** Trigger a browser download for `blob` under `filename`. */
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Build a CSV string from plain objects. Values are quoted and embedded
 * quotes are escaped; nested objects are JSON-encoded.
 */
export function toCsv(
  rows: Record<string, any>[],
  columns?: { key: string; label?: string }[],
): string {
  if (rows.length === 0 && !columns) return "";
  const cols: { key: string; label?: string }[] =
    columns ??
    Object.keys(
      rows.reduce((acc, r) => ({ ...acc, ...r }), {} as Record<string, any>),
    ).map((key) => ({ key }));
  const esc = (v: any) => {
    if (v == null) return "";
    const str = typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${str.replace(/"/g, '""')}"`;
  };
  const header = cols.map((c) => esc(c.label ?? c.key)).join(",");
  const body = rows.map((r) => cols.map((c) => esc(r[c.key])).join(","));
  return [header, ...body].join("\n");
}

/** Download `rows` as a CSV file named `local-seo-ranker-<name>-<date>.csv`. */
export function downloadCsv(
  name: string,
  rows: Record<string, any>[],
  columns?: { key: string; label?: string }[],
): void {
  const csv = toCsv(rows, columns);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const filename = `local-seo-ranker-${name}-${new Date().toISOString().split("T")[0]}.csv`;
  downloadFile(blob, filename);
}
