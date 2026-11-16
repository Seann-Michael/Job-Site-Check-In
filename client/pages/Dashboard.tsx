/**
 * Tenant dashboard.
 *
 * `/`, `/dashboard`, `/admin` and `/admin/dashboard` all redirected to the job
 * list, so a customer logging in saw a work queue and never saw whether any of
 * the optimisation work had moved anything. This page answers one question —
 * is the profile getting stronger? — from data the app already collects.
 *
 * Nothing here is invented. Every figure is read from a table, and a panel with
 * no data says so rather than showing a zero that looks like a measurement.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StarRating } from "@/components/StarRating";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  Globe,
  MessageSquare,
  Minus,
  Phone,
  RefreshCw,
  Send,
  Star,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/dataService";
import { workspaceService } from "@/lib/workspaceService";

/** Trailing window for the performance panel. */
const WINDOW_DAYS = 30;

/** StarRating requires a change handler; this one is read-only. */
const noop = () => undefined;

interface AuditRow {
  id: string;
  category: string;
  title: string;
  description: string | null;
  status: string | null;
  impact: string | null;
  action_required: string | null;
  scanned_at: string | null;
}

interface MetricPoint {
  metric_name: string;
  value: number;
  date: string;
}

interface DashboardData {
  businessName: string | null;
  score: number | null;
  previousScore: number | null;
  lastScannedAt: string | null;
  rating: number | null;
  reviewCount: number | null;
  unanswered: number;
  openItems: AuditRow[];
  metrics: MetricPoint[];
  requests: { sent: number; scheduled: number; optedOut: number; failed: number };
  publicPages: number;
}

/** The rows from the most recent scan. */
function latestBatch(rows: AuditRow[]): AuditRow[] {
  if (rows.length === 0) return [];
  const newest = rows[0]?.scanned_at ?? null;
  if (!newest) return rows.filter((r) => !r.scanned_at);
  return rows.filter((r) => r.scanned_at === newest);
}

/** Sum a metric over the window, and over the window before it, for a delta. */
function compare(metrics: MetricPoint[], name: string): { now: number; prev: number; has: boolean } {
  const cutoff = Date.now() - WINDOW_DAYS * 86_400_000;
  let now = 0;
  let prev = 0;
  let has = false;
  for (const m of metrics) {
    if (m.metric_name !== name) continue;
    has = true;
    const at = Date.parse(m.date);
    if (Number.isNaN(at)) continue;
    if (at >= cutoff) now += Number(m.value) || 0;
    else prev += Number(m.value) || 0;
  }
  return { now, prev, has };
}

