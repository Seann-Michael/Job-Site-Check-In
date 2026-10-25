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
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
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
import {
  DualCameraView,
  isDualCameraSupported,
  type DualCameraCorner,
  type DualCameraHandle,
} from '../../modules/dual-camera/src';

const PIP_CORNERS: DualCameraCorner[] = ['topRight', 'bottomRight', 'bottomLeft', 'topLeft'];

/** Zoom presets, as optical-style factors. Pinch anywhere on the viewfinder for anything in between. */
const ZOOMS: { label: string; value: number }[] = [
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
  { label: '4x', value: 4 },
];
const MAX_ZOOM = 8;
/** expo-camera takes 0–1 of the device's range; this keeps 2x/4x where the eye expects them. */
const toCameraZoom = (factor: number) => Math.min(1, Math.max(0, (factor - 1) * 0.1));

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
  if (aspect === 'full') return photo;
  try {
    // Normalize EXIF orientation first: the camera can report sensor
    // dimensions (landscape) for a portrait JPEG, and the manipulator works
    // on the rotated image — computing the crop on raw dims would misplace
    // it or throw.
    const norm = await ImageManipulator.manipulateAsync(photo.uri, [], {
      compress: 1,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    const { width: w, height: h } = norm;
    if (!w || !h) return photo;
    const portrait = h >= w;
    const target = aspect === '1:1' ? 1 : portrait ? 3 / 4 : 4 / 3; // w/h
    const current = w / h;
    let width = w;
    let height = h;
    if (current > target) width = Math.round(h * target);
    else height = Math.round(w / target);
    const originX = Math.round((w - width) / 2);
    const originY = Math.round((h - height) / 2);
    const result = await ImageManipulator.manipulateAsync(
      norm.uri,
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
  // Walk-through = both cameras at once (rear full-frame, you in a bubble)
  // on phones that can do it; otherwise it is ordinary single-camera video.
  const dualRef = useRef<DualCameraHandle>(null);
  const [dualReady, setDualReady] = useState(false);
  const [dualError, setDualError] = useState<string | null>(null);
  const [pipCorner, setPipCorner] = useState<DualCameraCorner>('topRight');
  const [swapped, setSwapped] = useState(false);

  // Level indicator: roll from the accelerometer while enabled. iOS reports
  // gravity direction (upright => y ≈ -1) while Android reports the reaction
  // force (upright => y ≈ +1) — normalize so level reads 0° on both.
  useEffect(() => {
    if (!levelOn || previewMode) return;
    const sign = Platform.OS === 'ios' ? -1 : 1;
    Accelerometer.setUpdateInterval(120);
    const subscription = Accelerometer.addListener(({ x, y }) => {
      setRoll((Math.atan2(sign * x, sign * y) * 180) / Math.PI);
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
  const [zoom, setZoom] = useState(1);
  const pinchStart = useRef(1);
  const [pinching, setPinching] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState<MediaPrefs | null>(null);

  useEffect(() => {
    void getMediaPrefs().then(setPrefs);
  }, []);

  const togglePref = (key: 'stampTimestamp' | 'stampGps' | 'stampWeather' | 'stampBusiness' | 'stampLogo') => {
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

  // Ask once, native only — re-running on every permission object change
  // re-summons the dialog on Android, and web would pop a browser prompt.
  const askedPermission = useRef(false);
  useEffect(() => {
    if (Platform.OS === 'web' || askedPermission.current) return;
    if (permission && !permission.granted && permission.canAskAgain) {
      askedPermission.current = true;
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

  const dualMode = mode === 'walkthru' && isDualCameraSupported && !dualError && !previewMode;

  // Pinch to zoom, like the stock camera. State updates are cheap enough at
  // gesture rate here, and both viewfinders take a plain number.
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onBegin(() => {
      pinchStart.current = zoom;
      setPinching(true);
    })
    .onUpdate((event) => {
      const next = Math.min(MAX_ZOOM, Math.max(1, pinchStart.current * event.scale));
      setZoom(Math.round(next * 10) / 10);
    })
    .onFinalize(() => setPinching(false));

  const saveRecording = (video: { uri: string; width?: number; height?: number }) => {
    if (!jobId) return;
    setShotCount((count) => count + 1);
    setLastShotUri(null);
    savingRef.current += 1;
    void saveCameraVideo(jobId, jobTitle ?? '', category, video, geoRef.current)
      .then((result) => {
        if (result.queued) setQueuedCount((count) => count + 1);
        else if (result.error) {
          setShotCount((count) => Math.max(0, count - 1));
          notify('Not saved', result.error);
        }
      })
      .finally(() => {
        savingRef.current = Math.max(0, savingRef.current - 1);
      });
  };

  const ensureMic = async () => {
    if (micPermission && !micPermission.granted) {
      const response = await requestMicPermission();
      if (!response.granted) {
        notify('Microphone needed', 'Videos record without sound unless mic access is allowed.');
      }
    }
  };

  const toggleDualRecord = async () => {
    if (!dualRef.current || !jobId) return;
    if (recording) {
      try {
        const video = await dualRef.current.stopRecording();
        setRecording(false);
        if (video?.uri) saveRecording(video);
      } catch (error) {
        setRecording(false);
        notify('Could not save', error instanceof Error ? error.message : 'Try again.');
      }
      return;
    }
    if (!dualReady) {
      notify('One moment', 'Both cameras are still starting.');
      return;
    }
    await ensureMic();
    try {
      await dualRef.current.startRecording();
      setRecording(true);
    } catch (error) {
      notify('Could not record', error instanceof Error ? error.message : 'Try again.');
    }
  };

  const toggleRecord = async () => {
    if (dualMode) return toggleDualRecord();
    if (!cameraRef.current || !jobId) return;
    if (recording) {
      cameraRef.current.stopRecording();
      return;
    }
    await ensureMic();
    setRecording(true);
    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: 120 });
      // Leave "recording" state the moment capture ends — the (possibly
      // slow) save runs in the background like photos do.
      setRecording(false);
      if (video?.uri) saveRecording(video);
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
    // Never navigate away mid-recording — that tears down the camera session
    // and discards the footage. Stop first; the resolved recording saves.
    if (recording) {
      if (dualMode) void toggleDualRecord();
      else cameraRef.current?.stopRecording();
      return;
    }
    if (savingRef.current > 0) {
      notify('Saving in background', 'Your last shots finish saving while you work.');
    }
    // Took something: go straight to Share (it can still be saved to the
    // queue there). Took nothing: just close.
    if (shotCount > 0 && jobId) {
      router.replace({ pathname: '/publish/[id]', params: { id: jobId } });
      return;
    }
    router.back();
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <GestureDetector gesture={pinch}>
      <View style={StyleSheet.absoluteFill}>
      {previewMode ? (
        <View style={[StyleSheet.absoluteFill, styles.previewViewfinder]}>
          <Ionicons name="videocam-outline" size={54} color="#31445C" />
          <Text style={styles.previewLabel}>Live viewfinder (on your phone)</Text>
        </View>
      ) : dualMode ? (
        <DualCameraView
          ref={dualRef}
          style={StyleSheet.absoluteFill}
          pipCorner={pipCorner}
          pipScale={0.3}
          swapped={swapped}
          zoom={zoom}
          torch={flash !== 'off'}
          onReady={() => setDualReady(true)}
          onError={(event) => {
            // Fall back to the single camera rather than a black screen.
            setDualError(event.nativeEvent.message);
            setDualReady(false);
            if (recording) setRecording(false);
            notify('Single camera', event.nativeEvent.message);
          }}
        />
      ) : (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flash}
          zoom={toCameraZoom(zoom)}
          mode={mode === 'photo' ? 'picture' : 'video'}
          enableTorch={mode !== 'photo' && flash !== 'off'}
        />
      )}
      </View>
      </GestureDetector>
      {pinching ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
          <View style={styles.zoomBubble}>
            <Text style={styles.zoomBubbleText}>{zoom.toFixed(1)}x</Text>
          </View>
        </View>
      ) : null}
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
            disabled={recording && !dualMode}
            onPress={() => {
              if (dualMode) setSwapped((value) => !value);
              else setFacing((side) => (side === 'back' ? 'front' : 'back'));
            }}
            hitSlop={10}
            style={[styles.roundButton, recording && !dualMode && { opacity: 0.4 }]}>
            <Ionicons name="camera-reverse-outline" size={20} color="#FFFFFF" />
          </Pressable>
          {dualMode ? (
            <Pressable
              onPress={() =>
                setPipCorner(
                  (corner) => PIP_CORNERS[(PIP_CORNERS.indexOf(corner) + 1) % PIP_CORNERS.length],
                )
              }
              hitSlop={10}
              style={styles.roundButton}>
              <Ionicons name="move-outline" size={20} color="#FFFFFF" />
            </Pressable>
          ) : null}
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
              { key: 'stampWeather', label: 'Stamp Weather', icon: 'partly-sunny-outline', on: prefs.stampWeather },
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
          <Text style={styles.walkHint}>
            {dualMode
              ? recording
                ? 'Recording you and what you’re showing'
                : dualReady
                  ? 'Both cameras on — talk while you show it. Flip swaps, move changes the bubble corner.'
                  : 'Starting both cameras…'
              : isDualCameraSupported
                ? 'Single camera for this clip.'
                : 'Narrated video — this phone records one camera at a time.'}
          </Text>
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
          {ZOOMS.map((entry) => {
            const on = Math.abs(zoom - entry.value) < 0.05;
            const between = !ZOOMS.some((z) => Math.abs(zoom - z.value) < 0.05);
            // The chip nearest a free-pinched zoom shows the live number.
            const nearest = between && ZOOMS.reduce((a, b) => (Math.abs(b.value - zoom) < Math.abs(a.value - zoom) ? b : a)).label === entry.label;
            return (
              <Pressable
                key={entry.label}
                onPress={() => setZoom(entry.value)}
                style={[styles.zoomChip, (on || nearest) && styles.zoomChipOn]}>
                <Text style={[styles.zoomText, (on || nearest) && styles.zoomTextOn]}>
                  {nearest ? `${zoom.toFixed(1)}x` : entry.label}
                </Text>
              </Pressable>
            );
          })}
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
                if (entry === 'walkthru') {
                  setWalkStep(0);
                  setDualError(null);
                } else {
                  setDualReady(false);
                }
              }}
              style={[styles.modeChip, mode === entry && styles.modeChipOn]}>
              <Text style={[styles.modeText, mode === entry && styles.modeTextOn]}>
                {entry.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </GestureHandlerRootView>
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
  zoomBubble: {
    backgroundColor: '#000000A0',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  zoomBubbleText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  walkHint: {
    color: '#D7E3F4',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: 6,
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
