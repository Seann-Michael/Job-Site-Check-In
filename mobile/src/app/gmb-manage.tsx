import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Badge, Button, Card, EmptyState, Segmented } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { notify } from '@/lib/format';
import { fetchGmbData } from '@/lib/gmb';
import {
  addGmbCategory,
  addGmbQa,
  addGmbService,
  deleteGmbCategory,
  deleteGmbQa,
  deleteGmbService,
  fetchGmbLists,
  saveGmbHours,
  type GmbHourRow,
  type GmbLists,
} from '@/lib/gmb-manage';
import { useAuth } from '@/providers/auth-provider';

const TABS = [
  { value: 'hours', label: 'Hours' },
  { value: 'qa', label: 'Q&A' },
  { value: 'services', label: 'Services' },
  { value: 'categories', label: 'Categories' },
];

function useFieldStyle() {
  const { colors } = useTheme();
  return [
    styles.input,
    { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
  ];
}

export default function GmbManageScreen() {
  const { colors } = useTheme();
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();
  const { user, initializing } = useAuth();

  const [tab, setTab] = useState(
    TABS.some((t) => t.value === initialTab) ? (initialTab as string) : 'hours',
  );
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [lists, setLists] = useState<GmbLists | null>(null);
  const [loading, setLoading] = useState(true);

  const [hoursDraft, setHoursDraft] = useState<GmbHourRow[]>([]);
  const [savingHours, setSavingHours] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [busy, setBusy] = useState(false);

  const fieldStyle = useFieldStyle();

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchGmbData();
    const bid = data.mode === 'connected' ? data.profile.business_id : 'demo';
    setBusinessId(bid);
    const fetched = await fetchGmbLists(bid);
    setLists(fetched);
    setHoursDraft(fetched.hours);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const refreshLists = async () => {
    if (!businessId) return;
    const fetched = await fetchGmbLists(businessId);
    setLists(fetched);
    setHoursDraft(fetched.hours);
  };

  const handleSaveHours = async () => {
    if (!businessId || savingHours) return;
    setSavingHours(true);
    const result = await saveGmbHours(businessId, hoursDraft);
    setSavingHours(false);
    if (result.error) {
      notify('Could not save hours', result.error);
      return;
    }
    notify('Hours saved', 'Business hours updated.');
    void refreshLists();
  };

  const handleAddQa = async () => {
    if (!businessId || !question.trim() || !answer.trim() || busy) return;
    setBusy(true);
    const result = await addGmbQa(businessId, question.trim(), answer.trim());
    setBusy(false);
    if (result.error) {
      notify('Could not add Q&A', result.error);
      return;
    }
    setQuestion('');
    setAnswer('');
    void refreshLists();
  };

  const handleAddService = async () => {
    if (!businessId || !serviceName.trim() || busy) return;
    setBusy(true);
    const result = await addGmbService(businessId, {
      name: serviceName.trim(),
      description: serviceDescription.trim(),
      price: servicePrice.trim(),
    });
    setBusy(false);
    if (result.error) {
      notify('Could not add service', result.error);
      return;
    }
    setServiceName('');
    setServicePrice('');
    setServiceDescription('');
    void refreshLists();
  };

  const handleAddCategory = async () => {
    if (!businessId || !categoryName.trim() || busy) return;
    setBusy(true);
    const result = await addGmbCategory(businessId, categoryName.trim());
    setBusy(false);
    if (result.error) {
      notify('Could not add category', result.error);
      return;
    }
    setCategoryName('');
    void refreshLists();
  };

  const updateHour = (index: number, patch: Partial<GmbHourRow>) => {
    setHoursDraft((prev) => prev.map((hour, i) => (i === index ? { ...hour, ...patch } : hour)));
  };

  return (
    <Screen>
      <DetailHeader title="Manage GMB Profile" />
      <Segmented options={TABS} value={tab} onChange={setTab} />

      {loading || !lists ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xxl }} />
      ) : tab === 'hours' ? (
        <Section title="Business hours">
          <Card style={{ padding: 0 }}>
            {hoursDraft.map((hour, index) => (
              <View
                key={hour.day}
                style={[
                  styles.hourRow,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                ]}>
                <Text style={{ width: 40, fontSize: 13.5, fontWeight: '600', color: colors.text }}>
                  {hour.day.slice(0, 3)}
                </Text>
                {hour.is_closed ? (
                  <Text style={{ flex: 1, fontSize: 13.5, color: colors.textMuted }}>Closed</Text>
                ) : (
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TextInput
                      value={hour.open_time}
                      onChangeText={(text) => updateHour(index, { open_time: text })}
                      placeholder="8:00 AM"
                      placeholderTextColor={colors.textMuted}
                      style={[fieldStyle, styles.timeInput]}
                    />
                    <Text style={{ color: colors.textMuted }}>–</Text>
                    <TextInput
                      value={hour.close_time}
                      onChangeText={(text) => updateHour(index, { close_time: text })}
                      placeholder="6:00 PM"
                      placeholderTextColor={colors.textMuted}
                      style={[fieldStyle, styles.timeInput]}
                    />
                  </View>
                )}
                <Pressable
                  onPress={() => updateHour(index, { is_closed: !hour.is_closed })}
                  style={[
                    styles.closedToggle,
                    {
                      backgroundColor: hour.is_closed ? colors.dangerSoft : colors.cardPressed,
                    },
                  ]}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: hour.is_closed ? colors.dangerStrong : colors.textSecondary,
                    }}>
                    {hour.is_closed ? 'Closed' : 'Open'}
                  </Text>
                </Pressable>
              </View>
            ))}
          </Card>
          <Button label="Save hours" loading={savingHours} onPress={handleSaveHours} />
        </Section>
      ) : tab === 'qa' ? (
        <>
          <Section title="Add a Q&A">
            <Card style={{ gap: Spacing.md }}>
              <TextInput
                value={question}
                onChangeText={setQuestion}
                placeholder="Question customers ask..."
                placeholderTextColor={colors.textMuted}
                style={fieldStyle}
              />
              <TextInput
                value={answer}
                onChangeText={setAnswer}
                placeholder="Your answer"
                placeholderTextColor={colors.textMuted}
                multiline
                style={[fieldStyle, styles.multiline]}
              />
              <Button
                label="Add Q&A"
                icon="add"
                loading={busy}
                disabled={!question.trim() || !answer.trim()}
                onPress={handleAddQa}
              />
            </Card>
          </Section>
          <Section title={`Existing (${lists.qas.length})`}>
            {lists.qas.length === 0 ? (
              <EmptyState
                icon="help-circle-outline"
                title="No Q&As yet"
                message="Answer common questions before customers ask them."
              />
            ) : (
              lists.qas.map((qa) => (
                <Card key={qa.id} style={{ gap: 4 }}>
                  <View style={styles.itemHeader}>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.text }}>
                      {qa.question}
                    </Text>
                    <Pressable
                      hitSlop={8}
                      onPress={async () => {
                        await deleteGmbQa(qa.id);
                        void refreshLists();
                      }}>
                      <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>{qa.answer}</Text>
                </Card>
              ))
            )}
          </Section>
        </>
      ) : tab === 'services' ? (
        <>
          <Section title="Add a service">
            <Card style={{ gap: Spacing.md }}>
              <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                <TextInput
                  value={serviceName}
                  onChangeText={setServiceName}
                  placeholder="Service name"
                  placeholderTextColor={colors.textMuted}
                  style={[fieldStyle, { flex: 2 }]}
                />
                <TextInput
                  value={servicePrice}
                  onChangeText={setServicePrice}
                  placeholder="Price"
                  placeholderTextColor={colors.textMuted}
                  style={[fieldStyle, { flex: 1 }]}
                />
              </View>
              <TextInput
                value={serviceDescription}
                onChangeText={setServiceDescription}
                placeholder="Short description"
                placeholderTextColor={colors.textMuted}
                multiline
                style={[fieldStyle, styles.multiline]}
              />
              <Button
                label="Add service"
                icon="add"
                loading={busy}
                disabled={!serviceName.trim()}
                onPress={handleAddService}
              />
            </Card>
          </Section>
          <Section title={`Listed (${lists.services.length})`}>
            {lists.services.map((service) => (
              <Card key={service.id} style={{ gap: 4 }}>
                <View style={styles.itemHeader}>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.text }}>
                    {service.name}
                  </Text>
                  {service.price ? (
                    <Badge label={service.price} tone="primary" />
                  ) : null}
                  <Pressable
                    hitSlop={8}
                    onPress={async () => {
                      await deleteGmbService(service.id);
                      void refreshLists();
                    }}>
                    <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                  </Pressable>
                </View>
                {service.description ? (
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    {service.description}
                  </Text>
                ) : null}
              </Card>
            ))}
          </Section>
        </>
      ) : (
        <>
          <Section title="Add a category">
            <Card style={{ gap: Spacing.md }}>
              <TextInput
                value={categoryName}
                onChangeText={setCategoryName}
                placeholder="e.g. Roofing Contractor"
                placeholderTextColor={colors.textMuted}
                style={fieldStyle}
                onSubmitEditing={handleAddCategory}
              />
              <Button
                label="Add category"
                icon="add"
                loading={busy}
                disabled={!categoryName.trim()}
                onPress={handleAddCategory}
              />
            </Card>
          </Section>
          <Section title={`Categories (${lists.categories.length})`}>
            <Card style={{ padding: 0 }}>
              {lists.categories.map((category, index) => (
                <View
                  key={category.id}
                  style={[
                    styles.categoryRow,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    },
                  ]}>
                  <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>{category.name}</Text>
                  {category.is_primary ? (
                    <Badge label="Primary" tone="primary" />
                  ) : (
                    <Pressable
                      hitSlop={8}
                      onPress={async () => {
                        await deleteGmbCategory(category.id);
                        void refreshLists();
                      }}>
                      <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                    </Pressable>
                  )}
                </View>
              ))}
            </Card>
          </Section>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    fontSize: 14.5,
  },
  multiline: {
    height: 72,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  timeInput: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    height: 36,
    fontSize: 12.5,
    paddingHorizontal: Spacing.sm,
  },
  closedToggle: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
});
