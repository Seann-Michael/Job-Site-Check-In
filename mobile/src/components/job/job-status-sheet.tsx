import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { JobSheet } from '@/components/job/sheet';
import { JOB_STATUS_TONES } from '@/components/job-card';
import { Badge } from '@/components/ui/basics';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { JOB_STATUS_LABELS } from '@/lib/format';
import type { JobStatus } from '@/lib/types';

const STATUS_ORDER: JobStatus[] = [
  'draft',
  'active',
  'in_progress',
  'paused',
  'completed',
  'cancelled',
];

/**
 * The status selector behind the chip in the job hero — a real sheet rather
 * than an Alert menu, so it works on web too.
 */
export function JobStatusSheet({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: JobStatus;
  onSelect: (status: JobStatus) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();

  return (
    <JobSheet
      visible={visible}
      title="Job status"
      subtitle="Everyone on this job sees the status you pick here."
      closeLabel="Cancel"
      onClose={onClose}>
      {STATUS_ORDER.map((status) => {
        const selected = status === current;
        return (
          <Pressable
            key={status}
            onPress={() => onSelect(status)}
            style={({ pressed }) => [
              styles.row,
              { borderColor: selected ? colors.primary : colors.border },
              pressed && { backgroundColor: colors.cardPressed },
            ]}>
            <Badge label={JOB_STATUS_LABELS[status]} tone={JOB_STATUS_TONES[status]} />
            <View style={{ flex: 1 }} />
            {selected ? (
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            ) : null}
          </Pressable>
        );
      })}
    </JobSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
});

