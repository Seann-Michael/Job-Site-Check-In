import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import { PixelRatio, StyleSheet, Text, View } from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';

import { getMediaPrefs, type StampPosition } from '@/lib/media-prefs';

interface StampRequest {
  uri: string;
  width: number;
  height: number;
  /** Overlay lines, first is emphasized (business name). */
  lines: string[];
  emphasizeFirst: boolean;
  /** Optional logo. */
  logoUri?: string;
  /** Where the logo sits; defaults to the saved `stampPosition` preference. */
  logoPosition?: StampPosition;
}

interface PendingJob {
  request: StampRequest;
  resolve: (uri: string | null) => void;
}

let enqueueJob: ((job: PendingJob) => void) | null = null;

/**
 * Burn overlay text (timestamp / GPS / business name) into a photo by
 * rendering it offscreen and snapshotting the result. Resolves null when no
 * host is mounted (web) so callers fall back to the unstamped image.
 */
export async function stampImage(request: StampRequest): Promise<string | null> {
  if (!enqueueJob) return null;
  const logoPosition = request.logoPosition ?? (await getMediaPrefs()).stampPosition;
  if (!enqueueJob) return null;
  return new Promise((resolve) => {
    enqueueJob?.({ request: { ...request, logoPosition }, resolve });
  });
}

/**
 * Overlay metrics (font sizes, insets, logo box) are authored against this
 * width and scaled to whatever the render size ends up being, so the stamp
 * keeps the same proportions on every photo size.
 */
const DESIGN_WIDTH = 480;

/**
 * Ceiling on the exported pixel width. Only 'original' captures are large
 * enough to be downscaled by it.
 */
const MAX_CAPTURE_WIDTH = 2048;

/**
 * Ceiling on the exported pixel *area*, because width alone does not bound
 * memory on a tall photo.
 *
 * Android's ViewShot backs a capture with `Bitmap.createBitmap(w, h,
 * ARGB_8888)` at the view's pixel size — 4 bytes per pixel — and holds
 * captured bitmaps in a static reusable set, so they are not reclaimed
 * promptly. Stamping runs on every capture while any stamp is enabled, so an
 * unbounded size is an OOM on low-RAM devices.
 *
 * 6,300,000 px x 4 bytes = ~24 MB per bitmap, and the budget is sized so the
 * common camera ratios clear it at full width: a 4:3 portrait is 2048 x 2731 =
 * 5,591,552 px (~22 MB) and a 3:2 portrait is 2048 x 3072 = 6,291,456 px
 * (~25 MB), which is the tallest shape that still exports at MAX_CAPTURE_WIDTH.
 * Anything taller has its width reduced to stay inside the budget: a 16:9
 * portrait lands at sqrt(6,300,000 / 1.778) ~= 1882 px wide.
 */
const MAX_CAPTURE_PIXELS = 6_300_000;

const VERTICAL_ALIGN: Record<string, 'flex-start' | 'center' | 'flex-end'> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
};

const HORIZONTAL_ALIGN: Record<string, 'flex-start' | 'center' | 'flex-end'> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
};

/** Height/width ratio of the source photo; defaults to 4:3 landscape. */
function aspectRatio(request: StampRequest): number {
  return request.height > 0 && request.width > 0 ? request.height / request.width : 0.75;
}

/** Pixel width of the exported snapshot for a job, bounded by both budgets. */
function exportWidth(request: StampRequest): number {
  const requested = Math.min(request.width || DESIGN_WIDTH, MAX_CAPTURE_WIDTH);
  // w * (w * aspect) <= MAX_CAPTURE_PIXELS  =>  w <= sqrt(MAX / aspect)
  const budgeted = Math.sqrt(MAX_CAPTURE_PIXELS / aspectRatio(request));
  return Math.max(1, Math.floor(Math.min(requested, budgeted)));
}

