import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Badge, Button } from '@/components/ui/basics';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/format';
import type { TeamMember, TeamRoster } from '@/lib/team';

/** What the sheet hands back: the person (or nobody) and the due date. */
export interface TaskAssignChoice {
  member: TeamMember | null;
  /** 'YYYY-MM-DD', or null for no due date. */
  dueDate: string | null;
}

/** Local date-only string N days from today — never UTC, which shifts the day. */
function isoDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primarySoft : 'transparent',
        },
        pressed && { opacity: 0.75 },
      ]}>
      <Text
        style={{
          fontSize: 12.5,
          fontWeight: '600',
          color: selected ? colors.primaryStrong : colors.textSecondary,
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Bottom sheet for handing a checklist task to a teammate.
 *
 * A list rather than an action sheet on purpose: `Alert.alert` with one button
 * per person stacks badly past three options on iOS and does nothing at all on
 * web.
 *
 * The sheet never claims anyone will be told. There is no push registration and
 * no server-side sender in this app, so assigning only moves the task into that
 * person's "Assigned to you" list.
 */
export function TaskAssignSheet({
  visible,
  taskLabel,
  roster,
  current,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  /** The task being assigned, shown so the sheet says what it is acting on. */
  taskLabel: string;
  /** From `fetchTeam` — undefined while it is still loading. */
  roster?: TeamRoster;
  current?: { assigneeId?: string; assigneeName?: string; dueDate?: string };
  onSubmit: (choice: TaskAssignChoice) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [due, setDue] = useState<string | null>(null);

  // Re-seed from the task each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setSelectedId(current?.assigneeId ?? null);
    setDue(current?.dueDate ?? null);
  }, [visible, current?.assigneeId, current?.dueDate]);

  const members = roster?.members ?? [];
  // Somebody assigned earlier who is no longer on the roster still needs a row,
  // otherwise saving would quietly unassign them.
  const missingCurrent: TeamMember | null =
    current?.assigneeId && !members.some((member) => member.id === current.assigneeId)
      ? {
          id: current.assigneeId,
          name: current.assigneeName ?? 'Former teammate',
          initials: (current.assigneeName ?? '?').slice(0, 1).toUpperCase(),
          role: 'No longer on your team list',
          isYou: false,
        }
      : null;
  const options = missingCurrent ? [missingCurrent, ...members] : members;

  const presets = [
    { label: 'Today', value: isoDate(0) },
    { label: 'Tomorrow', value: isoDate(1) },
    { label: 'In a week', value: isoDate(7) },
  ];
  // A date already on the task that is none of the presets keeps its own chip.
  const dueChips =
    due && !presets.some((preset) => preset.value === due)
      ? [...presets, { label: formatDate(due), value: due }]
      : presets;

  const submit = () => {
    onSubmit({
      member: options.find((member) => member.id === selectedId) ?? null,
      dueDate: due,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: colors.card, paddingBottom: insets.bottom + Spacing.lg },
          ]}
          onPress={(event) => event.stopPropagation()}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text }]}>Assign task</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
            {taskLabel}
          </Text>

          {!roster ? (
            <View style={styles.loading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Loading your team…</Text>
            </View>
          ) : (
            <>
              <ScrollView style={styles.list} contentContainerStyle={{ gap: Spacing.sm }}>
                <Pressable
                  onPress={() => setSelectedId(null)}
                  style={({ pressed }) => [
                    styles.row,
                    { borderColor: selectedId === null ? colors.primary : colors.border },
                    pressed && { backgroundColor: colors.cardPressed },
                  ]}>
                  <View
                    style={[styles.noneTile, { backgroundColor: colors.cardPressed }]}>
                    <Ionicons name="person-outline" size={17} color={colors.textMuted} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.text }}>
                    Nobody
                  </Text>
                  {selectedId === null ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  ) : null}
                </Pressable>

                {options.map((member) => {
                  const selected = member.id === selectedId;
                  return (
                    <Pressable
                      key={member.id}
                      onPress={() => setSelectedId(member.id)}
                      style={({ pressed }) => [
                        styles.row,
                        { borderColor: selected ? colors.primary : colors.border },
                        pressed && { backgroundColor: colors.cardPressed },
                      ]}>
                      <Avatar name={member.name} size={34} />
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                          {member.name}
                        </Text>
                        {member.role ? (
                          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                            {member.role}
                          </Text>
                        ) : null}
                      </View>
                      {member.isYou ? <Badge label="You" tone="primary" /> : null}
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>Due</Text>
              <View style={styles.chips}>
                <Chip label="No date" selected={due === null} onPress={() => setDue(null)} />
                {dueChips.map((preset) => (
                  <Chip
                    key={preset.value}
                    label={preset.label}
                    selected={due === preset.value}
                    onPress={() => setDue(preset.value)}
                  />
                ))}
              </View>

              {roster.isDemo && roster.demoReason ? (
                <View style={styles.note}>
                  <Ionicons name="information-circle-outline" size={15} color={colors.warningStrong} />
                  <Text style={{ flex: 1, fontSize: 12, color: colors.textSecondary }}>
                    {roster.demoReason}
                  </Text>
                </View>
              ) : null}
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                Assigning does not notify anyone — the app has no messaging or push yet. The task
                shows up under &quot;Assigned to you&quot; on their checklist screen.
              </Text>

              <Button label="Save assignment" icon="checkmark" onPress={submit} />
            </>
          )}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancel,
              { borderColor: colors.border },
              pressed && { backgroundColor: colors.cardPressed },
            ]}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: Radius.full,
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: Spacing.xs,
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  list: {
    maxHeight: 260,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  noneTile: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: Spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  cancel: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
});
