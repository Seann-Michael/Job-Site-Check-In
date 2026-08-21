import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card } from '@/components/ui/basics';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

/** Brand hero — a solid primary block with layered translucent circles (no
 *  native gradient dependency), the app mark and the product headline. */
function Hero() {
  const { colors } = useTheme();
  return (
    <View style={[styles.hero, { backgroundColor: colors.primary }]}>
      <View style={[styles.blob, styles.blobA]} />
      <View style={[styles.blob, styles.blobB]} />
      <View style={[styles.blob, styles.blobC]} />
      <View style={styles.heroContent}>
        <View style={styles.mark}>
          <Ionicons name="business" size={30} color={colors.primary} />
        </View>
        <Text style={styles.heroKicker}>LOCAL SEO RANKER</Text>
        <Text style={styles.heroTitle}>Manage your local presence</Text>
        <Text style={styles.heroSub}>
          Jobs, reviews and your Google profile — one place, on the job site.
        </Text>
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, signUp, signInWithGoogle, signInDemo, isSupabaseConfigured } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const isSignup = mode === 'signup';

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
  ];

  const switchMode = () => {
    setError(null);
    setNotice(null);
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
  };

  const handleSubmit = async () => {
    setError(null);
    setNotice(null);
    setSubmitting(true);
    const result = isSignup
      ? await signUp(email.trim(), password, name)
      : await signIn(email.trim(), password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if ('needsConfirmation' in result && result.needsConfirmation) {
      setNotice('Check your email to confirm your account, then sign in.');
      setMode('signin');
      return;
    }
    router.replace('/');
  };

  const handleGoogle = async () => {
    setError(null);
    setNotice(null);
    setGoogleSubmitting(true);
    const result = await signInWithGoogle();
    setGoogleSubmitting(false);
    if (result.error) {
      // A user who backs out of the Google sheet isn't an error to shout about.
      if (result.error !== 'cancelled') setError(result.error);
      return;
    }
    router.replace('/');
  };

  const handleForgotPassword = async () => {
    const target = email.trim();
    if (!target) {
      setError('Enter your email above first, then tap Forgot password.');
      return;
    }
    setError(null);
    setNotice(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: Linking.createURL('auth-callback'),
    });
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setNotice('Password reset email sent — check your inbox.');
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
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: insets.top }}>
          <Hero />
        </View>

        <View style={styles.body}>
          <View style={{ gap: 4 }}>
            <Text style={[Typography.title, { color: colors.text }]}>
              {isSignup ? 'Create account' : 'Sign in'}
            </Text>
            <Text style={[Typography.body, { color: colors.textSecondary }]}>
              {isSignup
                ? 'Set up your account to manage jobs, reviews and your Google profile.'
                : 'Welcome back. Enter your details to continue.'}
            </Text>
          </View>

          <View style={styles.form}>
            {isSignup ? (
              <View style={styles.field}>
                <Text style={[Typography.label, { color: colors.textSecondary }]}>Full name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  autoComplete="name"
                  style={inputStyle}
                />
              </View>
            ) : null}
            <View style={styles.field}>
              <Text style={[Typography.label, { color: colors.textSecondary }]}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@company.com"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                style={inputStyle}
              />
            </View>
            <View style={styles.field}>
              <Text style={[Typography.label, { color: colors.textSecondary }]}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                style={inputStyle}
              />
            </View>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: colors.dangerSoft }]}>
                <Ionicons name="alert-circle" size={16} color={colors.dangerStrong} />
                <Text style={[Typography.caption, { color: colors.dangerStrong, flex: 1 }]}>
                  {error}
                </Text>
              </View>
            ) : null}

            {notice ? (
              <View style={[styles.errorBox, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={[Typography.caption, { color: colors.primary, flex: 1 }]}>
                  {notice}
                </Text>
              </View>
            ) : null}

            {!isSignup ? (
              <Pressable
                onPress={handleForgotPassword}
                hitSlop={8}
                style={({ pressed }) => [{ alignSelf: 'flex-end' }, pressed && { opacity: 0.6 }]}>
                <Text style={[Typography.label, { color: colors.primary }]}>Forgot password?</Text>
              </Pressable>
            ) : null}

            <Button
              label={isSignup ? 'Create account' : 'Sign in'}
              onPress={handleSubmit}
              loading={submitting}
              fullWidth
            />

            <View style={styles.dividerRow}>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[Typography.caption, { color: colors.textMuted }]}>or</Text>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </View>

            <Button
              label={isSignup ? 'Sign up with Google' : 'Continue with Google'}
              variant="secondary"
              icon="logo-google"
              fullWidth
              loading={googleSubmitting}
              onPress={handleGoogle}
            />

            <Pressable
              onPress={switchMode}
              hitSlop={8}
              style={({ pressed }) => [{ alignSelf: 'center' }, pressed && { opacity: 0.6 }]}>
              <Text style={[Typography.body, { color: colors.textSecondary }]}>
                {isSignup ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={[Typography.bodyStrong, { color: colors.primary }]}>
                  {isSignup ? 'Sign in' : 'Sign up'}
                </Text>
              </Text>
            </Pressable>
          </View>

          {!isSupabaseConfigured ? (
            <Card style={styles.demoCard}>
              <View style={styles.demoHeader}>
                <Ionicons name="sparkles" size={16} color={colors.primary} />
                <Text style={[Typography.bodyStrong, { color: colors.text }]}>Demo mode</Text>
              </View>
              <Text style={[Typography.body, { color: colors.textSecondary }]}>
                Supabase isn&apos;t configured yet, so the app runs on sample data. Add
                EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to connect your real
                account.
              </Text>
              <Button label="Explore the demo" variant="secondary" onPress={handleDemo} fullWidth />
            </Card>
          ) : null}

          <Text style={[Typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>
            By continuing you agree to the Terms and Privacy Policy.
          </Text>
        </View>
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
    gap: Spacing.xl,
  },
  hero: {
    marginHorizontal: Spacing.screen,
    marginTop: Spacing.md,
    borderRadius: 28,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.xxxl,
    overflow: 'hidden',
  },
  heroContent: {
    gap: Spacing.sm,
  },
  mark: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  heroKicker: {
    ...Typography.eyebrow,
    color: 'rgba(255,255,255,0.75)',
  },
  heroTitle: {
    ...Typography.display,
    color: '#FFFFFF',
  },
  heroSub: {
    ...Typography.body,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  blob: {
    position: 'absolute',
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  blobA: { width: 180, height: 180, top: -70, right: -50 },
  blobB: { width: 120, height: 120, bottom: -50, right: 40 },
  blobC: { width: 90, height: 90, top: 30, right: 90, backgroundColor: 'rgba(255,255,255,0.08)' },
  body: {
    paddingHorizontal: Spacing.screen,
    gap: Spacing.xl,
  },
  form: {
    gap: Spacing.md,
  },
  field: {
    gap: 6,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.lg,
    height: 52,
    ...Typography.body,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.button,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
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
  demoCard: {
    gap: Spacing.md,
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
