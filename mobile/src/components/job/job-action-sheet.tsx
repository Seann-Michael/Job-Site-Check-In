import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { JobSheet, SheetRow } from '@/components/job/sheet';
import { IconTile } from '@/components/ui/basics';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Every "manage this job" action in one place: edit, both share paths, archive
 * and delete. It replaces the Alert.alert menu the header used to open, which
 * did nothing at all on web — Delete has to be reachable everywhere.
 *
 * Delete confirms in-sheet (a second destructive step) rather than through a
 * multi-button Alert, for the same reason.
 */
export function JobActionSheet({
  visible,
  jobTitle,
  archived,
  mediaCount,
  deleting,
  onClose,
  onEdit,
  onShareDetails,
  onShareGallery,
  onToggleArchive,
  onDelete,
}: {
  visible: boolean;
  jobTitle: string;
  archived: boolean;
  /** Photos/videos this device can see on the job — named in the delete warning. */
  mediaCount: number;
  deleting: boolean;
  onClose: () => void;
  onEdit: () => void;
  onShareDetails: () => void;
  onShareGallery: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const [confirming, setConfirming] = useState(false);

  // Re-opening the sheet must never land straight on the destructive step.
  useEffect(() => {
    if (!visible) setConfirming(false);
  }, [visible]);

  if (confirming) {
    return (
      <JobSheet
        visible={visible}
        title="Delete this job?"
        subtitle={`"${jobTitle}" will be removed for everyone.`}
        closeLabel="Keep job"
        onClose={() => (deleting ? undefined : setConfirming(false))}>
        <View style={[styles.warning, { backgroundColor: colors.dangerSoft }]}>
          <IconTile icon="warning-outline" tone="danger" size={34} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.dangerStrong }}>
              This cannot be undone
            </Text>
            <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
              {mediaCount > 0
                ? `The job and its ${mediaCount} media item${
                    mediaCount === 1 ? '' : 's'
                  } — plus check-ins, notes, documents and the checklist — are removed. There is no undo.`
                : 'The job and its check-ins, notes, documents and checklist are removed. There is no undo.'}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onDelete}
          disabled={deleting}
          style={({ pressed }) => [
            styles.destructive,
            { backgroundColor: colors.danger, opacity: deleting ? 0.7 : 1 },
            pressed && { opacity: 0.85 },
          ]}>
          {deleting ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <>
              <Ionicons name="trash" size={17} color={colors.onPrimary} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.onPrimary }}>
                Delete job permanently
              </Text>
            </>
          )}
        </Pressable>
      </JobSheet>
    );
  }

  return (
    <JobSheet visible={visible} title={jobTitle} subtitle="Manage this job" onClose={onClose}>
      <SheetRow
        icon="create-outline"
        tone="primary"
        label="Edit job"
        sub="Title, customer, address and tags"
        onPress={onEdit}
      />
      <SheetRow
        icon="share-outline"
        label="Share job details"
        sub="Send the address and job link"
        onPress={onShareDetails}
      />
      <SheetRow
        icon="images-outline"
        label="Share photo gallery"
        sub="Create a link the customer can open"
        onPress={onShareGallery}
      />
      <SheetRow
        icon={archived ? 'archive' : 'archive-outline'}
        label={archived ? 'Unarchive job' : 'Archive job'}
        sub={archived ? 'Show it in the job list again' : 'Hide it from the job list'}
        onPress={onToggleArchive}
      />
      <SheetRow
        icon="trash-outline"
        danger
        label="Delete job"
        sub="Removes the job and everything on it"
        onPress={() => setConfirming(true)}
      />
    </JobSheet>
  );
}

const styles = StyleSheet.create({
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  destructive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingVertical: 13,
  },
});
