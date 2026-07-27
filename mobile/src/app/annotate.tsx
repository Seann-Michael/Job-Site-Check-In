import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useRef, useState } from 'react';
import {
  PanResponder,
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Ellipse, Line, Path, Polygon, Text as SvgText } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

import { Button, Card } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { fetchMedia } from '@/lib/data';
import { notify } from '@/lib/format';
import { savePreparedImage } from '@/lib/media-capture';
import { useAuth } from '@/providers/auth-provider';

type Tool = 'draw' | 'arrow' | 'circle' | 'text';

type Shape =
  | { kind: 'path'; d: string; color: string }
  | { kind: 'arrow'; x1: number; y1: number; x2: number; y2: number; color: string }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; color: string }
  | { kind: 'text'; x: number; y: number; text: string; color: string };

const COLORS = ['#EF4444', '#FBBF24', '#0697E0', '#FFFFFF'];

const TOOLS: { value: Tool; icon: string; label: string }[] = [
  { value: 'draw', icon: 'pencil-outline', label: 'Draw' },
  { value: 'arrow', icon: 'arrow-forward-outline', label: 'Arrow' },
  { value: 'circle', icon: 'ellipse-outline', label: 'Circle' },
  { value: 'text', icon: 'text-outline', label: 'Text' },
];

const STROKE = 4;
const TEXT_SIZE = 22;
/** Keeps placed labels clear of the rounded corners / clipped edges of the frame. */
const TEXT_INSET = 10;
/** Longest edge of the exported image. */
const CAPTURE_LONG_EDGE = 1600;
/** Frame ratio used until the source image reports its own dimensions. */
const FALLBACK_ASPECT = 4 / 3;
/** Stops a tall portrait frame from pushing the tools off a small screen. */
const MAX_FRAME_HEIGHT = 380;

/**
 * Text is drawn centred on the tap (anchor 'middle' plus a baseline nudge) and
 * clamped inside the frame — SVG clips anything outside it, so an unclamped
 * label tapped near an edge simply vanished.
 */
function placeText(
  x: number,
  y: number,
  text: string,
  frame: { width: number; height: number },
): { x: number; y: number } {
  const baseline = y + TEXT_SIZE * 0.35;
  if (frame.width <= 0 || frame.height <= 0) return { x, y: baseline };
  // ~0.55em per character is close enough for bold system text at this size.
  const halfWidth = (text.length * TEXT_SIZE * 0.55) / 2;
  const minX = TEXT_INSET + halfWidth;
  const maxX = frame.width - TEXT_INSET - halfWidth;
  const minY = TEXT_INSET + TEXT_SIZE * 0.85;
  const maxY = frame.height - TEXT_INSET;
  return {
    x: maxX < minX ? frame.width / 2 : Math.min(Math.max(x, minX), maxX),
    y: maxY < minY ? frame.height / 2 : Math.min(Math.max(baseline, minY), maxY),
  };
}

function arrowHead(x1: number, y1: number, x2: number, y2: number): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 14;
  const left = {
    x: x2 - size * Math.cos(angle - Math.PI / 7),
    y: y2 - size * Math.sin(angle - Math.PI / 7),
  };
  const right = {
    x: x2 - size * Math.cos(angle + Math.PI / 7),
    y: y2 - size * Math.sin(angle + Math.PI / 7),
  };
  return `${x2},${y2} ${left.x},${left.y} ${right.x},${right.y}`;
}

