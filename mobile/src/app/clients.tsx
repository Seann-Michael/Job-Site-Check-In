import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SearchBar } from '@/components/search-bar';
import { Avatar, Card, EmptyState } from '@/components/ui/basics';
import { DetailHeader, Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { fetchClients } from '@/lib/clients';
import { formatDate } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';

export default function ClientsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, initializing } = useAuth();
  const { data: clients, refreshing, refresh } = useData(fetchClients);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const all = clients ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((client) =>
      [client.name, client.email, client.phone].join(' ').toLowerCase().includes(q),
    );
  }, [clients, query]);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <DetailHeader title="Clients" />
      <SearchBar value={query} onChangeText={setQuery} placeholder="Search clients..." />
      {filtered.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No clients found"
          message="Clients appear here as you create jobs for them."
        />
      ) : (
        filtered.map((client) => (
          <Card
            key={client.id}
            onPress={() =>
              router.push({ pathname: '/client/[id]', params: { id: client.id } })
            }>
            <View style={styles.row}>
              <Avatar name={client.name} size={42} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                  {client.name}
                </Text>
                <Text style={{ fontSize: 12.5, color: colors.textSecondary }} numberOfLines={1}>
                  {[client.phone, client.email].filter(Boolean).join(' · ') || 'No contact info'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.text }}>
                  {client.jobs_count} {client.jobs_count === 1 ? 'job' : 'jobs'}
                </Text>
                {client.last_job_at ? (
                  <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                    last {formatDate(client.last_job_at)}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
});
