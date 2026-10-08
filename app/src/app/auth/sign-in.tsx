import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function SignInScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signInWithOtp, verifyOtp, signInWithGoogle, signInWithApple, continueAsGuest } =
    useAuth();

  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSendCode = async () => {
    if (!email || !email.includes('@')) {
      setErrorMessage(t('auth.invalidEmailError'));
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const { error } = await signInWithOtp(email);
    setLoading(false);

    if (error) {
      if (error.message === 'DISPOSABLE_EMAIL') {
        setErrorMessage(t('auth.disposableEmailError'));
      } else {
        setErrorMessage(error.message);
      }
    } else {
      setStep('otp');
    }
  };

  const handleVerifyCode = async () => {
    const cleanToken = token.trim();
    if (!cleanToken || cleanToken.length < 6 || cleanToken.length > 8) {
      setErrorMessage(t('auth.invalidCodeError'));
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const { error } = await verifyOtp(email, token);
    setLoading(false);

    if (error) {
      setErrorMessage(t('auth.invalidCodeError'));
    } else {
      router.replace('/today');
    }
  };

  const handleGuest = () => {
    continueAsGuest();
    router.replace('/today');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{t('auth.title')}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('auth.subtitle')}</Text>
        </View>

        {errorMessage && (
          <View
            style={[
              styles.errorContainer,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            ]}
            testID="auth-error-banner"
          >
            <Text style={{ color: colors.danger, fontSize: fontSize.sm }}>{errorMessage}</Text>
          </View>
        )}

        {step === 'email' ? (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textMuted }]}>{t('auth.emailLabel')}</Text>
            <TextInput
              testID="input-email"
              style={[
                styles.input,
                { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setErrorMessage(null);
              }}
            />

            <Pressable
              testID="btn-send-code"
              accessibilityRole="button"
              accessibilityLabel={t('auth.sendCode')}
              style={[styles.primaryButton, { backgroundColor: colors.accent }]}
              onPress={handleSendCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Text style={{ color: colors.onAccent, fontWeight: '600', fontSize: fontSize.md }}>
                  {t('auth.sendCode')}
                </Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.section}>
            <Text
              style={{ color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.sm }}
            >
              {t('auth.codeSentBody', { email })}
            </Text>
            <TextInput
              testID="input-otp"
              style={[
                styles.input,
                styles.otpInput,
                { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              placeholder={t('auth.codePlaceholder')}
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={8}
              value={token}
              onChangeText={(text) => {
                setToken(text);
                setErrorMessage(null);
              }}
            />

            <Pressable
              testID="btn-verify-code"
              accessibilityRole="button"
              accessibilityLabel={t('auth.verifyCode')}
              style={[styles.primaryButton, { backgroundColor: colors.accent }]}
              onPress={handleVerifyCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Text style={{ color: colors.onAccent, fontWeight: '600', fontSize: fontSize.md }}>
                  {t('auth.verifyCode')}
                </Text>
              )}
            </Pressable>

            <Pressable
              testID="btn-back-to-email"
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
              style={styles.textButton}
              onPress={() => {
                setStep('email');
                setToken('');
                setErrorMessage(null);
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                {t('common.retry')}
              </Text>
            </Pressable>
          </View>
        )}

        <View style={styles.dividerContainer}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* OAuth Buttons */}
        <View style={styles.oauthSection}>
          <Pressable
            testID="btn-google-signin"
            accessibilityRole="button"
            accessibilityLabel={t('auth.googleSignIn')}
            style={[
              styles.secondaryButton,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
            onPress={async () => {
              setLoading(true);
              const { error } = await signInWithGoogle();
              setLoading(false);
              if (error) setErrorMessage(error.message);
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '500', fontSize: fontSize.md }}>
              {t('auth.googleSignIn')}
            </Text>
          </Pressable>

          <Pressable
            testID="btn-apple-signin"
            accessibilityRole="button"
            accessibilityLabel={t('auth.appleSignIn')}
            style={[
              styles.secondaryButton,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                marginTop: spacing.sm,
              },
            ]}
            onPress={async () => {
              setLoading(true);
              const { error } = await signInWithApple();
              setLoading(false);
              if (error) setErrorMessage(error.message);
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '500', fontSize: fontSize.md }}>
              {t('auth.appleSignIn')}
            </Text>
          </Pressable>
        </View>

        {/* Guest Mode */}
        <View style={styles.guestSection}>
          <Text
            style={{
              color: colors.textMuted,
              textAlign: 'center',
              fontSize: fontSize.sm,
              marginBottom: spacing.xs,
            }}
          >
            {t('auth.guestNotice')}
          </Text>
          <Pressable
            testID="btn-guest-signin"
            accessibilityRole="button"
            accessibilityLabel={t('auth.guestSignIn')}
            style={styles.ghostButton}
            onPress={handleGuest}
          >
            <Text style={{ color: colors.accent, fontWeight: '600', fontSize: fontSize.md }}>
              {t('auth.guestSignIn')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: 56,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  label: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  section: {
    marginBottom: spacing.lg,
  },
  errorContainer: {
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
  },
  otpInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: fontSize.xl,
    fontWeight: '600',
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  textButton: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  dividerContainer: {
    marginVertical: spacing.md,
  },
  dividerLine: {
    height: 1,
  },
  oauthSection: {
    marginBottom: spacing.lg,
  },
  guestSection: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
});
