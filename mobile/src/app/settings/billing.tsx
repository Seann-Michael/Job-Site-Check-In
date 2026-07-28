import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, IconTile } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/hooks/use-workspace';
import { notify } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';

const APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? '';

// Demo invoice history until Supabase billing tables are connected.
const DEMO_INVOICES = [
  { id: 'inv-3', date: 'Jul 1, 2026', amount: '$99.00', status: 'Paid' },
  { id: 'inv-2', date: 'Jun 1, 2026', amount: '$99.00', status: 'Paid' },
  { id: 'inv-1', date: 'May 1, 2026', amount: '$99.00', status: 'Paid' },
];

export default function BillingSettingsScreen() {
  const { colors } = useTheme();
  const { user, initializing } = useAuth();
  const { business } = useWorkspace();

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const manageBilling = () => {
    if (APP_URL) {
      void Linking.openURL(`${APP_URL.replace(/\/$/, '')}/admin/payments`);
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
              {business?.plan ?? 'No plan on file'}
            </Text>
            <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
              {business?.name ?? 'Your business'}
            </Text>
          </View>
          {business?.plan ? <Badge label="Active" tone="success" /> : null}
        </View>
        <View style={[styles.planMeta, { borderTopColor: colors.border }]}>
          <View style={styles.metaItem}>
            <Text style={[styles.metaValue, { color: colors.text }]}>$99</Text>
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>per month</Text>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
          <View style={styles.metaItem}>
            <Text style={[styles.metaValue, { color: colors.text }]}>Aug 1</Text>
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>next invoice</Text>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
          <View style={styles.metaItem}>
            <Text style={[styles.metaValue, { color: colors.text }]}>•••• 4242</Text>
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>card on file</Text>
          </View>
        </View>
        <Button label="Manage billing" icon="open-outline" variant="secondary" onPress={manageBilling} />
      </Card>

      <Section title="Invoice history">
        <Card style={{ padding: 0 }}>
          {DEMO_INVOICES.map((invoice, index) => (
            <View
              key={invoice.id}
              style={[
                styles.invoiceRow,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                },
              ]}>
              <Ionicons name="receipt-outline" size={17} color={colors.textMuted} />
              <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>{invoice.date}</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                {invoice.amount}
              </Text>
              <Badge label={invoice.status} tone="success" />
            </View>
          ))}
        </Card>
      </Section>

      <Text style={{ fontSize: 12.5, color: colors.textMuted, textAlign: 'center' }}>
        Demo billing data — plan changes, payment methods, and real invoices live in the web
        dashboard (Stripe/PayPal).
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
});
