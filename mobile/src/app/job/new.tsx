import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { SERVICE_ICONS } from '@/components/job-card';
import { TagEditor } from '@/components/tag-editor';
import { Button, Card } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { useTheme } from '@/hooks/use-theme';
import { clientDisplayName, fetchClient, fetchClients, matchClients } from '@/lib/clients';
import { createJob } from '@/lib/data';
import { notify } from '@/lib/format';
import { jobExtras } from '@/lib/job-extras';
import {
  autocompleteAddress,
  getPlaceDetails,
  isPlacesConfigured,
  streetViewImageUrl,
  type AddressSuggestion,
} from '@/lib/places';
import { useAuth } from '@/providers/auth-provider';
import type { ClientRecord, ServiceType } from '@/lib/types';

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

function Field({
  label,
  style,
  ...inputProps
}: Omit<TextInputProps, 'style'> & { label: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[{ gap: 5 }, style]}>
      <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.textSecondary }}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...inputProps}
        style={[
          fieldStyles.input,
          { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
          inputProps.multiline && { height: 76, paddingTop: 10, textAlignVertical: 'top' },
        ]}
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    fontSize: 15,
  },
});

/**
 * The comparison key for "did you mean this client you already have?".
 *
 * Jobs join to a client by NAME STRING (fetchClientJobs lowercases both sides
 * and compares exactly), so "Bob  Smith" is a different client from "Bob Smith"
 * as far as the data layer is concerned — two rows on the clients list, the
 * jobs split between them. Case, punctuation and repeated spaces are the three
 * ways people produce that accident, so all three are normalised away here and
 * the match is offered to the user rather than applied behind their back.
 *
 * Deliberately LOOSER than `clientNameKey` in lib/clients.ts, which never drops
 * a character because it also feeds silent decisions. This key only ever raises
 * the duplicate prompt below, which the user has to answer — nothing is merged
 * on the strength of it. The suggestion list underneath uses `matchClients`,
 * the shared matcher, rather than a second copy of this rule.
 */
function clientKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

