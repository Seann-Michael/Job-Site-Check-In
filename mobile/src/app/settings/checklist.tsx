import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { TaskAssignSheet, type TaskAssignChoice } from '@/components/task-assign-sheet';
import { Badge, Button, Card, EmptyState, Segmented } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/hooks/use-workspace';
import { dataErrors, fetchJobs } from '@/lib/data';
import { formatDate, notify } from '@/lib/format';
import { fetchTeam, type TeamRoster } from '@/lib/team';
import {
  DEFAULT_TASK_LABELS,
  getChecklistTemplate,
  setChecklistTemplate,
  tasksStore,
  type StoredJobTask,
} from '@/lib/tasks-store';
import { useAuth } from '@/providers/auth-provider';

/** Local 'YYYY-MM-DD' for today, for comparing against a task's due date. */
function todayKey(): string {
  const date = new Date();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export default function ChecklistTemplateScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, initializing } = useAuth();
  const { business } = useWorkspace();
  const [tab, setTab] = useState<'template' | 'assignments'>('template');
  const [labels, setLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState('');

  const { data: jobs } = useData(() => fetchJobs());
  // A failed jobs query returns an empty list, which is not an empty workspace.
  const [jobsError, setJobsError] = useState<string | null>(() => dataErrors.get('jobs'));
  useEffect(() => dataErrors.subscribe(() => setJobsError(dataErrors.get('jobs'))), []);
  // Deliberately not `useData`: that fetches once on mount, which here would
  // always capture `business === null` (the workspace resolves a tick later) and
  // pin the screen to the sample roster forever. The roster is scoped to a
  // business, so it is re-fetched whenever that business — or the signed-in
  // user — changes. `undefined` means "still loading", which the assign sheet
  // renders as a spinner rather than as an empty team.
  const [roster, setRoster] = useState<TeamRoster | undefined>(undefined);
  const { data: assignments, refresh: refreshAssignments } = useData(() =>
    tasksStore.getAssignments(),
  );
  // Bumped whenever any checklist changes, so the expanded job reloads too.
  const [version, setVersion] = useState(0);
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const [jobTasks, setJobTasks] = useState<StoredJobTask[] | null>(null);
  // The task the assign sheet is open for.
  const [assigning, setAssigning] = useState<{ jobId: string; task: StoredJobTask } | null>(null);

  useEffect(() => {
    void getChecklistTemplate().then(setLabels);
  }, []);

  // `fetchTeam` never rejects — it falls back to a labelled sample roster — so
  // there is no failure branch to handle here.
  useEffect(() => {
    let cancelled = false;
    setRoster(undefined);
    void fetchTeam(business?.id, user).then((next) => {
      if (!cancelled) setRoster(next);
    });
    return () => {
      cancelled = true;
    };
  }, [business?.id, user]);

  useEffect(
    () =>
      tasksStore.subscribe(() => {
        refreshAssignments();
        setVersion((current) => current + 1);
      }),
    [refreshAssignments],
  );

  useEffect(() => {
    if (!openJobId) {
      setJobTasks(null);
      return;
    }
    let cancelled = false;
    void tasksStore.getTasks(openJobId).then((tasks) => {
      if (!cancelled) setJobTasks(tasks);
    });
    return () => {
      cancelled = true;
    };
  }, [openJobId, version]);

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

  const openJob = (jobId: string) => {
    setJobTasks(null);
    setOpenJobId((current) => (current === jobId ? null : jobId));
  };

  const jobTitle = (jobId: string): string => {
    const job = (jobs ?? []).find((entry) => entry.id === jobId);
    if (job) return job.title;
    return jobs ? 'Job no longer listed' : 'Loading job…';
  };

  const applyAssignment = (choice: TaskAssignChoice) => {
    if (!assigning) return;
    void tasksStore.assign(assigning.jobId, assigning.task.id, {
      member: choice.member ? { id: choice.member.id, name: choice.member.name } : null,
      dueDate: choice.dueDate,
      by: user?.name,
    });
    setAssigning(null);
  };

  const mine = (assignments ?? []).filter((entry) => entry.task.assignee_id === user?.id);
  const today = todayKey();

  return (
    <Screen>
      <DetailHeader title="Checklists" />
      <Segmented
        options={[
          { value: 'template', label: 'Template' },
          { value: 'assignments', label: 'Assignments' },
        ]}
        value={tab}
        onChange={(value) => setTab(value as 'template' | 'assignments')}
      />

      {tab === 'assignments' ? (
        <>
          <Card style={{ gap: Spacing.sm }}>
            <View style={styles.noteRow}>
              <Ionicons name="notifications-off-outline" size={16} color={colors.textMuted} />
              <Text style={{ flex: 1, fontSize: 12.5, color: colors.textSecondary }}>
                Assigning is in-app only. Nobody is notified — this app has no push messaging or
                email sender — so a task is simply marked as theirs.
              </Text>
            </View>
            {roster === undefined ? (
              <View style={styles.noteRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ flex: 1, fontSize: 12.5, color: colors.textSecondary }}>
                  Loading your team…
                </Text>
              </View>
            ) : roster.isDemo ? (
              // The names in the picker are invented. Say so before anyone picks
              // one, not only inside the sheet.
              <View style={styles.noteRow}>
                <Ionicons name="people-outline" size={16} color={colors.warningStrong} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.badgeRow}>
                    <Badge label="Sample team" tone="warning" />
                  </View>
                  <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                    {roster.demoReason ?? 'These are sample teammates, not people on your team.'}
                  </Text>
                </View>
              </View>
            ) : null}
          </Card>

          <Section title={`Assigned to you (${mine.length})`}>
            {mine.length === 0 ? (
              <Card>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  Nothing is assigned to you. This list is built from the checklists this device
                  has loaded, so open a job below to pull its checklist in.
                </Text>
              </Card>
            ) : (
              <Card style={{ padding: 0 }}>
                {mine.map((entry, index) => {
                  const overdue =
                    !entry.task.done && !!entry.task.due_date && entry.task.due_date < today;
                  return (
                    <Pressable
                      key={`${entry.jobId}-${entry.task.id}`}
                      onPress={() => router.push(`/job/${entry.jobId}`)}
                      style={({ pressed }) => [
                        styles.row,
                        index > 0 && {
                          borderTopWidth: StyleSheet.hairlineWidth,
                          borderTopColor: colors.border,
                        },
                        pressed && { backgroundColor: colors.cardPressed },
                      ]}>
                      <Ionicons
                        name={entry.task.done ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={entry.task.done ? colors.success : colors.textMuted}
                      />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text
                          style={{
                            fontSize: 14,
                            color: entry.task.done ? colors.textSecondary : colors.text,
                            textDecorationLine: entry.task.done ? 'line-through' : 'none',
                          }}>
                          {entry.task.label}
                        </Text>
                        <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                          {jobTitle(entry.jobId)}
                          {entry.task.assigned_by ? ` · from ${entry.task.assigned_by}` : ''}
                        </Text>
                      </View>
                      {entry.task.due_date ? (
                        <Badge
                          label={formatDate(entry.task.due_date)}
                          tone={overdue ? 'danger' : 'neutral'}
                        />
                      ) : null}
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </Pressable>
                  );
                })}
              </Card>
            )}
          </Section>

          <Section title="Assign work">
            {jobs === undefined ? (
              <Card style={styles.noteRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Loading jobs…</Text>
              </Card>
            ) : jobs.length === 0 ? (
              jobsError ? (
                <Card style={styles.noteRow}>
                  <Ionicons name="cloud-offline-outline" size={16} color={colors.dangerStrong} />
                  <Text style={{ flex: 1, fontSize: 13, color: colors.textSecondary }}>
                    {jobsError}
                  </Text>
                </Card>
              ) : (
                <EmptyState
                  icon="briefcase-outline"
                  title="No jobs yet"
                  message="Create a job and its checklist tasks can be handed out from here."
                />
              )
            ) : (
              <Card style={{ padding: 0 }}>
                {jobs.map((job, index) => (
                  <View
                    key={job.id}
                    style={
                      index > 0
                        ? {
                            borderTopWidth: StyleSheet.hairlineWidth,
                            borderTopColor: colors.border,
                          }
                        : undefined
                    }>
                    <Pressable
                      onPress={() => openJob(job.id)}
                      style={({ pressed }) => [
                        styles.row,
                        pressed && { backgroundColor: colors.cardPressed },
                      ]}>
                      <Ionicons
                        name={openJobId === job.id ? 'chevron-down' : 'chevron-forward'}
                        size={16}
                        color={colors.textMuted}
                      />
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                          {job.title}
                        </Text>
                        <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                          {job.client_name}
                        </Text>
                      </View>
                    </Pressable>
                    {openJobId === job.id ? (
                      jobTasks === null ? (
                        <View style={[styles.row, styles.nested]}>
                          <ActivityIndicator size="small" color={colors.primary} />
                          <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                            Loading checklist…
                          </Text>
                        </View>
                      ) : (
                        jobTasks.map((task) => (
                          <Pressable
                            key={task.id}
                            onPress={() => setAssigning({ jobId: job.id, task })}
                            style={({ pressed }) => [
                              styles.row,
                              styles.nested,
                              pressed && { backgroundColor: colors.cardPressed },
                            ]}>
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text style={{ fontSize: 13.5, color: colors.text }}>
                                {task.label}
                              </Text>
                              <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                                {task.assignee_name
                                  ? `${task.assignee_name}${task.due_date ? ` · due ${formatDate(task.due_date)}` : ''}`
                                  : 'Unassigned'}
                              </Text>
                            </View>
                            <Ionicons
                              name={task.assignee_id ? 'person' : 'person-add-outline'}
                              size={16}
                              color={task.assignee_id ? colors.primary : colors.textMuted}
                            />
                          </Pressable>
                        ))
                      )
                    ) : null}
                  </View>
                ))}
              </Card>
            )}
          </Section>

          {assigning ? (
            <TaskAssignSheet
              visible
              taskLabel={assigning.task.label}
              roster={roster}
              current={{
                assigneeId: assigning.task.assignee_id,
                assigneeName: assigning.task.assignee_name,
                dueDate: assigning.task.due_date,
              }}
              onSubmit={applyAssignment}
              onClose={() => setAssigning(null)}
            />
          ) : null}
        </>
      ) : (
        <>
          <Text style={{ fontSize: 13, color: colors.textSecondary }}>
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
        </>
      )}
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
  /** A task under its job — indented so the grouping reads at a glance. */
  nested: {
    paddingLeft: Spacing.xxxl,
    paddingVertical: Spacing.sm + 2,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  /** Keeps a Badge at its own width instead of stretching down a column. */
  badgeRow: {
    flexDirection: 'row',
  },
});
