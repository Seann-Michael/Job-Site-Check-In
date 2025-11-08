import React, { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminWordPressSites() {
  const [sites, setSites] = useState<any[]>([]);
  const [siteUrl, setSiteUrl] = useState("");
  const [siteName, setSiteName] = useState("");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    fetch('/api/wordpress-connections')
      .then((r) => r.json())
      .then((d) => setSites(d.sites || []))
      .catch(() => setSites([]));
  }, []);

  const handleAdd = async () => {
    if (!siteUrl) { alert('site url required'); return; }
    const res = await fetch('/api/wordpress-connections/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ site_url: siteUrl, site_name: siteName, api_key: apiKey }) });
    const data = await res.json();
    if (data.site) {
      setSites((s) => [data.site, ...s]);
      setSiteUrl(''); setSiteName(''); setApiKey('');
    } else {
      alert('Failed to add site');
    }
  };

  const handleTest = async (s: any) => {
    const res = await fetch('/api/wordpress-connections/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ site_url: s.site_url, api_key: s.api_key }) });
    const data = await res.json();
    if (data.success) alert('Connection OK'); else alert('Connection failed');
  };

  const handleDelete = async (id: string) => {
    const res = await fetch('/api/wordpress-connections/' + id, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) setSites((prev) => prev.filter((p) => p.id !== id)); else alert('Failed to delete');
  };

  return (
    <AppLayout title="WordPress Sites" breadcrumbs={[{ label: 'WordPress Sites' }]}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm">Site URL</label>
            <Input value={siteUrl} onChange={(e) => setSiteUrl((e.target as HTMLInputElement).value)} className="mt-2" />
            <label className="text-sm mt-2">Site Name</label>
            <Input value={siteName} onChange={(e) => setSiteName((e.target as HTMLInputElement).value)} className="mt-2" />
            <label className="text-sm mt-2">API Key / Credentials</label>
            <Input value={apiKey} onChange={(e) => setApiKey((e.target as HTMLInputElement).value)} className="mt-2" />
            <div className="flex gap-2 mt-4">
              <Button onClick={handleAdd}>Add Site</Button>
            </div>
          </div>

          <div className="md:col-span-2">
            <h3 className="text-lg font-semibold">Connected Sites</h3>
            <div className="space-y-2 mt-4">
              {sites.map((s) => (
                <div key={s.id} className="border p-3 rounded flex items-center justify-between">
                  <div>
                    <div className="font-medium">{s.site_name || s.site_url}</div>
                    <div className="text-sm text-muted-foreground">{s.site_url}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleTest(s)}>Test</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(s.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
