import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  MoreVertical,
  Trash2,
  Edit,
  FolderOpen,
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

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  created_at: string;
  project_count?: number;
}

const emptyForm = { name: "", email: "", phone: "", address: "", notes: "" };

export default function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;

      // Fetch project counts per client
      const { data: projectCounts } = await supabase
        .from("jobs")
        .select("client_id")
        .not("client_id", "is", null);

      const countMap: Record<string, number> = {};
      (projectCounts || []).forEach((p: any) => {
        if (p.client_id) countMap[p.client_id] = (countMap[p.client_id] || 0) + 1;
      });

      setClients(
        (data || []).map((c: any) => ({ ...c, project_count: countMap[c.id] || 0 }))
      );
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

  const openAdd = () => {
    setEditClient(null);
    setForm(emptyForm);
    setShowDialog(true);
  };

  const openEdit = (client: Client, e: React.MouseEvent) => {
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

  const deleteClient = async (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete ${client.name}? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from("clients").delete().eq("id", client.id);
      if (error) throw error;
      toast.success("Client deleted");
      loadClients();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete client");
    }
  };

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q)
    );
  });

  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Clients
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Manage customer contact details, jobs, documents and reviews
            </p>
          </div>
          <Button onClick={openAdd} className="gap-2 self-start sm:self-auto">
            <Plus className="h-4 w-4" />
            Add Client
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{clients.length}</p>
              <p className="text-sm text-muted-foreground">Total Clients</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">
                {clients.reduce((a, c) => a + (c.project_count || 0), 0)}
              </p>
              <p className="text-sm text-muted-foreground">Total Jobs</p>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">
                {clients.filter((c) => (c.project_count || 0) > 0).length}
              </p>
              <p className="text-sm text-muted-foreground">Active Clients</p>
            </CardContent>
          </Card>
        </div>

        {/* Client List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">
              {search ? "No clients match your search" : "No clients yet"}
            </p>
            {!search && (
              <Button onClick={openAdd} variant="outline" className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Add your first client
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((client) => (
              <Card
                key={client.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/admin/clients/${client.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm flex-shrink-0">
                      {initials(client.name)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">
                          {client.name}
                        </span>
                        {(client.project_count || 0) > 0 && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <FolderOpen className="h-3 w-3" />
                            {client.project_count}{" "}
                            {client.project_count === 1 ? "job" : "jobs"}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                        {client.phone && (
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {client.phone}
                          </span>
                        )}
                        {client.email && (
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {client.email}
                          </span>
                        )}
                        {client.address && (
                          <span className="flex items-center gap-1 text-sm text-muted-foreground truncate">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            {client.address}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => openEdit(client, e)}>
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editClient ? "Edit Client" : "Add Client"}</DialogTitle>
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
                onChange={(e) => setForm({ ...form, address: e.target.value })}
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
              {saving ? "Saving..." : editClient ? "Save Changes" : "Add Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
