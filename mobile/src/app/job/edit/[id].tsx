import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { SERVICE_ICONS } from '@/components/job-card';
import { TagEditor } from '@/components/tag-editor';
import { Button, Card } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { fetchJob, updateJob } from '@/lib/data';
import { notify } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';
import type { ServiceType } from '@/lib/types';

const SERVICES: { value: ServiceType; label: string }[] = [
  { value: 'gutters', label: 'Gutters' },
  { value: 'drainage', label: 'Drainage' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'painting', label: 'Painting' },
  { value: 'snow_removal', label: 'Snow removal' },
  { value: 'general', label: 'General' },
];

export default function EditJobScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, initializing } = useAuth();
  const { data: job } = useData(() => fetchJob(id ?? ''));

  const [title, setTitle] = useState('');
  const [service, setService] = useState<ServiceType>('general');
  const [clientName, setClientName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (job && !loaded) {
      setTitle(job.title);
      setService(job.service_type);
      setClientName(job.client_name === 'Unknown client' ? '' : job.client_name);
      setAddress(job.address);
      setCity(job.city);
      setTags(job.tags ?? []);
      setLoaded(true);
    }
  }, [job, loaded]);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const fieldStyle = [
    styles.input,
    { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
  ];

  const handleSave = async () => {
    if (!job || saving || !title.trim()) return;
    setSaving(true);
    const result = await updateJob(job, {
      title: title.trim(),
      service_type: service,
      client_name: clientName.trim() || 'Unknown client',
      address: address.trim(),
      city: city.trim(),
      tags,
    });
    setSaving(false);
    if (result.error) {
      notify('Could not save', result.error);
      return;
    }
    notify('Job updated', 'Your changes have been saved.');
    router.back();
  };

  return (
    <Screen>
      <DetailHeader title="Edit job" />

      {job ? (
        <>
          <Section title="Job">
            <Card style={{ gap: Spacing.md }}>
              <View style={{ gap: 5 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Job title *</Text>
                <TextInput value={title} onChangeText={setTitle} style={fieldStyle} />
              </View>
              <View style={{ gap: 5 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Service type</Text>
                <View style={styles.chips}>
                  {SERVICES.map((option) => {
                    const selected = option.value === service;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setService(option.value)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: selected ? colors.primarySoft : colors.card,
                            borderColor: selected ? colors.primary : colors.border,
                          },
                        ]}>
                        <Ionicons
                          name={SERVICE_ICONS[option.value]}
                          size={13}
                          color={selected ? colors.primaryStrong : colors.textSecondary}
                        />
                        <Text
                          style={{
                            fontSize: 12.5,
                            fontWeight: '600',
                            color: selected ? colors.primaryStrong : colors.textSecondary,
                          }}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </Card>
          </Section>

          <Section title="Client & location">
            <Card style={{ gap: Spacing.md }}>
              <View style={{ gap: 5 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Client name</Text>
                <TextInput value={clientName} onChangeText={setClientName} style={fieldStyle} />
              </View>
              <View style={{ gap: 5 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Street address</Text>
                <TextInput value={address} onChangeText={setAddress} style={fieldStyle} />
              </View>
              <View style={{ gap: 5 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>City</Text>
                <TextInput value={city} onChangeText={setCity} style={fieldStyle} />
              </View>
            </Card>
          </Section>

          <Section title="Tags">
            <Card>
              <TagEditor tags={tags} onChange={setTags} placeholder="e.g. warranty, insurance" />
            </Card>
          </Section>

          <Button label="Save changes" loading={saving} disabled={!title.trim()} onPress={handleSave} />
        </>
      ) : (
        <Card>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Job not found.</Text>
        </Card>
      )}
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
  },
});
