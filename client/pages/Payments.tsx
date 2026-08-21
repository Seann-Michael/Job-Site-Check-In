// @ts-nocheck
import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { workspaceService } from "@/lib/workspaceService";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle,
  CreditCard,
  AlertTriangle,
  Zap,
  Building2,
  Star,
  ExternalLink,
  Loader2,
} from "lucide-react";

// ── Plans ─────────────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 29,
    description: "Great for solo operators and small businesses",
    icon: Zap,
    features: [
      "Up to 25 jobs/month",
      "1 business location",
      "Gallery & Reviews",
      "Email support",
    ],
    recommended: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 79,
    description: "Everything a growing business needs",
    icon: Star,
    features: [
      "Unlimited jobs",
      "3 business locations",
      "GMB Optimization",
      "Automations & Workflows",
      "Priority support",
    ],
    recommended: true,
  },
  {
    id: "agency",
    name: "Agency",
    price: 199,
    description: "For agencies managing multiple clients",
    icon: Building2,
    features: [
      "Unlimited jobs & clients",
      "Unlimited locations",
      "White-label branding",
      "API access",
      "Dedicated support",
    ],
    recommended: false,
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function Payments() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [providerStatus, setProviderStatus] = useState<{ stripe: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/payments/status")
      .then((r) => r.json())
      .then((data) => setProviderStatus(data))
      .catch(() => setProviderStatus({ stripe: false }));
  }, []);

  // Stripe redirects back here with ?success=1&session_id=... — confirm the
  // session server-side so the purchased plan is recorded on the business
  // (businesses.metadata.plan, read by the web admin screens and mobile app).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (params.get("success") !== "1" || !sessionId) return;
    fetch("/api/payments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (r.ok && data.applied) {
          toast.success(`Payment confirmed — you're on the ${data.plan} plan.`);
        } else {
          toast.warning(
            data.message ||
              "Payment received, but the plan couldn't be recorded on your account. Contact support if it doesn't show up.",
            { duration: 8000 },
          );
        }
      })
      .catch(() => {
        toast.warning(
          "Payment received, but the server couldn't be reached to record your plan. Reload this page to retry.",
          { duration: 8000 },
        );
      });
  }, []);

  const handleCheckout = async (plan: (typeof PLANS)[0]) => {
    if (providerStatus && !providerStatus.stripe) {
      toast.error(
        "Stripe is not configured yet. Add your STRIPE_SECRET_KEY in Settings → Environment.",
        { duration: 6000 }
      );
      return;
    }

    setLoadingPlan(plan.id);
    try {
      const annualDiscount = billing === "annual" ? 0.8 : 1;
      const amount = Math.round(plan.price * annualDiscount * (billing === "annual" ? 12 : 1));
      const userEmail = getCurrentUser()?.email || "";

      // Which business this purchase is for — the payment confirmation writes
      // the plan onto that businesses row, where web admin + mobile read it.
      let wsState = workspaceService.getState();
      if (!wsState.initialized) {
        try {
          wsState = await workspaceService.initialize();
        } catch {
          // Checkout can still proceed; the plan just can't be auto-recorded.
        }
      }

      const res = await fetch("/api/create-checkout-stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: billing === "annual" ? "one_time" : "subscription",
          amount: billing === "annual" ? amount : plan.price,
          planName: `${plan.name} (${billing === "annual" ? "Annual" : "Monthly"})`,
          email: userEmail,
          businessId: wsState.currentBusinessId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.message || "Checkout failed");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to start checkout");
    } finally {
      setLoadingPlan(null);
    }
  };

  const anyConfigured = providerStatus?.stripe;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Billing & Subscription</h1>
          <p className="text-muted-foreground mt-1">
            Choose a plan that fits your business
          </p>
        </div>

        {/* Config notice */}
        {providerStatus !== null && !anyConfigured && (
          <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">Payments not configured</p>
              <p className="text-sm text-yellow-700 mt-1">
                Add your <strong>STRIPE_SECRET_KEY</strong> as an environment variable to enable real payments.
                Until then, checkout buttons will show a warning.
              </p>
            </div>
          </div>
        )}

        {/* Billing cycle toggle */}
        <div className="flex items-center justify-end flex-wrap gap-4">
          <div className="flex items-center gap-2 rounded-lg border p-1">
            <button
              onClick={() => setBilling("monthly")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                billing === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                billing === "annual" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Annual
              <Badge variant="secondary" className="text-xs">Save 20%</Badge>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const annualDiscount = billing === "annual" ? 0.8 : 1;
            const displayPrice = billing === "annual"
              ? Math.round(plan.price * annualDiscount)
              : plan.price;

            return (
              <Card
                key={plan.id}
                className={`relative ${plan.recommended ? "border-primary ring-2 ring-primary/20" : ""}`}
              >
                {plan.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                  </div>
                  <CardDescription className="text-sm">{plan.description}</CardDescription>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">${displayPrice}</span>
                    <span className="text-muted-foreground text-sm">
                      {billing === "annual" ? "/mo, billed annually" : "/mo"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={plan.recommended ? "default" : "outline"}
                    disabled={loadingPlan === plan.id}
                    onClick={() => handleCheckout(plan)}
                  >
                    {loadingPlan === plan.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Redirecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Get {plan.name}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

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
              Payments are processed securely through <strong>Stripe</strong>.
              You will be redirected to a hosted checkout page to complete your purchase.
            </p>
            {!anyConfigured && (
              <p>
                To enable live payments, add your Stripe key as an environment variable:{" "}
                <code className="bg-muted px-1 rounded text-xs">STRIPE_SECRET_KEY</code>.
              </p>
            )}
            <p>All plans include a 14-day free trial. Cancel any time.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
