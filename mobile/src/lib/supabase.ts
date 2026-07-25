import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Same Supabase project as the web app (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY);
// Expo exposes env vars to the app via the EXPO_PUBLIC_ prefix.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key';

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
  },
});