export default function AnnotateScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { mediaId } = useLocalSearchParams<{ mediaId: string }>();
  const { user, initializing } = useAuth();

  const { data: media } = useData(fetchMedia);
  const item = (media ?? []).find((entry) => entry.id === mediaId);

  const [tool, setTool] = useState<Tool>('draw');
  const [color, setColor] = useState(COLORS[0]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [textDraft, setTextDraft] = useState('');
  const [textHint, setTextHint] = useState<string | null>(null);
  const [working, setWorking] = useState<'share' | 'save' | null>(null);
  // Source aspect ratio, so a portrait photo is not saved centre-cropped.
  const [aspect, setAspect] = useState(FALLBACK_ASPECT);
  const [available, setAvailable] = useState(0);

  const shotRef = useRef<View>(null);
  // Refs so the PanResponder (created once) always sees current tool/color.
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const colorRef = useRef(color);
  colorRef.current = color;
  const textRef = useRef(textDraft);
  textRef.current = textDraft;
  const startRef = useRef({ x: 0, y: 0 });
  const pointsRef = useRef('');
  const draftRef = useRef<Shape | null>(null);
  const frameRef = useRef({ width: 0, height: 0 });

  const setDraftBoth = (shape: Shape | null) => {
    draftRef.current = shape;
    setDraft(shape);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // The frame lives inside Screen's ScrollView: without these two the
      // ScrollView steals the responder mid-stroke and the page scrolls away.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (event) => {
        const { locationX: x, locationY: y } = event.nativeEvent;
        startRef.current = { x, y };
        const currentColor = colorRef.current;
        switch (toolRef.current) {
          case 'draw':
            pointsRef.current = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
            setDraftBoth({ kind: 'path', d: pointsRef.current, color: currentColor });
            break;
          case 'arrow':
            setDraftBoth({ kind: 'arrow', x1: x, y1: y, x2: x, y2: y, color: currentColor });
            break;
          case 'circle':
            setDraftBoth({ kind: 'ellipse', cx: x, cy: y, rx: 1, ry: 1, color: currentColor });
            break;
          case 'text': {
            const text = textRef.current.trim();
            if (!text) {
              // Used to be a bare `break` — the tap looked like a dead button.
              setTextHint('Type your label in the box above first, then tap the photo.');
              break;
            }
            const spot = placeText(x, y, text, frameRef.current);
            setShapes((current) => [
              ...current,
              { kind: 'text', x: spot.x, y: spot.y, text, color: currentColor },
            ]);
            // Clear the buffer so the next tap does not stamp the same label again.
            textRef.current = '';
            setTextDraft('');
            setTextHint(null);
            break;
          }
        }
      },
      onPanResponderMove: (event) => {
        const { locationX: x, locationY: y } = event.nativeEvent;
        const start = startRef.current;
        const currentColor = colorRef.current;
        switch (toolRef.current) {
          case 'draw':
            pointsRef.current += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
            setDraftBoth({ kind: 'path', d: pointsRef.current, color: currentColor });
            break;
          case 'arrow':
            setDraftBoth({
              kind: 'arrow',
              x1: start.x,
              y1: start.y,
              x2: x,
              y2: y,
              color: currentColor,
            });
            break;
          case 'circle':
            setDraftBoth({
              kind: 'ellipse',
              cx: (start.x + x) / 2,
              cy: (start.y + y) / 2,
              rx: Math.max(2, Math.abs(x - start.x) / 2),
              ry: Math.max(2, Math.abs(y - start.y) / 2),
              color: currentColor,
            });
            break;
          case 'text':
            break;
        }
      },
      onPanResponderRelease: () => {
        const finished = draftRef.current;
        if (finished) setShapes((current) => [...current, finished]);
        setDraftBoth(null);
      },
      // Same commit path as release: a stroke cut short by another responder
      // used to stay on screen forever without ever being added to `shapes`.
      onPanResponderTerminate: () => {
        const finished = draftRef.current;
        if (finished) setShapes((current) => [...current, finished]);
        setDraftBoth(null);
      },
    }),
  ).current;

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const renderShape = (shape: Shape, key: string) => {
    switch (shape.kind) {
      case 'path':
        return (
          <Path
            key={key}
            d={shape.d}
            stroke={shape.color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        );
      case 'arrow':
        return (
          <React.Fragment key={key}>
            <Line
              x1={shape.x1}
              y1={shape.y1}
              x2={shape.x2}
              y2={shape.y2}
              stroke={shape.color}
              strokeWidth={STROKE}
              strokeLinecap="round"
            />
            <Polygon points={arrowHead(shape.x1, shape.y1, shape.x2, shape.y2)} fill={shape.color} />
          </React.Fragment>
        );
      case 'ellipse':
        return (
          <Ellipse
            key={key}
            cx={shape.cx}
            cy={shape.cy}
            rx={shape.rx}
            ry={shape.ry}
            stroke={shape.color}
            strokeWidth={STROKE}
            fill="none"
          />
        );
      case 'text':
        return (
          <SvgText
            key={key}
            x={shape.x}
            y={shape.y}
            textAnchor="middle"
            fill={shape.color}
            stroke="#00000055"
            strokeWidth={0.5}
            fontSize={TEXT_SIZE}
            fontWeight="bold">
            {shape.text}
          </SvgText>
        );
    }
  };

  const capture = async (): Promise<{
    uri: string;
    base64: string;
    width: number;
    height: number;
  } | null> => {
    if (Platform.OS === 'web') {
      notify('Not on web', 'Annotation export works on your phone (iOS/Android).');
      return null;
    }
    // Export at the source ratio — a fixed 1600x1200 squashed portrait photos.
    const width = aspect >= 1 ? CAPTURE_LONG_EDGE : Math.round(CAPTURE_LONG_EDGE * aspect);
    const height = aspect >= 1 ? Math.round(CAPTURE_LONG_EDGE / aspect) : CAPTURE_LONG_EDGE;
    // iOS treats these as layout points and renders at the screen scale, so a
    // 1200x1600 request became 3600x4800 pixels on a 3x phone. Ask for
    // points = pixels / ratio there; Android's resize is already in pixels.
    // (The same points-vs-pixels correction is applied in stamp-host.tsx.)
    const ratio = Platform.OS === 'ios' ? PixelRatio.get() || 1 : 1;
    const uri = await captureRef(shotRef, {
      format: 'jpg',
      quality: 0.9,
      result: 'tmpfile',
      width: Math.round(width / ratio),
      height: Math.round(height / ratio),
    });
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { uri, base64, width, height };
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
          width: shot.width,
          height: shot.height,
        });
        if (result.error) notify('Could not save', result.error);
        else {
          notify('Saved', 'The annotated version was added to the job media.');
          router.back();
        }
      }
    } catch (error) {
      notify('Could not save', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setWorking(null);
    }
  };

  const frameWidth = available > 0 ? Math.min(available, MAX_FRAME_HEIGHT * aspect) : 0;
  // Explicit size (rather than aspectRatio alone) so a tall portrait frame stays
  // inside MAX_FRAME_HEIGHT without letterboxing the exported image.
  const frameStyle =
    frameWidth > 0
      ? { width: frameWidth, height: frameWidth / aspect }
      : { width: '100%' as const, aspectRatio: aspect };

  return (
    <Screen avoidKeyboard>
      <DetailHeader
        title="Annotate"
        actions={[
          { icon: 'arrow-undo-outline', onPress: () => setShapes((s) => s.slice(0, -1)) },
          { icon: 'trash-outline', onPress: () => setShapes([]) },
        ]}
      />

      {item?.uri ? (
        <>
          {/* Above the photo: below it the field sits under the keyboard. */}
          {tool === 'text' ? (
            <View style={{ gap: Spacing.xs }}>
              <Card style={styles.textCard}>
                <Ionicons name="text-outline" size={18} color={colors.textMuted} />
                <TextInput
                  value={textDraft}
                  onChangeText={(value) => {
                    setTextDraft(value);
                    if (textHint) setTextHint(null);
                  }}
                  placeholder="Label text (e.g. Leak here)"
                  placeholderTextColor={colors.textMuted}
                  style={{ flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 }}
                />
              </Card>
              {textHint ? (
                <Text style={[styles.textHint, { color: colors.warningStrong }]}>{textHint}</Text>
              ) : null}
            </View>
          ) : null}

          <Section
            title={
              tool === 'text'
                ? 'Tap the photo to place your label'
                : 'Draw directly on the photo'
            }>
            <View
              style={styles.frameWrap}
              onLayout={(event) => setAvailable(event.nativeEvent.layout.width)}>
              <View
                ref={shotRef}
                collapsable={false}
                style={[styles.shot, frameStyle]}
                onLayout={(event) => {
                  const { width, height } = event.nativeEvent.layout;
                  frameRef.current = { width, height };
                }}>
                <Image
                  source={{ uri: item.uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                  onLoad={(event) => {
                    const { width, height } = event.source;
                    if (width > 0 && height > 0) setAspect(width / height);
                  }}
                />
                <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
                  <Svg style={StyleSheet.absoluteFill}>
                    {shapes.map((shape, index) => renderShape(shape, `s-${index}`))}
                    {draft ? renderShape(draft, 'draft') : null}
                  </Svg>
                </View>
              </View>
            </View>
          </Section>

          <View style={styles.toolRow}>
            {TOOLS.map((entry) => (
              <Pressable
                key={entry.value}
                onPress={() => {
                  setTool(entry.value);
                  setTextHint(null);
                }}
                style={[
                  styles.toolButton,
                  {
                    backgroundColor: tool === entry.value ? colors.primarySoft : colors.card,
                    borderColor: tool === entry.value ? colors.primary : colors.border,
                  },
                ]}>
                <Ionicons
                  name={entry.icon as never}
                  size={17}
                  color={tool === entry.value ? colors.primaryStrong : colors.textSecondary}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: tool === entry.value ? colors.primaryStrong : colors.textSecondary,
                  }}>
                  {entry.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.colorRow}>
            {COLORS.map((entry) => (
              <Pressable
                key={entry}
                onPress={() => setColor(entry)}
                style={[
                  styles.swatch,
                  { backgroundColor: entry },
                  color === entry && { borderWidth: 3, borderColor: colors.primary },
                ]}
              />
            ))}
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
  frameWrap: {
    width: '100%',
    alignItems: 'center',
  },
  shot: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: '#05070B',
  },
  toolRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  toolButton: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm + 2,
  },
  colorRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    justifyContent: 'center',
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#00000030',
  },
  textCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  textHint: {
    fontSize: 12.5,
    fontWeight: '600',
    paddingHorizontal: Spacing.xs,
  },
});
