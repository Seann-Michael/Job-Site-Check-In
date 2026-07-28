import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { notify } from '@/lib/format';
import { getGmbConnection } from '@/lib/gmb-posts';
import { useAuth } from '@/providers/auth-provider';

const APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? '';
const GHL_WEBHOOK = process.env.EXPO_PUBLIC_PUBLISH_WEBHOOK_ID ?? '';
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

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
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleLocation, setGoogleLocation] = useState('');

  useEffect(() => {
    void getGmbConnection().then((connection) => {
      setGoogleConnected(Boolean(connection));
      setGoogleLocation(connection?.locationName ?? '');
    });
  }, []);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const openWeb = (path: string, missing: string) => {
    if (!APP_URL) {
      notify('Web app URL needed', missing);
      return;
    }
    void Linking.openURL(`${APP_URL.replace(/\/$/, '')}${path}`);
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
              label={googleConnected ? 'Connected' : 'Not connected'}
              tone={googleConnected ? 'success' : 'neutral'}
            />
          </View>

          {googleConnected ? (
            <>
              <StatusRow ok label={`Location: ${googleLocation}`} />
              <StatusRow ok label="Posts, profile info, and review replies are live" />
            </>
          ) : (
            <>
              <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}>
                Sign in with the Google account that owns your business listing. Two one-time
                steps:
              </Text>
              <StatusRow
                ok={false}
                label="1. Request Business Profile API access in Google Cloud (approval takes a few days)"
              />
              <StatusRow
                ok={false}
                label="2. Sign in with Google on the web dashboard to authorize this app"
              />
              <Button
                label="Connect on the web dashboard"
                icon="open-outline"
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
              label={GHL_WEBHOOK ? 'Connected' : 'Not connected'}
              tone={GHL_WEBHOOK ? 'success' : 'neutral'}
            />
          </View>

          <StatusRow ok={Boolean(API_BASE)} label="Web app API reachable" />
          <StatusRow ok={Boolean(GHL_WEBHOOK)} label="Publish workflow selected" />

          <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}>
            {GHL_WEBHOOK
              ? 'Completing a job fires your GoHighLevel workflow with the job details and photos.'
              : 'Pick the workflow that should receive completed jobs in the web dashboard, then it fires automatically from here.'}
          </Text>
          <Button
            label={GHL_WEBHOOK ? 'Manage workflows' : 'Set up in the web dashboard'}
            icon="open-outline"
            variant={GHL_WEBHOOK ? 'secondary' : 'primary'}
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
});
