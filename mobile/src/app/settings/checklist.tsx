import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { notify } from '@/lib/format';
import {
  DEFAULT_TASK_LABELS,
  getChecklistTemplate,
  setChecklistTemplate,
} from '@/lib/tasks-store';
import { useAuth } from '@/providers/auth-provider';

export default function ChecklistTemplateScreen() {
  const { colors } = useTheme();
  const { user, initializing } = useAuth();
  const [labels, setLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    void getChecklistTemplate().then(setLabels);
  }, []);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const save = async (next: string[]) => {
    setLabels(next);
    await setChecklistTemplate(next);
  };

  const addLabel = () => {
    if (!newLabel.trim()) return;
    void save([...labels, newLabel.trim()]);
    setNewLabel('');
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= labels.length) return;
    const next = [...labels];
    [next[index], next[target]] = [next[target], next[index]];
    void save(next);
  };

  return (
    <Screen>
      <DetailHeader title="Checklist template" />
      <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: -Spacing.sm }}>
        Every new job starts with this checklist. Existing jobs keep theirs.
      </Text>

      <Section title={`Tasks (${labels.length})`}>
        <Card style={{ padding: 0 }}>
          {labels.map((label, index) => (
            <View
              key={`${label}-${index}`}
              style={[
                styles.row,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                },
              ]}>
              <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>{label}</Text>
              <Pressable hitSlop={6} onPress={() => move(index, -1)} disabled={index === 0}>
                <Ionicons
                  name="chevron-up"
                  size={17}
                  color={index === 0 ? colors.border : colors.textSecondary}
                />
              </Pressable>
              <Pressable
                hitSlop={6}
                onPress={() => move(index, 1)}
                disabled={index === labels.length - 1}>
                <Ionicons
                  name="chevron-down"
                  size={17}
                  color={index === labels.length - 1 ? colors.border : colors.textSecondary}
                />
              </Pressable>
              <Pressable
                hitSlop={6}
                onPress={() => void save(labels.filter((_, i) => i !== index))}>
                <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
          <View
            style={[
              styles.row,
              labels.length > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              },
            ]}>
            <Ionicons name="add-circle-outline" size={20} color={colors.textMuted} />
            <TextInput
              value={newLabel}
              onChangeText={setNewLabel}
              placeholder="Add a task..."
              placeholderTextColor={colors.textMuted}
              style={{ flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 }}
              onSubmitEditing={addLabel}
              returnKeyType="done"
            />
          </View>
        </Card>
      </Section>

      <Button
        label="Reset to defaults"
        icon="refresh-outline"
        variant="secondary"
        onPress={() => {
          void save([...DEFAULT_TASK_LABELS]);
          notify('Template reset', 'Back to the standard field checklist.');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
});
