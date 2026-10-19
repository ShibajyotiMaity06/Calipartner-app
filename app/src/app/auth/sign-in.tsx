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
import { useRouter } from 'expo-router';
import {
  Text,
  Button,
  Field,
  PairRing,
  space,
  dark,
  radius,
} from '@calipartner/ui';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';

export default function SignInScreen() {
  const router = useRouter();
  const { signInWithOtp, verifyOtp, signInWithGoogle, signInWithApple, continueAsGuest } =
    useAuth();

  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'options' | 'email' | 'otp'>('options');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

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
    } else {
      router.replace('/today' as any);
    }
  };

  const handleGuest = () => {
    playClickSound();
    continueAsGuest();
    router.replace('/today' as any);
  };

  const isAppleFirst = Platform.OS === 'ios';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flexOne}
      >
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
                ? 'Create your account'
                : step === 'email'
                  ? 'Sign in with email'
                  : 'Enter 6-digit code'}
            </Text>
            <Text variant="body" color={dark.textMid} style={styles.subtitle}>
              Your data on this phone moves with you.
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
                {isAppleFirst ? (
                  <>
                    <Button
                      variant="secondary"
                      size="lg"
                      label={t('auth.appleSignIn')}
                      onPress={async () => {
                        setLoading(true);
                        const { error } = await signInWithApple();
                        setLoading(false);
                        if (error) setErrorMessage(error.message);
                      }}
                      disabled={loading}
                      testID="btn-apple-signin"
                    />
                    <Button
                      variant="secondary"
                      size="lg"
                      label={t('auth.googleSignIn')}
                      onPress={async () => {
                        setLoading(true);
                        const { error } = await signInWithGoogle();
                        setLoading(false);
                        if (error) setErrorMessage(error.message);
                      }}
                      disabled={loading}
                      testID="btn-google-signin"
                    />
                  </>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      size="lg"
                      label={t('auth.googleSignIn')}
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
                      variant="secondary"
                      size="lg"
                      label={t('auth.appleSignIn')}
                      onPress={async () => {
                        setLoading(true);
                        const { error } = await signInWithApple();
                        setLoading(false);
                        if (error) setErrorMessage(error.message);
                      }}
                      disabled={loading}
                      testID="btn-apple-signin"
                    />
                  </>
                )}

                <Button
                  variant="primary"
                  size="lg"
                  label="Continue with email"
                  onPress={() => setStep('email')}
                  disabled={loading}
                  testID="btn-continue-email"
                />
              </View>

              {/* Guest Option */}
              <View style={styles.guestSection}>
                <TouchableOpacity
                  onPress={handleGuest}
                  style={styles.guestButton}
                  accessibilityRole="button"
                  accessibilityLabel={t('auth.guestSignIn')}
                  testID="btn-guest-signin"
                >
                  <Text variant="body" color={dark.apricot} style={styles.guestText}>
                    Explore as guest →
                  </Text>
                </TouchableOpacity>
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
                  if (text.length === 6) {
                    // Auto-submit on 6 digits
                    handleVerifyCode();
                  }
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
                  <Text
                    variant="bodyS"
                    color={resendCooldown > 0 ? dark.textOff : dark.apricot}
                  >
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
  scrollContent: {
    padding: space[4],
    paddingTop: space[6],
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
  guestSection: {
    marginTop: space[3],
    alignItems: 'center',
  },
  guestButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space[3],
  },
  guestText: {
    fontWeight: '600',
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
});
