import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { fetchClient } from '@/lib/clients';
import { clientsStore } from '@/lib/clients-store';
import { notify } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';

/** Add a client (no id param) or edit/delete an existing one (?id=...). */
export default function EditClientScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user, initializing } = useAuth();
  const isNew = !id;

  const { data: client } = useData(() => (id ? fetchClient(id) : Promise.resolve(undefined)));
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [seeded, setSeeded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (client && !seeded) {
      setSeeded(true);
      setName(client.name);
      setPhone(client.phone);
      setEmail(client.email);
    }
  }, [client, seeded]);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const fieldStyle = [
    styles.input,
    { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
  ];

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      if (isNew) {
        const record = await clientsStore.create({ name, phone, email });
        notify('Client added', record.name);
        router.replace({ pathname: '/client/[id]', params: { id: record.id } });
      } else {
        await clientsStore.update(id!, {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
        });
        notify('Client updated', 'Your changes have been saved.');
        router.back();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    const doDelete = async () => {
      await clientsStore.remove(id!);
      notify('Client deleted', `${name || 'Client'} was removed.`);
      router.replace('/(tabs)/clients');
    };
    if (Platform.OS === 'web') {
      void doDelete();
      return;
    }
    Alert.alert(
      'Delete this client?',
      'Their jobs stay — only the client record is removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void doDelete() },
      ],
    );
  };

  return (
    <Screen>
      <DetailHeader title={isNew ? 'Add client' : 'Edit client'} />

      <Section title="Client details">
        <Card style={{ gap: Spacing.md }}>
          <View style={{ gap: 5 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Name *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Sarah Mitchell"
              placeholderTextColor={colors.textMuted}
              style={fieldStyle}
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
              placeholder="customer@email.com"
              placeholderTextColor={colors.textMuted}
              style={fieldStyle}
            />
          </View>
        </Card>
      </Section>

      <Button
        label={isNew ? 'Add client' : 'Save changes'}
        loading={saving}
        disabled={!name.trim()}
        onPress={() => void handleSave()}
      />
      {!isNew ? (
        <Button
          label="Delete client"
          icon="trash-outline"
          variant="secondary"
          onPress={handleDelete}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
});
