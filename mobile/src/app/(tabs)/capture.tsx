import { Redirect } from 'expo-router';

/** The Capture tab is a button, not a screen; a direct hit lands on the picker. */
export default function CaptureTab() {
  return <Redirect href="/capture-picker" />;
}
