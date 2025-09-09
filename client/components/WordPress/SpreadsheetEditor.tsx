import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Column = { slug: string; label: string; ai?: string };

export default function SpreadsheetEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [columns, setColumns] = useState<Column[]>([{ slug: 'col_1', label: 'col_1', ai: '' }]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(value || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) {
        // derive columns from keys
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
      // invalid JSON — start fresh
      setColumns((c) => (c.length ? c : [{ slug: 'col_1', label: 'col_1', ai: '' }]));
      setRows([]);
    }
  }, [value]);

  useEffect(() => {
    // emit JSON whenever rows change
    onChange(JSON.stringify(rows, null, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

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

  const updateCell = (rowIndex: number, slug: string, val: string) => {
    setRows((r) => {
      const copy = [...r];
      copy[rowIndex] = { ...copy[rowIndex], [slug]: val };
      return copy;
    });
  };

  const addRow = () => {
    const empty: Record<string, string> = {};
    columns.forEach((c) => empty[c.slug] = '');
    setRows((r) => [...r, empty]);
  };

  const deleteRow = (idx: number) => {
    setRows((r) => r.filter((_, i) => i !== idx));
  };

  const updateColumnAI = (slug: string, ai: string) => {
    setColumns((c) => c.map((col) => col.slug === slug ? { ...col, ai } : col));
  };

  const importJSON = () => {
    // already handled by parent via value prop — this button helps refresh parsing
    try {
      const parsed = JSON.parse(value || '[]');
      if (Array.isArray(parsed)) setRows(parsed.map((r: any) => {
        const obj: Record<string, string> = {};
        columns.forEach((c) => obj[c.slug] = r[c.slug] ?? '');
        return obj;
      }));
    } catch (e) { /* ignore */ }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button onClick={addColumn}>Add column</Button>
        <Button onClick={addRow}>Add row</Button>
        <Button onClick={importJSON}>Refresh from JSON</Button>
      </div>

      <div className="overflow-auto border rounded mt-2">
        <table className="min-w-full table-auto">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.slug} className="p-2 align-top border-r">
                  <div className="flex items-center gap-2">
                    <Input value={col.slug} onChange={(e) => updateColumnSlug(col.slug, (e.target as HTMLInputElement).value)} className="w-36" />
                    <Button size="sm" variant="destructive" onClick={() => deleteColumn(col.slug)}>Del</Button>
                  </div>
                  <div className="mt-2">
                    <label className="text-xs">AI instruction</label>
                    <Textarea value={col.ai || ''} onChange={(e) => updateColumnAI(col.slug, (e.target as HTMLTextAreaElement).value)} className="h-20 mt-1" />
                    <div className="text-xs text-muted-foreground">You can reference other columns using {'{{column_slug}}'} or rows using {'{{column_slug[rowIndex]}}'} in your AI prompt. Evaluation happens during generation.</div>
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
                {columns.map((col) => (
                  <td key={col.slug} className="p-2 align-top border-r">
                    <Input value={row[col.slug] ?? ''} onChange={(e) => updateCell(ri, col.slug, (e.target as HTMLInputElement).value)} />
                  </td>
                ))}
                <td className="p-2 align-top">
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="destructive" onClick={() => deleteRow(ri)}>Delete row</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => onChange(JSON.stringify(rows, null, 2))}>Apply to JSON</Button>
      </div>
    </div>
  );
}
