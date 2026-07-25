import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, IconTile } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/hooks/use-workspace';
import { clearLogo, getLogoUri, pickLogo } from '@/lib/logo';
import {
  DEFAULT_MEDIA_PREFS,
  getMediaPrefs,
  setMediaPrefs,
  type MediaPrefs,
  type PhotoQuality,
} from '@/lib/media-prefs';
import { useAuth } from '@/providers/auth-provider';
import type { MediaCategory } from '@/lib/types';

const QUALITY_OPTIONS: { value: PhotoQuality; label: string; sub: string }[] = [
  { value: 'standard', label: 'Standard', sub: '2048px — fast uploads, great for posts' },
  { value: 'high', label: 'High', sub: '3072px — sharper detail, larger uploads' },
  { value: 'original', label: 'Original', sub: 'Full camera resolution, biggest files' },
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
                Used for logo stickers and the capture stamp
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <Button
              label={logoUri ? 'Change logo' : 'Choose logo'}
              icon="image-outline"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => {
                if (!business) return;
                void pickLogo(business.id).then((uri) => {
                  if (uri) setLogoUri(uri);
                });
              }}
            />
            {logoUri ? (
              <Button
                label="Remove"
                icon="trash-outline"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => {
                  if (!business) return;
                  void clearLogo(business.id).then(() => setLogoUri(null));
                }}
              />
            ) : null}
          </View>
          <View style={styles.gpsRow}>
            <IconTile icon="color-wand-outline" size={34} tone={prefs.stampLogo ? 'primary' : 'neutral'} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>
                Logo stamp on capture
              </Text>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                Auto-place the logo bottom-right on new photos
              </Text>
            </View>
            <Switch
              value={prefs.stampLogo}
              onValueChange={(value) => update({ stampLogo: value })}
              trackColor={{ true: colors.primary, false: colors.cardPressed }}
              thumbColor="#FFFFFF"
            />
          </View>
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
          ).map((row, index) => (
            <View
              key={row.key}
              style={[
                styles.row,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                },
              ]}>
              <IconTile icon={row.icon} size={34} tone={prefs[row.key] ? 'primary' : 'neutral'} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>
                  {row.label}
                </Text>
                <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{row.sub}</Text>
              </View>
              <Switch
                value={prefs[row.key]}
                onValueChange={(value) => update({ [row.key]: value })}
                trackColor={{ true: colors.primary, false: colors.cardPressed }}
                thumbColor="#FFFFFF"
              />
            </View>
          ))}
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
});
