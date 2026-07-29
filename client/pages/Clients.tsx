import React, { useState, useEffect, useRef, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Users,
  Search,
  Plus,
  MoreVertical,
  Trash2,
  Edit,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { workspaceService } from "@/lib/workspaceService";
import {
  clientDisplayLabel,
  renameClientAcrossJobs,
} from "@/lib/clientNames";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/dataService";
import { formatDistanceToNow } from "date-fns";

type SortKey =
  | "businessName"
  | "name"
  | "phone"
  | "email"
  | "address"
  | "jobCount"
  | "lastActivity";
type SortDir = "asc" | "desc";

interface ClientRow {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  business_id?: string;
  /**
   * The CLIENT'S OWN company (clients.business_name) — the same fact mobile
   * shows next to the person. Not the tenant workspace: that used to be what
   * this column displayed, labelled "Business", which meant the same word
   * labelled two different facts across platforms.
   */
  businessName: string;
  jobCount: number;
  lastActivity: string | null;
  created_at: string;
}

// Shared grid column template for header and rows
const COLS = "160px 180px 140px 200px minmax(160px,1fr) 80px 140px 52px";

const emptyForm = { name: "", email: "", phone: "", address: "", notes: "" };

export default function Clients() {
  const navigate = useNavigate();
  const parentRef = useRef<HTMLDivElement>(null);

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showDialog, setShowDialog] = useState(false);
  const [editClient, setEditClient] = useState<ClientRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Bulk upload state
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkRows, setBulkRows] = useState<Record<string, string>[]>([]);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [bulkDragOver, setBulkDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadClients = async () => {
    setLoading(true);
    try {
      // Scope to the active business, the way mobile's fetchClients does —
      // an unscoped read is every tenant's customers, not a longer list.
      // Wait for workspace init first: on a cold load getCurrentBusinessId()
      // is still null and the queries below would run unscoped.
      // Legacy rows with business_id NULL (created before inserts were
      // stamped) are deliberately kept visible here: no scoped read anywhere
      // returns them, so hiding them on the web too would strand them with no
      // screen left to see or fix them from.
      const { currentBusinessId: businessId } = await workspaceService.whenReady();
      if (!businessId) {
        // Fail closed: no workspace means no tenant to scope to — show an
        // empty list rather than every tenant's data.
        setClients([]);
        return;
      }
      const { data: clientData, error } = await supabase
        .from("clients")
        .select("*")
        .or(`business_id.eq.${businessId},business_id.is.null`);
      if (error) throw error;

      // Fetch job stats per client (count + latest activity timestamp).
      // Jobs reference a client two ways — web-created jobs carry client_id,
      // mobile-created jobs carry only the name string in client_contact — so
      // match on either key or every mobile job counts as zero.
      const { data: jobData } = await supabase
        .from("jobs")
        .select("client_id, client_contact, updated_at, created_at")
        .eq("business_id", businessId);

      const idByName: Record<string, string> = {};
      (clientData || []).forEach((c: any) => {
        const key = (c.name || "").trim().toLowerCase();
        if (key && !idByName[key]) idByName[key] = c.id;
      });

      const jobStats: Record<string, { count: number; latest: string }> = {};
      (jobData || []).forEach((j: any) => {
        const contactName =
          typeof j.client_contact?.name === "string"
            ? j.client_contact.name.trim().toLowerCase()
            : "";
        const clientId = j.client_id || (contactName ? idByName[contactName] : undefined);
        if (!clientId) return;
        const ts = j.updated_at || j.created_at || "";
        if (!jobStats[clientId]) {
          jobStats[clientId] = { count: 1, latest: ts };
        } else {
          jobStats[clientId].count++;
          if (ts > jobStats[clientId].latest)
            jobStats[clientId].latest = ts;
        }
      });

      const rows: ClientRow[] = (clientData || []).map((c: any) => ({
        ...c,
        // The client's own company, same as mobile — not the tenant workspace.
        businessName: c.business_name || "",
        jobCount: jobStats[c.id]?.count || 0,
        lastActivity:
          jobStats[c.id]?.latest || c.updated_at || c.created_at || null,
      }));

      setClients(rows);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load clients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // loadClients awaits workspace init itself, so the cold-load call below
    // runs scoped once init lands. The subscription re-runs the load whenever
    // the active business changes afterwards (e.g. company switcher).
    loadClients();
    let lastBusinessId: string | null | undefined;
    const unsubscribe = workspaceService.subscribe((state) => {
      if (
        lastBusinessId !== undefined &&
        state.currentBusinessId !== lastBusinessId
      ) {
        loadClients();
      }
      lastBusinessId = state.currentBusinessId;
    });
    return unsubscribe;
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = q
      ? clients.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            clientDisplayLabel(c).toLowerCase().includes(q) ||
            c.businessName.toLowerCase().includes(q) ||
            (c.email || "").toLowerCase().includes(q) ||
            (c.phone || "").toLowerCase().includes(q) ||
            (c.address || "").toLowerCase().includes(q)
        )
      : [...clients];

    list.sort((a, b) => {
      let valA: any;
      let valB: any;
      if (sortKey === "jobCount") {
        valA = a.jobCount;
        valB = b.jobCount;
      } else if (sortKey === "lastActivity") {
        valA = a.lastActivity || "";
        valB = b.lastActivity || "";
      } else {
        valA = (a[sortKey as keyof ClientRow] as string) || "";
        valB = (b[sortKey as keyof ClientRow] as string) || "";
      }
      const cmp =
        typeof valA === "number"
          ? valA - valB
          : String(valA).localeCompare(String(valB));
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [clients, search, sortKey, sortDir]);

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 15,
  });

  const openAdd = () => {
    setEditClient(null);
    setForm(emptyForm);
    setShowDialog(true);
  };

  const openEdit = (client: ClientRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditClient(client);
    setForm({
      name: client.name,
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
      notes: client.notes || "",
    });
    setShowDialog(true);
  };

  const saveClient = async () => {
    if (!form.name.trim()) {
      toast.error("Client name is required");
      return;
    }
    setSaving(true);
    try {
      if (editClient) {
        const newName = form.name.trim();
        const renamed =
          newName.toLowerCase() !== (editClient.name || "").trim().toLowerCase();
        let moved = 0;
        if (renamed) {
          // Mobile jobs join to clients by the client_contact.name string, so
          // the jobs have to move BEFORE the client row is renamed — and if
          // the cascade fails, the rename is abandoned rather than orphaning
          // the client's work (mirrors mobile's edit screen). The cascade
          // requires a business scope (it fails closed without one), so
          // legacy clients with a NULL business_id are scoped to the active
          // workspace they're being edited from.
          const { currentBusinessId } = await workspaceService.whenReady();
          const result = await renameClientAcrossJobs(
            editClient.name,
            newName,
            editClient.business_id ?? currentBusinessId
          );
          if (result.error) {
            toast.error(
              `Couldn't rename client: ${result.error}${
                result.updated
                  ? ` (${result.updated} job(s) already moved)`
                  : ""
              }`
            );
            return;
          }
          moved = result.updated;
        }
        const updates: Record<string, any> = {
          ...form,
          name: newName,
          updated_at: new Date().toISOString(),
        };
        if (renamed) {
          // Keep the split fields coherent: mobile recomposes `name` from
          // first/last on its next save, so stale parts would silently revert
          // this rename (and cascade the jobs back with it).
          const parts = newName.split(/\s+/).filter(Boolean);
          updates.first_name = parts[0] || null;
          updates.last_name = parts.slice(1).join(" ") || null;
        }
        const { error } = await supabase
          .from("clients")
          .update(updates)
          .eq("id", editClient.id);
        if (error) throw error;
        toast.success(
          moved
            ? `Client updated — ${moved} job${moved === 1 ? "" : "s"} moved to the new name`
            : "Client updated"
        );
      } else {
        // Stamp the active business, exactly as the bulk import does: an
        // unstamped row is invisible to mobile's business-scoped fetch.
        // Wait for workspace init so a cold load can't slip through with a
        // null id — and fail closed if there's genuinely no workspace, since
        // an unstamped insert would be invisible everywhere.
        const { currentBusinessId: businessId } = await workspaceService.whenReady();
        if (!businessId) {
          toast.error(
            "No active business workspace — the client can't be saved. Reload the page and try again."
          );
          return;
        }
        const payload: Record<string, any> = {
          ...form,
          name: form.name.trim(),
          business_id: businessId,
        };
        const { error } = await supabase.from("clients").insert([payload]);
        if (error) throw error;
        toast.success("Client added");
      }
      setShowDialog(false);
      loadClients();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save client");
    } finally {
      setSaving(false);
    }
  };

  const deleteClient = async (client: ClientRow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete ${clientDisplayLabel(client)}? This cannot be undone.`)) return;
    try {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", client.id);
      if (error) throw error;
      toast.success("Client deleted");
      loadClients();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete client");
    }
  };

  // ── Bulk upload helpers ────────────────────────────────────────────
  const CSV_TEMPLATE_HEADERS = ["name", "business_name", "first_name", "last_name", "phone", "email", "address", "notes"];

  const downloadTemplate = () => {
    const exampleRow = ["John Smith", "Acme Corp", "John", "Smith", "555-123-4567", "john@acme.com", "123 Main St, Springfield, IL", "VIP client"];
    const csv = [CSV_TEMPLATE_HEADERS.join(","), exampleRow.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clients_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[\s_]+/g, "_"));
    return lines.slice(1).map((line) => {
      // Handle quoted fields
      const fields: string[] = [];
      let cur = "";
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuote = !inQuote;
        } else if (ch === "," && !inQuote) {
          fields.push(cur.trim());
          cur = "";
        } else {
          cur += ch;
        }
      }
      fields.push(cur.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = fields[i] || ""; });
      return row;
    }).filter((row) => row["name"]?.trim());
  };

  const handleBulkFile = (file: File) => {
    setBulkFile(file);
    setBulkResults(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      setBulkRows(rows);
    };
    reader.readAsText(file);
  };

  const runBulkImport = async () => {
    if (!bulkRows.length) return;
    // Same stamping rule as the single-add path: wait for workspace init and
    // fail closed rather than importing rows no scoped fetch would ever see.
    const { currentBusinessId: businessId } = await workspaceService.whenReady();
    if (!businessId) {
      toast.error(
        "No active business workspace — clients can't be imported. Reload the page and try again."
      );
      return;
    }
    setBulkImporting(true);
    const errors: string[] = [];
    let success = 0;
    for (let i = 0; i < bulkRows.length; i++) {
      const row = bulkRows[i];
      try {
        const payload: Record<string, any> = {
          name: row["name"],
          business_name: row["business_name"] || null,
          first_name: row["first_name"] || null,
          last_name: row["last_name"] || null,
          phone: row["phone"] || null,
          email: row["email"] || null,
          address: row["address"] || null,
          notes: row["notes"] || null,
          business_id: businessId,
        };
        const { error } = await supabase.from("clients").insert([payload]);
        if (error) throw error;
        success++;
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${row["name"]} — ${err.message || "Unknown error"}`);
      }
    }
    setBulkResults({ success, failed: errors.length, errors });
    setBulkImporting(false);
    if (success > 0) loadClients();
  };

  const openBulkDialog = () => {
    setBulkFile(null);
    setBulkRows([]);
    setBulkResults(null);
    setShowBulkDialog(true);
  };

  // ── End bulk upload helpers ──────────────────────────────────────────

  const formatActivity = (ts: string | null) => {
    if (!ts) return "—";
    try {
      return formatDistanceToNow(new Date(ts), { addSuffix: true });
    } catch {
      return "—";
    }
  };

  // Sort icon for column headers
  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col)
      return <ChevronsUpDown className="h-3 w-3 opacity-40 flex-shrink-0" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 flex-shrink-0" />
    ) : (
      <ChevronDown className="h-3 w-3 flex-shrink-0" />
    );
  };

  const ColHeader = ({
    col,
    label,
    right,
  }: {
    col: SortKey;
    label: string;
    right?: boolean;
  }) => (
    <button
      className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors select-none w-full ${right ? "justify-end" : ""}`}
      onClick={() => handleSort(col)}
    >
      {label}
      <SortIcon col={col} />
    </button>
  );

  return (
    <AppLayout>
      <div className="flex flex-col h-full p-4 sm:p-6 gap-4">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Clients
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {clients.length} client{clients.length !== 1 ? "s" : ""}
              {filtered.length !== clients.length &&
                ` · ${filtered.length} shown`}
            </p>
          </div>
          <div className="flex gap-2 self-start sm:self-auto">
            <Button variant="outline" onClick={openBulkDialog} className="gap-2">
              <Upload className="h-4 w-4" />
              Bulk Upload
            </Button>
            <Button onClick={openAdd} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Client
            </Button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, company, phone, email or address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Table container */}
        <div className="flex-1 min-h-0 border rounded-lg overflow-hidden flex flex-col bg-background">
          {loading ? (
            <div className="flex-1 p-4 space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 bg-muted/60 rounded animate-pulse"
                  style={{ opacity: 1 - i * 0.08 }}
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Users className="h-12 w-12 opacity-20" />
              <p className="font-medium text-sm">
                {search ? "No clients match your search" : "No clients yet"}
              </p>
              {!search && (
                <Button
                  onClick={openAdd}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add your first client
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Scrollable area — handles both x and y */}
              <div
                ref={parentRef}
                className="flex-1 overflow-auto min-h-0"
              >
                {/* Fixed-minimum-width inner wrapper so columns don't squish */}
                <div className="min-w-[1080px]">
                  {/* Sticky column header */}
                  <div
                    className="sticky top-0 z-10 border-b bg-muted/80 backdrop-blur-sm"
                    style={{ display: "grid", gridTemplateColumns: COLS, padding: "0 16px", gap: "8px", alignItems: "center", height: "40px" }}
                  >
                    <ColHeader col="businessName" label="Company" />
                    <ColHeader col="name" label="Customer Name" />
                    <ColHeader col="phone" label="Phone" />
                    <ColHeader col="email" label="Email" />
                    <ColHeader col="address" label="Address" />
                    <ColHeader col="jobCount" label="Jobs" right />
                    <ColHeader col="lastActivity" label="Last Activity" />
                    <div />
                  </div>

                  {/* Virtual rows */}
                  <div
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      position: "relative",
                    }}
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const client = filtered[virtualRow.index];
                      return (
                        <div
                          key={virtualRow.key}
                          data-index={virtualRow.index}
                          ref={rowVirtualizer.measureElement}
                          onClick={() =>
                            navigate(`/admin/clients/${client.id}`)
                          }
                          className="absolute left-0 right-0 border-b cursor-pointer hover:bg-muted/40 transition-colors group"
                          style={{ top: `${virtualRow.start}px` }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: COLS,
                              padding: "0 16px",
                              gap: "8px",
                              alignItems: "center",
                              height: "52px",
                            }}
                          >
                            {/* Company (the client's own business_name) */}
                            <div className="min-w-0">
                              {client.businessName ? (
                                <span className="text-sm truncate block">
                                  {client.businessName}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground/40">
                                  —
                                </span>
                              )}
                            </div>

                            {/* Customer Name — same precedence mobile shows:
                                person (first/last) over the raw join-key name */}
                            <div className="min-w-0">
                              <span className="text-sm font-medium truncate block">
                                {clientDisplayLabel(client)}
                              </span>
                            </div>

                            {/* Phone */}
                            <div className="min-w-0">
                              {client.phone ? (
                                <span className="text-sm text-muted-foreground truncate block">
                                  {client.phone}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground/40">
                                  —
                                </span>
                              )}
                            </div>

                            {/* Email */}
                            <div className="min-w-0">
                              {client.email ? (
                                <span className="text-sm text-muted-foreground truncate block">
                                  {client.email}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground/40">
                                  —
                                </span>
                              )}
                            </div>

                            {/* Address */}
                            <div className="min-w-0">
                              {client.address ? (
                                <span className="text-sm text-muted-foreground truncate block">
                                  {client.address}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground/40">
                                  —
                                </span>
                              )}
                            </div>

                            {/* Total Jobs */}
                            <div className="text-right">
                              <span
                                className={`text-sm font-semibold tabular-nums ${
                                  client.jobCount > 0
                                    ? "text-foreground"
                                    : "text-muted-foreground/40"
                                }`}
                              >
                                {client.jobCount > 0 ? client.jobCount : "—"}
                              </span>
                            </div>

                            {/* Last Activity */}
                            <div className="min-w-0">
                              <span className="text-xs text-muted-foreground truncate block">
                                {formatActivity(client.lastActivity)}
                              </span>
                            </div>

                            {/* Row actions */}
                            <div
                              className="flex justify-end"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={(e) => openEdit(client, e)}
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={(e) => deleteClient(client, e)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex-shrink-0 border-t px-4 py-2 text-xs text-muted-foreground bg-muted/20 flex items-center justify-between">
                <span>
                  {filtered.length} of {clients.length} client
                  {clients.length !== 1 ? "s" : ""}
                </span>
                <span>
                  Sorted by{" "}
                  <span className="font-medium capitalize">
                    {sortKey === "businessName"
                      ? "Company"
                      : sortKey === "name"
                        ? "Customer Name"
                        : sortKey === "jobCount"
                          ? "Total Jobs"
                          : sortKey === "lastActivity"
                            ? "Last Activity"
                            : sortKey}
                  </span>{" "}
                  ({sortDir === "asc" ? "A→Z" : "Z→A"})
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editClient ? "Edit Client" : "Add Client"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input
                autoFocus
                placeholder="Customer name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input
                  placeholder="Phone number"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  placeholder="Email address"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input
                placeholder="Street address"
                value={form.address}
                onChange={(e) =>
                  setForm({ ...form, address: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                placeholder="Any notes about this client..."
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveClient} disabled={saving}>
              {saving
                ? "Saving..."
                : editClient
                  ? "Save Changes"
                  : "Add Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Bulk Upload Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={(open) => { if (!bulkImporting) setShowBulkDialog(open); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Bulk Upload Clients
            </DialogTitle>
          </DialogHeader>

          {!bulkResults ? (
            <div className="space-y-4 py-2">
              {/* Template download */}
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">CSV Template</p>
                  <p className="text-xs text-muted-foreground">Download the template to see required column format</p>
                </div>
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2 flex-shrink-0">
                  <Download className="h-3.5 w-3.5" />
                  Download Template
                </Button>
              </div>

              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  bulkDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setBulkDragOver(true); }}
                onDragLeave={() => setBulkDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setBulkDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleBulkFile(file);
                }}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {bulkFile ? bulkFile.name : "Drop a CSV file here or click to browse"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {bulkFile
                    ? `${bulkRows.length} valid client${bulkRows.length !== 1 ? "s" : ""} found`
                    : "Accepts .csv files only"}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBulkFile(f); e.target.value = ""; }}
                />
              </div>

              {/* Preview table */}
              {bulkRows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Preview <span className="text-muted-foreground font-normal">(first 5 rows)</span></p>
                  <div className="border rounded-lg overflow-auto max-h-48">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/60 sticky top-0">
                        <tr>
                          {CSV_TEMPLATE_HEADERS.map((h) => (
                            <th key={h} className="text-left px-3 py-2 font-semibold capitalize whitespace-nowrap">{h.replace(/_/g, " ")}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bulkRows.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-t">
                            {CSV_TEMPLATE_HEADERS.map((h) => (
                              <td key={h} className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{row[h] || "—"}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {bulkRows.length > 5 && (
                    <p className="text-xs text-muted-foreground">…and {bulkRows.length - 5} more</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Results screen */
            <div className="space-y-4 py-2">
              <div className="flex gap-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-medium">{bulkResults.success} imported</span>
                </div>
                {bulkResults.failed > 0 && (
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">{bulkResults.failed} failed</span>
                  </div>
                )}
              </div>
              {bulkResults.errors.length > 0 && (
                <div className="border rounded-lg bg-destructive/5 p-3 space-y-1 max-h-48 overflow-auto">
                  <p className="text-xs font-semibold text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> Errors</p>
                  {bulkResults.errors.map((err, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {!bulkResults ? (
              <>
                <Button variant="outline" onClick={() => setShowBulkDialog(false)} disabled={bulkImporting}>Cancel</Button>
                <Button
                  onClick={runBulkImport}
                  disabled={bulkRows.length === 0 || bulkImporting}
                  className="gap-2"
                >
                  {bulkImporting ? (
                    <><span className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />Importing…</>
                  ) : (
                    <><Upload className="h-3.5 w-3.5" />Import {bulkRows.length > 0 ? bulkRows.length : ""} Client{bulkRows.length !== 1 ? "s" : ""}</>
                  )}
                </Button>
              </>
            ) : (
              <Button onClick={() => { setShowBulkDialog(false); setBulkResults(null); }}>Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
