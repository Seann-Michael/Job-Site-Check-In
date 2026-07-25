import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useRef, useState } from 'react';
import {
  PanResponder,
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
  const [working, setWorking] = useState<'share' | 'save' | null>(null);

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

  const setDraftBoth = (shape: Shape | null) => {
    draftRef.current = shape;
    setDraft(shape);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
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
            if (text) {
              setShapes((current) => [
                ...current,
                { kind: 'text', x, y, text, color: currentColor },
              ]);
            }
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
            fill={shape.color}
            stroke="#00000055"
            strokeWidth={0.5}
            fontSize={22}
            fontWeight="bold">
            {shape.text}
          </SvgText>
        );
    }
  };

  const capture = async (): Promise<{ uri: string; base64: string } | null> => {
    if (Platform.OS === 'web') {
      notify('Not on web', 'Annotation export works on your phone (iOS/Android).');
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

  return (
    <Screen>
      <DetailHeader
        title="Annotate"
        actions={[
          { icon: 'arrow-undo-outline', onPress: () => setShapes((s) => s.slice(0, -1)) },
          { icon: 'trash-outline', onPress: () => setShapes([]) },
        ]}
      />

      {item?.uri ? (
        <>
          <Section
            title={
              tool === 'text'
                ? 'Type below, then tap the photo to place it'
                : 'Draw directly on the photo'
            }>
            <View ref={shotRef} collapsable={false} style={styles.shot}>
              <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
                <Svg style={StyleSheet.absoluteFill}>
                  {shapes.map((shape, index) => renderShape(shape, `s-${index}`))}
                  {draft ? renderShape(draft, 'draft') : null}
                </Svg>
              </View>
            </View>
          </Section>

          {tool === 'text' ? (
            <Card style={styles.textCard}>
              <Ionicons name="text-outline" size={18} color={colors.textMuted} />
              <TextInput
                value={textDraft}
                onChangeText={setTextDraft}
                placeholder="Label text (e.g. Leak here)"
                placeholderTextColor={colors.textMuted}
                style={{ flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 }}
              />
            </Card>
          ) : null}

          <View style={styles.toolRow}>
            {TOOLS.map((entry) => (
              <Pressable
                key={entry.value}
                onPress={() => setTool(entry.value)}
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
  shot: {
    width: '100%',
    aspectRatio: 4 / 3,
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
});
