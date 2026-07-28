import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import React, { useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { TagEditor, TagList } from '@/components/tag-editor';
import { Badge, Button, Card, useToneColors, type IconName, type Tone } from '@/components/ui/basics';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime } from '@/lib/format';
import { documentStatus, jobExtras, type DocumentStatus, type JobDocument } from '@/lib/job-extras';

/**
 * How each sync state looks. A document that never left the phone must not be
 * mistakable for one the office can open, so the state drives the leading icon
 * AND a badge — not a subtlety of colour that a glance in sunlight would miss.
 */
const PRESENTATION: Record<
  DocumentStatus['state'],
  { label: string; tone: Tone; icon: IconName }
> = {
  shared: { label: 'Shared with team', tone: 'success', icon: 'cloud-done-outline' },
  local: { label: 'This device only', tone: 'warning', icon: 'phone-portrait-outline' },
  failed: { label: 'Not uploaded', tone: 'warning', icon: 'cloud-offline-outline' },
  lost: { label: 'File unavailable', tone: 'danger', icon: 'alert-circle-outline' },
};

/**
 * Open one attachment, returning why it could not be opened, or null.
 *
 * Web has no share sheet — `Sharing.shareAsync` rejects there, which the old
 * code swallowed, so tapping a file attached in the browser did nothing at all.
 */
async function openDocument(doc: JobDocument): Promise<string | null> {
  try {
    if (Platform.OS === 'web' || /^https?:/i.test(doc.uri)) {
      await Linking.openURL(doc.uri);
      return null;
    }
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(doc.uri, { mimeType: doc.mime_type });
      return null;
    }
    await Linking.openURL(doc.uri);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message.trim() : '';
    return message || 'This file could not be opened on this device.';
  }
}

/** Contracts, estimates and permits attached to the job. */
export function JobDocumentsTab({
  jobId,
  documents,
  onAdd,
  adding,
}: {
  jobId: string;
  documents: JobDocument[];
  onAdd: () => void;
  adding: boolean;
}) {
  const { colors } = useTheme();

  return (
    <View style={{ gap: Spacing.sm }}>
      {documents.length === 0 ? (
        <Card>
          <Text style={{ fontSize: 13, color: colors.textSecondary }}>
            Attach contracts, estimates, or permits so they are with the job on site.
          </Text>
        </Card>
      ) : (
        <Card style={{ padding: 0 }}>
          {documents.map((doc, index) => (
            <DocumentRow key={doc.id} jobId={jobId} doc={doc} divider={index > 0} />
          ))}
        </Card>
      )}
      <Button
        label="Attach a document"
        icon="add-circle-outline"
        variant="secondary"
        loading={adding}
        onPress={onAdd}
      />
    </View>
  );
}

/**
 * One attachment, told truthfully: where the file actually is, why it is not
 * shared when it is not, and a retry when retrying could change that.
 */
function DocumentRow({
  jobId,
  doc,
  divider,
}: {
  jobId: string;
  doc: JobDocument;
  divider: boolean;
}) {
  const { colors } = useTheme();
  const [tagging, setTagging] = useState(false);
  const [retrying, setRetrying] = useState(false);
  // Whatever went wrong on this row, in this row — a job screen toast would be
  // gone before the tech read it, and there is no toast in this component.
  const [problem, setProblem] = useState<string | null>(null);

  const status: DocumentStatus = documentStatus(doc);
  const look = PRESENTATION[status.state];
  const { fg } = useToneColors(look.tone);

  // The tag and delete buttons sit inside the row's own Pressable. Native picks
  // one responder, but a DOM click bubbles, so on web the row would ALSO fire
  // and open the file the user was deleting. A press on either button claims
  // the next moment for itself.
  const buttonPressedAt = useRef(0);
  const claimPress = () => {
    buttonPressedAt.current = Date.now();
  };

  const handlePress = async () => {
    if (!status.openable || Date.now() - buttonPressedAt.current < 400) return;
    setProblem(await openDocument(doc));
  };

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    setProblem(null);
    const result = await jobExtras.retryDocumentUpload(jobId, doc.id);
    setRetrying(false);
    // Success needs no message: the store emits, this row re-renders, and the
    // badge flips to "Shared with team". Only a second failure needs words.
    if (!result.shared) {
      setProblem(result.error ?? 'The upload still has not gone through.');
    }
  };

  return (
    <View>
      <Pressable
        onPress={() => void handlePress()}
        accessibilityRole="button"
        accessibilityLabel={`${doc.name}. ${look.label}.`}
        style={({ pressed }) => [
          styles.row,
          divider && {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
          },
          pressed && status.openable && { backgroundColor: colors.cardPressed },
        ]}>
        <Ionicons name={look.icon} size={19} color={status.state === 'shared' ? colors.primary : fg} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }} numberOfLines={1}>
            {doc.name}
          </Text>
          <View style={styles.metaRow}>
            <Badge label={look.label} tone={look.tone} />
            <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
              {doc.size > 0 ? `${Math.max(1, Math.round(doc.size / 1024))} KB · ` : ''}
              {formatDateTime(doc.added_at)}
            </Text>
          </View>
          {doc.tags?.length && !tagging ? <TagList tags={doc.tags} /> : null}
        </View>
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Tag ${doc.name}`}
          onPress={() => {
            claimPress();
            setTagging((current) => !current);
          }}>
          <Ionicons
            name="pricetag-outline"
            size={15}
            color={tagging ? colors.primary : colors.textMuted}
          />
        </Pressable>
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${doc.name}`}
          onPress={() => {
            claimPress();
            void jobExtras.deleteDocument(jobId, doc.id);
          }}>
          <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
        </Pressable>
      </Pressable>
      {status.note || problem || status.retryable ? (
        <View style={styles.notice}>
          {status.note ? (
            <View style={styles.noticeLine}>
              <Ionicons name="information-circle-outline" size={13} color={fg} />
              <Text style={{ flex: 1, fontSize: 11.5, lineHeight: 16, color: colors.textSecondary }}>
                {status.note}
              </Text>
            </View>
          ) : null}
          {problem ? (
            <View style={styles.noticeLine}>
              <Ionicons name="warning-outline" size={13} color={colors.danger} />
              <Text style={{ flex: 1, fontSize: 11.5, lineHeight: 16, color: colors.danger }}>
                {problem}
              </Text>
            </View>
          ) : null}
          {status.retryable ? (
            <Button
              label="Retry upload"
              icon="cloud-upload-outline"
              variant="secondary"
              loading={retrying}
              onPress={() => void handleRetry()}
              style={styles.retry}
            />
          ) : null}
        </View>
      ) : null}
      {tagging ? (
        <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md }}>
          <TagEditor
            tags={doc.tags ?? []}
            onChange={(tags) => void jobExtras.setDocumentTags(jobId, doc.id, tags)}
            placeholder="Tag this document..."
          />
        </View>
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm - 2,
  },
  notice: {
    // Lines up under the row's text column, not its icon.
    paddingLeft: Spacing.lg + 19 + Spacing.md,
    paddingRight: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm - 2,
  },
  noticeLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs + 2,
  },
  retry: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    marginTop: 2,
  },
});
