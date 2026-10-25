import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Badge, Button, Card, IconTile, Segmented, type IconName } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { useRole } from '@/hooks/use-role';
import { useWorkspace } from '@/hooks/use-workspace';
import { apiErrorMessage, apiFetch } from '@/lib/api';
import { notify } from '@/lib/format';
import { getGmbConnection, type GmbConnection } from '@/lib/gmb-posts';
import {
  DEFAULT_SHARE_SETTINGS,
  fetchShareSettings,
  isSharingAvailable,
  SHARE_DESTINATIONS,
  SHARE_LABELS,
  updateShareSettings,
  type ShareDestination,
  type ShareSettings,
} from '@/lib/shares';
import { useAuth } from '@/providers/auth-provider';

interface WorkflowSummary {
  id: string;
  name: string;
  description?: string | null;
}

const DEST_ICONS: Record<ShareDestination, IconName> = {
  gbp: 'storefront-outline',
  facebook: 'logo-facebook',
  instagram: 'logo-instagram',
  website: 'globe-outline',
};

const AFTER_OPTIONS = [
  { value: 'ask', label: 'Ask me', hint: 'Show the draft, then I choose' },
  { value: 'auto', label: 'Automatic', hint: 'Goes out as soon as photos upload' },
  { value: 'queue', label: 'Queue', hint: 'Nothing goes out until I share it' },
];

/**
 * Sharing & destinations — where projects go and what happens after photos
 * are taken. One source of truth on the business, edited by the owner.
 */
