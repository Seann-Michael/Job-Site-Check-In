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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  email: string;
  phone: string;
  address: string;
  notes: string;
  business_id?: string;
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

  const loadClients = async () => {
    setLoading(true);
    try {
      const { data: clientData, error } = await supabase
        .from("clients")
        .select("*");
      if (error) throw error;

      // Build business name lookup
      const businessIds = [
        ...new Set(
          (clientData || []).map((c: any) => c.business_id).filter(Boolean)
        ),
      ];
      const businessMap: Record<string, string> = {};
      if (businessIds.length > 0) {
        const { data: bizData } = await supabase
          .from("businesses")
          .select("id, name")
          .in("id", businessIds);
        (bizData || []).forEach((b: any) => {
          businessMap[b.id] = b.name;
        });
      }

      // Fetch job stats per client (count + latest activity timestamp)
      const { data: jobData } = await supabase
        .from("jobs")
        .select("client_id, updated_at, created_at")
        .not("client_id", "is", null);

      const jobStats: Record<string, { count: number; latest: string }> = {};
      (jobData || []).forEach((j: any) => {
        if (!j.client_id) return;
        const ts = j.updated_at || j.created_at || "";
        if (!jobStats[j.client_id]) {
          jobStats[j.client_id] = { count: 1, latest: ts };
        } else {
          jobStats[j.client_id].count++;
          if (ts > jobStats[j.client_id].latest)
            jobStats[j.client_id].latest = ts;
        }
      });

      const rows: ClientRow[] = (clientData || []).map((c: any) => ({
        ...c,
        businessName: businessMap[c.business_id] || "",
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
    loadClients();
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
        const { error } = await supabase
          .from("clients")
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq("id", editClient.id);
        if (error) throw error;
        toast.success("Client updated");
      } else {
        const { error } = await supabase.from("clients").insert([form]);
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
    if (!confirm(`Delete ${client.name}? This cannot be undone.`)) return;
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
          <Button onClick={openAdd} className="gap-2 self-start sm:self-auto">
            <Plus className="h-4 w-4" />
            Add Client
          </Button>
        </div>

        {/* Search bar */}
        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, business, phone, email or address…"
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
                    <ColHeader col="businessName" label="Business" />
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
                            {/* Business Name */}
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

                            {/* Customer Name */}
                            <div className="min-w-0">
                              <span className="text-sm font-medium truncate block">
                                {client.name}
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
                      ? "Business"
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
    </AppLayout>
  );
}
