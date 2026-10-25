import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Avatar, Badge, Button, Card, IconTile, Segmented } from '@/components/ui/basics';
import { TagEditor } from '@/components/tag-editor';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { useRole } from '@/hooks/use-role';
import { useWorkspace } from '@/hooks/use-workspace';
import { apiErrorMessage } from '@/lib/api';
import { notify } from '@/lib/format';
import { fetchShareSettings, isSharingAvailable, updateShareSettings, type ShareSettings } from '@/lib/shares';
import type { Business, BusinessAddress } from '@/lib/types';
import type { BusinessPatch } from '@/lib/workspace';
import { useAuth } from '@/providers/auth-provider';

/**
 * Business — identity, contact, online presence, service area, services,
 * credentials and the About text that captions and the website page use.
 *
 * Two stores, one screen: name/description/phone/email/website/address write
 * the businesses row the web app also edits (as a diff, never the whole
 * form); everything else lives in businesses.share_settings.profile through
 * the sharing API, so captions and the website page read the same values.
 */
interface Profile {
  tagline: string;
  category: string;
  founded: string;
  owner_name: string;
  service_area: string[];
  radius_miles: number;
  services: string[];
  license: string;
  insured: boolean;
  bonded: boolean;
  certifications: string[];
  about: string;
  hide_street: boolean;
  facebook_url: string;
  instagram_handle: string;
  review_link: string;
}

const EMPTY_PROFILE: Profile = {
  tagline: '', category: '', founded: '', owner_name: '', service_area: [], radius_miles: 25, services: [],
  license: '', insured: false, bonded: false, certifications: [], about: '', hide_street: true,
  facebook_url: '', instagram_handle: '', review_link: '',
};

function Field({ label, hint, value, onChangeText, placeholder, multiline, keyboardType, autoCapitalize, style }: {
  label: string; hint?: string; value: string; onChangeText: (v: string) => void; placeholder?: string; multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad' | 'email-address' | 'number-pad' | 'url'; autoCapitalize?: 'none' | 'characters' | 'sentences' | 'words'; style?: object;
}) {
  const { colors } = useTheme();
  return (
    <View style={[{ gap: 5 }, style]}>
      <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.textSecondary }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }, multiline && styles.multiline]}
      />
      {hint ? <Text style={{ fontSize: 12, color: colors.textMuted }}>{hint}</Text> : null}
    </View>
  );
}

