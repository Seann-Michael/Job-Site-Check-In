import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * Deep-link target for `localseoranker://gbp-connected` — the Google Business
 * Profile OAuth callback page sends the user here once the connection is
 * stored server-side. Lands back on the integrations screen (which re-reads
 * the status when it regains focus) without stacking a second copy of it.
 */
export default function GbpConnectedScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  useEffect(() => {
    try {
      if (router.canDismiss()) router.dismissAll();
    } catch {
      // Nothing to dismiss.
    }
    router.replace('/settings/integrations');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
      }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
