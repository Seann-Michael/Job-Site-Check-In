import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

import { Badge, Button, Card, IconTile } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/hooks/use-workspace';
import { apiFetch } from '@/lib/api';
import { isApiConfigured, webUrl } from '@/lib/config';
import { formatDate, notify } from '@/lib/format';
import {
  getCurrentOffering,
  purchase,
  purchasesAvailable,
  restorePurchases,
  setPurchaseBusiness,
} from '@/lib/purchases';
import { useAuth } from '@/providers/auth-provider';

/** Shape of GET /api/billing/my — the same call the web Billing page makes. */
interface BillingSummary {
  businessId?: string;
  planName: string | null;
  subscription: {
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    plans?: { name: string; amount_cents: number; interval: string } | null;
  } | null;
  invoices: {
    id: string;
    created_at: string;
    status: string;
    amount: number | string;
    amount_cents?: number | null;
    currency?: string;
    description?: string | null;
    hosted_invoice_url?: string | null;
    provider_invoice_url?: string | null;
  }[];
}

function money(cents: number | null | undefined, amount: number | string | undefined, currency = 'usd') {
  const value = typeof cents === 'number' ? cents / 100 : Number(amount ?? 0);
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(
      value,
    );
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

function invoiceTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  const s = status.toLowerCase();
  if (s === 'paid' || s === 'succeeded') return 'success';
  if (s === 'open' || s === 'pending') return 'warning';
  if (s === 'failed' || s === 'uncollectible' || s === 'void') return 'danger';
  return 'neutral';
}

