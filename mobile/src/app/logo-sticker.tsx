import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';

import { Button, Card, Segmented } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { useWorkspace } from '@/hooks/use-workspace';
import { fetchMedia } from '@/lib/data';
import { notify } from '@/lib/format';
import { getLogoUri, pickLogo } from '@/lib/logo';
import { captureNotice, savePreparedImage } from '@/lib/media-capture';
import { workspace } from '@/lib/workspace';
import { useAuth } from '@/providers/auth-provider';

const SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

const SIZE_WIDTHS: Record<string, number> = { small: 70, medium: 110, large: 160 };

export default function LogoStickerScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { mediaId } = useLocalSearchParams<{ mediaId: string }>();
  const { user, initializing } = useAuth();
  const { business } = useWorkspace();

  const { data: media } = useData(fetchMedia);
  const item = (media ?? []).find((entry) => entry.id === mediaId);

  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [logoVisible, setLogoVisible] = useState(true);
  const [size, setSize] = useState('medium');
  const [working, setWorking] = useState<'share' | 'save' | null>(null);
  // The logo is stored per business; without one the picker below can't run.
  const [workspaceError, setWorkspaceError] = useState<string | null>(() => workspace.lastError());
  useEffect(() => workspace.subscribe(() => setWorkspaceError(workspace.lastError())), []);

  const shotRef = useRef<View>(null);
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const panOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (business) void getLogoUri(business.id).then(setLogoUri);
  }, [business]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset(panOffset.current);
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_event, gesture) => {
        panOffset.current = {
          x: panOffset.current.x + gesture.dx,
          y: panOffset.current.y + gesture.dy,
        };
        pan.flattenOffset();
      },
    }),
  ).current;

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const blocked = !business;
  const blockedReason = workspaceError ?? 'Still loading your business…';
  /** Blocked *and* we know why — the pre-load gap is not worth alarming about. */
  const loadFailed = blocked && Boolean(workspaceError);

  const handlePickLogo = async () => {
    if (!business) {
      notify('Logo unavailable', blockedReason);
      return;
    }
    const result = await pickLogo(business.id);
    if (result.error) notify('PNG logos only', result.error);
    else if (result.uri) {
      setLogoUri(result.uri);
      if (result.syncError) {
        notify(
          'Logo saved on this device only',
          `Couldn't sync it to your business, so other devices and the web dashboard won't see it. (${result.syncError})`,
        );
      }
    }
  };

  const capture = async (): Promise<{ uri: string; base64: string } | null> => {
    if (Platform.OS === 'web') {
      notify('Not on web', 'Logo sticker export works on your phone (iOS/Android).');
      return null;
    }
    const uri = await captureRef(shotRef, {
      format: 'jpg',
      quality: 0.9,
      result: 'tmpfile',
      width: 1600,
    });
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { uri, base64 };
  };

  const handleShare = async () => {
    if (working) return;
    setWorking('share');
    try {
      const shot = await capture();
      if (shot && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(shot.uri, { mimeType: 'image/jpeg' });
      }
    } catch (error) {
      notify('Could not share', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setWorking(null);
    }
  };

  const handleSave = async () => {
    if (working || !item) return;
    setWorking('save');
    try {
      const shot = await capture();
      if (shot) {
        const result = await savePreparedImage(item.job_id, item.job_title, item.category, {
          uri: shot.uri,
          base64: shot.base64,
          width: 1600,
          height: 1200,
        });
        // `status`, not the presence of a message: a queued item is saved on
        // this device and already in the job — it must never read as lost.
        const notice = captureNotice(result, 'The logo version was added to the job media.');
        notify(notice.title, notice.body);
        if (result.status !== 'failed') router.back();
      }
    } catch (error) {
      notify('Could not save', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setWorking(null);
    }
  };

  return (
    <Screen>
      <DetailHeader title="Logo sticker" />

      {item?.uri ? (
        <>
          <Section title="Drag the logo into place">
            <ViewShot ref={shotRef} style={styles.shot}>
              <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              {logoUri && logoVisible ? (
                <Animated.View
                  {...panResponder.panHandlers}
                  style={[
                    styles.logoWrap,
                    { width: SIZE_WIDTHS[size], height: SIZE_WIDTHS[size] * 0.45 },
                    { transform: pan.getTranslateTransform() },
                  ]}>
                  <Image
                    source={{ uri: logoUri }}
                    style={StyleSheet.absoluteFill}
                    contentFit="contain"
                  />
                </Animated.View>
              ) : null}
            </ViewShot>
          </Section>

          {logoUri ? (
            <>
              <Segmented options={SIZES} value={size} onChange={setSize} />
              <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                <Button
                  label={logoVisible ? 'Remove logo' : 'Add logo'}
                  icon={logoVisible ? 'eye-off-outline' : 'eye-outline'}
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => setLogoVisible((current) => !current)}
                />
                <Button
                  label="Change logo"
                  icon="image-outline"
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => void handlePickLogo()}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                <Button
                  label="Share"
                  icon="share-outline"
                  variant="secondary"
                  style={{ flex: 1 }}
                  loading={working === 'share'}
                  onPress={() => void handleShare()}
                />
                <Button
                  label="Save to job"
                  icon="download-outline"
                  style={{ flex: 1 }}
                  loading={working === 'save'}
                  onPress={() => void handleSave()}
                />
              </View>
            </>
          ) : (
            <Card style={{ alignItems: 'center', gap: Spacing.md }}>
              <Ionicons
                name={
                  loadFailed ? 'cloud-offline-outline' : blocked ? 'hourglass-outline' : 'image-outline'
                }
                size={28}
                color={loadFailed ? colors.dangerStrong : colors.textMuted}
              />
              {/* Without a business we cannot tell "no logo yet" from "we never
                  got to look", so say which one it is rather than blaming the
                  business for an empty logo we never actually read. */}
              <Text
                style={{
                  fontSize: 13.5,
                  color: loadFailed ? colors.dangerStrong : colors.textSecondary,
                  textAlign: 'center',
                }}>
                {blocked
                  ? `${blockedReason} Logos are stored per business, so this one can't be loaded or changed yet.`
                  : `${business?.name ?? 'This business'} doesn't have a logo yet. Add a PNG to start stamping photos.`}
              </Text>
              <Button
                label="Choose PNG logo"
                icon="add"
                disabled={blocked}
                onPress={() => void handlePickLogo()}
              />
            </Card>
          )}
        </>
      ) : (
        <Card>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
            {item
              ? 'This item is a placeholder tile — capture a real photo first.'
              : 'Photo not found.'}
          </Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  shot: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: '#05070B',
  },
  logoWrap: {
    position: 'absolute',
    right: 12,
    bottom: 12,
  },
});
