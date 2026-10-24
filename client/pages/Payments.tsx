import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { workspaceService } from "@/lib/workspaceService";
import { apiFetch, isApiError } from "@/lib/api";
import {
  fetchPlans,
  planAmount,
  formatMoney,
  type PlanRow,
} from "@/lib/billingService";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, CreditCard, ExternalLink, Loader2 } from "lucide-react";

/**
 * Billing & Subscription.
 *
 * Plans are read from the `plans` table — the same rows Settings -> Billing and
 * the super-admin plan editor use. This page previously rendered a hardcoded
 * Starter/Pro/Agency array with its own prices, which disagreed with both, and
 * POSTed a client-chosen `amount` to checkout. The server now resolves the plan
 * (and its name) from `plans.stripe_price_id`, so the only thing this page
 * sends is which plan was clicked and which business it is for.
 *
 * A plan is only purchasable once it has a Stripe Price attached
 * (`plans.stripe_price_id`). Until then it is shown but not buyable, rather
 * than failing at checkout time with a developer-facing error.
 */
export default function Payments() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [providerStatus, setProviderStatus] = useState<{ stripe: boolean } | null>(null);

  useEffect(() => {
    apiFetch<{ stripe: boolean }>("/api/payments/status")
      .then((data) => setProviderStatus(data))
      .catch(() => setProviderStatus({ stripe: false }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchPlans()
      .then((rows) => {
        if (cancelled) return;
        setPlans(rows);
        setPlansError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setPlansError(
          (err instanceof Error && err.message) || "Plans couldn't be loaded. Reload the page to try again.",
        );
      })
      .finally(() => {
        if (!cancelled) setPlansLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Stripe redirects back here with ?success=1&session_id=... — confirm the
  // session server-side so the purchased plan is recorded on the business
  // (businesses.metadata.plan, read by the web admin screens and mobile app).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (params.get("success") !== "1" || !sessionId) return;
    apiFetch<{ applied?: boolean; plan?: string; message?: string }>("/api/payments/confirm", {
      method: "POST",
      body: { sessionId },
    })
      .then((data) => {
        if (data?.applied) {
          toast.success(`Payment confirmed — you're on the ${data.plan} plan.`);
        } else {
          toast.warning(
            data?.message ||
              "Payment received, but the plan couldn't be recorded on your account. Contact support if it doesn't show up.",
            { duration: 8000 },
          );
        }
      })
      .catch((err) => {
        toast.warning(
          (isApiError(err) && err.message) ||
            "Payment received, but the server couldn't be reached to record your plan. Reload this page to retry.",
          { duration: 8000 },
        );
      });
  }, []);

  const handleCheckout = async (plan: PlanRow) => {
    if (!plan.stripe_price_id) return;

    // Which business this purchase is for — the payment confirmation writes the
    // plan onto that businesses row, and the server checks the caller can write
    // it before recording anything.
    let wsState = workspaceService.getState();
    if (!wsState.initialized) {
      try {
        wsState = await workspaceService.initialize();
      } catch {
        // fall through — handled by the businessId check below
      }
    }
    const businessId = wsState.currentBusinessId;
    if (!businessId) {
      toast.error("Select a business before starting checkout.");
      return;
    }

    setLoadingPlan(plan.id);
    try {
      const data = await apiFetch<{ url?: string }>("/api/create-checkout-stripe", {
        method: "POST",
        body: { priceId: plan.stripe_price_id, businessId },
      });
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      toast.error("Checkout could not be started. Please try again.");
    } catch (err) {
      toast.error((isApiError(err) && err.message) || "Failed to start checkout");
    } finally {
      setLoadingPlan(null);
    }
  };

  const stripeReady = providerStatus?.stripe === true;
  const purchasable = plans.filter((p) => !!p.stripe_price_id);
  const selfServeAvailable = stripeReady && purchasable.length > 0;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Billing &amp; Subscription</h1>
          <p className="text-muted-foreground mt-1">Choose a plan that fits your business</p>
        </div>

        {/* Self-serve unavailable — say so plainly instead of failing at checkout */}
        {!plansLoading && !plansError && !selfServeAvailable && (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Online checkout isn't available yet. To start or change a plan, contact support and we'll set
              it up for your account.
            </CardContent>
          </Card>
        )}

        {plansError && (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">{plansError}</CardContent>
          </Card>
        )}

        {/* Plan cards */}
        {plansLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading plans…
          </div>
        ) : plans.length === 0 && !plansError ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              No plans have been published yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const amount = planAmount(plan);
              const canBuy = selfServeAvailable && !!plan.stripe_price_id;
              const features = plan.features ?? [];

              return (
                <Card key={plan.id} className="relative">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      {!plan.stripe_price_id && (
                        <Badge variant="secondary" className="text-xs">
                          Contact us
                        </Badge>
                      )}
                    </div>
                    {plan.max_businesses ? (
                      <CardDescription className="text-sm">
                        Up to {plan.max_businesses} business{" "}
                        {plan.max_businesses === 1 ? "location" : "locations"}
                      </CardDescription>
                    ) : null}
                    <div className="mt-2">
                      <span className="text-3xl font-bold">
                        {amount !== null ? formatMoney(amount) : "—"}
                      </span>
                      {plan.interval && (
                        <span className="text-muted-foreground text-sm">
                          {plan.interval === "year" ? "/yr" : "/mo"}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {features.length > 0 && (
                      <ul className="space-y-2">
                        {features.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}

                    <Button
                      className="w-full"
                      variant="outline"
                      disabled={!canBuy || loadingPlan === plan.id}
                      onClick={() => handleCheckout(plan)}
                    >
                      {loadingPlan === plan.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Redirecting…
                        </>
                      ) : canBuy ? (
                        <>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Get {plan.name}
                        </>
                      ) : (
                        "Contact support"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Info box */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payment Processing
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Payments are processed securely through <strong>Stripe</strong>. You will be redirected to a
              hosted checkout page to complete your purchase.
            </p>
            <p>To change or cancel a plan, contact support.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