export default function BillingSettingsScreen() {
  const { colors } = useTheme();
  const { user, initializing } = useAuth();
  const { business } = useWorkspace();

  // In-app purchases (App Store / Google Play) via RevenueCat. Only live in a
  // real build with a configured key — no-ops in Expo Go / web (see purchases.ts).
  const iapReady = purchasesAvailable();
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);

  // Live plan + invoice history from the server (Stripe-backed).
  useEffect(() => {
    if (!isApiConfigured || !business?.id || business.id.startsWith('demo')) return;
    let cancelled = false;
    setBillingError(null);
    apiFetch<BillingSummary>(`/api/billing/my?businessId=${encodeURIComponent(business.id)}`)
      .then((data) => {
        if (!cancelled) setBilling(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setBillingError(err instanceof Error ? err.message : 'Could not load billing.');
      });
    return () => {
      cancelled = true;
    };
  }, [business?.id]);

  useEffect(() => {
    if (!iapReady) return;
    let cancelled = false;
    if (business?.id) void setPurchaseBusiness(business.id);
    void getCurrentOffering().then((o) => {
      if (!cancelled) setOffering(o);
    });
    return () => {
      cancelled = true;
    };
  }, [iapReady, business?.id]);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const planName = billing?.planName ?? business?.plan ?? null;
  const subscription = billing?.subscription ?? null;
  const invoices = billing?.invoices ?? [];

  const buy = async (pkg: PurchasesPackage) => {
    setBuying(pkg.identifier);
    try {
      const info = await purchase(pkg);
      if (info && Object.keys(info.entitlements.active).length > 0) {
        notify('Subscription active', 'Thanks! Your plan is now active on this account.');
      }
    } catch (err) {
      const e = err as { userCancelled?: boolean; message?: string };
      if (!e?.userCancelled) {
        notify('Purchase failed', e?.message ?? 'The purchase could not be completed.');
      }
    } finally {
      setBuying(null);
    }
  };

  const restore = async () => {
    const info = await restorePurchases();
    const active = info ? Object.keys(info.entitlements.active).length > 0 : false;
    notify(
      active ? 'Purchases restored' : 'Nothing to restore',
      active
        ? 'Your subscription has been restored on this device.'
        : 'No active subscription was found for this store account.',
    );
  };

  const manageBilling = () => {
    const url = webUrl('/admin/payments');
    if (url) {
      void Linking.openURL(url);
    } else {
      notify(
        'Manage billing',
        'Plan changes and payment methods are managed in the web dashboard (Billing & Subscription). Set EXPO_PUBLIC_APP_URL to open it from here.',
      );
    }
  };

  return (
    <Screen>
      <DetailHeader title="Billing" />

      <Card style={{ gap: Spacing.md }}>
        <View style={styles.planRow}>
          <IconTile icon="ribbon-outline" size={44} />
          <View style={{ flex: 1, gap: 2 }}>
            {/* Only a tier the business row actually names. Claiming one the
                customer may not have — and an "Active" badge to match — is
                worse than saying nothing. */}
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
              {planName ?? 'No plan on file'}
            </Text>
            <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
              {business?.name ?? 'Your business'}
            </Text>
          </View>
          {subscription ? (
            <Badge
              label={
                subscription.cancel_at_period_end
                  ? 'Cancels soon'
                  : subscription.status === 'active' || subscription.status === 'trialing'
                    ? 'Active'
                    : subscription.status
              }
              tone={
                subscription.status === 'active' || subscription.status === 'trialing'
                  ? subscription.cancel_at_period_end
                    ? 'warning'
                    : 'success'
                  : 'warning'
              }
            />
          ) : planName ? (
            <Badge label="Active" tone="success" />
          ) : null}
        </View>
        {subscription?.plans || subscription?.current_period_end ? (
          <View style={[styles.planMeta, { borderTopColor: colors.border }]}>
            <View style={styles.metaItem}>
              <Text style={[styles.metaValue, { color: colors.text }]}>
                {subscription.plans ? money(subscription.plans.amount_cents, undefined) : '—'}
              </Text>
              <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                per {subscription.plans?.interval ?? 'month'}
              </Text>
            </View>
            <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
            <View style={styles.metaItem}>
              <Text style={[styles.metaValue, { color: colors.text }]}>
                {subscription.current_period_end ? formatDate(subscription.current_period_end) : '—'}
              </Text>
              <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                {subscription.cancel_at_period_end ? 'ends on' : 'renews on'}
              </Text>
            </View>
          </View>
        ) : null}
        <Button label="Manage billing" icon="open-outline" variant="secondary" onPress={manageBilling} />
      </Card>

      {iapReady && offering && offering.availablePackages.length > 0 ? (
        <Section title="Upgrade in app">
          <Card style={{ gap: Spacing.md }}>
            {offering.availablePackages.map((pkg) => (
              <View key={pkg.identifier} style={styles.pkgRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                    {pkg.product.title}
                  </Text>
                  <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                    {pkg.product.priceString}
                    {pkg.product.subscriptionPeriod ? ` / ${pkg.product.subscriptionPeriod}` : ''}
                  </Text>
                </View>
                <Button
                  label={buying === pkg.identifier ? 'Working…' : 'Subscribe'}
                  onPress={() => buy(pkg)}
                  disabled={buying !== null}
                />
              </View>
            ))}
            <Button
              label="Restore purchases"
              icon="refresh-outline"
              variant="secondary"
              onPress={restore}
            />
          </Card>
        </Section>
      ) : null}

      <Section title="Invoice history">
        {invoices.length === 0 ? (
          <Card>
            <Text style={{ fontSize: 13.5, color: colors.textSecondary, lineHeight: 19 }}>
              {billingError
                ? `Couldn't load invoices: ${billingError}`
                : business?.id?.startsWith('demo')
                  ? 'Sample workspace — no invoices.'
                  : 'No invoices yet. They appear here once your first payment goes through.'}
            </Text>
          </Card>
        ) : (
          <Card style={{ padding: 0 }}>
            {invoices.map((invoice, index) => {
              const link = invoice.hosted_invoice_url ?? invoice.provider_invoice_url ?? null;
              return (
                <Pressable
                  key={invoice.id}
                  disabled={!link}
                  onPress={() => link && void Linking.openURL(link)}
                  style={({ pressed }) => [
                    styles.invoiceRow,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    },
                    pressed && { backgroundColor: colors.cardPressed },
                  ]}>
                  <Ionicons name="receipt-outline" size={17} color={colors.textMuted} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={{ fontSize: 14, color: colors.text }}>
                      {formatDate(invoice.created_at)}
                    </Text>
                    {invoice.description ? (
                      <Text style={{ fontSize: 12, color: colors.textMuted }} numberOfLines={1}>
                        {invoice.description}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                    {money(invoice.amount_cents, invoice.amount, invoice.currency)}
                  </Text>
                  <Badge label={invoice.status} tone={invoiceTone(invoice.status)} />
                </Pressable>
              );
            })}
          </Card>
        )}
      </Section>

      <Text style={{ fontSize: 12.5, color: colors.textMuted, textAlign: 'center' }}>
        Plan changes and payment methods are managed in the web dashboard (Stripe). In-app
        subscriptions are billed through the App Store.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  planMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metaItem: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  metaLabel: {
    fontSize: 11.5,
  },
  metaDivider: {
    width: StyleSheet.hairlineWidth,
    height: 26,
  },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  pkgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
});
