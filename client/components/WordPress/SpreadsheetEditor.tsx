import React, { useEffect, useRef, useState } from 'react';

import React, { useEffect, useRef, useState } from 'react';

type Column = { slug: string; label: string; ai?: string };

export default function SpreadsheetEditor({ value, onChange, onColumnsChange }: { value: string; onChange: (v: string) => void; onColumnsChange?: (cols: {slug:string,label:string,ai?:string}[]) => void }) {
  const [columns, setColumns] = useState<Column[]>([{ slug: 'col_1', label: 'col_1', ai: '' }]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [active, setActive] = useState<{ r: number; c: number } | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Parse incoming JSON value to initialize grid
  useEffect(() => {
    try {
      const parsed = JSON.parse(value || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) {
        const derivedCols: Column[] = [];
        parsed.forEach((r: any) => {
          Object.keys(r).forEach((k) => {
            if (!derivedCols.find((c) => c.slug === k)) derivedCols.push({ slug: k, label: k, ai: '' });
          });
        });
        if (derivedCols.length > 0) setColumns(derivedCols);
        setRows(parsed.map((r: any) => {
          const obj: Record<string, string> = {};
          derivedCols.forEach((c) => { obj[c.slug] = r[c.slug] ?? ''; });
          return obj;
        }));
      } else {
        setColumns((c) => (c.length ? c : [{ slug: 'col_1', label: 'col_1', ai: '' }]));
        setRows([]);
      }
    } catch (e) {
      setColumns((c) => (c.length ? c : [{ slug: 'col_1', label: 'col_1', ai: '' }]));
      setRows([]);
    }
  }, [value]);

  useEffect(() => {
    if (typeof onColumnsChange === 'function') onColumnsChange(columns.map(c => ({ slug: c.slug, label: c.label, ai: c.ai })));
  }, [columns, onColumnsChange]);

  // Evaluate tokens {{col}} or {{col[index]}} against current rows
  const evaluateValue = (raw: string, rowIndex: number, visited = new Set<string>()): string => {
    if (typeof raw !== 'string') return String(raw ?? '');
    // prevent deep recursion
    if (visited.size > 50) return raw;
    const tokenRe = /\{\{([a-zA-Z0-9_\-]+)(?:\[(\d+)\])?\}\}/g;
    let result = raw;
    let m: RegExpExecArray | null;
    while ((m = tokenRe.exec(raw)) !== null) {
      const col = m[1];
      const idxStr = m[2];
      const idx = idxStr !== undefined ? parseInt(idxStr, 10) : rowIndex;
      const key = `${col}:${idx}`;
      if (visited.has(key)) {
        result = result.replace(m[0], '');
        continue;
      }
      visited.add(key);
      const refRow = rows[idx];
      const replacement = refRow ? String(refRow[col] ?? '') : '';
      // if replacement itself contains tokens, evaluate recursively
      const evaluated = evaluateValue(replacement, idx, visited);
      result = result.replace(m[0], evaluated);
    }
    return result;
  };

  // compute exported rows (apply token evaluation)
  const computeExportRows = (): Record<string, string>[] => {
    return rows.map((r, ri) => {
      const out: Record<string, string> = {};
      columns.forEach((c) => {
        const raw = r[c.slug] ?? '';
        // if cell begins with '=' treat as expression that may include tokens
        if (raw && raw.startsWith('=')) {
          const expr = raw.slice(1);
          // allow tokens inside expression
          out[c.slug] = evaluateValue(expr, ri);
        } else {
          out[c.slug] = evaluateValue(raw, ri);
        }
      });
      return out;
    });
  };

  // emit computed JSON whenever grid changes
  useEffect(() => {
    try {
      onChange(JSON.stringify(computeExportRows(), null, 2));
    } catch (e) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, columns]);

  const addColumn = () => {
    const next = columns.length + 1;
    const slug = `col_${next}`;
    setColumns((c) => [...c, { slug, label: slug, ai: '' }]);
    setRows((r) => r.map((row) => ({ ...row, [slug]: '' })));
  };

  const deleteColumn = (slug: string) => {
    setColumns((c) => c.filter((col) => col.slug !== slug));
    setRows((r) => r.map((row) => {
      const copy = { ...row };
      delete copy[slug];
      return copy;
    }));
  };

  const updateColumnSlug = (oldSlug: string, newSlugRaw: string) => {
    const newSlug = String(newSlugRaw || '').trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '').toLowerCase();
    if (!newSlug) return;
    if (columns.find((c) => c.slug === newSlug)) return; // avoid duplicates
    setColumns((cols) => cols.map((c) => c.slug === oldSlug ? { ...c, slug: newSlug, label: newSlug } : c));
    setRows((r) => r.map((row) => {
      const copy: Record<string, string> = {};
      Object.keys(row).forEach((k) => {
        if (k === oldSlug) copy[newSlug] = row[oldSlug]; else copy[k] = row[k];
      });
      if (!(oldSlug in row)) copy[newSlug] = '';
      return copy;
    }));
  };

  const updateColumnAI = (slug: string, ai: string) => {
    setColumns((c) => c.map((col) => col.slug === slug ? { ...col, ai } : col));
  };

  const addRow = () => {
    const empty: Record<string, string> = {};
    columns.forEach((c) => empty[c.slug] = '');
    setRows((r) => [...r, empty]);
    // focus new row first cell after next tick
    setTimeout(() => {
      const key = `0:${columns[0].slug}`; // using 0-based, but new row is last index
      // no-op
    }, 50);
  };

  const deleteRow = (idx: number) => {
    setRows((r) => r.filter((_, i) => i !== idx));
  };

  const updateCell = (rowIndex: number, slug: string, val: string) => {
    setRows((r) => {
      const copy = [...r];
      copy[rowIndex] = { ...copy[rowIndex], [slug]: val };
      return copy;
    });
  };

  // Keyboard navigation and copy/paste
  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>, ri: number, ci: number) => {
    const key = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && key.toLowerCase() === 'c') {
      // copy single cell
      const val = rows[ri]?.[columns[ci].slug] ?? '';
      try { await navigator.clipboard.writeText(val); } catch (err) {}
      e.preventDefault();
      return;
    }
    if (ctrl && key.toLowerCase() === 'v') {
      // paste into grid — support CSV/tab/line breaks
      try {
        const text = await navigator.clipboard.readText();
        if (!text) return;
        const lines = text.split(/\r?\n/).filter(Boolean);
        const newRows = [...rows];
        lines.forEach((ln, rIndex) => {
          const cells = ln.split(/\t|,/);
          const targetRow = ri + rIndex;
          while (newRows.length <= targetRow) {
            const empty: Record<string, string> = {};
            columns.forEach((c) => empty[c.slug] = '');
            newRows.push(empty);
          }
          cells.forEach((cellVal, cIndex) => {
            const targetCol = ci + cIndex;
            if (targetCol < columns.length) {
              newRows[targetRow][columns[targetCol].slug] = cellVal;
            }
          });
        });
        setRows(newRows);
      } catch (err) {
        // ignore
      }
      e.preventDefault();
      return;
    }

    if (key === 'ArrowRight') {
      const nc = Math.min(ci + 1, columns.length - 1);
      setActive({ r: ri, c: nc });
      e.preventDefault();
    } else if (key === 'ArrowLeft') {
      const nc = Math.max(ci - 1, 0);
      setActive({ r: ri, c: nc });
      e.preventDefault();
    } else if (key === 'ArrowDown' || key === 'Enter') {
      const nr = Math.min(ri + 1, Math.max(rows.length - 1, 0));
      setActive({ r: nr, c: ci });
      e.preventDefault();
    } else if (key === 'ArrowUp') {
      const nr = Math.max(ri - 1, 0);
      setActive({ r: nr, c: ci });
      e.preventDefault();
    }
  };

  // focus effect when active changes
  useEffect(() => {
    if (!active) return;
    const slug = columns[active.c]?.slug;
    if (!slug) return;
    const key = `${active.r}:${slug}`;
    const el = inputRefs.current.get(key);
    if (el) {
      el.focus();
      // place cursor at end
      const len = el.value.length;
      try { el.setSelectionRange(len, len); } catch (e) {}
    }
  }, [active, columns]);

  // Export CSV
  const exportCSV = () => {
    const header = columns.map((c) => c.slug).join(',');
    const data = computeExportRows().map(r => columns.map(c => `"${String(r[c.slug] ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const csv = header + '\n' + data;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Import CSV file
  const handleFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || '');
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length === 0) return;
      const hdrs = lines[0].split(',').map(h => h.trim());
      const newCols: Column[] = hdrs.map(h => ({ slug: h, label: h, ai: '' }));
      const newRows = lines.slice(1).map(ln => {
        const vals = ln.split(',');
        const obj: Record<string, string> = {};
        hdrs.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
        return obj;
      });
      setColumns(newCols);
      setRows(newRows);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={() => setRows((r) => { const empty: Record<string,string> = {}; columns.forEach(c => empty[c.slug]=''); return [...r, empty]; })} className="btn">Add row</button>
        <button onClick={addColumn} className="btn">Add column</button>
        <label className="cursor-pointer btn">
          Import CSV
          <input type="file" accept=".csv,text/csv" onChange={(e) => handleFile(e.target.files ? e.target.files[0] : null)} className="hidden" />
        </label>
        <button onClick={exportCSV} className="btn">Export CSV</button>
        <button onClick={() => onChange(JSON.stringify(computeExportRows(), null, 2))} className="btn">Apply to JSON</button>
      </div>

      <div className="overflow-auto border rounded mt-2">
        <table className="min-w-full table-auto">
          <thead>
            <tr>
              {columns.map((col, ci) => (
                <th key={col.slug} className="p-2 align-top border-r">
                  <div className="flex items-center gap-2">
                    <input className="border px-2 py-1 w-32" value={col.slug} onChange={(e) => updateColumnSlug(col.slug, e.target.value)} />
                    <button onClick={() => deleteColumn(col.slug)} className="text-sm text-red-600">Del</button>
                  </div>
                  <div className="mt-2">
                    <label className="text-xs">AI instruction</label>
                    <textarea className="border w-full mt-1 p-1 h-20" value={col.ai || ''} onChange={(e) => updateColumnAI(col.slug, e.target.value)} />
                    <div className="text-xs text-muted-foreground">Reference other cells with {`{{column_slug}}`} or {`{{column_slug[rowIndex]}}`}. Evaluation happens during generation.</div>
                  </div>
                </th>
              ))}
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td className="p-4" colSpan={columns.length + 1}>No rows. Click "Add row" to create one, or import CSV/JSON above.</td></tr>
            )}
            {rows.map((row, ri) => (
              <tr key={ri} className="border-t">
                {columns.map((col, ci) => (
                  <td key={col.slug} className="p-2 align-top border-r">
                    <input
                      ref={(el) => { if (!el) return; inputRefs.current.set(`${ri}:${col.slug}`, el); }}
                      className="border px-2 py-1 w-72"
                      value={row[col.slug] ?? ''}
                      onChange={(e) => updateCell(ri, col.slug, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e as any, ri, ci)}
                      onFocus={() => setActive({ r: ri, c: ci })}
                    />
                  </td>
                ))}
                <td className="p-2 align-top">
                  <div className="flex flex-col gap-2">
                    <button onClick={() => deleteRow(ri)} className="text-sm text-red-600">Delete row</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
