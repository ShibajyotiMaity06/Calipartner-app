import { NavigationIcon } from '@calipartner/ui';
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Button,
  Field,
  Text,
  onboardingLayout as layout,
  radius,
  space,
  useTheme,
} from '@calipartner/ui';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { afterSetupDestination } from '@/services/pairOnboardingService';
import { CaliPartnerLogo } from '@/components/brand/CaliPartnerLogo';
import { EntryTerms } from '@/components/brand/EntryTerms';
import { t } from '@/i18n';

export default function SignInScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isSignUp = mode === 'signup';
  const { colors } = useTheme();
  const { user, signInWithOtp, verifyOtp, signInWithGoogle, signInWithApple } = useAuth();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const pending = useRef(false);

  useEffect(() => {
    let mounted = true;
    if (user?.id) {
      void import('@/services/onboardingStatus')
        .then(async ({ isUserOnboarded }) => {
          const onboarded = await isUserOnboarded(user.id);
          const destination = onboarded ? await afterSetupDestination(user.id) : '/onboarding';
          if (mounted) router.replace(destination as never);
        })
        .catch(() => {
          if (mounted) setErrorMessage(t('common.errorBody'));
        });
    }
    return () => {
      mounted = false;
    };
  }, [user?.id, router]);
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const authenticate = async (
    operation: () => Promise<{ error: { message: string } | null }>,
    onSuccess?: () => void,
  ) => {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setErrorMessage(null);
    try {
      const { error } = await operation();
      if (error)
        setErrorMessage(
          error.message === 'DISPOSABLE_EMAIL' ? t('auth.disposableEmailError') : error.message,
        );
      else onSuccess?.();
    } catch {
      setErrorMessage(t('common.errorBody'));
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };
  const sendCode = () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage(t('auth.invalidEmailError'));
      return;
    }
    if (resendCooldown > 0) return;
    void authenticate(
      () => signInWithOtp(cleanEmail, isSignUp),
      () => {
        setEmail(cleanEmail);
        setToken('');
        setStep('otp');
        setResendCooldown(30);
      },
    );
  };
  const verifyCode = () => {
    if (!/^\d{6}$/.test(token.trim())) {
      setErrorMessage(t('auth.invalidCodeError'));
      return;
    }
    void authenticate(() => verifyOtp(email, token.trim()));
  };
  const changeMode = (signup: boolean) => {
    if (loading) return;
    setStep('email');
    setToken('');
    setErrorMessage(null);
    router.setParams({ mode: signup ? 'signup' : 'signin' });
  };
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg0 }]}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.frame}>
            <Pressable
              onPress={() => {
                if (step === 'otp') {
                  setStep('email');
                  setToken('');
                  setErrorMessage(null);
                } else router.replace('/welcome');
              }}
              disabled={loading}
              style={styles.back}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.back')}
              testID="btn-auth-top-back"
            >
              <NavigationIcon action="back" />
            </Pressable>
            <View
              style={[styles.tabs, { backgroundColor: colors.s1, borderColor: colors.hairline }]}
              accessibilityRole="tablist"
            >
              {([true, false] as const).map((signup) => (
                <Pressable
                  key={String(signup)}
                  onPress={() => changeMode(signup)}
                  disabled={loading}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isSignUp === signup }}
                  testID={signup ? 'auth-tab-signup' : 'auth-tab-signin'}
                  style={[
                    styles.tab,
                    { backgroundColor: isSignUp === signup ? colors.apricot : 'transparent' },
                  ]}
                >
                  <Text
                    variant="label"
                    color={isSignUp === signup ? colors.onBrand : colors.textMid}
                  >
                    {t(signup ? 'entryRefresh.createAccount' : 'entryRefresh.logIn')}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.heading}>
              <CaliPartnerLogo size={layout.previewAvatar} testID="auth-logo" />
              <Text variant="title1" accessibilityRole="header" testID="auth-title">
                {t(
                  step === 'otp'
                    ? 'entryRefresh.codeTitle'
                    : isSignUp
                      ? 'entryRefresh.createTitle'
                      : 'entryRefresh.loginTitle',
                )}
              </Text>
              <Text variant="bodyS" color={colors.textMid}>
                {step === 'otp'
                  ? t('auth.codeSentBody', { email })
                  : t(isSignUp ? 'entryRefresh.createBody' : 'entryRefresh.loginBody')}
              </Text>
            </View>
            {errorMessage && (
              <View
                style={[styles.error, { borderColor: colors.danger, backgroundColor: colors.s1 }]}
                testID="auth-error-banner"
              >
                <Text
                  variant="bodyS"
                  color={colors.danger}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                >
                  {errorMessage}
                </Text>
              </View>
            )}
            {step === 'email' ? (
              <>
                <View style={styles.stack}>
                  {Platform.OS === 'ios' && (
                    <Button
                      variant="secondary"
                      label={t('auth.appleSignIn')}
                      icon={<Ionicons name="logo-apple" size={layout.icon} color={colors.textHi} />}
                      disabled={loading}
                      onPress={() => void authenticate(signInWithApple)}
                      testID="btn-apple-signin"
                    />
                  )}
                  <Button
                    variant="secondary"
                    label={t('auth.googleSignIn')}
                    icon={<Ionicons name="logo-google" size={layout.icon} color={colors.textHi} />}
                    disabled={loading}
                    onPress={() => void authenticate(signInWithGoogle)}
                    testID="btn-google-signin"
                  />
                </View>
                <View style={styles.divider}>
                  <View style={[styles.line, { backgroundColor: colors.hairline }]} />
                  <Text variant="micro" color={colors.textMid}>
                    {t('entryRefresh.emailDivider')}
                  </Text>
                  <View style={[styles.line, { backgroundColor: colors.hairline }]} />
                </View>
                <Field
                  label={t('entryRefresh.emailLabel')}
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    setErrorMessage(null);
                  }}
                  placeholder={t('auth.emailPlaceholder')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  editable={!loading}
                  onSubmitEditing={sendCode}
                  testID="input-email"
                />
                <Text variant="micro" color={colors.textMid}>
                  {t('entryRefresh.codeHint')}
                </Text>
                <Button
                  label={
                    resendCooldown > 0
                      ? t('entryRefresh.resendIn', { seconds: resendCooldown })
                      : t('entryRefresh.sendCode')
                  }
                  onPress={sendCode}
                  loading={loading}
                  disabled={resendCooldown > 0}
                  testID="btn-send-code"
                />
                <EntryTerms />
              </>
            ) : (
              <View style={styles.stack}>
                <Field
                  label={t('entryRefresh.codeLabel')}
                  value={token}
                  onChangeText={(value) => {
                    setToken(value);
                    setErrorMessage(null);
                  }}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  editable={!loading}
                  onSubmitEditing={verifyCode}
                  testID="input-otp"
                />
                <Button
                  label={t('entryRefresh.verifyCode')}
                  onPress={verifyCode}
                  loading={loading}
                  testID="btn-verify-code"
                />
                <Button
                  variant="tertiary"
                  label={
                    resendCooldown > 0
                      ? t('entryRefresh.resendIn', { seconds: resendCooldown })
                      : t('entryRefresh.resend')
                  }
                  onPress={sendCode}
                  disabled={loading || resendCooldown > 0}
                  testID="btn-resend-otp"
                />
                <Button
                  variant="tertiary"
                  label={t('entryRefresh.changeEmail')}
                  onPress={() => {
                    setStep('email');
                    setToken('');
                    setErrorMessage(null);
                  }}
                  disabled={loading}
                  testID="btn-back-to-email"
                />
              </View>
            )}
            <View style={styles.footer}>
              <Text variant="bodyS" color={colors.textMid}>
                {t(isSignUp ? 'entryRefresh.existingAccount' : 'entryRefresh.newAccount')}
              </Text>
              <Button
                variant="tertiary"
                fullWidth={false}
                label={t(isSignUp ? 'entryRefresh.logIn' : 'entryRefresh.createAccount')}
                onPress={() => changeMode(!isSignUp)}
                disabled={loading}
                testID="auth-switch-mode"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, padding: space[5] },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: layout.entryWidth,
    alignSelf: 'center',
    gap: space[3],
  },
  back: {
    minHeight: layout.touch,
    minWidth: layout.touch,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    borderRadius: radius.full,
    borderWidth: layout.border,
    padding: space[1],
  },
  tab: {
    flex: 1,
    minHeight: layout.touch,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[2],
  },
  heading: { gap: space[2], marginVertical: space[2] },
  stack: { gap: space[3] },
  divider: { flexDirection: 'row', gap: space[3], alignItems: 'center', marginVertical: space[2] },
  line: { flex: 1, height: layout.border },
  error: { padding: space[3], borderWidth: layout.border, borderRadius: radius.control },
  footer: {
    marginTop: 'auto',
    paddingTop: space[7],
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
