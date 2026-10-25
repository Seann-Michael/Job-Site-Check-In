import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Avatar, Badge, Button, Card, IconTile } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useRole } from '@/hooks/use-role';
import { useWorkspace } from '@/hooks/use-workspace';
import { webUrl } from '@/lib/config';
import { notify } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';

/**
 * Profile — who you are in the app: photo, name, mobile, email, role, sign-in
 * and the account actions Apple requires (download my data, delete account).
 *
 * The photo and Face ID choice are kept on this phone; name and password go
 * through the auth provider as before. Email changes and account deletion
 * are confirmed by email through the web app, so those hand off with a
 * clear message rather than pretending to finish here.
 */
const PHOTO_KEY = 'profile.photo';
const FACEID_KEY = 'profile.faceid';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, initializing, isSupabaseConfigured, updateName, changePassword, signOut } = useAuth();
  const { businesses } = useWorkspace();
  const { mode } = useRole();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [faceId, setFaceId] = useState(false);
  const [faceIdAvailable, setFaceIdAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName);
    setLastName(user.lastName);
  }, [user]);

  useEffect(() => {
    void AsyncStorage.getItem(PHOTO_KEY).then((v) => setPhoto(v));
    void AsyncStorage.getItem(FACEID_KEY).then((v) => setFaceId(v === '1'));
    void AsyncStorage.getItem('profile.mobile').then((v) => setMobile(v ?? ''));
    void LocalAuthentication.hasHardwareAsync().then(setFaceIdAvailable).catch(() => setFaceIdAvailable(false));
  }, []);

  if (!initializing && !user) return <Redirect href="/login" />;

  const pickPhoto = async (source: 'camera' | 'library') => {
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      notify('Permission needed', 'Allow access in Settings to set a photo.');
      return;
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.6, mediaTypes: ['images'] });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setPhoto(result.assets[0].uri);
    await AsyncStorage.setItem(PHOTO_KEY, result.assets[0].uri);
    notify('Photo set', 'Shown on the crew list and next to your photos.');
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const result = await updateName(firstName, lastName);
      if (result.error) {
        notify('Not saved', result.error);
        return;
      }
      await AsyncStorage.setItem('profile.mobile', mobile.trim());
      notify('Saved', isSupabaseConfigured ? 'Profile updated.' : 'Saved on this phone.');
    } finally {
      setSaving(false);
    }
  };

  const handlePassword = async () => {
    if (changing) return;
    if (password.length < 8) {
      notify('Too short', 'Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      notify("Doesn't match", 'The two passwords differ.');
      return;
    }
    setChanging(true);
    try {
      const result = await changePassword(password);
      if (result.error) {
        notify('Not changed', result.error);
        return;
      }
      setCurrent('');
      setPassword('');
      setConfirm('');
      setShowPassword(false);
      notify('Password changed', 'Use it next time you sign in.');
    } finally {
      setChanging(false);
    }
  };

  const toggleFaceId = async (value: boolean) => {
    if (value) {
      const ok = await LocalAuthentication.authenticateAsync({ promptMessage: 'Turn on Face ID for Job Site Check In' }).catch(() => ({ success: false }));
      if (!ok.success) return;
    }
    setFaceId(value);
    await AsyncStorage.setItem(FACEID_KEY, value ? '1' : '0');
  };

  const openWeb = (path: string, what: string) => {
    const url = webUrl(path);
    if (!url) {
      notify(what, 'Open the web dashboard to do this.');
      return;
    }
    void Linking.openURL(url);
  };

  const confirmDelete = () => {
    const go = () => openWeb('/admin/settings?delete=account', 'Delete account');
    if (Platform.OS === 'web') return go();
    Alert.alert('Delete your account?', 'Removes your sign-in. Business data and photos stay with the business owner. You confirm by email from the web dashboard.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', style: 'destructive', onPress: go },
    ]);
  };

  const roleLabel = mode === 'owner' ? 'Owner' : mode === 'staff' ? 'Staff' : 'Viewer';
  const field = [styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }];

  return (
    <Screen>
      <DetailHeader title="Profile" />

      <Card style={styles.photoRow}>
        <View>
          {photo ? (
            <View style={[styles.photo, { borderColor: colors.border }]}><Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" /></View>
          ) : (
            <Avatar name={user?.name ?? 'User'} size={72} />
          )}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Photo</Text>
          <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>Shown next to your photos and on the crew list.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            <Button label="Take" variant="secondary" size="small" icon="camera-outline" onPress={() => void pickPhoto('camera')} />
            <Button label="Choose" variant="secondary" size="small" icon="images-outline" onPress={() => void pickPhoto('library')} />
            {photo ? <Button label="Remove" variant="ghost" size="small" onPress={() => { setPhoto(null); void AsyncStorage.removeItem(PHOTO_KEY); }} /> : null}
          </View>
        </View>
      </Card>

      <Section title="Your details">
        <Card style={{ gap: Spacing.md }}>
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={styles.label(colors)}>First name</Text>
              <TextInput value={firstName} onChangeText={setFirstName} placeholder="Alex" placeholderTextColor={colors.textMuted} style={field} />
            </View>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={styles.label(colors)}>Last name</Text>
              <TextInput value={lastName} onChangeText={setLastName} placeholder="Morgan" placeholderTextColor={colors.textMuted} style={field} />
            </View>
          </View>
          <View style={{ gap: 5 }}>
            <Text style={styles.label(colors)}>Mobile</Text>
            <TextInput value={mobile} onChangeText={setMobile} placeholder="(555) 555-0123" keyboardType="phone-pad" placeholderTextColor={colors.textMuted} style={field} />
            <Text style={{ fontSize: 12, color: colors.textMuted }}>For crew texts and sign-in codes.</Text>
          </View>
          <View style={{ gap: 5 }}>
            <Text style={styles.label(colors)}>Email</Text>
            <Pressable onPress={() => openWeb('/admin/settings', 'Change email')} style={[styles.input, styles.readonly, { backgroundColor: colors.cardPressed, borderColor: colors.border }]}>
              <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>{user?.email}</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primaryStrong }}>Change ›</Text>
            </Pressable>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>Changing it sends a confirmation to both addresses.</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <Badge label={roleLabel} tone="primary" />
            <Text style={{ flex: 1, fontSize: 12.5, color: colors.textSecondary }} numberOfLines={1}>
              {businesses.map((b) => b.name).join(' · ') || 'No business yet'}
            </Text>
          </View>
          <Button label="Save changes" loading={saving} onPress={() => void handleSave()} />
        </Card>
      </Section>

      <Section title="Sign-in">
        <Card style={{ padding: 0 }}>
          <Pressable onPress={() => setShowPassword((v) => !v)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.cardPressed }]}>
            <IconTile icon="key-outline" size={34} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>Change password</Text>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{isSupabaseConfigured ? 'Signs other devices out' : 'Needs a signed-in workspace'}</Text>
            </View>
            <Text style={{ fontSize: 13, color: colors.textMuted }}>{showPassword ? 'Hide' : 'Open ›'}</Text>
          </Pressable>
          {showPassword ? (
            <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.sm }}>
              <TextInput value={current} onChangeText={setCurrent} placeholder="Current password" secureTextEntry placeholderTextColor={colors.textMuted} style={field} />
              <TextInput value={password} onChangeText={setPassword} placeholder="New password (8+ characters)" secureTextEntry placeholderTextColor={colors.textMuted} style={field} />
              <TextInput value={confirm} onChangeText={setConfirm} placeholder="Confirm new password" secureTextEntry placeholderTextColor={colors.textMuted} style={field} />
              <Button label="Update password" loading={changing} disabled={!password || !confirm} onPress={() => void handlePassword()} />
              <Button label="Email me a reset link instead" variant="ghost" size="small" onPress={() => openWeb('/forgot-password', 'Reset link')} />
            </View>
          ) : null}
          {faceIdAvailable ? (
            <View style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              <IconTile icon="scan-outline" size={34} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>Face ID to open the app</Text>
              </View>
              <Switch value={faceId} onValueChange={(v) => void toggleFaceId(v)} trackColor={{ true: colors.primary, false: colors.cardPressed }} thumbColor="#FFFFFF" />
            </View>
          ) : null}
          <Pressable onPress={() => openWeb('/admin/settings', 'Linked sign-ins')} style={({ pressed }) => [styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, pressed && { backgroundColor: colors.cardPressed }]}>
            <IconTile icon="logo-google" size={34} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>Linked sign-ins</Text>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>Google, Apple</Text>
            </View>
            <Text style={{ fontSize: 13, color: colors.textMuted }}>Manage ›</Text>
          </Pressable>
        </Card>
      </Section>

      <Section title="Account">
        <Card style={{ padding: 0 }}>
          <Pressable onPress={() => openWeb('/admin/settings?export=1', 'Download my data')} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.cardPressed }]}>
            <IconTile icon="download-outline" size={34} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>Download my data</Text>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>Photos, projects and notes as a ZIP, emailed within 24h</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => void signOut().then(() => router.replace('/login'))} style={({ pressed }) => [styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, pressed && { backgroundColor: colors.cardPressed }]}>
            <IconTile icon="log-out-outline" size={34} />
            <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '600', color: colors.text }}>Sign out of this phone</Text>
          </Pressable>
          <Pressable onPress={confirmDelete} style={({ pressed }) => [styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, pressed && { backgroundColor: colors.cardPressed }]}>
            <IconTile icon="trash-outline" size={34} tone="danger" />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.danger }}>Delete account</Text>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>Business data and photos stay with the owner</Text>
            </View>
          </Pressable>
        </Card>
      </Section>
    </Screen>
  );
}

const styles = {
  ...StyleSheet.create({
    photoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    photo: { width: 72, height: 72, borderRadius: 36, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
    input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 44, fontSize: 15 },
    readonly: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  }),
  label: (colors: { textSecondary: string }) => ({ fontSize: 12.5, fontWeight: '600' as const, color: colors.textSecondary }),
};