export default function SharingSettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, initializing } = useAuth();
  const { business } = useWorkspace();
  const { mode } = useRole();
  const isOwner = mode === 'owner';

  const loader = useCallback(
    () => (business?.id && isSharingAvailable ? fetchShareSettings(business.id) : Promise.resolve({} as ShareSettings)),
    [business?.id],
  );
  const { data, loading, refresh } = useData(loader);
  const [settings, setSettings] = useState<ShareSettings | null>(null);
  const [google, setGoogle] = useState<GmbConnection | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && !settings) setSettings({ ...DEFAULT_SHARE_SETTINGS, ...data, destinations: { ...DEFAULT_SHARE_SETTINGS.destinations, ...(data.destinations ?? {}) } });
  }, [data, settings]);

  useEffect(() => {
    void getGmbConnection().then(setGoogle);
    if (!business?.id || !isSharingAvailable || business.id.startsWith('demo')) return;
    apiFetch<{ workflows: WorkflowSummary[] }>(`/api/workflows?businessId=${encodeURIComponent(business.id)}`)
      .then((d) => setWorkflows(Array.isArray(d?.workflows) ? d.workflows : []))
      .catch(() => setWorkflows([]));
  }, [business?.id]);

  if (!initializing && !user) return <Redirect href="/login" />;

  const save = async (patch: Partial<ShareSettings>) => {
    if (!business?.id || !settings) return;
    const next = { ...settings, ...patch, destinations: { ...settings.destinations, ...(patch.destinations ?? {}) } };
    setSettings(next);
    if (!isOwner) {
      notify('Owner only', 'Only the business owner can change sharing settings.');
      return;
    }
    setSaving(true);
    try {
      await updateShareSettings(business.id, patch);
    } catch (err) {
      notify('Not saved', apiErrorMessage(err));
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const s = settings;
  const connectedLabel = (d: ShareDestination): { label: string; tone: 'success' | 'warning' | 'neutral' } => {
    if (d === 'gbp') return google ? { label: google.approved ? 'Connected' : 'Pending', tone: google.approved ? 'success' : 'warning' } : { label: 'Not connected', tone: 'neutral' };
    if (d === 'website') return s?.website_workflow_id ? { label: 'Connected', tone: 'success' } : { label: 'Not set up', tone: 'neutral' };
    const c = d === 'facebook' ? s?.facebook : s?.instagram;
    return c?.connected ? { label: 'Connected', tone: 'success' } : { label: 'Not connected', tone: 'neutral' };
  };

  return (
    <Screen>
      <DetailHeader title="Sharing & destinations" />
      {loading && !s ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xxl }} />
      ) : !s ? (
        <Card>
          <Text style={{ color: colors.textSecondary }}>Sharing settings load once you are signed in to a workspace.</Text>
        </Card>
      ) : (
        <>
          <Section title="Where projects go">
            <Card style={{ padding: 0 }}>
              {SHARE_DESTINATIONS.map((d, i) => {
                const c = connectedLabel(d);
                return (
                  <View key={d} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                    <IconTile icon={DEST_ICONS[d]} size={36} tone={s.destinations?.[d] ? 'primary' : 'neutral'} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>{SHARE_LABELS[d]}</Text>
                      <Pressable
                        onPress={() => {
                          if (d === 'gbp') router.push('/settings/integrations');
                          else if (d === 'website') notify('Website', workflows.length ? 'Pick the workflow below.' : 'Build a workflow in the web dashboard under Automations, then pick it here.');
                          else notify(`${SHARE_LABELS[d]}`, 'Connecting a Page is coming in the next build. Until then this destination reports "not connected".');
                        }}>
                        <Badge label={c.label} tone={c.tone} />
                      </Pressable>
                    </View>
                    <Switch
                      value={Boolean(s.destinations?.[d])}
                      onValueChange={(v) => void save({ destinations: { [d]: v } })}
                      trackColor={{ true: colors.primary, false: colors.cardPressed }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                );
              })}
            </Card>
            {workflows.length > 0 ? (
              <View style={{ gap: Spacing.sm }}>
                <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>Website: which workflow receives the project</Text>
                {workflows.map((wf) => {
                  const active = wf.id === s.website_workflow_id;
                  return (
                    <Pressable
                      key={wf.id}
                      onPress={() => void save({ website_workflow_id: active ? (null as unknown as string) : wf.id })}
                      style={({ pressed }) => [styles.wfRow, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : colors.card }, pressed && { opacity: 0.8 }]}>
                      <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.text }}>{wf.name}</Text>
                      {active ? <Badge label="Selected" tone="primary" /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </Section>

          <Section title="After photos are taken">
            <Card style={{ padding: 0 }}>
              {AFTER_OPTIONS.map((o, i) => {
                const active = (s.after_capture ?? 'ask') === o.value;
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => void save({ after_capture: o.value as ShareSettings['after_capture'] })}
                    style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, pressed && { backgroundColor: colors.cardPressed }]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>{o.label}</Text>
                      <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{o.hint}</Text>
                    </View>
                    {active ? <Badge label="Current" tone="primary" /> : null}
                  </Pressable>
                );
              })}
            </Card>
          </Section>

          <Section title="Posts">
            <Card style={{ padding: 0 }}>
              <View style={styles.row}>
                <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '600', color: colors.text }}>Max photos per post</Text>
                <View style={{ width: 170 }}>
                  <Segmented
                    options={[4, 6, 8, 10].map((n) => ({ value: String(n), label: String(n) }))}
                    value={String(s.max_photos ?? 6)}
                    onChange={(v) => void save({ max_photos: Number(v) })}
                  />
                </View>
              </View>
              <View style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '600', color: colors.text }}>Hashtags on social</Text>
                <Switch value={s.hashtags !== false} onValueChange={(v) => void save({ hashtags: v })} trackColor={{ true: colors.primary, false: colors.cardPressed }} thumbColor="#FFFFFF" />
              </View>
            </Card>
          </Section>

          <Section title="Caption style">
            <Card style={{ gap: Spacing.md }}>
              <Segmented
                options={[
                  { value: 'plain', label: 'Plain' },
                  { value: 'friendly', label: 'Friendly' },
                  { value: 'professional', label: 'Professional' },
                ]}
                value={s.caption?.tone ?? 'plain'}
                onChange={(v) => void save({ caption: { ...s.caption, tone: v as 'plain' | 'friendly' | 'professional' } })}
              />
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                Always mention: {s.caption?.always_mention ? `“${s.caption.always_mention}”` : 'nothing yet'} · Never say: {s.caption?.never_say?.length ? s.caption.never_say.join(', ') : 'nothing yet'}
              </Text>
              <Button label="Edit always-mention and never-say" variant="secondary" icon="create-outline" onPress={() => router.push('/settings/business-profile')} />
            </Card>
          </Section>

          <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>
            {saving ? 'Saving…' : isOwner ? 'Changes save as you make them and apply to every phone in this business.' : 'Only the owner can change these.'}
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  wfRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderWidth: 1, borderRadius: Radius.md },
});
