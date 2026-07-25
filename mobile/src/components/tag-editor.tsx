import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Chip-style tag list with inline add/remove. */
export function TagEditor({
  tags,
  onChange,
  placeholder = 'Add a tag...',
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');

  const addTag = () => {
    const cleaned = draft.trim().replace(/^#/, '').toLowerCase();
    if (!cleaned) return;
    if (!tags.includes(cleaned)) onChange([...tags, cleaned]);
    setDraft('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.chips}>
        {tags.map((tag) => (
          <View key={tag} style={[styles.chip, { backgroundColor: colors.primarySoft }]}>
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.primaryStrong }}>
              #{tag}
            </Text>
            <Pressable hitSlop={6} onPress={() => onChange(tags.filter((t) => t !== tag))}>
              <Ionicons name="close" size={13} color={colors.primaryStrong} />
            </Pressable>
          </View>
        ))}
      </View>
      <View
        style={[
          styles.inputRow,
          { backgroundColor: colors.input, borderColor: colors.border },
        ]}>
        <Ionicons name="pricetag-outline" size={15} color={colors.textMuted} />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          style={[styles.input, { color: colors.text }]}
          onSubmitEditing={addTag}
          returnKeyType="done"
        />
        <Pressable hitSlop={6} onPress={addTag} disabled={!draft.trim()}>
          <Ionicons
            name="add-circle"
            size={22}
            color={draft.trim() ? colors.primary : colors.textMuted}
          />
        </Pressable>
      </View>
    </View>
  );
}

/** Read-only tag chips. */
export function TagList({ tags }: { tags: string[] }) {
  const { colors } = useTheme();
  if (!tags.length) return null;
  return (
    <View style={styles.chips}>
      {tags.map((tag) => (
        <View key={tag} style={[styles.chip, { backgroundColor: colors.primarySoft }]}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primaryStrong }}>
            #{tag}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 42,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
});
