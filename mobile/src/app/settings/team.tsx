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
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar, Badge, Button, Card, Segmented } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useRole } from '@/hooks/use-role';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/hooks/use-workspace';
import { isApiConfigured } from '@/lib/config';
import { notify } from '@/lib/format';
import { fetchTeam, inviteTeamMember, type TeamRoster } from '@/lib/team';
import { useAuth } from '@/providers/auth-provider';

const ROLE_OPTIONS = [
  { value: 'staff', label: 'Staff' },
  { value: 'viewer', label: 'Viewer' },
];

export default function TeamSettingsScreen() {
  const { colors } = useTheme();
  const { user, initializing } = useAuth();
  const { business } = useWorkspace();

  const { canManage } = useRole();
  const [roster, setRoster] = useState<TeamRoster | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('staff');
  const [inviting, setInviting] = useState(false);

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
  const canInvite =
    canManage && isApiConfigured && Boolean(businessId) && !businessId?.startsWith('demo');

  const sendInvite = async () => {
    if (!businessId || inviting) return;
    const email = inviteEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      notify('Check the email', 'Enter a valid email address for your teammate.');
      return;
    }
    setInviting(true);
    const result = await inviteTeamMember(
      businessId,
      email,
      inviteRole === 'viewer' ? 'viewer' : 'staff',
      inviteName,
    );
    setInviting(false);
    if (!result.ok) {
      notify('Could not add teammate', result.error);
      return;
    }
    setInviteEmail('');
    setInviteName('');
    notify(
      'Teammate added',
      `${email} now has ${inviteRole} access. If they are new, they get an email to set a password.`,
    );
    refresh();
  };
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

      <Section title="Add a teammate">
        {canInvite ? (
          <Card style={{ gap: Spacing.md }}>
            <Text style={{ fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 }}>
              Staff can add jobs, photos and posts. Viewers can only look. New teammates receive an
              email invitation to set their password.
            </Text>
            <TextInput
              value={inviteName}
              onChangeText={setInviteName}
              placeholder="Name (optional)"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              style={[
                styles.input,
                { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
              ]}
            />
            <TextInput
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="teammate@company.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={[
                styles.input,
                { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
              ]}
            />
            <Segmented options={ROLE_OPTIONS} value={inviteRole} onChange={setInviteRole} />
            <Button
              label="Add teammate"
              icon="person-add-outline"
              loading={inviting}
              onPress={() => void sendInvite()}
            />
          </Card>
        ) : (
          <Card style={{ gap: Spacing.sm }}>
            <View style={styles.noteRow}>
              <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
              <Text style={{ flex: 1, fontSize: 12.5, color: colors.textSecondary }}>
                {!canManage
                  ? 'Only the business owner can add or remove teammates.'
                  : businessId?.startsWith('demo') || !businessId
                    ? 'Switch to your real business to manage its team.'
                    : 'Team management needs the web app API, which this build cannot reach.'}
              </Text>
            </View>
          </Card>
        )}
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
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 14,
  },
});
