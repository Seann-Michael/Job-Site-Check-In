import { Ionicons } from '@expo/vector-icons';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card } from '@/components/ui/basics';
import { Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime, notify } from '@/lib/format';
import { jobExtras, type JobNote, type VoiceNote } from '@/lib/job-extras';

function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

type FeedEntry =
  | { kind: 'text'; note: JobNote }
  | { kind: 'voice'; note: VoiceNote };

/**
 * The job's Notes feed: typed notes and voice notes together, newest
 * first, every entry stamped with author + date + time.
 */
export function NotesSection({
  jobId,
  notes,
  voiceNotes,
  author,
}: {
  jobId: string;
  notes: JobNote[];
  voiceNotes: VoiceNote[];
  author: string;
}) {
  const { colors } = useTheme();
  const [newNote, setNewNote] = useState('');
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 500);
  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRecording = recorderState.isRecording;

  // Leaving the screen mid-recording: stop and reset the audio session, or
  // iOS keeps routing playback through the quiet earpiece afterwards.
  useEffect(() => {
    return () => {
      try {
        if (recorder.isRecording) void recorder.stop();
      } catch {
        // Recorder already released.
      }
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(
        () => undefined,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const feed = useMemo<FeedEntry[]>(() => {
    const entries: FeedEntry[] = [
      ...notes.map((note) => ({ kind: 'text' as const, note })),
      ...voiceNotes.map((note) => ({ kind: 'voice' as const, note })),
    ];
    return entries.sort((a, b) => (a.note.created_at < b.note.created_at ? 1 : -1));
  }, [notes, voiceNotes]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    await jobExtras.addNote(jobId, newNote, author);
    setNewNote('');
  };

  const startRecording = async () => {
    if (busy) return;
    if (Platform.OS === 'web') {
      notify('Not on web', 'Voice notes record on your phone (iOS/Android).');
      return;
    }
    setBusy(true);
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        notify('Microphone needed', 'Allow microphone access to record voice notes.');
        return;
      }
      player.pause();
      setPlayingId(null);
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) {
      notify('Could not record', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const stopRecording = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const durationMs = recorderState.durationMillis ?? 0;
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (recorder.uri) {
        await jobExtras.addVoiceNote(jobId, recorder.uri, durationMs, author);
        notify('Voice note saved', 'Added to the notes feed.');
      }
    } catch (error) {
      notify('Could not save', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const togglePlay = (note: VoiceNote) => {
    if (playingId === note.id && playerStatus.playing) {
      player.pause();
      setPlayingId(null);
      return;
    }
    try {
      player.replace({ uri: note.uri });
      player.seekTo(0);
      player.play();
      setPlayingId(note.id);
    } catch {
      notify('Could not play', 'This recording could not be opened.');
    }
  };

  return (
    <Section title={`Notes (${feed.length})`}>
      <Card style={{ padding: 0 }}>
        <View style={styles.inputRow}>
          <Ionicons name="create-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={newNote}
            onChangeText={setNewNote}
            placeholder="Add a note about this job..."
            placeholderTextColor={colors.textMuted}
            style={{ flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 }}
            onSubmitEditing={() => void handleAddNote()}
            returnKeyType="done"
          />
          <Pressable
            hitSlop={8}
            onPress={() => void (isRecording ? stopRecording() : startRecording())}>
            <Ionicons
              name={isRecording ? 'stop-circle' : 'mic-outline'}
              size={22}
              color={isRecording ? colors.danger : colors.textSecondary}
            />
          </Pressable>
          <Pressable hitSlop={8} onPress={() => void handleAddNote()} disabled={!newNote.trim()}>
            <Ionicons
              name="arrow-up-circle"
              size={22}
              color={newNote.trim() ? colors.primary : colors.textMuted}
            />
          </Pressable>
        </View>

        {isRecording ? (
          <View
            style={[
              styles.inputRow,
              { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
            ]}>
            <Ionicons name="mic" size={18} color={colors.danger} />
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.text }}>
              Recording… {fmtDuration(recorderState.durationMillis ?? 0)}
            </Text>
            <Pressable hitSlop={8} onPress={() => void stopRecording()}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.danger }}>Stop</Text>
            </Pressable>
          </View>
        ) : null}

        {feed.map((entry) => (
          <View
            key={entry.note.id}
            style={[
              styles.noteRow,
              { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
            ]}>
            {entry.kind === 'voice' ? (
              <Pressable hitSlop={8} onPress={() => togglePlay(entry.note)}>
                <Ionicons
                  name={
                    playingId === entry.note.id && playerStatus.playing
                      ? 'pause-circle'
                      : 'play-circle'
                  }
                  size={28}
                  color={colors.primary}
                />
              </Pressable>
            ) : null}
            <View style={{ flex: 1, gap: 2 }}>
              {entry.kind === 'text' ? (
                <Text style={{ fontSize: 14, color: colors.text }}>{entry.note.text}</Text>
              ) : (
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                  Voice note · {fmtDuration(entry.note.duration_ms)}
                </Text>
              )}
              <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                {(entry.kind === 'text' ? entry.note.author : entry.note.author) || 'Team member'}
                {' · '}
                {formatDateTime(entry.note.created_at)}
              </Text>
            </View>
            <Pressable
              hitSlop={8}
              onPress={() => {
                if (entry.kind === 'voice') {
                  if (playingId === entry.note.id) {
                    player.pause();
                    setPlayingId(null);
                  }
                  void jobExtras.deleteVoiceNote(jobId, entry.note.id);
                } else {
                  void jobExtras.deleteNote(jobId, entry.note.id);
                }
              }}>
              <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
            </Pressable>
          </View>
        ))}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md - 2,
  },
});
