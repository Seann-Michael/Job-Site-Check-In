import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { JobCard } from '@/components/job-card';
import { Avatar, Button, Card, EmptyState } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { fetchClient, fetchClientJobs } from '@/lib/clients';
import { notify } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';

export default function ClientDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, initializing } = useAuth();

  const { data: client } = useData(() => fetchClient(id ?? ''));
  const { data: jobs } = useData(async () => {
    const found = await fetchClient(id ?? '');
    return found ? fetchClientJobs(found.name) : [];
  });

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const call = () => {
    if (!client?.phone) {
      notify('No phone number', 'Add a phone number for this client in the web dashboard.');
      return;
    }
    void Linking.openURL(`tel:${client.phone.replace(/[^\d+]/g, '')}`);
  };

  const email = () => {
    if (!client?.email) {
      notify('No email', 'Add an email for this client in the web dashboard.');
      return;
    }
    void Linking.openURL(`mailto:${client.email}`);
  };

  return (
    <Screen>
      <DetailHeader title="Client" />

      {client ? (
        <>
          <Card style={styles.headerCard}>
            <Avatar name={client.name} size={52} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
                {client.name}
              </Text>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                {client.jobs_count} {client.jobs_count === 1 ? 'job' : 'jobs'} on record
              </Text>
            </View>
          </Card>

          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <Button
              label="Call"
              icon="call-outline"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={call}
            />
            <Button
              label="Email"
              icon="mail-outline"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={email}
            />
            <Button
              label="New job"
              icon="add"
              style={{ flex: 1 }}
              onPress={() => router.push('/job/new')}
            />
          </View>

          {client.phone || client.email ? (
            <Card style={{ gap: Spacing.sm }}>
              {client.phone ? (
                <View style={styles.contactRow}>
                  <Ionicons name="call-outline" size={15} color={colors.textMuted} />
                  <Text style={{ fontSize: 13.5, color: colors.textSecondary }}>
                    {client.phone}
                  </Text>
                </View>
              ) : null}
              {client.email ? (
                <View style={styles.contactRow}>
                  <Ionicons name="mail-outline" size={15} color={colors.textMuted} />
                  <Text style={{ fontSize: 13.5, color: colors.textSecondary }}>
                    {client.email}
                  </Text>
                </View>
              ) : null}
            </Card>
          ) : null}

          <Section title="Jobs">
            {(jobs ?? []).length === 0 ? (
              <EmptyState
                icon="briefcase-outline"
                title="No jobs yet"
                message="Create a job for this client to start documenting work."
              />
            ) : (
              (jobs ?? []).map((job) => <JobCard key={job.id} job={job} />)
            )}
          </Section>
        </>
      ) : (
        <Card>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Client not found.</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
});
