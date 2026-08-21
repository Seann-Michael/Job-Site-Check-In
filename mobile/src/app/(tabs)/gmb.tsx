import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Badge, Button, Card, IconTile, type IconName, type Tone } from '@/components/ui/basics';
import { Screen, ScreenHeader, Section } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useRole } from '@/hooks/use-role';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { notify } from '@/lib/format';
import {
  connectGmb,
  DEMO_GMB_AUDIT,
  DEMO_GMB_PROFILE,
  fetchGmbData,
  scanGmb,
  type GmbAuditStatus,
} from '@/lib/gmb';
import { jobsStore } from '@/lib/jobs-store';
import { isPlacesConfigured, searchBusinesses, type AddressSuggestion } from '@/lib/places';
import { fetchRecentPosts } from '@/lib/publish';
import { timeAgo } from '@/lib/format';

const AUDIT_ICONS: Record<GmbAuditStatus, { icon: IconName; tone: Tone }> = {
  good: { icon: 'checkmark-circle', tone: 'success' },
  warning: { icon: 'alert-circle', tone: 'warning' },
  critical: { icon: 'close-circle', tone: 'danger' },
};

function AuditList({
  items,
}: {
  items: { id: string; title: string; description: string; status: GmbAuditStatus }[];
}) {
  const { colors } = useTheme();
  return (
    <Card style={{ padding: 0 }}>
      {items.map((item, index) => {
        const config = AUDIT_ICONS[item.status];
        const iconColor =
          config.tone === 'success'
            ? colors.success
            : config.tone === 'warning'
              ? colors.warning
              : colors.danger;
        return (
          <View
            key={item.id}
            style={[
              styles.auditRow,
              index > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              },
            ]}>
            <Ionicons name={config.icon} size={20} color={iconColor} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                {item.title}
              </Text>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                {item.description}
              </Text>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

function ProfileCard({
  name,
  category,
  rating,
  reviewCount,
  photoCount,
  score,
  badge,
  onScan,
  scanning,
}: {
  name: string;
  category: string;
  rating: number | null;
  reviewCount: number;
  photoCount: number;
  score: number;
  badge: { label: string; tone: Tone };
  onScan?: () => void;
  scanning?: boolean;
}) {
  const { colors } = useTheme();
  const scoreColor = score >= 80 ? colors.success : score >= 60 ? colors.warning : colors.danger;
  const scoreTone: Tone = score >= 80 ? 'success' : score >= 60 ? 'warning' : 'danger';
  return (
    <Card style={{ gap: Spacing.lg }}>
      <View style={styles.profileRow}>
        <IconTile icon="storefront" size={46} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[Typography.h2, { color: colors.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[Typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
            {category}
          </Text>
        </View>
        <Badge label={badge.label} tone={badge.tone} />
      </View>

      {/* Bold score block + completeness bar. */}
      <View style={[styles.scoreBlock, { backgroundColor: colors.cardPressed }]}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={[Typography.eyebrow, { color: colors.textMuted }]}>PROFILE SCORE</Text>
          <View style={[styles.scoreTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.scoreFill,
                { backgroundColor: scoreColor, width: `${Math.min(100, Math.max(0, score))}%` },
              ]}
            />
          </View>
          <Text style={[Typography.caption, { color: colors.textSecondary }]}>
            {score >= 80 ? 'Looking strong' : score >= 60 ? 'A few gaps to close' : 'Needs attention'}
          </Text>
        </View>
        <View style={styles.scoreNumberWrap}>
          <Text style={[Typography.display, { color: scoreColor }]}>{score}</Text>
          <Text style={[Typography.caption, { color: colors.textMuted }]}>/ 100</Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <View style={styles.metricValueRow}>
            <Ionicons name="star" size={15} color={colors.star} />
            <Text style={[Typography.h1, { color: colors.text }]}>
              {rating != null ? rating.toFixed(1) : '—'}
            </Text>
          </View>
          <Text style={[Typography.caption, { color: colors.textSecondary }]}>
            {reviewCount} reviews
          </Text>
        </View>
        <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
        <View style={styles.metric}>
          <Text style={[Typography.h1, { color: colors.text }]}>{photoCount}</Text>
          <Text style={[Typography.caption, { color: colors.textSecondary }]}>photos</Text>
        </View>
        <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
        <View style={styles.metric}>
          <Badge label={score >= 80 ? 'Healthy' : 'Improve'} tone={scoreTone} />
        </View>
      </View>

      {onScan ? (
        <Button
          label={scanning ? 'Syncing…' : 'Sync from Google'}
          icon="sync"
          loading={scanning}
          fullWidth
          onPress={onScan}
        />
      ) : null}
    </Card>
  );
}

function QuickActions({
  items,
}: {
  items: { icon: IconName; label: string; sub: string; tab: string }[];
}) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View style={styles.actionsGrid}>
      {items.map((action) => (
        <Card
          key={action.label}
          style={styles.actionCard}
          onPress={() => router.push({ pathname: '/gmb-manage', params: { tab: action.tab } })}>
          <IconTile icon={action.icon} size={36} />
          <View style={{ gap: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
              {action.label}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{action.sub}</Text>
          </View>
        </Card>
      ))}
    </View>
  );
}

/** Entry point to the Google Business Profile posts manager. */
function GooglePostsCard() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Card style={styles.postsCard} onPress={() => router.push('/gmb-posts')}>
      <IconTile icon="megaphone-outline" size={40} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
          Google posts
        </Text>
        <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
          See what is live on Google — edit, delete, or publish with a photo
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Card>
  );
}

/** Entry point to Google reviews (Business Profile API) with replies. */
function GoogleReviewsCard() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Card style={styles.postsCard} onPress={() => router.push('/gmb-reviews')}>
      <IconTile icon="star-outline" size={40} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
          Google reviews
        </Text>
        <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
          Read what customers wrote and reply from your phone
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Card>
  );
}

function RecentPosts() {
  const { colors } = useTheme();
  const { data: posts, refresh } = useData(fetchRecentPosts);
  useEffect(() => jobsStore.subscribe(refresh), [refresh]);

  if (!posts?.length) return null;
  return (
    <Section title="Recent posts">
      <Card style={{ padding: 0 }}>
        {posts.map((post, index) => (
          <View
            key={post.id}
            style={[
              styles.postRow,
              index > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              },
            ]}>
            <Ionicons name="megaphone-outline" size={17} color={colors.primary} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text
                style={{ fontSize: 13.5, fontWeight: '600', color: colors.text }}
                numberOfLines={1}>
                {post.title}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                {post.platform.toUpperCase()} · {timeAgo(post.created_at)}
              </Text>
            </View>
            <Badge
              label={post.status}
              tone={
                post.status === 'published'
                  ? 'success'
                  : post.status === 'failed'
                    ? 'danger'
                    : 'primary'
              }
            />
          </View>
        ))}
      </Card>
    </Section>
  );
}

export default function GmbScreen() {
  const { colors } = useTheme();
  const { isViewer, canWrite } = useRole();
  const { data, loading, refreshing, refresh } = useData(fetchGmbData);

  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);

  // Debounced business search for the connect flow.
  useEffect(() => {
    if (!isPlacesConfigured || search.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const results = await searchBusinesses(search);
      if (!cancelled) setSuggestions(results);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  const handleScan = async () => {
    if (data?.mode !== 'connected' || scanning) return;
    setScanning(true);
    const result = await scanGmb(data.profile);
    setScanning(false);
    if (result.error) {
      notify('Scan failed', result.error);
      return;
    }
    refresh();
    notify('Profile scanned', 'Audit refreshed from Google — score updated.');
  };

  const handleConnect = async (suggestion: AddressSuggestion) => {
    if (connecting) return;
    setSuggestions([]);
    setSearch(suggestion.description);
    setConnecting(true);
    const result = await connectGmb(suggestion.placeId);
    setConnecting(false);
    if (result.error) {
      notify('Could not connect', result.error);
      return;
    }
    setSearch('');
    refresh();
    notify('Profile connected', 'Your Google Business Profile is connected and audited.');
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title="GMB Profile" subtitle="Google Business Profile" readOnly={isViewer} />

      {loading || !data ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xxl }} />
      ) : data.mode === 'demo' ? (
        <>
          <ProfileCard
            name={DEMO_GMB_PROFILE.name}
            category={DEMO_GMB_PROFILE.category}
            rating={DEMO_GMB_PROFILE.rating}
            reviewCount={DEMO_GMB_PROFILE.review_count}
            photoCount={DEMO_GMB_PROFILE.photo_count}
            score={DEMO_GMB_PROFILE.score}
            badge={{ label: 'Demo', tone: 'warning' }}
          />
          <Section title="Manage">
            <QuickActions
              items={[
                { icon: 'time-outline', label: 'Hours', sub: 'Mon–Sat', tab: 'hours' },
                { icon: 'help-circle-outline', label: 'Q&A', sub: '2 answered', tab: 'qa' },
                { icon: 'pricetag-outline', label: 'Categories', sub: '1 primary, 2 more', tab: 'categories' },
                { icon: 'list-outline', label: 'Services', sub: '4 listed', tab: 'services' },
              ]}
            />
          </Section>
          <Section title="Audit checklist">
            <AuditList
              items={DEMO_GMB_AUDIT.map((item) => ({
                id: item.id,
                title: item.label,
                description: item.detail,
                status:
                  item.status === 'pass' ? 'good' : item.status === 'warn' ? 'warning' : 'critical',
              }))}
            />
          </Section>
          <GooglePostsCard />

          <GoogleReviewsCard />

          <RecentPosts />
          <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>
            Demo data — connect Supabase to see your real profile.
          </Text>
        </>
      ) : data.mode === 'disconnected' ? (
        <Card style={{ gap: Spacing.md }}>
          <View style={styles.profileRow}>
            <IconTile icon="storefront-outline" size={44} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.businessName, { color: colors.text }]}>
                Connect your profile
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                Search your business on Google to connect and audit it.
              </Text>
            </View>
          </View>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={
              isPlacesConfigured
                ? 'Search your business name...'
                : 'Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to search'
            }
            editable={isPlacesConfigured && !connecting && canWrite}
            placeholderTextColor={colors.textMuted}
            style={[
              styles.searchInput,
              { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
            ]}
          />
          {connecting ? <ActivityIndicator color={colors.primary} /> : null}
          {suggestions.length > 0 ? (
            <View style={[styles.suggestions, { borderColor: colors.border }]}>
              {suggestions.map((suggestion, index) => (
                <Pressable
                  key={suggestion.placeId}
                  onPress={() => handleConnect(suggestion)}
                  style={({ pressed }) => [
                    styles.suggestionRow,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    },
                    pressed && { backgroundColor: colors.cardPressed },
                  ]}>
                  <Ionicons name="storefront-outline" size={15} color={colors.textMuted} />
                  <Text style={{ flex: 1, fontSize: 13.5, color: colors.text }} numberOfLines={1}>
                    {suggestion.description}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </Card>
      ) : (
        <>
          <ProfileCard
            name={data.profile.business_name}
            category={data.profile.address ?? ''}
            rating={data.profile.rating}
            reviewCount={data.profile.review_count}
            photoCount={data.profile.photos?.length ?? 0}
            score={data.profile.overall_score}
            badge={{ label: 'Connected', tone: 'success' }}
            onScan={isPlacesConfigured && canWrite ? handleScan : undefined}
            scanning={scanning}
          />
          <Section title="Manage">
            <QuickActions
              items={[
                { icon: 'time-outline', label: 'Hours', sub: `${data.counts.hours} entries`, tab: 'hours' },
                { icon: 'help-circle-outline', label: 'Q&A', sub: `${data.counts.qas} questions`, tab: 'qa' },
                {
                  icon: 'pricetag-outline',
                  label: 'Categories',
                  sub: `${data.counts.categories} set`,
                  tab: 'categories',
                },
                { icon: 'list-outline', label: 'Services', sub: `${data.counts.services} listed`, tab: 'services' },
              ]}
            />
          </Section>
          {data.audit.length > 0 ? (
            <Section title="Audit checklist">
              <AuditList items={data.audit} />
            </Section>
          ) : null}
          <GooglePostsCard />

          <GoogleReviewsCard />

          <RecentPosts />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '700',
  },
  scoreBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  scoreNumberWrap: {
    alignItems: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  metricLabel: {
    fontSize: 12,
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
  },
  scoreTrack: {
    height: 8,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  actionCard: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: Spacing.md,
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  searchInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    fontSize: 15,
  },
  suggestions: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md - 2,
  },
  postsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
});
