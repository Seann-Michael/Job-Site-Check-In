import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Download,
  DollarSign,
  Users,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabaseClient } from "@/lib/supabaseClient";
import { downloadCsv } from "@/lib/dataExport";
import { isApiError } from "@/lib/api";
import {
  type PlanRow,
  type PlanInput,
  type OverviewData,
  type BillingRecordRow,
  type AssignMode,
  getPlans,
  savePlan,
  deletePlan,
  getOverview,
  assignPlan,
  cancel as cancelSubscription,
  recordInvoice,
  formatCents,
  formatMoney,
  planAmount,
} from "@/lib/billingService";

// ── Local row shapes for the direct (RLS-gated, super-admin) reads ───────────

interface BusinessSubRow {
  id: string;
  name: string;
  email: string | null;
  status: string | null;
  planName: string | null;
  planId: string | null;
  amountCents: number | null;
  interval: string | null;
  mrrCents: number;
  cancelAtPeriodEnd: boolean;
}

interface InvoiceRow extends BillingRecordRow {
  businessName?: string | null;
}

function monthlyCents(amountCents: number | null, interval: string | null): number {
  const cents = Number(amountCents) || 0;
  return interval === "year" ? Math.round(cents / 12) : cents;
}

const STATUS_VARIANTS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  trialing: "bg-blue-100 text-blue-800",
  comped: "bg-purple-100 text-purple-800",
  past_due: "bg-amber-100 text-amber-800",
  canceled: "bg-gray-100 text-gray-700",
  incomplete: "bg-gray-100 text-gray-700",
  paid: "bg-green-100 text-green-800",
  open: "bg-amber-100 text-amber-800",
  refunded: "bg-gray-100 text-gray-700",
  void: "bg-gray-100 text-gray-700",
  uncollectible: "bg-red-100 text-red-800",
};

function StatusBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_VARIANTS[value] || "bg-gray-100 text-gray-700"}`}>
      {value}
    </span>
  );
}

// ── Plan create/edit dialog ──────────────────────────────────────────────────

const emptyPlan: PlanInput = { name: "", interval: "month", amount_cents: 0, features: [], is_active: true };

function PlanDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: PlanRow | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [amountDollars, setAmountDollars] = useState("0");
  const [featuresText, setFeaturesText] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setInterval((editing?.interval as "month" | "year") ?? "month");
      const cents = editing?.amount_cents ?? (planAmount({ amount_cents: editing?.amount_cents, price: editing?.price ?? null }) ?? 0) * 100;
      setAmountDollars(String((Number(cents) || 0) / 100));
      setFeaturesText((editing?.features ?? []).join("\n"));
      setIsActive(editing?.is_active ?? true);
    }
  }, [open, editing]);

  const submit = async () => {
    const amount = parseFloat(amountDollars);
    if (!name.trim()) return toast.error("Name is required");
    if (!Number.isFinite(amount) || amount < 0) return toast.error("Enter a valid amount");
    setSaving(true);
    try {
      await savePlan({
        id: editing?.id,
        name: name.trim(),
        interval,
        amount_cents: Math.round(amount * 100),
        features: featuresText.split("\n").map((f) => f.trim()).filter(Boolean),
        is_active: isActive,
      });
      toast.success(editing ? "Plan updated" : "Plan created");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Failed to save plan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit plan" : "Create plan"}</DialogTitle>
          <DialogDescription>
            Plans sync to Stripe when STRIPE_SECRET_KEY is configured; otherwise they are stored locally.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plan-name">Name</Label>
            <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pro" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plan-amount">Amount (USD)</Label>
              <Input id="plan-amount" type="number" min="0" step="0.01" value={amountDollars} onChange={(e) => setAmountDollars(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Interval</Label>
              <Select value={interval} onValueChange={(v) => setInterval(v as "month" | "year")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Monthly</SelectItem>
                  <SelectItem value="year">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan-features">Features (one per line)</Label>
            <Textarea id="plan-features" rows={4} value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="plan-active">Active</Label>
            <Switch id="plan-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Assign plan dialog ───────────────────────────────────────────────────────

function AssignDialog({
  open,
  onOpenChange,
  business,
  plans,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  business: BusinessSubRow | null;
  plans: PlanRow[];
  onDone: () => void;
}) {
  const [planId, setPlanId] = useState("");
  const [mode, setMode] = useState<AssignMode>("comp");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPlanId(business?.planId ?? plans[0]?.id ?? "");
      setMode("comp");
    }
  }, [open, business, plans]);

  const submit = async () => {
    if (!business) return;
    if (!planId) return toast.error("Choose a plan");
    setBusy(true);
    try {
      const res = await assignPlan(business.id, planId, mode);
      if (res.checkoutUrl) {
        toast.message("Stripe checkout required", { description: "No saved payment method — opening Checkout." });
        window.open(res.checkoutUrl, "_blank", "noopener");
      } else {
        toast.success(`Plan assigned (${res.status || mode})`);
      }
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Failed to assign plan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign / change plan</DialogTitle>
          <DialogDescription>{business?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue placeholder="Select a plan" /></SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {formatMoney(planAmount(p))}/{p.interval || "month"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as AssignMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="comp">Comp (free internal grant)</SelectItem>
                <SelectItem value="manual">Manual (record intent, no charge)</SelectItem>
                <SelectItem value="stripe">Stripe (bill via Stripe)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Stripe mode requires STRIPE_SECRET_KEY. If the business has no saved card, a Checkout link opens.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Working…" : "Assign"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Manual invoice dialog ────────────────────────────────────────────────────

function InvoiceDialog({
  open,
  onOpenChange,
  business,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  business: BusinessSubRow | null;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("0");
  const [status, setStatus] = useState("paid");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setAmount("0"); setStatus("paid"); setDescription(""); }
  }, [open]);

  const submit = async () => {
    if (!business) return;
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n < 0) return toast.error("Enter a valid amount");
    setBusy(true);
    try {
      await recordInvoice(business.id, { amount_cents: Math.round(n * 100), status, description });
      toast.success("Invoice recorded");
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Failed to record invoice");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record manual invoice</DialogTitle>
          <DialogDescription>{business?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inv-amount">Amount (USD)</Label>
              <Input id="inv-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["paid", "open", "void", "uncollectible", "refunded"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-desc">Description</Label>
            <Input id="inv-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Record"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SuperAdminBilling() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [businesses, setBusinesses] = useState<BusinessSubRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [planDialog, setPlanDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanRow | null>(null);
  const [assignFor, setAssignFor] = useState<BusinessSubRow | null>(null);
  const [invoiceFor, setInvoiceFor] = useState<BusinessSubRow | null>(null);

  const [invoiceBizFilter, setInvoiceBizFilter] = useState("all");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all");

  const loadPlans = useCallback(async () => {
    try {
      setPlans(await getPlans());
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Failed to load plans");
    }
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await getOverview());
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Failed to load revenue");
    }
  }, []);

  const loadBusinesses = useCallback(async () => {
    // Super admin reads businesses + subscriptions directly (RLS-gated).
    const [{ data: bizRows }, { data: subRows }] = await Promise.all([
      supabaseClient.from("businesses").select("id, name, email").order("name", { ascending: true }).limit(1000),
      supabaseClient
        .from("subscriptions")
        .select("business_id, status, cancel_at_period_end, plan_id, plans(name, amount_cents, interval)"),
    ]);
    const subByBiz = new Map<string, any>();
    for (const s of (subRows ?? []) as any[]) subByBiz.set(s.business_id, s);
    const rows: BusinessSubRow[] = ((bizRows ?? []) as any[]).map((b) => {
      const s = subByBiz.get(b.id);
      const plan = s?.plans || null;
      const amountCents = plan?.amount_cents ?? null;
      const interval = plan?.interval ?? null;
      const live = s && ["active", "trialing", "past_due"].includes(s.status);
      return {
        id: b.id,
        name: b.name,
        email: b.email ?? null,
        status: s?.status ?? null,
        planName: plan?.name ?? null,
        planId: s?.plan_id ?? null,
        amountCents,
        interval,
        mrrCents: live ? monthlyCents(amountCents, interval) : 0,
        cancelAtPeriodEnd: !!s?.cancel_at_period_end,
      };
    });
    setBusinesses(rows);
  }, []);

  const loadInvoices = useCallback(async () => {
    const { data } = await supabaseClient
      .from("billing_records")
      .select("*, businesses(name)")
      .order("created_at", { ascending: false })
      .limit(500);
    const rows: InvoiceRow[] = ((data ?? []) as any[]).map((r) => ({ ...r, businessName: r.businesses?.name ?? null }));
    setInvoices(rows);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadPlans(), loadOverview(), loadBusinesses(), loadInvoices()]);
    setLoading(false);
  }, [loadPlans, loadOverview, loadBusinesses, loadInvoices]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const onDeletePlan = async (p: PlanRow) => {
    if (!window.confirm(`Delete plan "${p.name}"? If it's in use it will be archived instead.`)) return;
    try {
      await deletePlan(p.id);
      toast.success("Plan removed");
      void loadPlans();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Failed to delete plan");
    }
  };

  const onCancel = async (b: BusinessSubRow) => {
    if (!window.confirm(`Cancel the subscription for "${b.name}"?`)) return;
    try {
      await cancelSubscription(b.id, false);
      toast.success("Subscription canceled");
      void loadBusinesses();
      void loadOverview();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Failed to cancel");
    }
  };

  const markRefunded = async (inv: InvoiceRow) => {
    // Super admins may write billing_records under RLS (is_super_admin()).
    const { error } = await supabaseClient.from("billing_records").update({ status: "refunded" }).eq("id", inv.id);
    if (error) return toast.error(error.message);
    toast.success("Marked refunded");
    void loadInvoices();
    void loadOverview();
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(
      (i) =>
        (invoiceBizFilter === "all" || i.business_id === invoiceBizFilter) &&
        (invoiceStatusFilter === "all" || i.status === invoiceStatusFilter),
    );
  }, [invoices, invoiceBizFilter, invoiceStatusFilter]);

  const exportInvoices = () => {
    downloadCsv(
      "invoices",
      filteredInvoices.map((i) => ({
        created_at: i.created_at,
        business: i.businessName ?? i.business_id,
        status: i.status,
        amount: i.amount_cents != null ? (i.amount_cents / 100).toFixed(2) : i.amount,
        currency: i.currency,
        provider: i.payment_provider,
        stripe_invoice_id: i.stripe_invoice_id ?? "",
        invoice_id: i.invoice_id ?? "",
      })),
    );
  };

  const invoiceAmount = (i: InvoiceRow) =>
    i.amount_cents != null ? formatCents(i.amount_cents, i.currency || "usd") : formatMoney(i.amount, i.currency || "usd");

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CreditCard className="h-6 w-6" /> Billing
            </h1>
            <p className="text-muted-foreground">Plans, subscriptions, revenue and invoices.</p>
          </div>
          <Button variant="outline" onClick={() => void loadAll()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {overview && !overview.stripeConfigured && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Stripe is not configured (STRIPE_SECRET_KEY unset). Comp and manual controls work; live billing and webhooks are dormant.
          </div>
        )}

        <Tabs defaultValue="plans">
          <TabsList>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="subs">Subscriptions</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>

          {/* Plans */}
          <TabsContent value="plans" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => { setEditingPlan(null); setPlanDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" /> New plan
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Interval</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Stripe</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{formatMoney(planAmount(p))}</TableCell>
                        <TableCell>{p.interval || "month"}</TableCell>
                        <TableCell>{p.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                        <TableCell>{p.stripe_price_id ? <Badge variant="outline">Synced</Badge> : <span className="text-muted-foreground text-xs">local</span>}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="icon" variant="ghost" onClick={() => { setEditingPlan(p); setPlanDialog(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => void onDeletePlan(p)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {plans.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No plans yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscriptions / Businesses */}
          <TabsContent value="subs" className="space-y-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>MRR</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {businesses.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div className="font-medium">{b.name}</div>
                          <div className="text-xs text-muted-foreground">{b.email}</div>
                        </TableCell>
                        <TableCell>{b.planName || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          <StatusBadge value={b.status} />
                          {b.cancelAtPeriodEnd && <span className="ml-1 text-xs text-amber-700">(ends)</span>}
                        </TableCell>
                        <TableCell>{b.mrrCents ? formatCents(b.mrrCents) : "—"}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="outline" onClick={() => setAssignFor(b)}>Assign</Button>
                          <Button size="sm" variant="ghost" onClick={() => setInvoiceFor(b)}>Invoice</Button>
                          {b.status && b.status !== "canceled" && (
                            <Button size="sm" variant="ghost" onClick={() => void onCancel(b)}>Cancel</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {businesses.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No businesses.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revenue */}
          <TabsContent value="revenue" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><DollarSign className="h-4 w-4" /> MRR</CardDescription></CardHeader>
                <CardContent><div className="text-3xl font-bold">{formatCents(overview?.mrrCents ?? 0)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><Users className="h-4 w-4" /> Active subscriptions</CardDescription></CardHeader>
                <CardContent><div className="text-3xl font-bold">{overview?.activeCount ?? 0}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><TrendingDown className="h-4 w-4" /> Churn (30d)</CardDescription></CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{((overview?.churn.rate ?? 0) * 100).toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">{overview?.churn.canceledLast30 ?? 0} canceled</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">By plan</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Plan</TableHead><TableHead>Subscribers</TableHead><TableHead>MRR</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {(overview?.byPlan ?? []).map((p) => (
                      <TableRow key={p.planId ?? p.planName}>
                        <TableCell>{p.planName}</TableCell>
                        <TableCell>{p.count}</TableCell>
                        <TableCell>{formatCents(p.mrrCents)}</TableCell>
                      </TableRow>
                    ))}
                    {(overview?.byPlan.length ?? 0) === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No active subscriptions.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Revenue — trailing 12 months (paid invoices)</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {(() => {
                  const rows = overview?.revenueByMonth ?? [];
                  const max = Math.max(1, ...rows.map((r) => r.revenueCents));
                  return rows.map((r) => (
                    <div key={r.month} className="flex items-center gap-3">
                      <div className="w-16 text-xs text-muted-foreground">{r.month}</div>
                      <div className="flex-1 bg-muted rounded h-4 overflow-hidden">
                        <div className="bg-primary h-4" style={{ width: `${(r.revenueCents / max) * 100}%` }} />
                      </div>
                      <div className="w-24 text-right text-xs">{formatCents(r.revenueCents)}</div>
                    </div>
                  ));
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoices */}
          <TabsContent value="invoices" className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="flex gap-2">
                <Select value={invoiceBizFilter} onValueChange={setInvoiceBizFilter}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="All businesses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All businesses</SelectItem>
                    {businesses.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {["paid", "open", "void", "uncollectible", "refunded", "succeeded"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={exportInvoices}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Business</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="text-xs">{new Date(i.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>{i.businessName ?? i.business_id}</TableCell>
                        <TableCell>{invoiceAmount(i)}</TableCell>
                        <TableCell><StatusBadge value={i.status} /></TableCell>
                        <TableCell className="text-xs">{i.payment_provider ?? "—"}</TableCell>
                        <TableCell className="text-right space-x-1">
                          {i.hosted_invoice_url && (
                            <a className="text-xs text-primary underline" href={i.hosted_invoice_url} target="_blank" rel="noopener noreferrer">view</a>
                          )}
                          {i.status !== "refunded" && (
                            <Button size="sm" variant="ghost" onClick={() => void markRefunded(i)}>Refund</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredInvoices.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No invoices.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <PlanDialog open={planDialog} onOpenChange={setPlanDialog} editing={editingPlan} onSaved={() => { void loadPlans(); void loadOverview(); }} />
      <AssignDialog open={!!assignFor} onOpenChange={(o) => !o && setAssignFor(null)} business={assignFor} plans={plans.filter((p) => p.is_active)} onDone={() => { void loadBusinesses(); void loadOverview(); }} />
      <InvoiceDialog open={!!invoiceFor} onOpenChange={(o) => !o && setInvoiceFor(null)} business={invoiceFor} onDone={() => { void loadInvoices(); void loadOverview(); }} />
    </SuperAdminLayout>
  );
}
