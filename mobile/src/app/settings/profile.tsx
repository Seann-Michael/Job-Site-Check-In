import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar, Button, Card } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { notify } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';

export default function ProfileSettingsScreen() {
  const { colors } = useTheme();
  const { user, initializing, isSupabaseConfigured, updateName, changePassword } = useAuth();

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const fieldStyle = [
    styles.input,
    { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
  ];

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    const result = await updateName(name);
    setSaving(false);
    if (result.error) {
      notify('Could not save', result.error);
      return;
    }
    notify('Profile saved', 'Your name has been updated.');
  };

  const handlePassword = async () => {
    if (changing) return;
    if (password !== confirm) {
      notify('Passwords do not match', 'Enter the same new password in both fields.');
      return;
    }
    setChanging(true);
    const result = await changePassword(password);
    setChanging(false);
    if (result.error) {
      notify('Could not change password', result.error);
      return;
    }
    setPassword('');
    setConfirm('');
    notify('Password changed', 'Use your new password next time you sign in.');
  };

  return (
    <Screen>
      <DetailHeader title="Profile" />

      <Card style={styles.headerCard}>
        <Avatar name={name || user?.name || 'User'} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
            {name || user?.name}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary }}>{user?.email}</Text>
        </View>
      </Card>

      <Section title="Your details">
        <Card style={{ gap: Spacing.md }}>
          <View style={{ gap: 5 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Full name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              style={fieldStyle}
            />
          </View>
          <View style={{ gap: 5 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
            <TextInput
              value={user?.email ?? ''}
              editable={false}
              style={[fieldStyle, { opacity: 0.6 }]}
            />
          </View>
          <Button label="Save changes" loading={saving} onPress={handleSave} />
        </Card>
      </Section>

      <Section title="Password">
        {isSupabaseConfigured ? (
          <Card style={{ gap: Spacing.md }}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="New password (8+ characters)"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={fieldStyle}
            />
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={fieldStyle}
            />
            <Button
              label="Change password"
              variant="secondary"
              loading={changing}
              disabled={!password || !confirm}
              onPress={handlePassword}
            />
          </Card>
        ) : (
          <Card>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              Password changes are available once your Supabase account is connected — in demo mode
              there is no real account.
            </Text>
          </Card>
        )}
      </Section>
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
    height: 46,
    fontSize: 15,
  },
});
