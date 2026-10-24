import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/hooks/use-workspace';
import { apiErrorMessage, apiFetch } from '@/lib/api';
import { API_BASE_URL, webUrl } from '@/lib/config';
import { notify } from '@/lib/format';
import {
  connectGoogleBusinessProfile,
  getGmbConnection,
  type GmbConnection,
} from '@/lib/gmb-posts';
import { getPublishWorkflowId, setPublishWorkflowId } from '@/lib/publish';
import { useAuth } from '@/providers/auth-provider';

const API_BASE = API_BASE_URL;

interface WorkflowSummary {
  id: string;
  name: string;
  description?: string | null;
  is_published?: boolean;
}

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.statusRow}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'ellipse-outline'}
        size={16}
        color={ok ? colors.success : colors.textMuted}
      />
      <Text style={{ flex: 1, fontSize: 13, color: colors.textSecondary }}>{label}</Text>
    </View>
  );
}

/** Connect the outside services the app talks to. */
export default function IntegrationsScreen() {
  const { colors } = useTheme();
  const { user, initializing } = useAuth();
  const { business } = useWorkspace();
  const [google, setGoogle] = useState<GmbConnection | null>(null);
  const [checking, setChecking] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [workflowId, setWorkflowId] = useState('');
  const [workflowsError, setWorkflowsError] = useState<string | null>(null);

  useEffect(() => {
    void getPublishWorkflowId().then(setWorkflowId);
  }, []);

  useEffect(() => {
    if (!API_BASE || !business?.id || business.id.startsWith('demo')) return;
    let cancelled = false;
    setWorkflowsError(null);
    apiFetch<{ workflows: WorkflowSummary[] }>(
      `/api/workflows?businessId=${encodeURIComponent(business.id)}`,
    )
      .then((data) => {
        if (!cancelled) setWorkflows(Array.isArray(data?.workflows) ? data.workflows : []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setWorkflowsError(apiErrorMessage(err, "Couldn't load workflows."));
      });
    return () => {
      cancelled = true;
    };
  }, [business?.id]);

  const chooseWorkflow = async (id: string) => {
    const next = id === workflowId ? '' : id;
    await setPublishWorkflowId(next || null);
    setWorkflowId(next);
  };

  const refreshGoogle = useCallback(async () => {
    const connection = await getGmbConnection();
    setGoogle(connection);
    setChecking(false);
  }, []);

  useEffect(() => {
    void refreshGoogle();
    // Coming back from the Google sign-in sheet (or the dashboard) re-checks.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshGoogle();
    });
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('gbp-connected')) void refreshGoogle();
    });
    return () => {
      sub.remove();
      linkSub.remove();
    };
  }, [refreshGoogle]);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const googleConnected = google !== null;

  const connectGoogle = async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      const result = await connectGoogleBusinessProfile();
      if (!result.ok) {
        notify('Could not start Google sign-in', result.error);
        return;
      }
      await refreshGoogle();
    } finally {
      setConnecting(false);
    }
  };

  const openWeb = (path: string, missing: string) => {
    const url = webUrl(path);
    if (!url) {
      notify('Web app URL needed', missing);
      return;
    }
    void Linking.openURL(url);
  };

  return (
    <Screen>
      <DetailHeader title="Integrations" />

      <Section title="Google Business Profile">
        <Card style={{ gap: Spacing.md }}>
          <View style={styles.headerRow}>
            <Ionicons name="storefront" size={22} color={colors.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                Google Business Profile
              </Text>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                Powers every GMB feature: profile, hours, posts, and reviews.
              </Text>
            </View>
            <Badge
              label={
                checking
                  ? 'Checking…'
                  : googleConnected
                    ? google.approved
                      ? 'Connected'
                      : 'Pending approval'
                    : 'Not connected'
              }
              tone={googleConnected ? (google.approved ? 'success' : 'warning') : 'neutral'}
            />
          </View>

          {googleConnected ? (
            <>
              {google.email ? <StatusRow ok label={`Google account: ${google.email}`} /> : null}
              {google.locationName ? (
                <StatusRow ok label={`Location: ${google.locationName}`} />
              ) : null}
              {google.approved ? (
                <StatusRow ok label="Posts, profile info, and review replies are live" />
              ) : (
                <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}>
                  {google.message ??
                    'Google has not approved Business Profile API access for this project yet. Posts and reviews go live as soon as it is approved.'}
                </Text>
              )}
              <Button
                label="Reconnect with a different account"
                icon="refresh-outline"
                variant="secondary"
                loading={connecting}
                onPress={() => void connectGoogle()}
              />
            </>
          ) : (
            <>
              <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}>
                Sign in with the Google account that owns your business listing. The connection
                is shared with the web dashboard.
              </Text>
              <Button
                label="Connect Google Business Profile"
                icon="logo-google"
                loading={connecting}
                onPress={() => void connectGoogle()}
              />
              <Button
                label="Or connect on the web dashboard"
                icon="open-outline"
                variant="secondary"
                onPress={() =>
                  openWeb(
                    '/admin/settings',
                    'Set EXPO_PUBLIC_APP_URL to open your dashboard from here.',
                  )
                }
              />
              <Button
                label="Google API access docs"
                icon="help-circle-outline"
                variant="secondary"
                onPress={() =>
                  void Linking.openURL(
                    'https://developers.google.com/my-business/content/prereqs',
                  )
                }
              />
            </>
          )}
          <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
            Google Places is used only for address autocomplete and the public-view audit — never
            for managing your listing.
          </Text>
        </Card>
      </Section>

      <Section title="GoHighLevel">
        <Card style={{ gap: Spacing.md }}>
          <View style={styles.headerRow}>
            <Ionicons name="git-network-outline" size={22} color={colors.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                GoHighLevel
              </Text>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                Pushes completed jobs into your CRM workflows and website feed.
              </Text>
            </View>
            <Badge
              label={workflowId ? 'Connected' : 'Not connected'}
              tone={workflowId ? 'success' : 'neutral'}
            />
          </View>

          <StatusRow ok={Boolean(API_BASE)} label="Web app API reachable" />
          <StatusRow ok={Boolean(workflowId)} label="Publish workflow selected" />

          <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}>
            {workflowId
              ? 'Completing a job fires the selected workflow with the job details and photos.'
              : 'Pick the workflow that should receive completed jobs. Build workflows in the web dashboard under Automations.'}
          </Text>

          {workflows.length > 0 ? (
            <View style={{ gap: Spacing.sm }}>
              {workflows.map((wf) => {
                const active = wf.id === workflowId;
                return (
                  <Pressable
                    key={wf.id}
                    onPress={() => void chooseWorkflow(wf.id)}
                    style={({ pressed }) => [
                      styles.workflowRow,
                      {
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primarySoft : colors.card,
                      },
                      pressed && { opacity: 0.8 },
                    ]}>
                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={active ? colors.primary : colors.textMuted}
                    />
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                        {wf.name}
                      </Text>
                      {wf.description ? (
                        <Text style={{ fontSize: 12, color: colors.textSecondary }} numberOfLines={2}>
                          {wf.description}
                        </Text>
                      ) : null}
                    </View>
                    {wf.is_published === false ? <Badge label="Draft" tone="warning" /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : workflowsError ? (
            <Text style={{ fontSize: 12.5, color: colors.dangerStrong }}>{workflowsError}</Text>
          ) : (
            <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
              {business?.id?.startsWith('demo')
                ? 'Sample workspace — no workflows to choose from.'
                : 'No active workflows yet for this business.'}
            </Text>
          )}

          <Button
            label={workflowId ? 'Manage workflows' : 'Build a workflow in the web dashboard'}
            icon="open-outline"
            variant="secondary"
            onPress={() =>
              openWeb(
                '/admin/automations',
                'Set EXPO_PUBLIC_APP_URL to open your dashboard from here.',
              )
            }
          />
        </Card>
      </Section>

      <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>
        Connections are shared with the web app — set them once and both stay in sync.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  workflowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: 12,
  },
});
