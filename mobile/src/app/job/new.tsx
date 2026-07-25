import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import { Button, Card } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { createJob } from '@/lib/data';
import { notify } from '@/lib/format';
import {
  autocompleteAddress,
  getPlaceDetails,
  isPlacesConfigured,
  streetViewImageUrl,
  type AddressSuggestion,
} from '@/lib/places';
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

export default function NewJobScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, initializing } = useAuth();

  const [title, setTitle] = useState('');
  const [service, setService] = useState<ServiceType>('general');
  const [notes, setNotes] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');

  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const [submitting, setSubmitting] = useState(false);

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

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

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
      client_name: clientName.trim(),
      client_phone: clientPhone.trim() || undefined,
      client_email: clientEmail.trim() || undefined,
      street: street.trim(),
      city: city.trim(),
      state: state.trim() || undefined,
      zip: zip.trim() || undefined,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      street_view_available: Boolean(streetView),
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);
    if (result.error || !result.job) {
      notify('Job not created', result.error ?? 'Something went wrong. Please try again.');
      return;
    }
    const jobId = result.job.id;
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
          <Field
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Scope, materials, access notes..."
            multiline
          />
          <View style={styles.startRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
            <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>Starts today</Text>
          </View>
        </Card>
      </Section>

      <Section title="Client">
        <Card style={{ gap: Spacing.md }}>
          <Field
            label="Client name"
            value={clientName}
            onChangeText={setClientName}
            placeholder="Full name"
          />
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
  streetView: {
    width: '100%',
    height: 150,
    borderRadius: Radius.md,
  },
});
