import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { SearchBar } from '@/components/search-bar';
import { Avatar, Button, Card, EmptyState, IconTile } from '@/components/ui/basics';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Spacing, Typography } from '@/constants/theme';
import { useRole } from '@/hooks/use-role';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { clientDisplayName, fetchClients } from '@/lib/clients';
import { clientsStore } from '@/lib/clients-store';
import { dataErrors } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { workspace } from '@/lib/workspace';
import { useAuth } from '@/providers/auth-provider';

export default function ClientsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { canWrite, isViewer } = useRole();
  const { user, initializing } = useAuth();
  const { data: clients, loading, refreshing, refresh } = useData(fetchClients);
  React.useEffect(() => clientsStore.subscribe(refresh), [refresh]);
  const [query, setQuery] = useState('');

  // Why this screen watches two channels instead of one: fetchClients has no
  // `dataErrors` slot of its own (see lib/clients.ts), and both of the reads it
  // depends on can fail without it ever saying so.
  //
  //  - workspace.lastError() — the businesses query failed, so
  //    workspace.getCurrent() is null and fetchClients refuses to read the
  //    `clients` table at all rather than run it unscoped. That is exactly the
  //    case this banner exists for: the address book comes back EMPTY, and
  //    without a reason attached "Clients appear here as you create jobs for
  //    them" tells the user they have no customers.
  //  - dataErrors.get('jobs') — fetchClients builds the derived list, and every
  //    job count and last-job date on a real row, from fetchJobs(). A jobs
  //    failure therefore empties or undercounts this screen too.
  //
  // Both stay null in demo mode: the unconfigured paths in workspace.ts and
  // data.ts never record an error, so no phantom banner appears there.
  const [workspaceError, setWorkspaceError] = useState<string | null>(() => workspace.lastError());
  const [jobsError, setJobsError] = useState<string | null>(() => dataErrors.get('jobs'));
  React.useEffect(() => workspace.subscribe(() => setWorkspaceError(workspace.lastError())), []);
  React.useEffect(() => dataErrors.subscribe(() => setJobsError(dataErrors.get('jobs'))), []);

  // The scope failure is named first: when the business is unknown nothing was
  // read, so it explains more of the screen than a jobs failure does.
  const loadError = workspaceError
    ? `${workspaceError} Until it loads there's no way to tell your clients from another company's, so none are shown.`
    : jobsError
      ? `${jobsError} Clients and their job counts are built from that list.`
      : null;

  const filtered = useMemo(() => {
    const all = clients ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    // Search every name the app can show. The detail screen titles a client by
    // clientDisplayName (first/last wins over `name`), so searching only `name`
    // meant typing the name you just read on that screen returned nothing.
    return all.filter((client) =>
      [
        clientDisplayName(client),
        client.name,
        client.business_name,
        client.email,
        client.phone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [clients, query]);

  // Did the fetch actually hand us anything? Separates "the read came back
  // empty" from "the search matched none of the rows we hold".
  const hasRows = (clients ?? []).length > 0;

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader
        title="Clients"
        subtitle="Everyone you've worked with"
        readOnly={isViewer}
        actions={
          canWrite
            ? [{ icon: 'person-add-outline', onPress: () => router.push('/client/edit') }]
            : []
        }
      />
      <SearchBar value={query} onChangeText={setQuery} placeholder="Search clients..." />
      {/* A banner, not a replacement. Both channels are process-global and are
          written by reads other screens make too, so a failure can arrive while
          this tab still holds rows it loaded successfully — clients edited or
          created on this device are always local, and a jobs failure leaves a
          successfully read `clients` table intact. Blanking the list would hide
          the user's real address book on top of the failure. */}
      {loadError ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
          <IconTile icon="cloud-offline-outline" tone="danger" />
          <Text style={{ flex: 1, color: colors.text, fontWeight: '600', fontSize: 15 }}>
            {loadError}
          </Text>
          <Button
            label="Try again"
            variant="secondary"
            icon="refresh"
            loading={refreshing}
            onPress={refresh}
          />
        </Card>
      ) : null}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xxl }} />
      ) : filtered.length === 0 ? (
        // With rows in hand it was the search that emptied the list, so the
        // empty state is still the truth. With no rows AND a failure, the
        // banner above is the explanation — repeating the reassuring "as you
        // create jobs for them" underneath it would be a claim about a read
        // that never happened.
        loadError && !hasRows ? null : (
          <EmptyState
            icon="people-outline"
            title="No clients found"
            message={
              hasRows
                ? 'No client matches that search.'
                : 'Clients appear here as you create jobs for them.'
            }
          />
        )
      ) : (
        filtered.map((client) => (
          <Card
            key={client.id}
            onPress={() =>
              router.push({ pathname: '/client/[id]', params: { id: client.id } })
            }>
            <View style={styles.row}>
              {/* Same label and initials the detail screen uses, so a client
                  cannot appear under two different names in one session. */}
              <Avatar name={clientDisplayName(client)} size={46} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[Typography.bodyStrong, { color: colors.text }]} numberOfLines={1}>
                  {clientDisplayName(client)}
                </Text>
                {client.business_name && client.business_name !== clientDisplayName(client) ? (
                  <Text style={[Typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                    {client.business_name}
                  </Text>
                ) : null}
                <Text style={[Typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                  {[client.phone, client.email].filter(Boolean).join(' · ') || 'No contact info'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <Text style={[Typography.label, { color: colors.text }]}>
                  {client.jobs_count} {client.jobs_count === 1 ? 'job' : 'jobs'}
                </Text>
                {client.last_job_at ? (
                  <Text style={[Typography.caption, { color: colors.textMuted }]}>
                    {formatDate(client.last_job_at)}
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