export default function NewJobScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, initializing } = useAuth();
  // Optional prefill when arriving from a client screen; plain /job/new stays
  // blank. Only the client id travels in the route: expo-router serialises
  // params into the URL on react-native-web, so a phone number or email passed
  // this way would land in the address bar, browser history and any Referer
  // header. The contact details are looked up from the client record instead.
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();

  const [title, setTitle] = useState('');
  const [service, setService] = useState<ServiceType>('general');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [prefilledClient, setPrefilledClient] = useState('');
  const prefillSeeded = useRef(false);

  // Existing clients, fetched ONCE. fetchClients calls fetchJobs internally, so
  // a lookup per keystroke would be a full round trip per character — the whole
  // match below runs against this in-memory list instead.
  const { data: clients, loading: clientsLoading } = useData(fetchClients);
  const [clientMatches, setClientMatches] = useState<ClientRecord[]>([]);
  const [linkedClient, setLinkedClient] = useState<ClientRecord | null>(null);
  // The normalised name the user has explicitly said is a *new* client, so the
  // duplicate prompt stops re-appearing for that one spelling.
  const [separateFrom, setSeparateFrom] = useState('');

  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const [submitting, setSubmitting] = useState(false);

  // One-shot prefill from the client record. The ref stops a re-render from
  // re-seeding, and each setter only fills a field that is still empty, so a
  // slow lookup can never overwrite what the user has already typed.
  useEffect(() => {
    if (!clientId || prefillSeeded.current) return;
    let cancelled = false;
    void (async () => {
      const client = await fetchClient(clientId);
      if (cancelled || !client) return;
      prefillSeeded.current = true;
      // `client.name` — not the display label — is what links a job back to
      // its client: createJob stores it as Job.client_name.
      setClientName((current) => current || client.name);
      setClientPhone((current) => current || client.phone);
      setClientEmail((current) => current || client.email);
      setPrefilledClient(clientDisplayName(client));
      // Arriving from a client screen IS the link. `linkedName` below re-checks
      // it against whatever is actually in the field, so this can never claim a
      // link the name no longer supports.
      setLinkedClient(client);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // Debounced Places autocomplete, like the web app's address search.
  useEffect(() => {
    if (!isPlacesConfigured || search.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const results = await autocompleteAddress(search);
      if (!cancelled) setSuggestions(results);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  const typedKey = clientKey(clientName);
  // A link only counts while the field still holds that client's name — typing
  // over it silently unlinks, so no state can drift out of sync with the input.
  const linkedName =
    linkedClient && clientKey(linkedClient.name) === typedKey && typedKey ? linkedClient.name : null;
  const exactMatch = typedKey
    ? (clients ?? []).find((client) => clientKey(client.name) === typedKey)
    : undefined;

  // Same debounce-then-dropdown shape as the Places search above, except the
  // list is already in memory, so this matches rather than fetches.
  //
  // `matchClients` (lib/clients.ts) is the shared matcher and the only copy of
  // this logic. It looks at the record's first/last name and business name as
  // well as the join name, so typing a person's name finds the client filed
  // under their company — which a substring scan of `name` alone never did.
  useEffect(() => {
    const typed = clientName.trim();
    if (linkedName || typed.length < 2 || !clients?.length) {
      setClientMatches([]);
      return;
    }
    const timer = setTimeout(() => {
      setClientMatches(
        matchClients(clients, typed)
          // An exact match gets the dedicated card below instead of a row here.
          .filter((match) => clientKey(match.client.name) !== clientKey(typed))
          .map((match) => match.client),
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [clientName, clients, linkedName]);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const linkToClient = (client: ClientRecord) => {
    setClientMatches([]);
    setSeparateFrom('');
    setLinkedClient(client);
    // `client.name` — not the display label — is the string jobs join on.
    setClientName(client.name);
    setClientPhone((current) => current || client.phone);
    setClientEmail((current) => current || client.email);
  };

  // What actually gets written. When the typed name normalises onto an existing
  // client and the user has not said otherwise, their exact spelling is used so
  // the job lands on that client's record instead of forking a near-duplicate.
  const resolvedClientName =
    linkedName ??
    (exactMatch && separateFrom !== typedKey ? exactMatch.name : clientName.trim());
  // Only worth interrupting for when the spellings actually differ — an
  // identical string already joins correctly and needs no decision.
  const duplicatePrompt =
    exactMatch && !linkedName && separateFrom !== typedKey && exactMatch.name !== clientName.trim()
      ? exactMatch
      : undefined;
  // No decision pending: say plainly whose record this job is joining.
  const attachedClient = duplicatePrompt
    ? undefined
    : linkedName
      ? (linkedClient ?? undefined)
      : exactMatch && separateFrom !== typedKey
        ? exactMatch
        : undefined;
  const jobsLabel = (count: number) => (count === 1 ? '1 job' : `${count} jobs`);

  const handleSuggestion = async (suggestion: AddressSuggestion) => {
    setSuggestions([]);
    setSearch(suggestion.description);
    const details = await getPlaceDetails(suggestion.placeId);
    if (!details) return;
    setStreet(details.street);
    setCity(details.city);
    setState(details.state);
    setZip(details.zip);
    if (typeof details.latitude === 'number' && typeof details.longitude === 'number') {
      setCoords({ latitude: details.latitude, longitude: details.longitude });
    }
  };

  const canSubmit = title.trim().length > 0 && street.trim().length > 0 && city.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    const result = await createJob({
      title: title.trim(),
      service_type: service,
      client_name: resolvedClientName,
      client_phone: clientPhone.trim() || undefined,
      client_email: clientEmail.trim() || undefined,
      street: street.trim(),
      city: city.trim(),
      state: state.trim() || undefined,
      zip: zip.trim() || undefined,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      street_view_available: Boolean(streetView),
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
      keywords: keywords.length ? keywords : undefined,
    });
    if (result.error || !result.job) {
      setSubmitting(false);
      notify('Job not created', result.error ?? 'Something went wrong. Please try again.');
      return;
    }
    const jobId = result.job.id;
    // The connected insert files notes under metadata.notes, which nothing
    // reads back, and demo mode has nowhere to put them at all. Posting them as
    // the job's first note gives them one home that works in both modes and is
    // actually rendered — the notes list on the job screen.
    if (notes.trim()) {
      await jobExtras.addNote(jobId, notes.trim(), user?.name ?? 'You');
    }
    setSubmitting(false);
    if (Platform.OS === 'web') {
      notify('Job created', `${result.job.title} is ready — capture photos from the job screen.`);
      router.replace({ pathname: '/job/[id]', params: { id: jobId } });
      return;
    }
    // Close the loop on site: offer to shoot the "before" photos right away.
    Alert.alert('Job created', 'Capture before photos now?', [
      {
        text: 'Later',
        style: 'cancel',
        onPress: () => router.replace({ pathname: '/job/[id]', params: { id: jobId } }),
      },
      {
        text: 'Capture now',
        onPress: () =>
          router.replace({ pathname: '/job/[id]', params: { id: jobId, capture: 'before' } }),
      },
    ]);
  };

  const streetView = coords ? streetViewImageUrl(coords.latitude, coords.longitude) : undefined;

  return (
    <Screen>
      <DetailHeader title="New job" />

      <Section title="Job">
        <Card style={{ gap: Spacing.md }}>
          <Field
            label="Job title *"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Gutter guard installation"
          />
          <View style={{ gap: 5 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.textSecondary }}>
              Service type
            </Text>
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
          <View style={{ gap: 5 }}>
            <Field
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Scope of work — what you're doing on this job."
              multiline
            />
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              Shown as the scope of work on the job screen and in reports.
            </Text>
          </View>
          <View style={{ gap: 5 }}>
            <Field
              label="Internal notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Gate code, dog in the yard, crew reminders..."
              multiline
            />
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              Saved as the first note on the job — for your team, not the customer.
            </Text>
          </View>
          <View style={styles.startRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
            <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>Starts today</Text>
          </View>
        </Card>
      </Section>

      <Section title="Local SEO keywords">
        <Card style={{ gap: Spacing.md }}>
          <TagEditor
            tags={keywords}
            onChange={setKeywords}
            mode="phrase"
            placeholder="e.g. gutter guard installation Westlake OH"
          />
          <Text style={{ fontSize: 12, color: colors.textMuted }}>
            Phrases you want this job to rank for. Saved exactly as you type them — capitals
            and punctuation included.
          </Text>
        </Card>
      </Section>

      <Section title="Client">
        <Card style={{ gap: Spacing.md }}>
          {prefilledClient ? (
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              Prefilled from {prefilledClient} — edit anything that changed.
            </Text>
          ) : null}
          <Field
            label="Client name"
            value={clientName}
            onChangeText={setClientName}
            placeholder="Full name"
          />

          {clientMatches.length > 0 ? (
            <View style={[styles.suggestions, { borderColor: colors.border }]}>
              {clientMatches.map((client, index) => (
                <Pressable
                  key={client.id}
                  onPress={() => linkToClient(client)}
                  style={({ pressed }) => [
                    styles.suggestionRow,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    },
                    pressed && { backgroundColor: colors.cardPressed },
                  ]}>
                  <Ionicons name="person-outline" size={15} color={colors.textMuted} />
                  <Text style={{ flex: 1, fontSize: 13.5, color: colors.text }} numberOfLines={1}>
                    {clientDisplayName(client)}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    {jobsLabel(client.jobs_count)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {duplicatePrompt ? (
            <View
              style={[
                styles.notice,
                { backgroundColor: colors.warningSoft, borderColor: colors.warningStrong },
              ]}>
              <Text style={{ fontSize: 13, color: colors.warningStrong, fontWeight: '600' }}>
                {clientDisplayName(duplicatePrompt)} is already a client
              </Text>
              <Text style={{ fontSize: 12.5, color: colors.text }}>
                They have {jobsLabel(duplicatePrompt.jobs_count)} on record under “
                {duplicatePrompt.name}”. This job will go on that record unless you keep “
                {clientName.trim()}” as a separate client.
              </Text>
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <Button
                  label="Use existing"
                  onPress={() => linkToClient(duplicatePrompt)}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Keep separate"
                  variant="secondary"
                  onPress={() => setSeparateFrom(typedKey)}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ) : null}

          {attachedClient && clientDisplayName(attachedClient) !== prefilledClient ? (
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              Adding to {clientDisplayName(attachedClient)}’s record —{' '}
              {jobsLabel(attachedClient.jobs_count)} so far.
            </Text>
          ) : null}

          {!attachedClient && !duplicatePrompt && separateFrom && separateFrom === typedKey ? (
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              Saving “{clientName.trim()}” as a separate client.
            </Text>
          ) : null}

          {clientsLoading && clientName.trim().length >= 2 ? (
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              Checking your existing clients...
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <Field
              label="Phone"
              value={clientPhone}
              onChangeText={setClientPhone}
              placeholder="(555) 555-0100"
              keyboardType="phone-pad"
              style={{ flex: 1 }}
            />
            <Field
              label="Email"
              value={clientEmail}
              onChangeText={setClientEmail}
              placeholder="name@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      </Section>

      <Section title="Location">
        <Card style={{ gap: Spacing.md }}>
          <Field
            label="Address search"
            value={search}
            onChangeText={setSearch}
            placeholder={
              isPlacesConfigured ? 'Start typing the job address...' : 'Enter address below'
            }
            editable={isPlacesConfigured}
          />
          {!isPlacesConfigured ? (
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY for live address suggestions and Street View.
            </Text>
          ) : null}
          {suggestions.length > 0 ? (
            <View style={[styles.suggestions, { borderColor: colors.border }]}>
              {suggestions.map((suggestion, index) => (
                <Pressable
                  key={suggestion.placeId}
                  onPress={() => handleSuggestion(suggestion)}
                  style={({ pressed }) => [
                    styles.suggestionRow,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    },
                    pressed && { backgroundColor: colors.cardPressed },
                  ]}>
                  <Ionicons name="location-outline" size={15} color={colors.textMuted} />
                  <Text style={{ flex: 1, fontSize: 13.5, color: colors.text }} numberOfLines={1}>
                    {suggestion.description}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Field
            label="Street address *"
            value={street}
            onChangeText={setStreet}
            placeholder="214 Maple Ave"
          />
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <Field
              label="City *"
              value={city}
              onChangeText={setCity}
              placeholder="Westlake"
              style={{ flex: 2 }}
            />
            <Field
              label="State"
              value={state}
              onChangeText={setState}
              placeholder="OH"
              autoCapitalize="characters"
              style={{ flex: 1 }}
            />
            <Field
              label="ZIP"
              value={zip}
              onChangeText={setZip}
              placeholder="44145"
              keyboardType="number-pad"
              style={{ flex: 1 }}
            />
          </View>
          {streetView ? (
            <View style={{ gap: 5 }}>
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.textSecondary }}>
                Street View
              </Text>
              <Image
                source={{ uri: streetView }}
                style={styles.streetView}
                contentFit="cover"
                transition={150}
              />
            </View>
          ) : null}
        </Card>
      </Section>

      <Button
        label="Create job"
        icon="add"
        onPress={handleSubmit}
        loading={submitting}
        disabled={!canSubmit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  startRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestions: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md - 2,
  },
  notice: {
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  streetView: {
    width: '100%',
    height: 150,
    borderRadius: Radius.md,
  },
});
