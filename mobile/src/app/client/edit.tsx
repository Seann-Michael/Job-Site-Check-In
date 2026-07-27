import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { derivedClientId, fetchClient } from '@/lib/clients';
import { clientsStore } from '@/lib/clients-store';
import { renameClientAcrossJobs } from '@/lib/data';
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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [seeded, setSeeded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (client && !seeded) {
      setSeeded(true);
      // Older records only have the combined `name`. Split it for display so
      // the fields aren't blank, but see handleSave: the stored `name` is never
      // rewritten for an existing client, because jobs join to it by string.
      const [first = '', ...rest] = (client.first_name || client.name || '').trim().split(/\s+/);
      setFirstName(client.first_name || first);
      setLastName(client.last_name || rest.join(' '));
      setBusinessName(client.business_name ?? '');
      setPhone(client.phone);
      setEmail(client.email);
    }
  }, [client, seeded]);

  // A client needs something to be called: a person, a company, or both.
  const personName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
  const canSave = Boolean(personName || businessName.trim());

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const fieldStyle = [
    styles.input,
    { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
  ];

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      if (isNew) {
        // A new client has no jobs yet, so composing the join key here is safe.
        const record = await clientsStore.create({
          name: personName || businessName.trim(),
          first_name: firstName,
          last_name: lastName,
          business_name: businessName,
          phone,
          email,
        });
        notify('Client added', record.name);
        router.replace({ pathname: '/client/[id]', params: { id: record.id } });
      } else {
        // Jobs reference their client by name string, so a rename has to move
        // the jobs with it or they all detach. Cascade FIRST: if it fails we
        // leave the client's name alone rather than orphaning their work.
        const nextName = personName || businessName.trim();
        const previousName = client?.name ?? '';
        const renamed = nextName.toLowerCase() !== previousName.toLowerCase();

        let moved = 0;
        if (renamed && previousName) {
          const result = await renameClientAcrossJobs(previousName, nextName);
          if (result.error) {
            notify(
              "Couldn't rename",
              `${result.error}${result.updated ? ` (${result.updated} job(s) already moved)` : ''}`,
            );
            return;
          }
          moved = result.updated;
        }

        await clientsStore.update(id!, {
          ...(renamed ? { name: nextName } : {}),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          business_name: businessName.trim(),
          phone: phone.trim(),
          email: email.trim(),
        });

        notify(
          'Client updated',
          moved ? `Renamed, and ${moved} job${moved === 1 ? '' : 's'} moved with them.` : 'Your changes have been saved.',
        );

        // A demo-mode client's id is derived from their name, so after a rename
        // the screen we came from points at an id that no longer resolves.
        if (renamed && id!.startsWith('client-')) {
          router.replace({ pathname: '/client/[id]', params: { id: derivedClientId(nextName) } });
        } else {
          router.back();
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    const doDelete = async () => {
      await clientsStore.remove(id!);
      notify('Client deleted', `${personName || businessName.trim() || 'Client'} was removed.`);
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
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>First name</Text>
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Sarah"
                placeholderTextColor={colors.textMuted}
                style={fieldStyle}
              />
            </View>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Last name</Text>
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                placeholder="Mitchell"
                placeholderTextColor={colors.textMuted}
                style={fieldStyle}
              />
            </View>
          </View>
          <View style={{ gap: 5 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Business name (optional)
            </Text>
            <TextInput
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="e.g. Mitchell Property Group"
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
        disabled={!canSave}
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
