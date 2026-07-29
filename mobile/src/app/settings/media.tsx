import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, IconTile } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/hooks/use-workspace';
import { notify } from '@/lib/format';
import { clearLogo, getLogoUri, pickLogo } from '@/lib/logo';
import {
  DEFAULT_MEDIA_PREFS,
  getMediaPrefs,
  setMediaPrefs,
  STAMP_POSITION_LABELS,
  STAMP_POSITIONS,
  type MediaPrefs,
  type PhotoQuality,
} from '@/lib/media-prefs';
import { workspace } from '@/lib/workspace';
import { useAuth } from '@/providers/auth-provider';
import type { MediaCategory } from '@/lib/types';

const QUALITY_OPTIONS: { value: PhotoQuality; label: string; sub: string }[] = [
  { value: 'standard', label: 'Standard', sub: '2048px — fast uploads, great for posts' },
  { value: 'high', label: 'High', sub: '3072px — sharper detail, larger uploads' },
  { value: 'original', label: 'Original', sub: 'Full camera resolution, biggest files' },
];

/** The nine stamp positions laid out as the 3x3 grid the user taps. */
const POSITION_ROWS = [
  STAMP_POSITIONS.slice(0, 3),
  STAMP_POSITIONS.slice(3, 6),
  STAMP_POSITIONS.slice(6, 9),
];

const CATEGORY_OPTIONS: { value: MediaCategory | 'ask'; label: string }[] = [
  { value: 'ask', label: 'Ask every time' },
  { value: 'before', label: 'Before' },
  { value: 'progress', label: 'Progress' },
  { value: 'after', label: 'After' },
  { value: 'final', label: 'Final' },
];

