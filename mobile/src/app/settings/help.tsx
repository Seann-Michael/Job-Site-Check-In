import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, IconTile } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { notify } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';

const APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? '';
const SUPPORT_EMAIL = 'support@localseoranker.com';

const FAQS = [
  {
    q: 'Why do my photos need GPS?',
    a: 'Geotagged photos tied to a job address are strong local SEO signals. The app attaches your location at capture time and stores it with the photo.',
  },
  {
    q: 'What do the photo categories mean?',
    a: 'Before / Progress / After / Final keep job galleries organized and make before-and-after pairs easy to share with customers and on your Google profile.',
  },
  {
    q: 'How does the GMB profile score work?',
    a: 'The scan checks your Google listing for phone, website, photo count, rating, review count, and hours — the score is the share of checks that pass, identical to the web dashboard.',
  },
  {
    q: 'Why does the app say demo mode?',
    a: 'Without Supabase keys in mobile/.env the app runs on sample data. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to connect your real account.',
  },
];

export default function HelpSettingsScreen() {
  const { colors } = useTheme();
  const { user, initializing } = useAuth();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const openKnowledgeBase = () => {
    if (APP_URL) {
      void Linking.openURL(`${APP_URL.replace(/\/$/, '')}/help`);
    } else {
      notify(
        'Knowledge base',
        'Set EXPO_PUBLIC_APP_URL to your deployed web app to open the knowledge base from here.',
      );
    }
  };

  const emailSupport = () => {
    void Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Mobile app support')}`,
    ).catch(() => notify('Email', `Reach us at ${SUPPORT_EMAIL}`));
  };

  return (
    <Screen>
      <DetailHeader title="Help & support" />

      <Section title="Get help">
        <Card style={{ padding: 0 }}>
          <Pressable
            onPress={openKnowledgeBase}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.cardPressed }]}>
            <IconTile icon="book-outline" size={36} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>
                Knowledge base
              </Text>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                Guides and how-tos on the web
              </Text>
            </View>
            <Ionicons name="open-outline" size={16} color={colors.textMuted} />
          </Pressable>
          <Pressable
            onPress={emailSupport}
            style={({ pressed }) => [
              styles.row,
              { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
              pressed && { backgroundColor: colors.cardPressed },
            ]}>
            <IconTile icon="mail-outline" size={36} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>
                Email support
              </Text>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{SUPPORT_EMAIL}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        </Card>
      </Section>

      <Section title="Frequently asked">
        <Card style={{ padding: 0 }}>
          {FAQS.map((faq, index) => {
            const open = openIndex === index;
            return (
              <Pressable
                key={faq.q}
                onPress={() => setOpenIndex(open ? null : index)}
                style={[
                  styles.faqRow,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                ]}>
                <View style={styles.faqHeader}>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.text }}>
                    {faq.q}
                  </Text>
                  <Ionicons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textMuted}
                  />
                </View>
                {open ? (
                  <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary }}>
                    {faq.a}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </Card>
      </Section>

      <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>
        Local SEO Ranker Mobile · v0.1.0
      </Text>
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
  faqRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
});
