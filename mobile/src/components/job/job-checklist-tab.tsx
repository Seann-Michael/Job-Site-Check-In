import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { TaskAssignSheet, type TaskAssignChoice } from '@/components/task-assign-sheet';
import { Card } from '@/components/ui/basics';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatDateTime } from '@/lib/format';
import { tasksStore, type StoredJobTask } from '@/lib/tasks-store';
import type { TeamRoster } from '@/lib/team';

/**
 * The job's checklist: tap to tick off, type at the bottom to add, and hand
 * any task to a teammate from the person chip on its row — the same
 * TaskAssignSheet used in Settings > Checklists, so assignment behaves
 * identically wherever it happens.
 */
export function JobChecklistTab({
  jobId,
  tasks,
  author,
  roster,
}: {
  jobId: string;
  tasks: StoredJobTask[];
  /** Stamped against whatever the user ticks off or assigns. */
  author: string;
  /** From fetchTeam — undefined while loading; the sheet handles that. */
  roster?: TeamRoster;
}) {
  const { colors } = useTheme();
  const [newTask, setNewTask] = useState('');
  const [assigning, setAssigning] = useState<StoredJobTask | null>(null);

  const done = tasks.filter((task) => task.done).length;

  const addTask = () => {
    if (!newTask.trim()) return;
    void tasksStore.add(jobId, newTask);
    setNewTask('');
  };

  const applyAssignment = (choice: TaskAssignChoice) => {
    const task = assigning;
    setAssigning(null);
    if (!task) return;
    void tasksStore.assign(jobId, task.id, {
      member: choice.member,
      dueDate: choice.dueDate,
      by: author,
    });
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
              {!task.done && task.assignee_name ? (
                <Text style={{ fontSize: 11, color: colors.textMuted }}>
                  {task.assignee_name}
                  {task.due_date ? ` · due ${formatDate(task.due_date)}` : ''}
                </Text>
              ) : null}
            </View>
            {/* Its own Pressable so tapping it opens the sheet instead of
                toggling the row. Person icon = unassigned; filled = assigned. */}
            <Pressable
              hitSlop={8}
              onPress={() => setAssigning(task)}
              accessibilityLabel={
                task.assignee_name ? `Assigned to ${task.assignee_name}` : 'Assign this task'
              }>
              <Ionicons
                name={task.assignee_id ? 'person-circle' : 'person-add-outline'}
                size={20}
                color={task.assignee_id ? colors.primary : colors.textMuted}
              />
            </Pressable>
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
      {assigning ? (
        <TaskAssignSheet
          visible
          taskLabel={assigning.label}
          roster={roster}
          current={{
            assigneeId: assigning.assignee_id,
            assigneeName: assigning.assignee_name,
            dueDate: assigning.due_date,
          }}
          onSubmit={applyAssignment}
          onClose={() => setAssigning(null)}
        />
      ) : null}
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
