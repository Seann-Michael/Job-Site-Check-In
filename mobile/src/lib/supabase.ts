import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Same Supabase project as the web app (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
// Config comes from EXPO_PUBLIC_* env at build time, falling back to the values
// committed in app.json `extra` so a plain `expo start` or a store build still
// reaches the real backend instead of dropping into demo mode. The URL and anon
// key are public (they ship in the web bundle too), so keeping them in `extra`
// is safe.
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? 'https://placeholder.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey ?? 'placeholder-key';

// Mirrors the placeholder detection in the web app's client/lib/dataService.ts:
// when Supabase isn't configured the app runs on demo data instead of crashing.
export const isSupabaseConfigured =
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseAnonKey.includes('placeholder') &&
  supabaseAnonKey.length > 20;

const isWeb = Platform.OS === 'web';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // On native, sessions persist in AsyncStorage; on web supabase-js
    // falls back to localStorage on its own (and no-ops during static render).
    ...(isWeb ? {} : { storage: AsyncStorage }),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: isWeb,
    // PKCE so native Google OAuth returns an authorization `code` that
    // auth-provider.signInWithGoogle exchanges for a session.
    flowType: 'pkce',
  },
});
