/**
 * Settings > Team — a read-only view of `fetchTeam`, the shared roster.
 *
 * This screen used to run its own `users` query with no business filter, so a
 * connected project showed every account in the whole database as if they were
 * colleagues, and it kept a private copy of the three sample names. Both now
 * come from '@/lib/team'.
 *
 * The roster is honest about being sampled (`isDemo`/`demoReason`), and this
 * screen is the one place that has to be blunt about it: nobody has signed in
 * to this project yet, so what everyone actually sees today is `DEMO_TEAM`.
 * Sample rows are labelled as samples rather than presented as the user's team.
 */

import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Avatar, Badge, Card } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/hooks/use-workspace';
import { fetchTeam, type TeamRoster } from '@/lib/team';
import { useAuth } from '@/providers/auth-provider';

export default function TeamSettingsScreen() {
  const { colors } = useTheme();
  const { user, initializing } = useAuth();
  const { business } = useWorkspace();

  const [roster, setRoster] = useState<TeamRoster | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // `business` is null while useWorkspace loads, so the roster cannot be a
  // fetch-once call — it has to re-run once the workspace resolves, or an
  // unscoped sample list would stick. fetchTeam never rejects.
  const businessId = business?.id ?? null;
  const load = useCallback(() => fetchTeam(businessId, user), [businessId, user]);

  useEffect(() => {
    let alive = true;
    void load().then((next) => {
      if (alive) setRoster(next);
    });
    return () => {
      alive = false;
    };
  }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load()
      .then(setRoster)
      .finally(() => setRefreshing(false));
  }, [load]);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const members = roster?.members ?? [];
  const isDemo = roster?.isDemo ?? false;
  const divider = {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <DetailHeader title="Team" />

      {roster && isDemo && roster.demoReason ? (
        <Card style={{ gap: Spacing.sm }}>
          <View style={styles.noteRow}>
            <Ionicons name="people-outline" size={16} color={colors.warningStrong} />
            <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '600', color: colors.text }}>
              These are sample teammates
            </Text>
          </View>
          <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
            {roster.demoReason} Nothing here is a real colleague, and none of these people can be
            contacted from the app.
          </Text>
          {roster.error ? (
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              Lookup failed: {roster.error}
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Section title={roster ? `Team (${members.length})` : 'Team'}>
        {roster === null ? (
          <Card style={styles.noteRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>Loading team…</Text>
          </Card>
        ) : (
          <Card style={{ padding: 0 }}>
            {members.map((member, index) => (
              <View key={member.id} style={[styles.row, index > 0 && divider]}>
                <Avatar name={member.name} size={36} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text
                    style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}
                    numberOfLines={1}>
                    {member.name}
                  </Text>
                  {member.email ? (
                    <Text style={{ fontSize: 12.5, color: colors.textSecondary }} numberOfLines={1}>
                      {member.email}
                    </Text>
                  ) : null}
                </View>
                {member.isYou ? <Badge label="You" tone="primary" /> : null}
                {/* A sampled row's role is invented too, so it says so instead. */}
                {isDemo && !member.isYou ? (
                  <Badge label="Sample" tone="warning" />
                ) : member.role ? (
                  <Badge
                    label={member.role}
                    tone={member.role === 'Owner' ? 'primary' : 'neutral'}
                  />
                ) : null}
              </View>
            ))}
          </Card>
        )}
      </Section>

      <Section title="Adding teammates">
        <Card style={{ gap: Spacing.sm }}>
          <View style={styles.noteRow}>
            <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
            <Text style={{ flex: 1, fontSize: 12.5, color: colors.textSecondary }}>
              Sending an invite is not available yet — not from this app and not from the web
              dashboard. There is no invite email behind either one, so this screen deliberately
              offers no invite box rather than collecting an address that would reach nobody.
            </Text>
          </View>
          <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
            Accounts are created and linked to a business outside the app for now. Once someone is
            linked and has signed in, they appear in this list.
          </Text>
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
});
