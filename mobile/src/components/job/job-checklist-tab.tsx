import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card } from '@/components/ui/basics';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime } from '@/lib/format';
import { tasksStore } from '@/lib/tasks-store';
import type { JobTask } from '@/lib/types';

/** The job's checklist: tap to tick off, type at the bottom to add. */
export function JobChecklistTab({
  jobId,
  tasks,
  author,
}: {
  jobId: string;
  tasks: JobTask[];
  /** Stamped against whatever the user ticks off. */
  author: string;
}) {
  const { colors } = useTheme();
  const [newTask, setNewTask] = useState('');

  const done = tasks.filter((task) => task.done).length;

  const addTask = () => {
    if (!newTask.trim()) return;
    void tasksStore.add(jobId, newTask);
    setNewTask('');
  };

  return (
    <View style={{ gap: Spacing.sm }}>
      <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
        {tasks.length === 0
          ? 'Add the steps this job needs.'
          : `${done} of ${tasks.length} done`}
      </Text>
      <Card style={{ padding: 0 }}>
        {tasks.map((task, index) => (
          <Pressable
            key={task.id}
            onPress={() => void tasksStore.toggle(jobId, task.id, author)}
            style={({ pressed }) => [
              styles.row,
              index > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              },
              pressed && { backgroundColor: colors.cardPressed },
            ]}>
            <Ionicons
              name={task.done ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={task.done ? colors.success : colors.textMuted}
            />
            <View style={{ flex: 1, gap: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  color: task.done ? colors.textSecondary : colors.text,
                  textDecorationLine: task.done ? 'line-through' : 'none',
                }}>
                {task.label}
              </Text>
              {task.done && task.done_at ? (
                <Text style={{ fontSize: 11, color: colors.textMuted }}>
                  {task.done_by ?? 'Team member'} · {formatDateTime(task.done_at)}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))}
        <View
          style={[
            styles.row,
            tasks.length > 0 && {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.border,
            },
          ]}>
          <Ionicons name="add-circle-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={newTask}
            onChangeText={setNewTask}
            placeholder="Add a task..."
            placeholderTextColor={colors.textMuted}
            style={{ flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 }}
            onSubmitEditing={addTask}
            returnKeyType="done"
          />
        </View>
      </Card>
    </View>
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
