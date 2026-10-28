import { afterSetupDestination } from '@/services/pairOnboardingService';
import React, { useState, useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Text,
  Button,
  Field,
  PairRing,
  ChevronLeftIcon,
  space,
  dark,
  radius,
} from '@calipartner/ui';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';
import { TermsOfServiceModal } from '@/components/legal';

export default function SignInScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isSignUp = mode === 'signup';
  const { user, signInWithOtp, verifyOtp, signInWithGoogle, signInWithApple } = useAuth();

  // If user is already authenticated (e.g. after OAuth redirect or active session), check status
  useEffect(() => {
    let mounted = true;
    if (user?.id) {
      import('@/services/onboardingStatus')
        .then(async ({ isUserOnboarded }) => {
          const onboarded = await isUserOnboarded(user.id);
          if (!mounted) return;
          if (onboarded) {
            router.replace((await afterSetupDestination(user.id)) as never);
          } else {
            router.replace('/onboarding' as never);
          }
        })
        .catch(() => {
          if (mounted) setErrorMessage(t('common.errorBody'));
        });
    }
    return () => {
      mounted = false;
    };
  }, [user?.id, isSignUp, router]);

  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'options' | 'email' | 'otp'>('options');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // 30s cooldown for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSendCode = async () => {
    if (!email || !email.includes('@')) {
      setErrorMessage(t('auth.invalidEmailError'));
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const { error } = await signInWithOtp(email, isSignUp);
    setLoading(false);

    if (error) {
      if (error.message === 'DISPOSABLE_EMAIL') {
        setErrorMessage(t('auth.disposableEmailError'));
      } else {
        const msg = error.message;
        if (msg.includes('Retry after')) {
          const match = msg.match(/(\d+)/);
          const secs = match && match[1] ? Math.min(30, parseInt(match[1], 10)) : 30;
          setResendCooldown(secs);
          setErrorMessage(`Retry after ${secs} seconds`);
        } else {
          setErrorMessage(msg);
        }
      }
    } else {
      setStep('otp');
      setResendCooldown(30);
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

    const { error } = await verifyOtp(email, cleanToken);
    setLoading(false);

    if (error) {
      setErrorMessage(t('auth.invalidCodeError'));
    }
    // Auth-state navigation above chooses Today or goal setup. Login never creates a new account.
  };

  const handleBackNavigation = () => {
    playClickSound();
    if (step === 'otp') {
      setStep('email');
      setErrorMessage(null);
    } else if (step === 'email') {
      setStep('options');
      setErrorMessage(null);
    } else {
      router.replace('/welcome' as never);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flexOne}
      >
        {/* Top Back Navigation Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={handleBackNavigation}
            style={styles.backNavButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Back"
            testID="btn-auth-top-back"
          >
            <ChevronLeftIcon size={22} color={dark.textHi} />
            <Text variant="body" color={dark.textHi} style={styles.backNavText}>
              Back
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo & Header (Spec B01) */}
          <View style={styles.header}>
            <View style={styles.logoRingWrapper}>
              <PairRing
                size={64}
                userPercent={80}
                partnerPercent={65}
                userHue="iris"
                partnerHue="teal"
                hasPartner={true}
                testID="auth-logo-ring"
              />
            </View>
            <Text variant="title1" color={dark.textHi} style={styles.title} testID="auth-title">
              {step === 'options'
                ? isSignUp
                  ? 'Create your account'
                  : 'Welcome back'
                : step === 'email'
                  ? 'Sign in with email'
                  : 'Enter 6-digit code'}
            </Text>
            <Text variant="body" color={dark.textMid} style={styles.subtitle}>
              {isSignUp
                ? 'Your data on this phone moves with you.'
                : 'Sign in to access your squad and logs.'}
            </Text>
          </View>

          {/* Error Banner */}
          {errorMessage && (
            <View style={styles.errorContainer} testID="auth-error-banner">
              <Text variant="bodyS" color={dark.danger}>
                {errorMessage}
              </Text>
            </View>
          )}

          {/* STEP 1: Options (Apple first on iOS, then Google, then Email) */}
          {step === 'options' && (
            <View style={styles.section}>
              <View style={styles.oauthButtons}>
                {Platform.OS === 'ios' && (
                  <Button
                    variant="secondary"
                    size="lg"
                    label={t('auth.appleSignIn')}
                    icon={
                      <Ionicons
                        name="logo-apple"
                        size={20}
                        color={dark.textHi}
                        style={{ marginRight: 8 }}
                      />
                    }
                    onPress={async () => {
                      setLoading(true);
                      const { error } = await signInWithApple();
                      setLoading(false);
                      if (error) setErrorMessage(error.message);
                    }}
                    disabled={loading}
                    testID="btn-apple-signin"
                  />
                )}

                <Button
                  variant="secondary"
                  size="lg"
                  label={t('auth.googleSignIn')}
                  icon={
                    <Ionicons
                      name="logo-google"
                      size={18}
                      color={dark.textHi}
                      style={{ marginRight: 8 }}
                    />
                  }
                  onPress={async () => {
                    setLoading(true);
                    const { error } = await signInWithGoogle();
                    setLoading(false);
                    if (error) setErrorMessage(error.message);
                  }}
                  disabled={loading}
                  testID="btn-google-signin"
                />

                <Button
                  variant="primary"
                  size="lg"
                  label="Continue with email"
                  icon={
                    <Ionicons
                      name="mail"
                      size={18}
                      color={dark.onBrand}
                      style={{ marginRight: 8 }}
                    />
                  }
                  onPress={() => setStep('email')}
                  disabled={loading}
                  testID="btn-continue-email"
                />
              </View>

              {/* Terms of Service & Privacy Policy Prompt (Apple & Google guideline compliance) */}
              <View style={styles.termsPromptContainer}>
                <Text variant="bodyS" color={dark.textLo} style={styles.termsPromptText}>
                  By continuing, you agree to our{' '}
                  <Text
                    variant="bodyS"
                    color={dark.apricot}
                    onPress={() => setShowTermsModal(true)}
                    style={styles.termsLink}
                    testID="link-terms-of-service"
                  >
                    Terms of Service
                  </Text>{' '}
                  and{' '}
                  <Text
                    variant="bodyS"
                    color={dark.apricot}
                    onPress={() => setShowTermsModal(true)}
                    style={styles.termsLink}
                    testID="link-privacy-policy"
                  >
                    Privacy Policy
                  </Text>
                  .
                </Text>
              </View>
            </View>
          )}

          {/* STEP 2: Email Entry (Spec B02) */}
          {step === 'email' && (
            <View style={styles.section}>
              <Field
                label={t('auth.emailLabel')}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setErrorMessage(null);
                }}
                placeholder={t('auth.emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                testID="input-email"
              />

              <Button
                variant="primary"
                size="lg"
                label={t('auth.sendCode')}
                onPress={handleSendCode}
                loading={loading}
                testID="btn-send-code"
              />

              <TouchableOpacity
                onPress={() => {
                  setStep('options');
                  setErrorMessage(null);
                }}
                style={styles.backLink}
                testID="btn-back-to-options"
              >
                <Text variant="bodyS" color={dark.textMid}>
                  ← Back to other sign in options
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 3: OTP Entry (Spec B03) */}
          {step === 'otp' && (
            <View style={styles.section}>
              <Text variant="bodyS" color={dark.textMid} style={styles.codeSentInfo}>
                {t('auth.codeSentBody', { email })}
              </Text>

              <TextInput
                testID="input-otp"
                style={styles.otpInput}
                placeholder="123456"
                placeholderTextColor={dark.textOff}
                keyboardType="number-pad"
                maxLength={6}
                value={token}
                onChangeText={(text) => {
                  setToken(text);
                  setErrorMessage(null);
                }}
              />

              <Button
                variant="primary"
                size="lg"
                label={t('auth.verifyCode')}
                onPress={handleVerifyCode}
                loading={loading}
                testID="btn-verify-code"
              />

              <View style={styles.otpFooter}>
                <TouchableOpacity
                  onPress={() => {
                    if (resendCooldown <= 0) handleSendCode();
                  }}
                  disabled={resendCooldown > 0}
                  style={styles.resendButton}
                  testID="btn-resend-otp"
                >
                  <Text variant="bodyS" color={resendCooldown > 0 ? dark.textOff : dark.apricot}>
                    {resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : 'Resend 6-digit code'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setStep('email');
                    setToken('');
                    setErrorMessage(null);
                  }}
                  style={styles.wrongEmailLink}
                  testID="btn-back-to-email"
                >
                  <Text variant="bodyS" color={dark.textLo}>
                    Wrong email? Change it
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <TermsOfServiceModal visible={showTermsModal} onClose={() => setShowTermsModal(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: dark.bg0,
  },
  flexOne: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: space[3],
    paddingTop: space[2],
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  backNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: space[2],
  },
  backNavText: {
    fontWeight: '600',
  },
  scrollContent: {
    padding: space[4],
    paddingTop: space[2],
    gap: space[4],
  },
  header: {
    alignItems: 'center',
    gap: space[2],
    marginBottom: space[2],
  },
  logoRingWrapper: {
    marginBottom: space[2],
  },
  title: {
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  errorContainer: {
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.danger,
    borderRadius: radius.control,
    padding: space[3],
  },
  section: {
    gap: space[4],
  },
  oauthButtons: {
    gap: space[3],
  },
  backLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeSentInfo: {
    lineHeight: 20,
  },
  otpInput: {
    height: 56,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    backgroundColor: dark.s2,
    color: dark.textHi,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 10,
  },
  otpFooter: {
    alignItems: 'center',
    gap: space[2],
    marginTop: space[1],
  },
  resendButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  wrongEmailLink: {
    minHeight: 44,
    justifyContent: 'center',
  },
  termsPromptContainer: {
    paddingTop: space[3],
    paddingHorizontal: space[2],
    alignItems: 'center',
  },
  termsPromptText: {
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    textDecorationLine: 'underline',
  },
});
