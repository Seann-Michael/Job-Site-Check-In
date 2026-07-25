import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';

interface StampRequest {
  uri: string;
  width: number;
  height: number;
  /** Overlay lines, first is emphasized (business name). */
  lines: string[];
  emphasizeFirst: boolean;
  /** Optional logo placed bottom-right. */
  logoUri?: string;
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
export function stampImage(request: StampRequest): Promise<string | null> {
  if (!enqueueJob) return Promise.resolve(null);
  return new Promise((resolve) => {
    enqueueJob?.({ request, resolve });
  });
}

const RENDER_WIDTH = 480;

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
          width: Math.min(job.request.width || RENDER_WIDTH, 2048),
        });
        finish(uri);
      } catch {
        finish(null);
      }
    }, 150);
  };

  if (!job) return null;

  const { request } = job;
  const aspect = request.height > 0 && request.width > 0 ? request.height / request.width : 0.75;

  return (
    <ViewShot
      ref={shotRef}
      style={[styles.offscreen, { width: RENDER_WIDTH, height: RENDER_WIDTH * aspect }]}>
      <Image
        source={{ uri: request.uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        onLoad={handleLoaded}
        onError={() => finish(null)}
      />
      <View style={styles.stampColumn}>
        {request.lines.map((line, index) => (
          <View key={index} style={styles.chip}>
            <Text
              style={[
                styles.chipText,
                request.emphasizeFirst && index === 0 && styles.chipTextBold,
              ]}>
              {line}
            </Text>
          </View>
        ))}
      </View>
      {request.logoUri ? (
        <Image source={{ uri: request.logoUri }} style={styles.logo} contentFit="contain" />
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
    left: 10,
    bottom: 10,
    gap: 4,
    alignItems: 'flex-start',
  },
  chip: {
    backgroundColor: '#000000B0',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  chipTextBold: {
    fontSize: 13,
    fontWeight: '800',
  },
  logo: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 110,
    height: 44,
  },
});
