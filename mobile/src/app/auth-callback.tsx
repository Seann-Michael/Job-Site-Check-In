import { Redirect, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { notify } from '@/lib/format';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * Deep-link target for `localseoranker://auth-callback` — where Supabase
 * sends password-reset links for this app, and where native Google sign-in
 * returns. With PKCE the link carries a `code`:
 *
 *  - Google sign-in: auth-provider.signInWithGoogle already exchanges the
 *    code from the auth session result; on Android this route can mount as
 *    well, so it first checks for a session and simply goes home.
 *  - Password reset: no session exists yet, so the exchange happens here and
 *    the profile screen is where the new password gets set.
 */
export default function AuthCallbackScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [target, setTarget] = useState<'/' | '/settings/profile' | '/login' | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const code = typeof params.code === 'string' ? params.code : '';
      if (params.error_description) {
        notify('Link problem', String(params.error_description));
        if (!cancelled) setTarget('/login');
        return;
      }
      if (!isSupabaseConfigured) {
        if (!cancelled) setTarget('/');
        return;
      }
      const { data: before } = await supabase.auth.getSession();
      if (before.session || !code) {
        if (!cancelled) setTarget(before.session ? '/' : '/login');
        return;
      }
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        // The sign-in flow may have exchanged it a moment earlier.
        const { data: after } = await supabase.auth.getSession();
        if (!cancelled) setTarget(after.session ? '/' : '/login');
        if (!after.session) notify('Link expired', error.message);
        return;
      }
      notify('Signed in', 'Set your new password under Profile.');
      if (!cancelled) setTarget('/settings/profile');
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (target) return <Redirect href={target} />;
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
