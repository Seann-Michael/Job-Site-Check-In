import { Ionicons } from '@expo/vector-icons';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type FlashMode,
} from 'expo-camera';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/basics';
import { Radius, Spacing } from '@/constants/theme';
import { notify } from '@/lib/format';
import {
  getLocationFix,
  openAppSettings,
  saveCameraPhoto,
  saveCameraVideo,
  type GeoFix,
} from '@/lib/media-capture';
import { getMediaPrefs, setMediaPrefs, type MediaPrefs } from '@/lib/media-prefs';
import { useAuth } from '@/providers/auth-provider';
import type { MediaCategory } from '@/lib/types';

const ZOOMS: { label: string; value: number }[] = [
  { label: '1x', value: 0 },
  { label: '2x', value: 0.12 },
  { label: '4x', value: 0.3 },
];

type AspectRatio = 'full' | '4:3' | '1:1';
const ASPECTS: AspectRatio[] = ['full', '4:3', '1:1'];

const WALKTHRU_STEPS = [
  'Front of the property',
  'Left side',
  'Right side',
  'Back / yard',
  'Problem areas up close',
];

/** Center-crop a captured photo to the selected aspect ratio. */
async function cropToAspect(
  photo: { uri: string; width: number; height: number },
  aspect: AspectRatio,
): Promise<{ uri: string; width: number; height: number }> {
  if (aspect === 'full' || !photo.width || !photo.height) return photo;
  const target = aspect === '1:1' ? 1 : 3 / 4; // portrait 4:3 => w/h = 0.75
  const current = photo.width / photo.height;
  let width = photo.width;
  let height = photo.height;
  if (current > target) width = Math.round(photo.height * target);
  else height = Math.round(photo.width / target);
  const originX = Math.round((photo.width - width) / 2);
  const originY = Math.round((photo.height - height) / 2);
  try {
    const result = await ImageManipulator.manipulateAsync(
      photo.uri,
      [{ crop: { originX, originY, width, height } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
    );
    return { uri: result.uri, width: result.width, height: result.height };
  } catch {
    return photo;
  }
}

const CATEGORIES: { value: MediaCategory; label: string }[] = [
  { value: 'before', label: 'Before' },
  { value: 'progress', label: 'Progress' },
  { value: 'after', label: 'After' },
  { value: 'final', label: 'Final' },
];

/**
 * CompanyCam-style in-app camera: stays open for rapid multi-shot capture,
 * with the job name, category chips, flash, and a running shot counter in
 * the viewfinder. Every shot flows through the normal pipeline (stamps,
 * GPS, upload or offline queue).
 */
export default function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { jobId, jobTitle, category: categoryParam, preview, mode: modeParam } =
    useLocalSearchParams<{
      jobId: string;
      jobTitle?: string;
      category?: string;
      preview?: string;
      mode?: string;
    }>();
  // Web can't run the native camera; preview=1 renders the UI over a
  // placeholder viewfinder (used by the design previews).
  const previewMode = Platform.OS === 'web' && preview === '1';
  const { user, initializing } = useAuth();

  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [mode, setMode] = useState<'photo' | 'video' | 'walkthru'>(
    modeParam === 'video' ? 'video' : 'photo',
  );
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [aspect, setAspect] = useState<AspectRatio>('full');
  const [levelOn, setLevelOn] = useState(false);
  const [roll, setRoll] = useState(0);
  const [walkStep, setWalkStep] = useState(0);

  // Level indicator: roll from the accelerometer while enabled.
  useEffect(() => {
    if (!levelOn || previewMode) return;
    Accelerometer.setUpdateInterval(120);
    const subscription = Accelerometer.addListener(({ x, y }) => {
      setRoll((Math.atan2(x, y) * 180) / Math.PI);
    });
    return () => subscription.remove();
  }, [levelOn, previewMode]);
  const [category, setCategory] = useState<MediaCategory>(
    (categoryParam as MediaCategory) || 'progress',
  );
  const [flash, setFlash] = useState<FlashMode>('off');
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [shotCount, setShotCount] = useState(0);
  const [queuedCount, setQueuedCount] = useState(0);
  const [lastShotUri, setLastShotUri] = useState<string | null>(null);
  const [snapping, setSnapping] = useState(false);
  const [flashOverlay, setFlashOverlay] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [showGrid, setShowGrid] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState<MediaPrefs | null>(null);

  useEffect(() => {
    void getMediaPrefs().then(setPrefs);
  }, []);

  const togglePref = (key: 'stampTimestamp' | 'stampGps' | 'stampBusiness' | 'stampLogo') => {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    void setMediaPrefs({ [key]: next[key] });
  };

  const cameraRef = useRef<CameraView>(null);
  const geoRef = useRef<GeoFix | undefined>(undefined);
  const savingRef = useRef(0);
  const [lastPhotoId, setLastPhotoId] = useState<string | null>(null);

  // Recording timer.
  useEffect(() => {
    if (!recording) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => clearInterval(interval);
  }, [recording]);

  // One GPS fix per camera session (refreshed silently in the background).
  useEffect(() => {
    let alive = true;
    void getMediaPrefs().then((prefs) => {
      if (!prefs.attachGps) return;
      void getLocationFix().then((fix) => {
        if (alive) geoRef.current = fix;
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  if (Platform.OS === 'web' && !previewMode) {
    return (
      <View style={[styles.root, styles.center, { padding: Spacing.xl }]}>
        <Ionicons name="camera-outline" size={44} color="#5A6B85" />
        <Text style={styles.webText}>
          The in-app camera runs on your phone (iOS/Android). On the web preview, use Add media →
          Choose from gallery instead.
        </Text>
        <Button label="Go back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  if (!permission && !previewMode) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  if (!previewMode && permission && !permission.granted) {
    return (
      <View style={[styles.root, styles.center, { padding: Spacing.xl, gap: Spacing.lg }]}>
        <Ionicons name="camera-outline" size={44} color="#5A6B85" />
        <Text style={styles.webText}>
          Camera access is needed to take job photos. Enable it in Settings.
        </Text>
        <Button label="Open Settings" onPress={openAppSettings} />
        <Button label="Go back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const takePhoto = async () => {
    if (!cameraRef.current || snapping || !jobId) return;
    setSnapping(true);
    setFlashOverlay(true);
    setTimeout(() => setFlashOverlay(false), 120);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, exif: true });
      if (!photo?.uri) return;
      const framed = await cropToAspect(
        { uri: photo.uri, width: photo.width ?? 0, height: photo.height ?? 0 },
        aspect,
      );
      setLastShotUri(framed.uri);
      setShotCount((count) => count + 1);
      // Save in the background so the shutter is ready again immediately.
      savingRef.current += 1;
      void saveCameraPhoto(
        jobId,
        jobTitle ?? '',
        category,
        {
          ...framed,
          exif: (photo.exif ?? undefined) as Record<string, unknown> | undefined,
        },
        geoRef.current,
      )
        .then((result) => {
          if (result.item) setLastPhotoId(result.item.id);
          if (result.queued) setQueuedCount((count) => count + 1);
          else if (result.error) {
            setShotCount((count) => Math.max(0, count - 1));
            notify('Not saved', result.error);
          }
        })
        .finally(() => {
          savingRef.current = Math.max(0, savingRef.current - 1);
        });
    } catch (error) {
      notify('Could not capture', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSnapping(false);
    }
  };

  const toggleRecord = async () => {
    if (!cameraRef.current || !jobId) return;
    if (recording) {
      cameraRef.current.stopRecording();
      return;
    }
    if (micPermission && !micPermission.granted) {
      const response = await requestMicPermission();
      if (!response.granted) {
        notify('Microphone needed', 'Videos record without sound unless mic access is allowed.');
      }
    }
    setRecording(true);
    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: 120 });
      if (video?.uri) {
        setShotCount((count) => count + 1);
        setLastShotUri(null);
        const result = await saveCameraVideo(jobId, jobTitle ?? '', category, video, geoRef.current);
        if (result.queued) setQueuedCount((count) => count + 1);
        else if (result.error) {
          setShotCount((count) => Math.max(0, count - 1));
          notify('Not saved', result.error);
        }
      }
    } catch (error) {
      notify('Could not record', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setRecording(false);
    }
  };

  const openLastShot = () => {
    if (lastPhotoId) {
      router.push({ pathname: '/annotate', params: { mediaId: lastPhotoId } });
    }
  };

  const finish = () => {
    router.back();
  };

  return (
    <View style={styles.root}>
      {previewMode ? (
        <View style={[StyleSheet.absoluteFill, styles.previewViewfinder]}>
          <Ionicons name="videocam-outline" size={54} color="#31445C" />
          <Text style={styles.previewLabel}>Live viewfinder (on your phone)</Text>
        </View>
      ) : (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flash}
          zoom={zoom}
          mode={mode === 'video' ? 'video' : 'picture'}
        />
      )}
      {showGrid ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.gridLine, { left: '33.3%', width: 1, top: 0, bottom: 0 }]} />
          <View style={[styles.gridLine, { left: '66.6%', width: 1, top: 0, bottom: 0 }]} />
          <View style={[styles.gridLine, { top: '33.3%', height: 1, left: 0, right: 0 }]} />
          <View style={[styles.gridLine, { top: '66.6%', height: 1, left: 0, right: 0 }]} />
        </View>
      ) : null}
      {levelOn ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.levelWrap]}>
          <View
            style={[
              styles.levelLine,
              {
                transform: [{ rotate: `${-roll}deg` }],
                backgroundColor: Math.abs(roll) < 2 ? '#34D399' : '#FFFFFF90',
              },
            ]}
          />
        </View>
      ) : null}
      {flashOverlay ? <View style={[StyleSheet.absoluteFill, styles.flashOverlay]} /> : null}

      {/* Top bar: close, job name, flash + flip */}
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable onPress={finish} hitSlop={10} style={styles.roundButton}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={styles.jobChip}>
          <Ionicons name="briefcase-outline" size={12} color="#FFFFFF" />
          <Text style={styles.jobChipText} numberOfLines={1}>
            {jobTitle || 'Job photos'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <Pressable
            onPress={() => setFlash((mode) => (mode === 'off' ? 'on' : mode === 'on' ? 'auto' : 'off'))}
            hitSlop={10}
            style={styles.roundButton}>
            <Ionicons
              name={flash === 'off' ? 'flash-off-outline' : 'flash-outline'}
              size={20}
              color={flash === 'off' ? '#FFFFFF' : '#FBBF24'}
            />
            {flash === 'auto' ? <Text style={styles.flashAuto}>A</Text> : null}
          </Pressable>
          <Pressable
            onPress={() => setFacing((side) => (side === 'back' ? 'front' : 'back'))}
            hitSlop={10}
            style={styles.roundButton}>
            <Ionicons name="camera-reverse-outline" size={20} color="#FFFFFF" />
          </Pressable>
          <Pressable
            onPress={() => setShowSettings((open) => !open)}
            hitSlop={10}
            style={styles.roundButton}>
            <Ionicons name="settings-outline" size={19} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {/* Quick camera settings, CompanyCam-style */}
      {showSettings && prefs ? (
        <View style={[styles.settingsSheet, { top: insets.top + 64 }]}>
          {(
            [
              { key: 'aspect', label: `Aspect ${aspect === 'full' ? 'Full' : aspect}`, icon: 'crop-outline', on: aspect !== 'full' },
              { key: 'grid', label: 'Display Grid', icon: 'grid-outline', on: showGrid },
              { key: 'level', label: 'Display Level', icon: 'analytics-outline', on: levelOn },
              { key: 'stampTimestamp', label: 'Stamp Date/Time', icon: 'time-outline', on: prefs.stampTimestamp },
              { key: 'stampGps', label: 'Stamp Lat/Long', icon: 'location-outline', on: prefs.stampGps },
              { key: 'stampBusiness', label: 'Stamp Business', icon: 'business-outline', on: prefs.stampBusiness },
              { key: 'stampLogo', label: 'Stamp Logo', icon: 'image-outline', on: prefs.stampLogo },
            ] as const
          ).map((tile) => (
            <Pressable
              key={tile.key}
              onPress={() => {
                if (tile.key === 'grid') setShowGrid((current) => !current);
                else if (tile.key === 'level') setLevelOn((current) => !current);
                else if (tile.key === 'aspect') {
                  setAspect(
                    (current) => ASPECTS[(ASPECTS.indexOf(current) + 1) % ASPECTS.length],
                  );
                } else togglePref(tile.key);
              }}
              style={[styles.settingsTile, tile.on && styles.settingsTileOn]}>
              <Ionicons name={tile.icon} size={20} color={tile.on ? '#FFFFFF' : '#AFC0D6'} />
              <Text style={[styles.settingsTileText, tile.on && { color: '#FFFFFF' }]}>
                {tile.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Bottom: category chips, shutter row */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.lg }]}>
        {recording ? (
          <View style={styles.recordPill}>
            <View style={styles.recordDot} />
            <Text style={styles.recordText}>
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
            </Text>
          </View>
        ) : null}
        {queuedCount > 0 ? (
          <View style={styles.queuedPill}>
            <Ionicons name="cloud-offline-outline" size={12} color="#FBBF24" />
            <Text style={styles.queuedText}>
              {queuedCount} saved offline — uploads when back online
            </Text>
          </View>
        ) : null}

        {mode === 'walkthru' ? (
          <Pressable
            onPress={() => setWalkStep((step) => (step + 1) % WALKTHRU_STEPS.length)}
            style={styles.walkPill}>
            <Text style={styles.walkStep}>
              {walkStep + 1}/{WALKTHRU_STEPS.length}
            </Text>
            <Text style={styles.walkText}>{WALKTHRU_STEPS[walkStep]}</Text>
            <Ionicons name="chevron-forward" size={15} color="#FFFFFF" />
          </Pressable>
        ) : null}

        <View style={styles.zoomRow}>
          {ZOOMS.map((entry) => (
            <Pressable
              key={entry.label}
              onPress={() => setZoom(entry.value)}
              style={[styles.zoomChip, zoom === entry.value && styles.zoomChipOn]}>
              <Text style={[styles.zoomText, zoom === entry.value && styles.zoomTextOn]}>
                {entry.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.categoryRow}>
          {CATEGORIES.map((entry) => (
            <Pressable
              key={entry.value}
              onPress={() => setCategory(entry.value)}
              style={[styles.categoryChip, category === entry.value && styles.categoryChipOn]}>
              <Text
                style={[
                  styles.categoryText,
                  category === entry.value && styles.categoryTextOn,
                ]}>
                {entry.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.shutterRow}>
          <Pressable onPress={openLastShot} style={styles.thumbSlot} disabled={!lastPhotoId}>
            {lastShotUri ? (
              <Image source={{ uri: lastShotUri }} style={styles.thumb} contentFit="cover" />
            ) : null}
            {lastShotUri && lastPhotoId ? (
              <View style={styles.editHint}>
                <Ionicons name="pencil" size={10} color="#FFFFFF" />
              </View>
            ) : null}
            {shotCount > 0 ? (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{shotCount}</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            onPress={() => void (mode === 'photo' ? takePhoto() : toggleRecord())}
            disabled={snapping}
            style={({ pressed }) => [styles.shutterOuter, pressed && { opacity: 0.8 }]}>
            {mode !== 'photo' ? (
              recording ? (
                <View style={styles.stopSquare} />
              ) : (
                <View style={styles.recordInner} />
              )
            ) : (
              <View style={[styles.shutterInner, snapping && { backgroundColor: '#D1D5DB' }]} />
            )}
          </Pressable>

          <Pressable onPress={finish} style={styles.doneButton}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.modeRow}>
          {(['photo', 'video', 'walkthru'] as const).map((entry) => (
            <Pressable
              key={entry}
              disabled={recording}
              onPress={() => {
                setMode(entry);
                if (entry === 'walkthru') setWalkStep(0);
              }}
              style={[styles.modeChip, mode === entry && styles.modeChipOn]}>
              <Text style={[styles.modeText, mode === entry && styles.modeTextOn]}>
                {entry.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#05070B',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  webText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
  flashOverlay: {
    backgroundColor: '#FFFFFF',
    opacity: 0.7,
  },
  previewViewfinder: {
    backgroundColor: '#101B2A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  previewLabel: {
    color: '#31445C',
    fontSize: 13,
    fontWeight: '600',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: '#FFFFFF40',
  },
  settingsSheet: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: '#0D1420F2',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  settingsTile: {
    width: '31.5%',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1B2637',
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: 4,
  },
  settingsTileOn: {
    backgroundColor: '#0697E0',
  },
  settingsTileText: {
    color: '#AFC0D6',
    fontSize: 10.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  zoomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  zoomChip: {
    backgroundColor: '#00000080',
    borderRadius: Radius.full,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomChipOn: {
    backgroundColor: '#0697E0',
  },
  zoomText: {
    color: '#D7DEE9',
    fontSize: 12,
    fontWeight: '700',
  },
  zoomTextOn: {
    color: '#FFFFFF',
  },
  recordPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#00000090',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },
  recordDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  recordText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  recordInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EF4444',
  },
  stopSquare: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#EF4444',
  },
  editHint: {
    position: 'absolute',
    left: -5,
    bottom: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0697E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  modeChip: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: 5,
  },
  modeChipOn: {
    backgroundColor: '#1B2637',
  },
  modeText: {
    color: '#8FA3BC',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  modeTextOn: {
    color: '#FFFFFF',
  },
  levelWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelLine: {
    width: 180,
    height: 2,
    borderRadius: 1,
  },
  walkPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0D1420E6',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
  },
  walkStep: {
    color: '#7DD3FC',
    fontSize: 12,
    fontWeight: '800',
  },
  walkText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: '#00000080',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashAuto: {
    position: 'absolute',
    right: 6,
    bottom: 5,
    color: '#FBBF24',
    fontSize: 9,
    fontWeight: '800',
  },
  jobChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#00000080',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
  },
  jobChipText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
    maxWidth: 180,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  queuedPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#00000090',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },
  queuedText: {
    color: '#FBBF24',
    fontSize: 11.5,
    fontWeight: '600',
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  categoryChip: {
    backgroundColor: '#00000080',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryChipOn: {
    backgroundColor: '#0697E0',
    borderColor: '#FFFFFF55',
  },
  categoryText: {
    color: '#D7DEE9',
    fontSize: 12.5,
    fontWeight: '700',
  },
  categoryTextOn: {
    color: '#FFFFFF',
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  thumbSlot: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: '#00000060',
    overflow: 'visible',
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  countBadge: {
    position: 'absolute',
    top: -7,
    right: -7,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0697E0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
  },
  doneButton: {
    width: 52,
    alignItems: 'center',
  },
  doneText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
