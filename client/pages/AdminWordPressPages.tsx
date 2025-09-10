import React, { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import TemplateEditor from "@/components/WordPress/TemplateEditor";
import CSVMapper from "@/components/WordPress/CSVMapper";
import SpreadsheetEditor from "@/components/WordPress/SpreadsheetEditor";

export default function AdminWordPressPages() {
  const [sites, setSites] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [itemsJson, setItemsJson] = useState<string>("[]");
  const [rawCSVText, setRawCSVText] = useState<string>("");
  const [showCSVMapper, setShowCSVMapper] = useState<boolean>(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [previews, setPreviews] = useState<any[]>([]);
  const [spreadsheetColumns, setSpreadsheetColumns] = useState<any[]>([]);

  useEffect(() => {
    fetch('/.netlify/functions/wordpress-connections')
      .then((r) => r.json())
      .then((d) => setSites(d.sites || []))
      .catch(() => setSites([]));

    fetch('/.netlify/functions/page-templates')
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .catch(() => setTemplates([]));

    fetch('/.netlify/functions/bulk-pages/jobs')
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs || []))
      .catch(() => setJobs([]));
  }, []);

  // CSV parsing utility (simple parser)
  function parseCSV(text: string) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lines.length === 0) return [];
    const headers = lines[0].split(",").map((h) => h.trim());
    const rows = lines.slice(1);
    return rows.map((r) => {
      const cols = r.split(",").map((c) => c.trim());
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => {
        obj[h] = cols[i] || "";
      });
      return obj;
    });
  }

  // Handle CSV file upload and convert to JSON items (store raw CSV too for mapping)
  const handleCSVFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || "");
      try {
        const parsed = parseCSV(text);
        setRawCSVText(text);
        setItemsJson(JSON.stringify(parsed, null, 2));
        setShowCSVMapper(true);
      } catch (err) {
        alert('Failed to parse CSV file');
      }
    };
    reader.readAsText(file);
  };

  // Template creation form state
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateContent, setNewTemplateContent] = useState("");
  const [newTemplatePageType, setNewTemplatePageType] = useState("custom");
  const [newTitleTemplate, setNewTitleTemplate] = useState("");
  const [newSlugTemplate, setNewSlugTemplate] = useState("");
  const [newMetaDescriptionTemplate, setNewMetaDescriptionTemplate] = useState("");

  const createTemplate = async () => {
    if (!newTemplateName || !newTemplateContent) { alert('Template name and content required'); return; }
    const payload = {
      template_name: newTemplateName,
      template_content: newTemplateContent,
      variables: [],
      page_type: newTemplatePageType,
      metadata: {
        title_template: newTitleTemplate,
        slug_template: newSlugTemplate,
        meta_description_template: newMetaDescriptionTemplate,
      },
    };
    const res = await fetch('/.netlify/functions/page-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.template) {
      setTemplates((t) => [data.template, ...t]);
      setNewTemplateName(''); setNewTemplateContent(''); setNewTemplatePageType('custom'); setNewTitleTemplate(''); setNewSlugTemplate(''); setNewMetaDescriptionTemplate('');
      alert('Template created');
    } else {
      alert('Failed to create template');
    }
  };

  const handlePreview = async () => {
    if (!selectedTemplate) return;
    let items = [];
    try { items = JSON.parse(itemsJson); } catch (e) { alert('Invalid JSON for items'); return; }
    const res = await fetch('/.netlify/functions/bulk-pages/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template_id: selectedTemplate, items, options: { columns: spreadsheetColumns } }) });
    const data = await res.json();
    setPreviews(data.previews || []);
  };

  const handleGenerate = async () => {
    if (!selectedTemplate || !selectedSite) { alert('Select site and template'); return; }
    let items = [];
    try { items = JSON.parse(itemsJson); } catch (e) { alert('Invalid JSON for items'); return; }
    const res = await fetch('/.netlify/functions/bulk-pages/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}` }, body: JSON.stringify({ site_id: selectedSite, template_id: selectedTemplate, items, options: { columns: spreadsheetColumns } }) });
    const data = await res.json();
    if (data.job_id) {
      alert('Job started: ' + data.job_id);
    } else {
      alert('Failed to start job');
    }
  };

  return (
    <AppLayout title="WordPress Pages" breadcrumbs={[{ label: 'WordPress Pages' }]}>
      <div className="space-y-6">
        <Tabs defaultValue="generator">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="generator">Page Generator</TabsTrigger>
            <TabsTrigger value="templates">Templates Library</TabsTrigger>
            <TabsTrigger value="history">Generation History</TabsTrigger>
          </TabsList>

          <TabsContent value="generator" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="col-span-1">
                <label className="text-sm">Target WordPress Site</label>
                <Select onValueChange={(v) => setSelectedSite(v)}>
                  <SelectTrigger className="w-full mt-2"><SelectValue placeholder="Select a site" /></SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.site_name || s.site_url}</SelectItem>)}
                  </SelectContent>
                </Select>

                <label className="text-sm mt-4">Template</label>
                <Select onValueChange={(v) => setSelectedTemplate(v)}>
                  <SelectTrigger className="w-full mt-2"><SelectValue placeholder="Select a template" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.template_name}</SelectItem>)}
                  </SelectContent>
                </Select>

                <label className="text-sm mt-4">Data (Spreadsheet) or CSV</label>
                <div className="flex items-center gap-2 mt-2">
                  <input type="file" accept=".csv,text/csv" onChange={(e) => handleCSVFile(e.target.files ? e.target.files[0] : null)} className="" />
                  <Button onClick={() => { try { const parsed = JSON.parse(itemsJson); alert(`Loaded ${parsed.length || 0} items`); } catch (e) { alert('Invalid JSON'); } }}>Validate JSON</Button>
                </div>

                <div className="mt-2">
                  <SpreadsheetEditor value={itemsJson} onChange={(v) => setItemsJson(v)} onColumnsChange={(cols) => setSpreadsheetColumns(cols)} />
                </div>

                {rawCSVText && showCSVMapper && (
                  <div className="mt-4">
                    <CSVMapper rawText={rawCSVText} onApply={(items) => { setItemsJson(JSON.stringify(items, null, 2)); setShowCSVMapper(false); setRawCSVText(''); }} />
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <Button onClick={handlePreview}>Preview</Button>
                  <Button onClick={handleGenerate} variant="primary">Generate</Button>
                </div>
              </div>

              <div className="col-span-2">
                <h3 className="text-lg font-semibold">Preview (first 5)</h3>
                <div className="space-y-4 mt-2">
                  {previews.map((p, idx) => (
                    <div key={idx} className="border rounded p-4">
                      <div className="font-medium">{p.title} — <span className="text-sm text-muted-foreground">{p.slug}</span></div>
                      <div className="mt-2 text-sm" dangerouslySetInnerHTML={{ __html: p.rendered }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="col-span-1">
                <h3 className="text-lg font-semibold">Create Template</h3>
                <p className="text-sm text-muted-foreground">Create a new template for bulk generation.</p>

                <label className="text-sm mt-3">Template Name</label>
                <Input value={newTemplateName} onChange={(e) => setNewTemplateName((e.target as HTMLInputElement).value)} className="mt-2" />

                <label className="text-sm mt-3">Page Type</label>
                <Select onValueChange={(v) => setNewTemplatePageType(v)}>
                  <SelectTrigger className="w-full mt-2"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="location">Location</SelectItem>
                    <SelectItem value="combo">Combo</SelectItem>
                  </SelectContent>
                </Select>

                <label className="text-sm mt-3">Title Template</label>
                <Input value={newTitleTemplate} onChange={(e) => setNewTitleTemplate((e.target as HTMLInputElement).value)} className="mt-2" />

                <label className="text-sm mt-3">Slug Template</label>
                <Input value={newSlugTemplate} onChange={(e) => setNewSlugTemplate((e.target as HTMLInputElement).value)} className="mt-2" />

                <label className="text-sm mt-3">Meta Description Template</label>
                <Textarea value={newMetaDescriptionTemplate} onChange={(e) => setNewMetaDescriptionTemplate((e.target as HTMLTextAreaElement).value)} className="mt-2" />

                <label className="text-sm mt-3">Content (HTML with variables)</label>
                <TemplateEditor value={newTemplateContent} onChange={(v) => setNewTemplateContent(v)} />

                <div className="flex gap-2 mt-4">
                  <Button onClick={createTemplate}>Create Template</Button>
                </div>
              </div>
              <div className="col-span-2">
                <h3 className="text-lg font-semibold">Templates Library</h3>
                <table className="w-full table-auto mt-4">
                  <thead>
                    <tr><th className="text-left">Name</th><th>Type</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {templates.map((t) => (
                      <tr key={t.id}><td>{t.template_name}</td><td>{t.page_type}</td><td><Button size="sm">Edit</Button></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <h3 className="text-lg font-semibold">Generation Jobs</h3>
            <table className="w-full table-auto">
              <thead>
                <tr><th>Date</th><th>Site</th><th>Template</th><th>Pages</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td>{new Date(j.created_at).toLocaleString()}</td>
                    <td>{j.site_name || j.wordpress_connections?.site_name}</td>
                    <td>{j.template_id}</td>
                    <td>{j.completed_pages}/{j.total_pages}</td>
                    <td>{j.status}</td>
                    <td className="flex gap-2">
                      {j.status === 'processing' && <Button size="sm" variant="outline" onClick={async () => { await fetch(`/.netlify/functions/bulk-pages/jobs/${j.id}/pause`, { method: 'POST' }); alert('Pause requested'); }}>Pause</Button>}
                      {j.status === 'paused' && <Button size="sm" onClick={async () => { await fetch(`/.netlify/functions/bulk-pages/jobs/${j.id}/resume`, { method: 'POST' }); alert('Resume requested'); }}>Resume</Button>}
                      {j.status !== 'completed' && j.status !== 'canceled' && <Button size="sm" variant="destructive" onClick={async () => { if (!confirm('Cancel job?')) return; await fetch(`/.netlify/functions/bulk-pages/jobs/${j.id}/cancel`, { method: 'POST' }); alert('Cancel requested'); }}>Cancel</Button>}
                      <Button size="sm" onClick={async () => { const res = await fetch(`/.netlify/functions/bulk-pages/jobs/${j.id}`); const d = await res.json(); console.log(d); alert('See console for job details'); }}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
