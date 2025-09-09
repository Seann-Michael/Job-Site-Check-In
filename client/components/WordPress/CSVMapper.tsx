import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

const VARIABLES = ["city", "state", "zip", "neighborhood", "service", "business_name", "phone", "custom"];

export default function CSVMapper({ rawText, onApply }: { rawText: string; onApply: (items: any[]) => void }) {
  const [mappings, setMappings] = useState<Record<string, string>>({});

  const headers = useMemo(() => {
    const lines = rawText.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lines.length === 0) return [];
    return lines[0].split(",").map((h) => h.trim());
  }, [rawText]);

  const rows = useMemo(() => {
    const lines = rawText.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lines.length <= 1) return [];
    return lines.slice(1).map((r) => r.split(",").map((c) => c.trim()));
  }, [rawText]);

  const handleChange = (header: string, variable: string) => {
    setMappings((m) => ({ ...m, [header]: variable }));
  };

  const applyMapping = () => {
    const items = rows.map((cols) => {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => {
        const mapTo = mappings[h];
        if (!mapTo) return;
        if (mapTo === 'custom') {
          obj[h] = cols[i] || '';
        } else {
          obj[mapTo] = cols[i] || '';
        }
      });
      return obj;
    });
    onApply(items);
  };

  return (
    <div className="p-4 border rounded">
      <h4 className="font-medium">Map CSV Headers to Variables</h4>
      <div className="mt-3 space-y-2">
        {headers.map((h) => (
          <div key={h} className="flex items-center gap-2">
            <div className="w-48 text-sm">{h}</div>
            <Select onValueChange={(v) => handleChange(h, v)}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Map to variable" /></SelectTrigger>
              <SelectContent>
                {VARIABLES.map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={applyMapping}>Apply Mapping</Button>
      </div>
    </div>
  );
}