/** Mount once at the app root; renders stamp jobs offscreen. */
export function StampHost() {
  const [job, setJob] = useState<PendingJob | null>(null);
  const queue = useRef<PendingJob[]>([]);
  const shotRef = useRef<View>(null);

  useEffect(() => {
    enqueueJob = (next) => {
      queue.current.push(next);
      setJob((current) => current ?? queue.current.shift() ?? null);
    };
    return () => {
      enqueueJob = null;
    };
  }, []);

  const finish = (uri: string | null) => {
    job?.resolve(uri);
    setJob(queue.current.shift() ?? null);
  };

  const handleLoaded = () => {
    // Give the overlay a frame to settle, then snapshot at export size.
    setTimeout(async () => {
      if (!job) return;
      try {
        const uri = await captureRef(shotRef, {
          format: 'jpg',
          quality: 0.85,
          result: 'tmpfile',
          width: exportWidth(job.request),
        });
        finish(uri);
      } catch {
        finish(null);
      }
    }, 150);
  };

  if (!job) return null;

  const { request } = job;
  const aspect = aspectRatio(request);

  // Snapshots come out at layout-points x device pixel ratio, so lay the view
  // out at target/ratio points: the capture is then 1:1 with the export size
  // instead of being rendered small and upscaled (which softened every stamp).
  // Dividing by the ratio also means the backing bitmap is exactly
  // exportWidth px wide, so the MAX_CAPTURE_PIXELS budget caps it on every
  // density — a 3x device does not silently allocate 9x the memory.
  const renderWidth = exportWidth(request) / (PixelRatio.get() || 1);
  const ui = renderWidth / DESIGN_WIDTH;

  const [vertical, horizontal] = (request.logoPosition ?? 'bottom-right').split('-');
  const inset = 10 * ui;
  const logoWidth = 110 * ui;
  const logoHeight = 44 * ui;

  // The text chips live bottom-left; lift them clear when the logo shares that
  // edge so the two overlays never sit on top of each other.
  const chipsCollide = vertical === 'bottom' && horizontal !== 'right';
  const chipsBottom = chipsCollide ? inset + logoHeight + 6 * ui : inset;

  return (
    <ViewShot
      ref={shotRef}
      style={[styles.offscreen, { width: renderWidth, height: renderWidth * aspect }]}>
      <Image
        source={{ uri: request.uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        onLoad={handleLoaded}
        onError={() => finish(null)}
      />
      <View style={[styles.stampColumn, { left: inset, bottom: chipsBottom, gap: 4 * ui }]}>
        {request.lines.map((line, index) => (
          <View
            key={index}
            style={[
              styles.chip,
              {
                borderRadius: 5 * ui,
                paddingHorizontal: 7 * ui,
                paddingVertical: 3 * ui,
              },
            ]}>
            <Text
              style={[
                styles.chipText,
                { fontSize: 11 * ui },
                request.emphasizeFirst && index === 0 && { fontSize: 13 * ui, fontWeight: '800' },
              ]}>
              {line}
            </Text>
          </View>
        ))}
      </View>
      {request.logoUri ? (
        // A padded absolute-fill flex box, so 'center' works vertically and
        // horizontally — absolute left/top offsets alone cannot centre a view
        // of unknown size in React Native.
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              padding: inset,
              justifyContent: VERTICAL_ALIGN[vertical] ?? 'flex-end',
              alignItems: HORIZONTAL_ALIGN[horizontal] ?? 'flex-end',
            },
          ]}>
          <Image
            source={{ uri: request.logoUri }}
            style={{ width: logoWidth, height: logoHeight }}
            contentFit="contain"
          />
        </View>
      ) : null}
    </ViewShot>
  );
}

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    left: -10000,
    top: 0,
    backgroundColor: '#000',
  },
  stampColumn: {
    position: 'absolute',
    alignItems: 'flex-start',
  },
  chip: {
    backgroundColor: '#000000B0',
  },
  chipText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
