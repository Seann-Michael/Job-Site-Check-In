import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Activity,
  Edit,
  Trash2,
  Camera,
  Video,
  FolderOpen,
  DollarSign,
  Save,
  X,
  Plus,
  LogIn,
  MessageSquare,
  CreditCard,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import supabaseClient from "@/lib/supabaseClient";
import { workspaceService } from "@/lib/workspaceService";
import { UserManagementSystem } from "@/components/UserManagementSystem";
import { getCurrentUser } from "@/lib/auth";
import {
  getBusinessBilling,
  getPlans,
  assignPlan,
  cancel,
  formatMoney,
  planAmount,
  type PlanRow,
  type BillingRecordRow,
  type SubscriptionRow,
  type AssignMode,
} from "@/lib/billingService";
import {
  fetchBusinessAggregate,
  formatDate,
  type BusinessAggregate,
} from "@/lib/businessMetrics";

interface ActivityLog {
  id: string;
  action: string;
  resourceType: string | null;
  timestamp: string;
  actor: string;
  details?: string;
}

interface TimestampedNote {
  id: string;
  note: string;
  timestamp: string;
  adminUser: string;
}

export default function BusinessDetail() {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [newNote, setNewNote] = useState("");

  const [businessData, setBusinessData] = useState({
    id: businessId || "",
    name: "",
    adminFirstName: "",
    adminLastName: "",
    email: "",
    phone: "",
    address: "",
    status: "",
    signupDate: "",
  });
  const [loadingBusiness, setLoadingBusiness] = useState(true);

  // Real per-business aggregates (photos/videos/projects/reviews/revenue).
  const [agg, setAgg] = useState<BusinessAggregate | null>(null);
  const [aggLoading, setAggLoading] = useState(true);

  // Billing (subscription + plans + invoices) via the /api/billing/* endpoints.
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [invoices, setInvoices] = useState<BillingRecordRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [assignMode, setAssignMode] = useState<AssignMode>("comp");
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  // Activity log (audit_logs).
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);

  // Notes edit/delete dialog state (replaces prompt()/confirm()).
  const [editingNote, setEditingNote] = useState<TimestampedNote | null>(null);
  const [editNoteText, setEditNoteText] = useState("");
  const [deletingNote, setDeletingNote] = useState<TimestampedNote | null>(null);

  useEffect(() => {
    if (!businessId) return;
    const loadBusiness = async () => {
      setLoadingBusiness(true);
      try {
        const { data, error } = await supabaseClient
          .from("businesses")
          .select("*, owner:owner_id(name, email, phone)")
          .eq("id", businessId)
          .single();
        if (error) throw error;
        if (!data) throw new Error("Business not found");
        const ownerName: string = data.owner?.name ?? "";
        const nameParts = ownerName.split(" ");
        const addrObj = data.address as Record<string, string> | null;
        const addr = addrObj
          ? [addrObj.street, addrObj.city, addrObj.state].filter(Boolean).join(", ")
          : "";
        setBusinessData({
          id: data.id,
          name: data.name,
          adminFirstName: nameParts[0] ?? "",
          adminLastName: nameParts.slice(1).join(" "),
          email: data.owner?.email ?? data.email ?? "",
          phone: data.phone ?? "",
          address: addr,
          status: data.status === "active" ? "Active" : data.status ?? "",
          signupDate: data.created_at ? new Date(data.created_at).toISOString().slice(0, 10) : "",
        });
      } catch (err: any) {
        toast.error("Failed to load business: " + (err?.message ?? "Unknown error"));
      } finally {
        setLoadingBusiness(false);
      }
    };
    loadBusiness();
  }, [businessId]);

  const [timestampedNotes, setTimestampedNotes] = useState<TimestampedNote[]>([]);
  const [savingNote, setSavingNote] = useState(false);

  // Load internal notes for this business.
  useEffect(() => {
    if (!businessId) return;
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabaseClient
          .from("business_notes")
          .select("*")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (!active) return;
        const notes: TimestampedNote[] = (data ?? []).map((r: any) => ({
          id: r.id,
          note: r.note,
          timestamp: r.created_at,
          adminUser: r.admin_user,
        }));
        setTimestampedNotes(notes);
      } catch (err: any) {
        if (active) toast.error("Failed to load notes: " + (err?.message ?? "Unknown error"));
      }
    })();
    return () => {
      active = false;
    };
  }, [businessId]);

  // Load real per-business aggregates for the overview cards.
  useEffect(() => {
    if (!businessId) return;
    let active = true;
    (async () => {
      setAggLoading(true);
      try {
        const a = await fetchBusinessAggregate(businessId);
        if (active) setAgg(a);
      } catch (err: any) {
        if (active) {
          setAgg(null);
          toast.error("Failed to load metrics: " + (err?.message ?? "Unknown error"));
        }
      } finally {
        if (active) setAggLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [businessId]);

  // Load billing (subscription + plans + invoices).
  const loadBilling = useCallback(async () => {
    if (!businessId) return;
    setBillingLoading(true);
    setBillingError(null);
    try {
      const [billing, planList] = await Promise.all([
        getBusinessBilling(businessId),
        getPlans(),
      ]);
      setSubscription(billing.subscription);
      setInvoices(billing.invoices ?? []);
      setPlans(planList);
      setSelectedPlanId(billing.subscription?.plan_id ?? "");
    } catch (err: any) {
      setBillingError(err?.message ?? "Failed to load billing");
      toast.error("Failed to load billing: " + (err?.message ?? "Unknown error"));
    } finally {
      setBillingLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  // Load activity log (audit_logs), newest first, with actor names resolved.
  useEffect(() => {
    if (!businessId) return;
    let active = true;
    (async () => {
      setActivityLoading(true);
      setActivityError(null);
      try {
        const { data, error } = await supabaseClient
          .from("audit_logs")
          .select("id, action, resource_type, created_at, details, user_id")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        const rows = data ?? [];

        // Resolve actor names for the distinct user_ids in one query.
        const userIds = Array.from(
          new Set(rows.map((r: any) => r.user_id).filter(Boolean)),
        ) as string[];
        const actorById = new Map<string, string>();
        if (userIds.length > 0) {
          const { data: usersData } = await supabaseClient
            .from("users")
            .select("id, name, email")
            .in("id", userIds);
          for (const u of usersData ?? []) {
            actorById.set(u.id as string, (u.name as string) || (u.email as string) || (u.id as string));
          }
        }

        if (!active) return;
        setActivityLog(
          rows.map((r: any) => ({
            id: r.id,
            action: r.action,
            resourceType: r.resource_type ?? null,
            timestamp: r.created_at,
            actor: r.user_id ? actorById.get(r.user_id) ?? r.user_id : "System",
            details:
              r.details == null
                ? undefined
                : typeof r.details === "string"
                  ? r.details
                  : JSON.stringify(r.details),
          })),
        );
      } catch (err: any) {
        if (active) setActivityError(err?.message ?? "Failed to load activity");
      } finally {
        if (active) setActivityLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [businessId]);

  const handleSaveBusiness = async () => {
    if (!businessId) return;
    try {
      const { error } = await supabaseClient
        .from("businesses")
        .update({
          name: businessData.name,
          phone: businessData.phone || null,
          email: businessData.email || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", businessId);
      if (error) throw error;
      setIsEditing(false);
      toast.success("Business details updated successfully");
    } catch (err: any) {
      toast.error("Failed to save: " + (err?.message ?? "Unknown error"));
    }
  };

  const handleAssignPlan = async () => {
    if (!businessId || !selectedPlanId) return;
    setAssigning(true);
    try {
      const res = await assignPlan(businessId, selectedPlanId, assignMode);
      if (res.checkoutUrl) {
        // Manual/Stripe flows can return a hosted checkout URL for the owner.
        window.open(res.checkoutUrl, "_blank", "noopener,noreferrer");
      }
      await loadBilling();
      toast.success(
        assignMode === "comp"
          ? "Complimentary plan assigned"
          : "Plan assignment started",
      );
    } catch (err: any) {
      toast.error("Failed to assign plan: " + (err?.message ?? "Unknown error"));
    } finally {
      setAssigning(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!businessId) return;
    try {
      await cancel(businessId, true);
      await loadBilling();
      toast.success("Subscription set to cancel at period end");
    } catch (err: any) {
      toast.error("Failed to cancel plan: " + (err?.message ?? "Unknown error"));
    } finally {
      setCancelOpen(false);
    }
  };


  /**
   * Super admins have full access to every account: switch the workspace to
   * this business and open the regular admin UI.
   */
  const openAccount = async () => {
    if (!businessId) return;
    await workspaceService.whenReady();
    if (!workspaceService.getBusinessIds().includes(businessId)) {
      await workspaceService.reloadBusinesses();
    }
    if (!workspaceService.getBusinessIds().includes(businessId)) {
      toast.error("Could not open this account.");
      return;
    }
    await workspaceService.switchBusiness(businessId);
    navigate("/admin/jobs");
  };

  const addTimestampedNote = async () => {
    if (!newNote.trim() || !businessId) return;
    setSavingNote(true);
    try {
      const adminUser = getCurrentUser()?.name || "Super Admin";
      const { data, error } = await supabaseClient
        .from("business_notes")
        .insert({ business_id: businessId, note: newNote.trim(), admin_user: adminUser })
        .select()
        .single();
      if (error) throw error;
      const note: TimestampedNote = { id: data.id, note: data.note, timestamp: data.created_at, adminUser: data.admin_user };
      setTimestampedNotes((prev) => [note, ...prev]);
      setNewNote("");
      toast.success("Note added successfully");
    } catch (err: any) {
      toast.error("Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

  const editNote = async (noteId: string, newText: string) => {
    try {
      const { error } = await supabaseClient
        .from("business_notes")
        .update({ note: newText, updated_at: new Date().toISOString() })
        .eq("id", noteId);
      if (error) throw error;
      setTimestampedNotes((prev) => prev.map((n) => n.id === noteId ? { ...n, note: newText } : n));
      toast.success("Note updated successfully");
    } catch {
      toast.error("Failed to update note");
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const { error } = await supabaseClient.from("business_notes").delete().eq("id", noteId);
      if (error) throw error;
      setTimestampedNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success("Note deleted successfully");
    } catch {
      toast.error("Failed to delete note");
    }
  };

  const submitEditNote = async () => {
    if (!editingNote || !editNoteText.trim()) return;
    await editNote(editingNote.id, editNoteText.trim());
    setEditingNote(null);
    setEditNoteText("");
  };

  return (
    <SuperAdminLayout
      title={businessData.name}
      breadcrumbs={[
        { label: "Business Management", href: "/super-admin/businesses" },
        { label: businessData.name },
      ]}
    >
      <div className="space-y-6">
        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => void openAccount()} className="gap-2">
            <LogIn className="h-4 w-4" />
            Open account
          </Button>
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} className="gap-2">
              <Edit className="h-4 w-4" />
              Edit Business
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleSaveBusiness} className="gap-2">
                <Save className="h-4 w-4" />
                Save Changes
              </Button>
            </div>
          )}
        </div>

        {/* Business Overview Cards — real aggregates */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Photos", value: agg?.photos, icon: Camera },
            { label: "Videos", value: agg?.videos, icon: Video },
            { label: "Projects", value: agg?.jobs, icon: FolderOpen },
            { label: "Reviews", value: agg?.reviews, icon: MessageSquare },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-xl font-bold">
                      {aggLoading ? "…" : agg ? value : "—"}
                    </p>
                  </div>
                  <Icon className="h-6 w-6 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                  <p className="text-xl font-bold">
                    {aggLoading
                      ? "…"
                      : agg
                        ? formatMoney(agg.revenueCents / 100)
                        : "—"}
                  </p>
                </div>
                <DollarSign className="h-6 w-6 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Business Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Business Details
                <Badge
                  variant={
                    businessData.status === "Active"
                      ? "default"
                      : businessData.status === "Trial"
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {businessData.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Business Name</Label>
                  {isEditing ? (
                    <Input
                      value={businessData.name}
                      onChange={(e) =>
                        setBusinessData((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <p className="text-sm p-2 bg-muted rounded">
                      {businessData.name}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Admin First Name</Label>
                  {isEditing ? (
                    <Input
                      value={businessData.adminFirstName}
                      onChange={(e) =>
                        setBusinessData((prev) => ({
                          ...prev,
                          adminFirstName: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <p className="text-sm p-2 bg-muted rounded">
                      {businessData.adminFirstName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Admin Last Name</Label>
                  {isEditing ? (
                    <Input
                      value={businessData.adminLastName}
                      onChange={(e) =>
                        setBusinessData((prev) => ({
                          ...prev,
                          adminLastName: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <p className="text-sm p-2 bg-muted rounded">
                      {businessData.adminLastName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  {isEditing ? (
                    <Input
                      type="email"
                      value={businessData.email}
                      onChange={(e) =>
                        setBusinessData((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <p className="text-sm p-2 bg-muted rounded">
                      {businessData.email}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  {isEditing ? (
                    <Input
                      value={businessData.phone}
                      onChange={(e) =>
                        setBusinessData((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <p className="text-sm p-2 bg-muted rounded">
                      {businessData.phone}
                    </p>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Address</Label>
                  {isEditing ? (
                    <Input
                      value={businessData.address}
                      onChange={(e) =>
                        setBusinessData((prev) => ({
                          ...prev,
                          address: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <p className="text-sm p-2 bg-muted rounded">
                      {businessData.address}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Signup Date</Label>
                  <p className="text-sm p-2 bg-muted rounded">
                    {formatDate(businessData.signupDate)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Plan & Subscription — wired to the billing API */}
          <Card>
            <CardHeader>
              <CardTitle>Plan &amp; Subscription</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {billingLoading ? (
                <p className="text-sm text-muted-foreground">Loading billing…</p>
              ) : billingError ? (
                <p className="text-sm text-destructive">{billingError}</p>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Current Plan</span>
                    <Badge variant="default">
                      {subscription?.plans?.name ??
                        plans.find((p) => p.id === subscription?.plan_id)?.name ??
                        "No plan"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Status</span>
                    <Badge
                      variant={
                        subscription?.status === "active" ? "default" : "secondary"
                      }
                    >
                      {subscription?.status ?? "none"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Monthly Price</span>
                    <span className="font-bold">
                      {formatMoney(
                        (() => {
                          const p = plans.find(
                            (pl) => pl.id === subscription?.plan_id,
                          );
                          return p ? planAmount(p) : null;
                        })(),
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Current Period End</span>
                    <span className="text-sm">
                      {formatDate(subscription?.current_period_end)}
                    </span>
                  </div>
                  {subscription?.cancel_at_period_end && (
                    <p className="text-xs text-amber-600">
                      Scheduled to cancel at period end.
                    </p>
                  )}
                  <Separator />
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Assign Plan</Label>
                      <Select
                        value={selectedPlanId}
                        onValueChange={setSelectedPlanId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a plan" />
                        </SelectTrigger>
                        <SelectContent>
                          {plans.length === 0 ? (
                            <SelectItem value="__none" disabled>
                              No plans configured
                            </SelectItem>
                          ) : (
                            plans.map((p) => {
                              const amt = planAmount(p);
                              return (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                  {amt != null ? ` — ${formatMoney(amt)}` : ""}
                                </SelectItem>
                              );
                            })
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Assignment Mode</Label>
                      <Select
                        value={assignMode}
                        onValueChange={(v) => setAssignMode(v as AssignMode)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="comp">
                            Comp (free internal grant)
                          </SelectItem>
                          <SelectItem value="manual">
                            Manual (record without Stripe)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Super-admin assignments default to Comp. Stripe checkout
                        needs the account owner, so it is not offered here.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleAssignPlan}
                        disabled={!selectedPlanId || assigning}
                        className="gap-2"
                      >
                        <CreditCard className="h-4 w-4" />
                        {assigning ? "Assigning…" : "Assign Plan"}
                      </Button>
                      {subscription &&
                        subscription.status !== "canceled" &&
                        !subscription.cancel_at_period_end && (
                          <Button
                            variant="destructive"
                            onClick={() => setCancelOpen(true)}
                            className="gap-2"
                          >
                            <X className="h-4 w-4" />
                            Cancel Subscription
                          </Button>
                        )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Billing — real billing_records via getBusinessBilling() */}
        <Card>
          <CardHeader>
            <CardTitle>Billing</CardTitle>
          </CardHeader>
          <CardContent>
            {billingLoading ? (
              <p className="text-sm text-muted-foreground">Loading invoices…</p>
            ) : billingError ? (
              <p className="text-sm text-destructive">{billingError}</p>
            ) : invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Invoice</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => {
                    const cents =
                      inv.amount_cents ??
                      (inv.amount != null ? Math.round(inv.amount * 100) : null);
                    return (
                      <TableRow key={inv.id}>
                        <TableCell>{formatDate(inv.created_at)}</TableCell>
                        <TableCell>
                          {inv.description ?? inv.plan_name ?? "—"}
                        </TableCell>
                        <TableCell>
                          {cents == null
                            ? "—"
                            : formatMoney(cents / 100, inv.currency ?? "usd")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              inv.status === "paid"
                                ? "default"
                                : inv.status === "open"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {inv.status ?? "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {inv.hosted_invoice_url ? (
                            <a
                              href={inv.hosted_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline text-sm"
                            >
                              View
                            </a>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Timestamped Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Internal Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Textarea
                placeholder="Add an internal note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={addTimestampedNote}
                disabled={savingNote || !newNote.trim()}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {savingNote ? "Saving…" : "Add Note"}
              </Button>
            </div>
            <div className="space-y-3">
              {timestampedNotes.length === 0 && (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              )}
              {timestampedNotes.map((note) => (
                <div key={note.id} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <p className="text-sm flex-1">{note.note}</p>
                    <div className="flex gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingNote(note);
                          setEditNoteText(note.note);
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingNote(note)}
                        className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                    <span>By: {note.adminUser}</span>
                    <span>{formatDate(note.timestamp, { includeTime: true })}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Team membership (owner + invited staff/viewers) */}
        {businessId && (
          <Card>
            <CardHeader>
              <CardTitle>Team</CardTitle>
              <p className="text-sm text-muted-foreground">
                Invite, change roles for, or remove people on this account.
              </p>
            </CardHeader>
            <CardContent>
              <UserManagementSystem
                businessId={businessId}
                canManage
                embedded
              />
            </CardContent>
          </Card>
        )}

        {/* Activity Log — real audit_logs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <p className="text-sm text-muted-foreground">Loading activity…</p>
            ) : activityError ? (
              <p className="text-sm text-destructive">{activityError}</p>
            ) : activityLog.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {activityLog.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 border rounded-lg"
                  >
                    <Activity className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{activity.actor}</span>{" "}
                        {activity.action}
                        {activity.resourceType ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {activity.resourceType}
                          </span>
                        ) : null}
                      </p>
                      {activity.details && (
                        <p className="text-xs text-muted-foreground break-all">
                          {activity.details}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(activity.timestamp, { includeTime: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Note Dialog */}
        <Dialog
          open={!!editingNote}
          onOpenChange={(open) => {
            if (!open) {
              setEditingNote(null);
              setEditNoteText("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Note</DialogTitle>
            </DialogHeader>
            <Textarea
              value={editNoteText}
              onChange={(e) => setEditNoteText(e.target.value)}
              className="min-h-[120px]"
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingNote(null);
                  setEditNoteText("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={submitEditNote} disabled={!editNoteText.trim()}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Note Confirm */}
        <AlertDialog
          open={!!deletingNote}
          onOpenChange={(open) => !open && setDeletingNote(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Note</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this note? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (deletingNote) deleteNote(deletingNote.id);
                  setDeletingNote(null);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Cancel Subscription Confirm */}
        <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
              <AlertDialogDescription>
                This schedules the subscription to cancel at the end of the
                current period. The business keeps access until then.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Plan</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleCancelSubscription}
              >
                Cancel Subscription
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SuperAdminLayout>
  );
}