export default function BusinessProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, initializing, isSupabaseConfigured } = useAuth();
  const { business, update } = useWorkspace();
  const { mode } = useRole();
  const isOwner = mode === 'owner';

  // Row fields (seeded once per business; saved as a diff).
  const [seeded, setSeeded] = useState<Business | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  useEffect(() => {
    if (!business || business.id === seeded?.id) return;
    setSeeded(business);
    setName(business.name ?? '');
    setDescription(business.description ?? '');
    setPhone(business.phone ?? '');
    setEmail(business.email ?? '');
    setWebsite(business.website ?? '');
    setStreet(business.address?.street ?? '');
    setCity(business.address?.city ?? '');
    setState(business.address?.state ?? '');
    setZip(business.address?.zip ?? '');
  }, [business, seeded]);

  // Profile fields (share_settings.profile).
  const loader = useCallback(
    () => (business?.id && isSharingAvailable ? fetchShareSettings(business.id).catch(() => ({}) as ShareSettings) : Promise.resolve({} as ShareSettings)),
    [business?.id],
  );
  const { data: settings } = useData(loader);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [alwaysMention, setAlwaysMention] = useState('');
  const [neverSay, setNeverSay] = useState<string[]>([]);
  useEffect(() => {
    if (settings && !profile) {
      const p = ((settings as ShareSettings & { profile?: Partial<Profile> }).profile ?? {}) as Partial<Profile>;
      setProfile({ ...EMPTY_PROFILE, ...p });
      setAlwaysMention(settings.caption?.always_mention ?? '');
      setNeverSay(settings.caption?.never_say ?? []);
    }
  }, [settings, profile]);
  const setP = <K extends keyof Profile>(key: K, value: Profile[K]) => setProfile((p) => ({ ...(p ?? EMPTY_PROFILE), [key]: value }));

  const [saving, setSaving] = useState(false);

  if (!initializing && !user) return <Redirect href="/login" />;

  const buildPatch = (base: Business): BusinessPatch => {
    const patch: BusinessPatch = {};
    if (name.trim() !== (base.name ?? '')) patch.name = name.trim();
    if (description.trim() !== (base.description ?? '')) patch.description = description.trim();
    if (phone.trim() !== (base.phone ?? '')) patch.phone = phone.trim();
    if (email.trim() !== (base.email ?? '')) patch.email = email.trim();
    if (website.trim() !== (base.website ?? '')) patch.website = website.trim();
    const addr: BusinessAddress = { street: street.trim(), city: city.trim(), state: state.trim(), zip: zip.trim(), country: base.address?.country };
    const cur = base.address ?? {};
    if ((cur.street ?? '') !== addr.street || (cur.city ?? '') !== addr.city || (cur.state ?? '') !== addr.state || (cur.zip ?? '') !== addr.zip) patch.address = addr;
    return patch;
  };

  const handleSave = async () => {
    if (!seeded || saving) return;
    if (!name.trim()) {
      notify('Name required', 'Give the business a name.');
      return;
    }
    setSaving(true);
    try {
      const patch = buildPatch(seeded);
      if (Object.keys(patch).length) {
        const result = await update(patch);
        if (!result.synced && result.reason === 'failed') {
          notify('Not saved', result.message ?? 'The server rejected the change.');
          return;
        }
        if (!result.synced && !isSupabaseConfigured) notify('Saved on this phone', 'Sign in to a workspace to save for the whole team.');
      }
      if (profile && business?.id && isSharingAvailable) {
        if (!isOwner) notify('Owner only', 'Only the owner can change the business profile. Contact details were saved.');
        else await updateShareSettings(business.id, { profile, caption: { ...(settings?.caption ?? {}), always_mention: alwaysMention.trim(), never_say: neverSay } } as Partial<ShareSettings>);
      }
      notify('Saved', 'Business details updated.');
      router.back();
    } catch (err) {
      notify('Not saved', apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const p = profile ?? EMPTY_PROFILE;

  return (
    <Screen>
      <DetailHeader title="Business" />
      <Card style={styles.logoRow}>
        <Avatar name={name || business?.name || 'B'} size={64} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Logo</Text>
            {business?.plan ? <Badge label={business.plan} tone="primary" /> : null}
          </View>
          <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>Stamped on photos, on reports and the website page. Set under Camera & stamps.</Text>
          <Button label="Change logo" variant="secondary" size="small" icon="image-outline" onPress={() => router.push('/settings/media')} />
        </View>
      </Card>

      <Section title="Identity">
        <Card style={{ gap: Spacing.md }}>
          <Field label="Business name" value={name} onChangeText={setName} placeholder="Westside Home Services" />
          <Field label="Tagline" value={p.tagline} onChangeText={(v) => setP('tagline', v)} placeholder="One line under your name" />
          <Field label="Primary category" value={p.category} onChangeText={(v) => setP('category', v)} placeholder="e.g. Roofing contractor" hint="Matches your Google category. Captions and keywords lean on it." />
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <Field label="Founded" value={p.founded} onChangeText={(v) => setP('founded', v.replace(/\D/g, '').slice(0, 4))} placeholder="2016" keyboardType="number-pad" style={{ flex: 1 }} />
            <Field label="Owner" value={p.owner_name} onChangeText={(v) => setP('owner_name', v)} placeholder="Name" style={{ flex: 2 }} />
          </View>
        </Card>
      </Section>

      <Section title="Contact">
        <Card style={{ gap: Spacing.md }}>
          <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="(555) 555-0123" keyboardType="phone-pad" hint="On posts' call button and review texts." />
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="hello@yourbusiness.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Street address" value={street} onChangeText={setStreet} placeholder="214 Maple Ave" />
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <Field label="City" value={city} onChangeText={setCity} placeholder="Westlake" style={{ flex: 2 }} />
            <Field label="State" value={state} onChangeText={setState} placeholder="OH" autoCapitalize="characters" style={{ flex: 1 }} />
            <Field label="ZIP" value={zip} onChangeText={setZip} placeholder="44145" keyboardType="number-pad" style={{ flex: 1 }} />
          </View>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>Hide street address on posts and pages</Text>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>Service-area businesses show city only</Text>
            </View>
            <Switch value={p.hide_street} onValueChange={(v) => setP('hide_street', v)} trackColor={{ true: colors.primary, false: colors.cardPressed }} thumbColor="#FFFFFF" />
          </View>
        </Card>
      </Section>

      <Section title="Online">
        <Card style={{ gap: Spacing.md }}>
          <Field label="Website" value={website} onChangeText={setWebsite} placeholder="https://yourbusiness.com" keyboardType="url" autoCapitalize="none" />
          <View style={{ gap: 5 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.textSecondary }}>Google Business Profile</Text>
            <Pressable onPress={() => router.push('/settings/integrations')} style={({ pressed }) => [styles.linkRow, { borderColor: colors.border, backgroundColor: colors.card }, pressed && { backgroundColor: colors.cardPressed }]}>
              <IconTile icon="storefront-outline" size={32} />
              <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>Manage connection and profile</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primaryStrong }}>Open ›</Text>
            </Pressable>
          </View>
          <Field label="Facebook Page" value={p.facebook_url} onChangeText={(v) => setP('facebook_url', v)} placeholder="facebook.com/yourpage" autoCapitalize="none" />
          <Field label="Instagram" value={p.instagram_handle} onChangeText={(v) => setP('instagram_handle', v)} placeholder="@username" autoCapitalize="none" />
          <Field label="Review link" value={p.review_link} onChangeText={(v) => setP('review_link', v)} placeholder="g.page/r/…/review" autoCapitalize="none" hint="Where review requests and QR codes send customers." />
        </Card>
      </Section>

      <Section title="Service area">
        <Card style={{ gap: Spacing.md }}>
          <TagEditor tags={p.service_area} onChange={(v) => setP('service_area', v)} mode="phrase" placeholder="Add a city" />
          <Text style={{ fontSize: 12, color: colors.textMuted }}>Mentioned in captions when a project is in that city.</Text>
          <View style={{ gap: 5 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.textSecondary }}>Radius from home base</Text>
            <Segmented
              options={[
                { value: '15', label: '15 mi' },
                { value: '25', label: '25 mi' },
                { value: '40', label: '40 mi' },
                { value: '0', label: 'Statewide' },
              ]}
              value={String(p.radius_miles)}
              onChange={(v) => setP('radius_miles', Number(v))}
            />
          </View>
        </Card>
      </Section>

      <Section title="Services">
        <Card style={{ gap: Spacing.md }}>
          <TagEditor tags={p.services} onChange={(v) => setP('services', v)} mode="phrase" placeholder="Add a service" />
          <Text style={{ fontSize: 12, color: colors.textMuted }}>Prices and descriptions live under GMB › Services.</Text>
        </Card>
      </Section>

      <Section title="Credentials">
        <Card style={{ gap: Spacing.md }}>
          <Field label="License number" value={p.license} onChangeText={(v) => setP('license', v)} placeholder="OH-RC-00000" autoCapitalize="characters" />
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.textSecondary }}>Insured</Text>
              <Segmented options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} value={p.insured ? 'yes' : 'no'} onChange={(v) => setP('insured', v === 'yes')} />
            </View>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.textSecondary }}>Bonded</Text>
              <Segmented options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} value={p.bonded ? 'yes' : 'no'} onChange={(v) => setP('bonded', v === 'yes')} />
            </View>
          </View>
          <View style={{ gap: 5 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.textSecondary }}>Certifications</Text>
            <TagEditor tags={p.certifications} onChange={(v) => setP('certifications', v)} mode="phrase" placeholder="e.g. GAF Certified" />
            <Text style={{ fontSize: 12, color: colors.textMuted }}>Captions can mention these. Nothing is claimed that isn't listed here.</Text>
          </View>
        </Card>
      </Section>

      <Section title="About">
        <Card style={{ gap: Spacing.md }}>
          <Field label="About the business" value={p.about} onChangeText={(v) => setP('about', v)} placeholder="2–4 sentences. Used on website project pages and as background for captions." multiline />
          <Field label="Short description" value={description} onChangeText={setDescription} placeholder="What you do and the areas you cover" multiline hint="Shown in the web dashboard." />
          <Field label="Always mention in posts" value={alwaysMention} onChangeText={setAlwaysMention} placeholder="e.g. Serving Medina County since 2016" />
          <View style={{ gap: 5 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.textSecondary }}>Never say</Text>
            <TagEditor tags={neverSay} onChange={setNeverSay} mode="phrase" placeholder="e.g. cheapest" />
          </View>
        </Card>
      </Section>

      <Button label="Save" icon="checkmark" loading={saving} disabled={!seeded} onPress={() => void handleSave()} />
      <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>
        {isOwner ? 'Applies to every phone in this business.' : 'Contact details save for everyone; the rest is owner-only.'}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 44, fontSize: 15 },
  multiline: { height: 96, paddingTop: 10, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.md, padding: Spacing.md },
});