export default function MediaSettingsScreen() {
  const { colors } = useTheme();
  const { user, initializing } = useAuth();
  const { business } = useWorkspace();
  const [prefs, setPrefs] = useState<MediaPrefs>(DEFAULT_MEDIA_PREFS);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  // Tells "still loading" apart from "the businesses query failed" — without a
  // business the logo picker and the business/logo stamps cannot run at all.
  const [workspaceError, setWorkspaceError] = useState<string | null>(() => workspace.lastError());
  useEffect(() => workspace.subscribe(() => setWorkspaceError(workspace.lastError())), []);

  useEffect(() => {
    void getMediaPrefs().then(setPrefs);
  }, []);

  useEffect(() => {
    if (business) void getLogoUri(business.id).then(setLogoUri);
  }, [business]);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const update = (patch: Partial<MediaPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
    void setMediaPrefs(patch);
  };

  /** Everything on this screen that needs `business.id` is dead without one. */
  const blocked = !business;
  const blockedReason = workspaceError ?? 'Still loading your business…';

  return (
    <Screen>
      <DetailHeader title="Media & camera" />

      <Section title="Photo quality">
        <Card style={{ padding: 0 }}>
          {QUALITY_OPTIONS.map((option, index) => {
            const selected = prefs.quality === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => update({ quality: option.value })}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                  pressed && { backgroundColor: colors.cardPressed },
                ]}>
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>
                    {option.label}
                  </Text>
                  <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{option.sub}</Text>
                </View>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </Card>
      </Section>

      <Section title="Location">
        <Card style={styles.gpsRow}>
          <IconTile icon="location-outline" size={36} tone={prefs.attachGps ? 'primary' : 'neutral'} />
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>
              Attach GPS to photos
            </Text>
            <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
              Geotagged photos are a strong local SEO signal
            </Text>
          </View>
          <Switch
            value={prefs.attachGps}
            onValueChange={(value) => update({ attachGps: value })}
            trackColor={{ true: colors.primary, false: colors.cardPressed }}
            thumbColor="#FFFFFF"
          />
        </Card>
      </Section>

      <Section title={`Business logo — ${business?.name ?? 'your business'}`}>
        <Card style={{ gap: Spacing.md }}>
          <View style={styles.logoRow}>
            {logoUri ? (
              <Image
                source={{ uri: logoUri }}
                style={[styles.logoPreview, { backgroundColor: colors.cardPressed }]}
                contentFit="contain"
              />
            ) : (
              <View style={[styles.logoPreview, styles.logoEmpty, { backgroundColor: colors.cardPressed }]}>
                <Ionicons name="image-outline" size={22} color={colors.textMuted} />
              </View>
            )}
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>
                {logoUri ? 'Logo set' : 'No logo yet'}
              </Text>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                PNG only — used for logo stickers and the capture stamp
              </Text>
            </View>
          </View>
          {blocked ? (
            <View style={styles.gpsRow}>
              <IconTile
                icon={workspaceError ? 'cloud-offline-outline' : 'hourglass-outline'}
                size={34}
                tone={workspaceError ? 'danger' : 'neutral'}
              />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>
                  {workspaceError ? 'Logo controls unavailable' : 'Loading your business…'}
                </Text>
                <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                  {workspaceError
                    ? `${workspaceError} The logo is stored per business, so it can't be changed until one loads.`
                    : 'The logo is stored per business — the controls turn on as soon as it loads.'}
                </Text>
              </View>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <Button
              label={logoUri ? 'Change logo' : 'Choose PNG logo'}
              icon="image-outline"
              variant="secondary"
              disabled={blocked}
              style={{ flex: 1 }}
              onPress={() => {
                if (!business) return;
                void pickLogo(business.id).then((result) => {
                  if (result.error) notify('PNG logos only', result.error);
                  else if (result.uri) {
                    setLogoUri(result.uri);
                    if (result.syncError) {
                      notify(
                        'Logo saved on this device only',
                        `Couldn't sync it to your business, so other devices and the web dashboard won't see it. (${result.syncError})`,
                      );
                    }
                  }
                });
              }}
            />
            {logoUri ? (
              <Button
                label="Remove"
                icon="trash-outline"
                variant="secondary"
                disabled={blocked}
                style={{ flex: 1 }}
                onPress={() => {
                  if (!business) return;
                  void clearLogo(business.id).then(() => setLogoUri(null));
                }}
              />
            ) : null}
          </View>
          <View style={styles.gpsRow}>
            <IconTile
              icon="color-wand-outline"
              size={34}
              tone={prefs.stampLogo && !blocked ? 'primary' : 'neutral'}
            />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>
                Logo stamp on capture
              </Text>
              {/* Red only for a real failure — the brief gap before the first
                  load resolves is not something to alarm anyone about. */}
              <Text
                style={{
                  fontSize: 12.5,
                  color: blocked && workspaceError ? colors.dangerStrong : colors.textSecondary,
                }}>
                {blocked
                  ? `Not being applied — ${blockedReason}`
                  : 'Auto-place the logo on new photos, wherever you pick below'}
              </Text>
            </View>
            <Switch
              value={prefs.stampLogo}
              onValueChange={(value) => update({ stampLogo: value })}
              trackColor={{ true: colors.primary, false: colors.cardPressed }}
              thumbColor="#FFFFFF"
            />
          </View>

          {prefs.stampLogo ? (
            <View style={{ gap: Spacing.sm }}>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                Tap a cell to choose where the logo sits on the photo.
              </Text>
              <View style={{ gap: Spacing.sm }}>
                {POSITION_ROWS.map((row, rowIndex) => (
                  <View key={rowIndex} style={{ flexDirection: 'row', gap: Spacing.sm }}>
                    {row.map((position) => {
                      const selected = prefs.stampPosition === position;
                      return (
                        <Pressable
                          key={position}
                          accessibilityRole="button"
                          accessibilityLabel={STAMP_POSITION_LABELS[position]}
                          accessibilityState={{ selected }}
                          onPress={() => update({ stampPosition: position })}
                          style={({ pressed }) => [
                            styles.gridCell,
                            {
                              borderColor: selected ? colors.primary : colors.border,
                              backgroundColor: selected ? colors.primarySoft : colors.card,
                            },
                            pressed && !selected && { backgroundColor: colors.cardPressed },
                          ]}>
                          <View
                            style={[
                              styles.gridDot,
                              { backgroundColor: selected ? colors.primary : colors.textMuted },
                            ]}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: '600',
                  color: colors.textSecondary,
                  textAlign: 'center',
                }}>
                {STAMP_POSITION_LABELS[prefs.stampPosition]}
              </Text>
            </View>
          ) : null}
        </Card>
      </Section>

      <Section title="Photo stamps">
        <Card style={{ padding: 0 }}>
          {(
            [
              {
                key: 'stampBusiness' as const,
                icon: 'business-outline' as const,
                label: 'Business name stamp',
                sub: 'Overlay your business name on photos',
              },
              {
                key: 'stampTimestamp' as const,
                icon: 'time-outline' as const,
                label: 'Timestamp stamp',
                sub: 'Overlay the capture date and time',
              },
              {
                key: 'stampGps' as const,
                icon: 'navigate-outline' as const,
                label: 'GPS coordinates stamp',
                sub: 'Overlay latitude/longitude (needs GPS on)',
              },
            ]
          ).map((row, index) => {
            // Only the business-name stamp needs the current business to render.
            const rowBlocked = blocked && row.key === 'stampBusiness';
            return (
              <View
                key={row.key}
                style={[
                  styles.row,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                ]}>
                <IconTile
                  icon={row.icon}
                  size={34}
                  tone={prefs[row.key] && !rowBlocked ? 'primary' : 'neutral'}
                />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>
                    {row.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12.5,
                      color: rowBlocked && workspaceError ? colors.dangerStrong : colors.textSecondary,
                    }}>
                    {rowBlocked ? `Not being applied — ${blockedReason}` : row.sub}
                  </Text>
                </View>
                <Switch
                  value={prefs[row.key]}
                  onValueChange={(value) => update({ [row.key]: value })}
                  trackColor={{ true: colors.primary, false: colors.cardPressed }}
                  thumbColor="#FFFFFF"
                />
              </View>
            );
          })}
        </Card>
      </Section>

      <Section title="Default photo category">
        <Card style={{ padding: 0 }}>
          {CATEGORY_OPTIONS.map((option, index) => {
            const selected = prefs.defaultCategory === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => update({ defaultCategory: option.value })}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                  pressed && { backgroundColor: colors.cardPressed },
                ]}>
                <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '600', color: colors.text }}>
                  {option.label}
                </Text>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </Card>
      </Section>

      <Text style={{ fontSize: 12.5, color: colors.textMuted, textAlign: 'center' }}>
        Picking a default category skips the category sheet when capturing.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  logoPreview: {
    width: 84,
    height: 44,
    borderRadius: 8,
  },
  logoEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** aspectRatio 4/3 per cell makes the whole 3x3 grid a 4:3 photo shape. */
  gridCell: {
    flex: 1,
    aspectRatio: 4 / 3,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
});
