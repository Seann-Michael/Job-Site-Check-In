import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { JobSheet, SheetRow } from '@/components/job/sheet';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { TeamRoster } from '@/lib/team';

/**
 * Who is working this job. Names come from the shared roster (lib/team.ts) —
 * and when that roster is sampled rather than real, the sheet says so, because
 * assigning work to a name implies the person exists.
 *
 * Replaces an Alert.alert list, which showed nothing at all on web.
 */
export function JobAssignSheet({
  visible,
  roster,
  assignees,
  onToggle,
  onClose,
}: {
  visible: boolean;
  /** Undefined while the roster is still loading. */
  roster?: TeamRoster;
  assignees: string[];
  onToggle: (name: string) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();

  const members = roster?.members ?? [];
  // Somebody assigned earlier who is no longer on the roster still needs a row,
  // or they can never be un-assigned.
  const extras = assignees.filter((name) => !members.some((member) => member.name === name));

  return (
    <JobSheet
      visible={visible}
      title="Assign teammates"
      subtitle="Tap a name to add or remove them from this job."
      closeLabel="Done"
      onClose={onClose}>
      {roster?.isDemo && roster.demoReason ? (
        <View style={[styles.note, { backgroundColor: colors.warningSoft }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.warningStrong} />
          <Text style={{ flex: 1, fontSize: 12.5, color: colors.warningStrong }}>
            {roster.demoReason}
          </Text>
        </View>
      ) : null}

      {!roster ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ fontSize: 13, color: colors.textSecondary }}>Loading your team…</Text>
        </View>
      ) : null}

      {members.map((member) => {
        const selected = assignees.includes(member.name);
        return (
          <SheetRow
            key={member.id}
            icon={selected ? 'person' : 'person-outline'}
            tone={selected ? 'primary' : 'neutral'}
            label={member.isYou ? `${member.name} (you)` : member.name}
            sub={member.role ?? member.email}
            onPress={() => onToggle(member.name)}
            trailing={
              selected ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              ) : (
                <Ionicons name="add-circle-outline" size={20} color={colors.textMuted} />
              )
            }
          />
        );
      })}

      {extras.map((name) => (
        <SheetRow
          key={`extra-${name}`}
          icon="person"
          tone="primary"
          label={name}
          sub="Assigned earlier — not on the current roster"
          onPress={() => onToggle(name)}
          trailing={<Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
        />
      ))}
    </JobSheet>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
});
