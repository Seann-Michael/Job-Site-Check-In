import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Badge, Button, Card, IconTile } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/hooks/use-workspace';
import { notify } from '@/lib/format';
import type { Business, BusinessAddress } from '@/lib/types';
import type { BusinessPatch } from '@/lib/workspace';
import { useAuth } from '@/providers/auth-provider';

/**
 * The details of the *active* business — the mobile counterpart of the web
 * app's Settings → Business tab, writing the same columns (name, description,
 * phone, email, website, address JSONB). Picking *which* business is active is
 * a different screen: app/settings/business.tsx.
 *
 * Saves send a *diff* against the record the form was seeded from, never the
 * whole form. A field the user did not touch is left out of the patch entirely,
 * so lib/workspace.ts never writes it; a field the user emptied is sent as ''
 * and cleared (-> null in Supabase). Without the diff, saving a form seeded
 * from a thin cached business (name and id only) would null out the real phone,
 * email, website, and address on the server.
 */
export default function BusinessProfileScreen() {
  const { colors } = useTheme();
  const { user, initializing, isSupabaseConfigured } = useAuth();
  const { business, update } = useWorkspace();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [country, setCountry] = useState('');
  /**
   * The record the fields above were filled from — the save baseline, and the
   * proof that the form holds a loaded business rather than ten empty strings.
   * Null until that has happened, which is what gates the save button.
   */
  const [seeded, setSeeded] = useState<Business | null>(null);
  const [saving, setSaving] = useState(false);

  // Seed once per business. Saving re-emits with the merged copy, and re-seeding
  // on every change would fight whatever the user is typing; a different id
  // (they switched business in the other screen) does refill the form.
  useEffect(() => {
    if (!business || business.id === seeded?.id) return;
    setSeeded(business);
    setName(business.name);
    setDescription(business.description ?? '');
    setPhone(business.phone ?? '');
    setEmail(business.email ?? '');
    setWebsite(business.website ?? '');
    setStreet(business.address?.street ?? '');
    setCity(business.address?.city ?? '');
    setState(business.address?.state ?? '');
    setZip(business.address?.zip ?? '');
    setCountry(business.address?.country ?? '');
  }, [business, seeded]);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const fieldStyle = [
    styles.input,
    { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
  ];

  // Only what changed against the seeded record. An untouched field is absent
  // from the patch, so the writer leaves the server copy alone.
  const buildPatch = (from: Business) => {
    const patch: BusinessPatch = {};
    const changed = (next: string, before: string | undefined) => next !== (before ?? '');
    if (changed(name.trim(), from.name)) patch.name = name.trim();
    if (changed(description.trim(), from.description)) patch.description = description.trim();
    if (changed(phone.trim(), from.phone)) patch.phone = phone.trim();
    if (changed(email.trim(), from.email)) patch.email = email.trim();
    if (changed(website.trim(), from.website)) patch.website = website.trim();
    // `address` is one JSONB column, so any change rewrites the whole object —
    // built from the seeded values the user left alone, not from nothing.
    const address: BusinessAddress = {
      ...(street.trim() ? { street: street.trim() } : {}),
      ...(city.trim() ? { city: city.trim() } : {}),
      ...(state.trim() ? { state: state.trim() } : {}),
      ...(zip.trim() ? { zip: zip.trim() } : {}),
      ...(country.trim() ? { country: country.trim() } : {}),
    };
    const before = from.address;
    const addressChanged =
      changed(street.trim(), before?.street) ||
      changed(city.trim(), before?.city) ||
      changed(state.trim(), before?.state) ||
      changed(zip.trim(), before?.zip) ||
      changed(country.trim(), before?.country);
    if (addressChanged) patch.address = address;
    return patch;
  };

  // A business has to be called something — every job, photo, and post is filed
  // under this name. Nothing else is required, matching the web form. Saving is
  // impossible before the form has been seeded from a loaded record: with no
  // baseline there is no way to tell an untouched field from a cleared one.
  const pending: BusinessPatch = seeded ? buildPatch(seeded) : {};
  const canSave = Boolean(seeded) && Boolean(name.trim()) && Object.keys(pending).length > 0;

  // Demo businesses never reach the network, and neither does anything else
  // until Supabase is configured. Say so rather than implying a server save.
  const localOnly = !isSupabaseConfigured || Boolean(business?.id.startsWith('demo'));

  const handleSave = async () => {
    if (!seeded || !canSave || saving) return;
    setSaving(true);
    try {
      const patch = pending;
      const result = await update(patch);
      // The local override is written before the network call, so the change is
      // on this device either way. Only `synced` means the server took it.
      if (result.synced) {
        setSeeded({ ...seeded, ...patch });
        notify('Business profile saved', 'Your business details have been updated.');
      } else if (result.reason === 'local') {
        setSeeded({ ...seeded, ...patch });
        notify(
          'Saved on this device',
          localOnly
            ? 'Connect your account to sync these details to the web dashboard.'
            : 'These details are stored on this device only.',
        );
      } else {
        notify(
          'Saved on this device only',
          result.message
            ? `Couldn't save to the server, so the web dashboard still shows the previous details. (${result.message})`
            : "Couldn't save to the server, so the web dashboard still shows the previous details.",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen avoidKeyboard>
      <DetailHeader title="Business profile" />

      <Card style={styles.headerCard}>
        <IconTile icon="business-outline" size={52} tone="primary" />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
            {name.trim() || business?.name || 'Business'}
          </Text>
          {business?.plan ? <Badge label={business.plan} tone="primary" /> : null}
        </View>
      </Card>

      <Section title="Business details">
        <Card style={{ gap: Spacing.md }}>
          <View style={{ gap: 5 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Business name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Westside Home Services"
              placeholderTextColor={colors.textMuted}
              style={fieldStyle}
            />
          </View>
          <View style={{ gap: 5 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What you do, and the areas you cover"
              placeholderTextColor={colors.textMuted}
              multiline
              style={[fieldStyle, styles.multiline]}
            />
          </View>
          <View style={{ gap: 5 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Phone</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="(555) 555-0123"
              placeholderTextColor={colors.textMuted}
              style={fieldStyle}
            />
          </View>
          <View style={{ gap: 5 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="hello@yourbusiness.com"
              placeholderTextColor={colors.textMuted}
              style={fieldStyle}
            />
          </View>
          <View style={{ gap: 5 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Website</Text>
            <TextInput
              value={website}
              onChangeText={setWebsite}
              keyboardType="url"
              autoCapitalize="none"
              placeholder="https://yourbusiness.com"
              placeholderTextColor={colors.textMuted}
              style={fieldStyle}
            />
          </View>
        </Card>
      </Section>

      <Section title="Address">
        <Card style={{ gap: Spacing.md }}>
          <View style={{ gap: 5 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Street</Text>
            <TextInput
              value={street}
              onChangeText={setStreet}
              placeholder="214 Maple Ave"
              placeholderTextColor={colors.textMuted}
              style={fieldStyle}
            />
          </View>
          <View style={{ gap: 5 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>City</Text>
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="Westlake"
              placeholderTextColor={colors.textMuted}
              style={fieldStyle}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>State</Text>
              <TextInput
                value={state}
                onChangeText={setState}
                placeholder="OH"
                placeholderTextColor={colors.textMuted}
                style={fieldStyle}
              />
            </View>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>ZIP</Text>
              <TextInput
                value={zip}
                onChangeText={setZip}
                keyboardType="number-pad"
                placeholder="44145"
                placeholderTextColor={colors.textMuted}
                style={fieldStyle}
              />
            </View>
          </View>
          <View style={{ gap: 5 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Country</Text>
            <TextInput
              value={country}
              onChangeText={setCountry}
              placeholder="United States"
              placeholderTextColor={colors.textMuted}
              style={fieldStyle}
            />
          </View>
        </Card>
      </Section>

      <Button
        label="Save changes"
        loading={saving}
        disabled={!canSave}
        onPress={() => void handleSave()}
      />

      <Text style={{ fontSize: 12.5, color: colors.textMuted, textAlign: 'center' }}>
        {business
          ? 'These details are used on your GMB posts, review requests, and photo stamps. Editing changes the active business — switch businesses from Settings → Switch business.'
          : 'Loading the active business…'}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    fontSize: 15,
  },
  multiline: {
    height: 88,
    paddingTop: Spacing.sm + 2,
    textAlignVertical: 'top',
  },
});
