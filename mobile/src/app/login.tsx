import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/logo-mark';
import { Button, Card } from '@/components/ui/basics';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { notify } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';

export default function LoginScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, signInDemo, isSupabaseConfigured } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
  ];

  const handleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    const result = await signIn(email.trim(), password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.replace('/');
  };

  const handleDemo = () => {
    signInDemo();
    router.replace('/');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.xxxl, paddingBottom: insets.bottom + Spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <LogoMark size={64} />
          <Text style={[styles.brand, { color: colors.text }]}>Local SEO Ranker</Text>
          {/* Same copy as the web login page */}
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            Sign in to manage your account
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={inputStyle}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={inputStyle}
          />
          {error ? (
            <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
          ) : null}
          <Button label="Sign in" onPress={handleSignIn} loading={submitting} />
          <View style={styles.dividerRow}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textMuted }]}>or</Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </View>
          <Button
            label="Continue with Google"
            variant="secondary"
            icon="logo-google"
            onPress={() =>
              notify(
                'Google sign-in',
                'Google OAuth arrives with the auth milestone — it reuses the same Supabase provider as the web app.',
              )
            }
          />
        </View>

        {!isSupabaseConfigured ? (
          <Card style={styles.demoCard}>
            <View style={styles.demoHeader}>
              <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
              <Text style={[styles.demoTitle, { color: colors.text }]}>Demo mode</Text>
            </View>
            <Text style={[styles.demoText, { color: colors.textSecondary }]}>
              Supabase isn't configured yet, so the app runs on sample data. Add
              EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to connect your real
              account.
            </Text>
            <Button label="Explore the demo" variant="secondary" onPress={handleDemo} />
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.xxl,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  brand: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
  },
  form: {
    gap: Spacing.md,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    height: 48,
    fontSize: 15,
  },
  error: {
    fontSize: 13,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.xs,
  },
  divider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 12,
  },
  demoCard: {
    gap: Spacing.md,
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  demoTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  demoText: {
    fontSize: 13,
    lineHeight: 19,
  },
});
