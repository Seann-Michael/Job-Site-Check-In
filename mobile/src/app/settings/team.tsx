import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar, Badge, Button, Card } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { notify } from '@/lib/format';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const INVITES_KEY = 'lsr-pending-invites-v1';

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

const DEMO_MEMBERS: Member[] = [
  { id: 'm-1', name: 'Alex Morgan', email: 'demo@localseoranker.com', role: 'Owner' },
  { id: 'm-2', name: 'Jordan Reyes', email: 'jordan@westsidehs.com', role: 'Field tech' },
  { id: 'm-3', name: 'Casey Nguyen', email: 'casey@westsidehs.com', role: 'Office' },
];

async function fetchMembers(): Promise<Member[]> {
  if (!isSupabaseConfigured) return DEMO_MEMBERS;
  const { data, error } = await supabase.from('users').select('id, name, email, role').limit(25);
  if (error || !data?.length) return DEMO_MEMBERS;
  return (data as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    name: typeof row.name === 'string' && row.name ? row.name : String(row.email ?? 'Member'),
    email: String(row.email ?? ''),
    role: typeof row.role === 'string' ? row.role : 'member',
  }));
}

export default function TeamSettingsScreen() {
  const { colors } = useTheme();
  const { user, initializing } = useAuth();

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<string[]>([]);
  const [email, setEmail] = useState('');

  useEffect(() => {
    void fetchMembers().then(setMembers);
    AsyncStorage.getItem(INVITES_KEY)
      .then((raw) => {
        if (raw) setInvites(JSON.parse(raw) as string[]);
      })
      .catch(() => undefined);
  }, []);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const handleInvite = () => {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      notify('Invalid email', 'Enter a valid email address to invite.');
      return;
    }
    if (invites.includes(trimmed) || members.some((m) => m.email.toLowerCase() === trimmed)) {
      notify('Already added', 'That email is already on the team or invited.');
      return;
    }
    const next = [...invites, trimmed];
    setInvites(next);
    AsyncStorage.setItem(INVITES_KEY, JSON.stringify(next)).catch(() => undefined);
    setEmail('');
    notify(
      'Invite noted',
      'Invite emails send from the web dashboard for now — this keeps the list ready.',
    );
  };

  const removeInvite = (target: string) => {
    const next = invites.filter((invite) => invite !== target);
    setInvites(next);
    AsyncStorage.setItem(INVITES_KEY, JSON.stringify(next)).catch(() => undefined);
  };

  return (
    <Screen>
      <DetailHeader title="Team" />

      <Section title="Invite">
        <Card style={{ gap: Spacing.md }}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="teammate@email.com"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={[
              styles.input,
              { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
            ]}
            onSubmitEditing={handleInvite}
          />
          <Button label="Add invite" icon="person-add-outline" onPress={handleInvite} />
        </Card>
      </Section>

      {invites.length > 0 ? (
        <Section title={`Pending invites (${invites.length})`}>
          <Card style={{ padding: 0 }}>
            {invites.map((invite, index) => (
              <View
                key={invite}
                style={[
                  styles.row,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                ]}>
                <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
                <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>{invite}</Text>
                <Pressable hitSlop={8} onPress={() => removeInvite(invite)}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      <Section title={`Members (${members.length})`}>
        <Card style={{ padding: 0 }}>
          {members.map((member, index) => (
            <View
              key={member.id}
              style={[
                styles.row,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                },
              ]}>
              <Avatar name={member.name} size={36} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>
                  {member.name}
                </Text>
                <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{member.email}</Text>
              </View>
              <Badge label={member.role} tone={member.role === 'Owner' ? 'primary' : 'neutral'} />
            </View>
          ))}
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 46,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
});
