import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { ContactRow } from '@/components/contact-row';
import { JobCard } from '@/components/job-card';
import { TagEditor } from '@/components/tag-editor';
import { Avatar, Button, Card, EmptyState } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { clientTags } from '@/lib/client-tags';
import { fetchClient, fetchClientJobs } from '@/lib/clients';
import { clientsStore } from '@/lib/clients-store';
import { notify } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';

export default function ClientDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, initializing } = useAuth();

  const { data: client, refresh: refreshClient } = useData(() => fetchClient(id ?? ''));
  React.useEffect(() => clientsStore.subscribe(refreshClient), [refreshClient]);
  const { data: jobs } = useData(async () => {
    const found = await fetchClient(id ?? '');
    return found ? fetchClientJobs(found.name) : [];
  });
  const { data: tags, refresh: refreshTags } = useData(() => clientTags.get(id ?? ''));
  React.useEffect(() => clientTags.subscribe(refreshTags), [refreshTags]);

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
      <DetailHeader
        title="Client"
        actions={[
          {
            icon: 'create-outline',
            onPress: () => router.push({ pathname: '/client/edit', params: { id: id ?? '' } }),
          },
        ]}
      />

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

          <Section title="Tags">
            <Card>
              <TagEditor
                tags={tags ?? []}
                onChange={(next) => void clientTags.set(id ?? '', next)}
                placeholder="e.g. vip, repeat, hoa"
              />
            </Card>
          </Section>

          {client.phone || client.email ? (
            <Card style={{ gap: Spacing.md }}>
              {client.phone ? (
                <ContactRow
                  icon="call-outline"
                  text={client.phone}
                  copyLabel="Phone number"
                  actions={[
                    { icon: 'call', onPress: call },
                    {
                      icon: 'chatbubble-outline',
                      onPress: () =>
                        void Linking.openURL(`sms:${client.phone.replace(/[^+\d]/g, '')}`),
                    },
                  ]}
                />
              ) : null}
              {client.email ? (
                <ContactRow
                  icon="mail-outline"
                  text={client.email}
                  copyLabel="Email"
                  actions={[{ icon: 'mail', onPress: email }]}
                />
              ) : null}
            </Card>
          ) : null}

          <Button label="New job" icon="add" onPress={() => router.push('/job/new')} />

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
