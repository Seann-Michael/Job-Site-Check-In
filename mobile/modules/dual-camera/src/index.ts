import { requireNativeModule, requireNativeViewManager } from 'expo-modules-core';
import React from 'react';
import { Platform, type ViewProps } from 'react-native';

export type DualCameraCorner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

export type DualCameraRecording = {
  uri: string;
  duration: number;
  width: number;
  height: number;
};

export type DualCameraViewProps = ViewProps & {
  /** Where the small picture sits. */
  pipCorner?: DualCameraCorner;
  /** Small picture width as a fraction of the view width (0.2–0.45). */
  pipScale?: number;
  /** True puts the front camera full-frame and the rear camera in the bubble. */
  swapped?: boolean;
  muted?: boolean;
  torch?: boolean;
  onReady?: () => void;
  onError?: (event: { nativeEvent: { message: string } }) => void;
  onRecordingFinished?: (event: { nativeEvent: DualCameraRecording }) => void;
};

export type DualCameraHandle = {
  startRecording(): Promise<void>;
  stopRecording(): Promise<DualCameraRecording>;
};

type NativeModule = { isSupported: boolean };

let nativeModule: NativeModule | null = null;
let NativeView: React.ComponentType<DualCameraViewProps & { ref?: React.Ref<DualCameraHandle> }> | null = null;

if (Platform.OS === 'ios') {
  try {
    nativeModule = requireNativeModule<NativeModule>('DualCamera');
    NativeView = requireNativeViewManager('DualCamera');
  } catch {
    nativeModule = null;
    NativeView = null;
  }
}

/** iPhone XS / XR and newer on iOS 13+. Android and older phones fall back to one camera. */
export const isDualCameraSupported: boolean = Boolean(nativeModule?.isSupported && NativeView);

export const DualCameraView = React.forwardRef<DualCameraHandle, DualCameraViewProps>(function DualCameraView(props, ref) {
  if (!NativeView) return null;
  return React.createElement(NativeView, { ...props, ref });
});
