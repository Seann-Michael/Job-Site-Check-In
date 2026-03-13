import React, { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { createCheckoutSession } from "@/lib/paymentService";

export default function Payments() {
  const [provider, setProvider] = useState<"stripe" | "paypal">("stripe");
  const [mode, setMode] = useState<"one_time" | "subscription">("one_time");
  const [amount, setAmount] = useState<number>(49);
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckout = async () => {
    setIsLoading(true);
    try {
      const resp = await createCheckoutSession({ provider, mode, amount });
      if (!resp || !resp.url) {
        toast.error(resp?.message || "Checkout creation failed");
        return;
      }
      // Open provider checkout
      window.location.href = resp.url;
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to start checkout");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout title="Payments" breadcrumbs={[{ label: "Payments", href: "/admin/payments" }]}> 
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Start Checkout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Provider</label>
              <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Mode</label>
              <Select value={mode} onValueChange={(v) => setMode(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">One-time</SelectItem>
                  <SelectItem value="subscription">Subscription</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Amount (USD)</label>
              <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleCheckout} disabled={isLoading}>
                {isLoading ? "Starting..." : "Checkout"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This page scaffolds Stripe and PayPal checkout flows. API keys must be configured on the server for real payments.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