function Delta({ now, prev }: { now: number; prev: number }) {
  // With no prior period there is no trend to state — saying "+100%" against
  // zero history would be a fabrication.
  if (prev <= 0) {
    return <span className="text-xs text-muted-foreground">no earlier period to compare</span>;
  }
  const pct = Math.round(((now - prev) / prev) * 100);
  if (pct === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> flat vs the previous {WINDOW_DAYS} days
      </span>
    );
  }
  const up = pct > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${up ? "text-emerald-600" : "text-red-600"}`}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {up ? "+" : ""}
      {pct}% vs the previous {WINDOW_DAYS} days
    </span>
  );
}

function MetricCard({
  icon,
  label,
  metrics,
  name,
}: {
  icon: React.ReactNode;
  label: string;
  metrics: MetricPoint[];
  name: string;
}) {
  const { now, prev, has } = compare(metrics, name);
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          {label}
        </div>
        {has ? (
          <>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{now.toLocaleString()}</p>
            <div className="mt-1">
              <Delta now={now} prev={prev} />
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Not measured yet — sync Google Business Profile to start collecting this.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noWorkspace, setNoWorkspace] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { currentBusinessId } = await workspaceService.whenReady();
      if (!currentBusinessId) {
        setNoWorkspace(true);
        return;
      }
      const bid = currentBusinessId;
      const since = new Date(Date.now() - 2 * WINDOW_DAYS * 86_400_000).toISOString();

      const [profRes, auditRes, metricRes, reviewRes, unansweredRes, reqRes, pagesRes] = await Promise.all([
        supabase
          .from("gmb_profiles")
          .select("business_name, overall_score, rating, review_count, last_scanned_at")
          .eq("business_id", bid)
          .maybeSingle(),
        supabase
          .from("gmb_audit_results")
          .select("id, category, title, description, status, impact, action_required, scanned_at")
          .eq("business_id", bid)
          .order("scanned_at", { ascending: false })
          .limit(400),
        supabase
          .from("analytics")
          .select("metric_name, value, date")
          .eq("business_id", bid)
          .gte("date", since.slice(0, 10))
          .order("date", { ascending: false })
          .limit(1000),
        supabase.from("reviews").select("rating").eq("business_id", bid).limit(1000),
        supabase
          .from("reviews")
          .select("id", { count: "exact", head: true })
          .eq("business_id", bid)
          .is("response", null),
        supabase.from("review_requests").select("status").eq("business_id", bid).limit(1000),
        supabase
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .eq("business_id", bid)
          .eq("status", "completed"),
      ]);

      const audits = (auditRes.data as AuditRow[] | null) ?? [];
      const current = latestBatch(audits);

      // The previous score comes from the scan before the latest one, now that
      // scans are kept as dated snapshots instead of being overwritten.
      const currentStamp = current[0]?.scanned_at ?? null;
      const earlier = audits.filter((r) => r.scanned_at && r.scanned_at !== currentStamp);
      const prevStamp = earlier[0]?.scanned_at ?? null;
      const prevBatch = prevStamp ? earlier.filter((r) => r.scanned_at === prevStamp) : [];
      const batchScore = (rows: AuditRow[]): number | null =>
        rows.length === 0 ? null : Math.round((rows.filter((r) => r.status === "good").length / rows.length) * 100);

      const ratings = ((reviewRes.data as { rating: number }[] | null) ?? [])
        .map((r) => Number(r.rating))
        .filter((n) => n > 0);

      const requestRows = ((reqRes.data as { status: string }[] | null) ?? []).map((r) => r.status);
      const countOf = (...statuses: string[]) => requestRows.filter((s) => statuses.includes(s)).length;

      const profile = profRes.data as {
        business_name?: string | null;
        overall_score?: number | null;
        rating?: number | null;
        review_count?: number | null;
        last_scanned_at?: string | null;
      } | null;

      setData({
        businessName: profile?.business_name ?? workspaceService.getCurrentBusinessName(),
        score: profile?.overall_score ?? batchScore(current),
        previousScore: batchScore(prevBatch),
        lastScannedAt: profile?.last_scanned_at ?? currentStamp,
        rating:
          profile?.rating ??
          (ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null),
        reviewCount: profile?.review_count ?? (ratings.length || null),
        unanswered: unansweredRes.count ?? 0,
        openItems: current.filter((r) => r.status !== "good"),
        metrics: (metricRes.data as MetricPoint[] | null) ?? [],
        requests: {
          sent: countOf("sent", "viewed"),
          scheduled: countOf("scheduled", "sending"),
          optedOut: countOf("opted_out"),
          failed: countOf("failed"),
        },
        publicPages: pagesRes.count ?? 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const scoreDelta = useMemo(() => {
    if (!data || data.score == null || data.previousScore == null) return null;
    return data.score - data.previousScore;
  }, [data]);

  if (noWorkspace) {
    return (
      <AppLayout>
        <div className="container px-4 py-10">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No active business workspace yet. Finish setting one up to see your dashboard.
              </p>
              <Button asChild className="mt-4">
                <Link to="/onboarding">Set up a business</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (loading || !data) {
    return (
      <AppLayout>
        <div className="container px-4 py-10">
          <p className="animate-pulse text-muted-foreground">Loading your dashboard…</p>
        </div>
      </AppLayout>
    );
  }

  const highImpact = data.openItems.filter((i) => i.impact === "high");

  return (
    <AppLayout>
      <div className="container space-y-6 px-4 py-8">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">{data.businessName || "Your business"}</h1>
            <p className="text-sm text-muted-foreground">
              {data.lastScannedAt
                ? `Last scanned ${new Date(data.lastScannedAt).toLocaleDateString()}`
                : "Not scanned yet"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button asChild size="sm">
              <Link to="/admin/gmb-optimization">Open optimization</Link>
            </Button>
          </div>
        </div>

        {/* ── Profile strength ─────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Profile strength
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.score == null ? (
              <p className="text-sm text-muted-foreground">
                No scan yet. Run one from the optimization page to get a baseline.
              </p>
            ) : (
              <>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-semibold tabular-nums">{data.score}</span>
                  <span className="text-muted-foreground">/ 100</span>
                  {scoreDelta !== null && scoreDelta !== 0 && (
                    <span
                      className={`inline-flex items-center gap-1 text-sm font-medium ${scoreDelta > 0 ? "text-emerald-600" : "text-red-600"}`}
                    >
                      {scoreDelta > 0 ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4" />
                      )}
                      {scoreDelta > 0 ? "+" : ""}
                      {scoreDelta} since the last scan
                    </span>
                  )}
                  {data.previousScore == null && (
                    <span className="text-xs text-muted-foreground">
                      first recorded scan — the next one will show the change
                    </span>
                  )}
                </div>
                <Progress value={data.score} className="mt-4" />
              </>
            )}
          </CardContent>
        </Card>

        {/* ── What Google saw ──────────────────────────────────────────── */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">
            What your listing did in the last {WINDOW_DAYS} days
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon={<Phone className="h-4 w-4" />}
              label="Calls from Google"
              metrics={data.metrics}
              name="gbp_calls"
            />
            <MetricCard
              icon={<Globe className="h-4 w-4" />}
              label="Website clicks"
              metrics={data.metrics}
              name="gbp_website_clicks"
            />
            <MetricCard
              icon={<CalendarCheck className="h-4 w-4" />}
              label="Direction requests"
              metrics={data.metrics}
              name="gbp_direction_requests"
            />
            <MetricCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Profile views"
              metrics={data.metrics}
              name="gbp_profile_views"
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Reviews ───────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                Reviews
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.rating != null ? (
                <div className="flex items-center gap-3">
                  <StarRating rating={data.rating} onRatingChange={noop} readonly size="sm" />
                  <span className="text-2xl font-semibold tabular-nums">{data.rating}</span>
                  <span className="text-sm text-muted-foreground">
                    from {(data.reviewCount ?? 0).toLocaleString()} review
                    {data.reviewCount === 1 ? "" : "s"}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No reviews synced yet.</p>
              )}

              {data.unanswered > 0 && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="text-sm">
                    <p className="font-medium">
                      {data.unanswered} review{data.unanswered === 1 ? "" : "s"} without a reply
                    </p>
                    <p className="text-muted-foreground">
                      Replies are a ranking input, and the window to reply well is short.
                    </p>
                    <Button asChild variant="link" size="sm" className="h-auto p-0">
                      <Link to="/admin/reviews">Reply to them</Link>
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 border-t pt-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Requests sent</p>
                  <p className="text-lg font-semibold tabular-nums">{data.requests.sent}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Queued</p>
                  <p className="text-lg font-semibold tabular-nums">{data.requests.scheduled}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Opted out</p>
                  <p className="text-lg font-semibold tabular-nums">{data.requests.optedOut}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Failed</p>
                  <p className="text-lg font-semibold tabular-nums">{data.requests.failed}</p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/reviews">
                  <Send className="mr-2 h-4 w-4" />
                  Ask a customer for a review
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* ── Open items ────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Fix these next
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.openItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {data.score == null
                    ? "Run a scan to see what to fix."
                    : "Nothing outstanding from the last scan."}
                </p>
              ) : (
                <ul className="space-y-3">
                  {[...highImpact, ...data.openItems.filter((i) => i.impact !== "high")]
                    .slice(0, 6)
                    .map((item) => (
                      <li key={item.id} className="flex items-start gap-3">
                        <Badge
                          variant={item.impact === "high" ? "destructive" : "secondary"}
                          className="mt-0.5 shrink-0"
                        >
                          {item.impact ?? "low"}
                        </Badge>
                        <div className="text-sm">
                          <p className="font-medium">{item.title}</p>
                          <p className="text-muted-foreground">
                            {item.action_required || item.description}
                          </p>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Published work ───────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Published job pages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{data.publicPages}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Completed jobs are published as indexable pages carrying your name, address and phone,
              and are listed in your sitemap for Google to crawl.
            </p>
            <Button asChild variant="link" size="sm" className="mt-2 h-auto p-0">
              <Link to="/admin/jobs">See your jobs</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
