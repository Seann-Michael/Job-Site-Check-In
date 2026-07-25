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
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/basics';
import { Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { notify, timeAgo } from '@/lib/format';
import { jobExtras, type VoiceNote } from '@/lib/job-extras';

function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Record + play back voice notes on a job. */
export function VoiceNotes({ jobId, notes }: { jobId: string; notes: VoiceNote[] }) {
  const { colors } = useTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 500);
  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRecording = recorderState.isRecording;

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
        await jobExtras.addVoiceNote(jobId, recorder.uri, durationMs);
        notify('Voice note saved', 'Attached to this job.');
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
    <Section
      title={`Voice notes (${notes.length})`}
      action={
        <Pressable
          hitSlop={8}
          onPress={() => void (isRecording ? stopRecording() : startRecording())}>
          <Ionicons
            name={isRecording ? 'stop-circle' : 'mic-circle'}
            size={24}
            color={isRecording ? colors.danger : colors.primary}
          />
        </Pressable>
      }>
      {isRecording ? (
        <Card style={[styles.row, { borderColor: colors.danger, borderWidth: 1 }]}>
          <Ionicons name="mic" size={18} color={colors.danger} />
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.text }}>
            Recording… {fmtDuration(recorderState.durationMillis ?? 0)}
          </Text>
          <Pressable hitSlop={8} onPress={() => void stopRecording()}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.danger }}>Stop</Text>
          </Pressable>
        </Card>
      ) : notes.length === 0 ? (
        <Card>
          <Text style={{ fontSize: 13, color: colors.textSecondary }}>
            Talk instead of type — tap the mic to record a note in the field.
          </Text>
        </Card>
      ) : null}

      {notes.length > 0 ? (
        <Card style={{ padding: 0 }}>
          {notes.map((note, index) => {
            const isPlaying = playingId === note.id && playerStatus.playing;
            return (
              <View
                key={note.id}
                style={[
                  styles.row,
                  styles.noteRow,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                ]}>
                <Pressable hitSlop={8} onPress={() => togglePlay(note)}>
                  <Ionicons
                    name={isPlaying ? 'pause-circle' : 'play-circle'}
                    size={30}
                    color={colors.primary}
                  />
                </Pressable>
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                    Voice note · {fmtDuration(note.duration_ms)}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                    {timeAgo(note.created_at)}
                  </Text>
                </View>
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    if (playingId === note.id) {
                      player.pause();
                      setPlayingId(null);
                    }
                    void jobExtras.deleteVoiceNote(jobId, note.id);
                  }}>
                  <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
                </Pressable>
              </View>
            );
          })}
        </Card>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  noteRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md - 2,
  },
});
