import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  Field,
  SegmentedControl,
  Text,
  onboardingLayout as layout,
  radius,
  space,
  useTheme,
} from '@calipartner/ui';
import { useAuth } from '@/contexts/AuthContext';
import { CaliPartnerLogo } from '@/components/brand/CaliPartnerLogo';
import { EntryTerms } from '@/components/brand/EntryTerms';
import { t } from '@/i18n';

interface OnboardingAuthModalProps {
  visible: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
}

export function OnboardingAuthModal({
  visible,
  onClose,
  onAuthenticated,
}: OnboardingAuthModalProps) {
  const { colors, reduceMotion } = useTheme();
  const styles = createStyles(colors);
  const { user, signInWithOtp, verifyOtp, signInWithGoogle, signInWithApple } = useAuth();

  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const pending = useRef(false);
  const [googleWaiting, setGoogleWaiting] = useState(false);
  const googleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const googleAttempt = useRef(0);

  useEffect(
    () => () => {
      if (googleTimer.current) clearTimeout(googleTimer.current);
      googleAttempt.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (user?.id && visible) {
      onAuthenticated();
    }
  }, [user?.id, visible, onAuthenticated]);

  const googleSignIn = async () => {
    if (googleWaiting || pending.current) return;
    const attempt = ++googleAttempt.current;
    setGoogleWaiting(true);
    setErrorMessage(null);
    googleTimer.current = setTimeout(() => {
      if (attempt !== googleAttempt.current) return;
      googleAttempt.current += 1;
      setGoogleWaiting(false);
      setErrorMessage(t('publicSite.googlePending'));
    }, 12000);
    try {
      const result = await signInWithGoogle();
      if (attempt !== googleAttempt.current) return;
      if (result.error) {
        if (googleTimer.current) clearTimeout(googleTimer.current);
        setGoogleWaiting(false);
        setErrorMessage(t('publicSite.browserHelp'));
      }
    } catch {
      if (attempt !== googleAttempt.current) return;
      if (googleTimer.current) clearTimeout(googleTimer.current);
      setGoogleWaiting(false);
      setErrorMessage(t('publicSite.browserHelp'));
    }
  };

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
      if (error) {
        setErrorMessage(
          error.message === 'DISPOSABLE_EMAIL' ? t('auth.disposableEmailError') : error.message,
        );
      } else {
        onSuccess?.();
      }
    } catch {
      setErrorMessage(t('common.errorBody'));
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };

  const sendCode = () => {
    googleAttempt.current += 1;
    if (googleTimer.current) clearTimeout(googleTimer.current);
    setGoogleWaiting(false);
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage(t('auth.invalidEmailError'));
      return;
    }
    if (resendCooldown > 0) return;
    void authenticate(
      () => signInWithOtp(cleanEmail, mode === 'signup'),
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
    void authenticate(() => verifyOtp(email, token.trim()), onAuthenticated);
  };

  const changeMode = (nextMode: 'signup' | 'signin') => {
    if (loading) return;
    setMode(nextMode);
    setStep('email');
    setToken('');
    setErrorMessage(null);
  };

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg0 }]}>
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={onClose}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={t('setup.close')}
              style={styles.closeBtn}
              testID="btn-close-onboarding-auth"
            >
              <Ionicons name="close" size={24} color={colors.textHi} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.frame}>
              <SegmentedControl
                value={mode}
                onChange={(val) => changeMode(val as 'signup' | 'signin')}
                disabled={loading}
                options={[
                  {
                    value: 'signup',
                    label: t('entryRefresh.createAccount'),
                    testID: 'onboarding-auth-tab-signup',
                  },
                  {
                    value: 'signin',
                    label: t('entryRefresh.logIn'),
                    testID: 'onboarding-auth-tab-signin',
                  },
                ]}
              />

              <View style={styles.heading}>
                <CaliPartnerLogo size={layout.previewAvatar} testID="onboarding-auth-logo" />
                <Text
                  variant="title1"
                  accessibilityRole="header"
                  testID="onboarding-auth-title"
                  style={styles.title}
                >
                  {step === 'otp'
                    ? t('entryRefresh.codeTitle')
                    : mode === 'signup'
                      ? 'Save your plan & start tracking'
                      : t('entryRefresh.loginTitle')}
                </Text>
                <Text variant="bodyS" color={colors.textMid} style={styles.subtitle}>
                  {step === 'otp'
                    ? t('auth.codeSentBody', { email })
                    : mode === 'signup'
                      ? 'Your personalized targets and meal logs will sync across your devices.'
                      : t('entryRefresh.loginBody')}
                </Text>
              </View>

              {errorMessage && (
                <View
                  style={[styles.error, { borderColor: colors.danger, backgroundColor: colors.s1 }]}
                  testID="onboarding-auth-error-banner"
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
                        icon={
                          <Ionicons name="logo-apple" size={layout.icon} color={colors.textHi} />
                        }
                        disabled={loading}
                        onPress={() => void authenticate(signInWithApple, onAuthenticated)}
                        testID="btn-onboarding-apple-signin"
                      />
                    )}
                    <Button
                      variant="secondary"
                      label={t('auth.googleSignIn')}
                      icon={
                        <Ionicons name="logo-google" size={layout.icon} color={colors.textHi} />
                      }
                      disabled={loading || googleWaiting}
                      onPress={() => void googleSignIn()}
                      testID="btn-onboarding-google-signin"
                    />
                  </View>

                  {Platform.OS === 'web' && (
                    <Text
                      variant="bodyS"
                      color={colors.textMid}
                      testID="onboarding-auth-browser-help"
                      accessibilityLiveRegion="polite"
                    >
                      {t('publicSite.browserHelp')}
                    </Text>
                  )}

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
                    testID="input-onboarding-email"
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
                    testID="btn-onboarding-send-code"
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
                    testID="input-onboarding-otp"
                  />
                  <Button
                    label={t('entryRefresh.verifyCode')}
                    onPress={verifyCode}
                    loading={loading}
                    testID="btn-onboarding-verify-code"
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
                    testID="btn-onboarding-resend-otp"
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
                    testID="btn-onboarding-back-to-email"
                  />
                </View>
              )}

              <View style={styles.footer}>
                <Text variant="bodyS" color={colors.textMid}>
                  {t(
                    mode === 'signup' ? 'entryRefresh.existingAccount' : 'entryRefresh.newAccount',
                  )}
                </Text>
                <Button
                  variant="tertiary"
                  fullWidth={false}
                  label={t(mode === 'signup' ? 'entryRefresh.logIn' : 'entryRefresh.createAccount')}
                  onPress={() => changeMode(mode === 'signup' ? 'signin' : 'signup')}
                  disabled={loading}
                  testID="btn-onboarding-switch-auth-mode"
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: { flex: 1 },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: space[5],
      paddingVertical: space[3],
    },
    closeBtn: {
      minWidth: layout.touch,
      minHeight: layout.touch,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scroll: { flexGrow: 1, padding: space[5] },
    frame: {
      flex: 1,
      width: '100%',
      maxWidth: layout.entryWidth,
      alignSelf: 'center',
      gap: space[3],
    },
    heading: { gap: space[2], marginVertical: space[2], alignItems: 'center' },
    title: { textAlign: 'center' },
    subtitle: { textAlign: 'center' },
    stack: { gap: space[3] },
    divider: {
      flexDirection: 'row',
      gap: space[3],
      alignItems: 'center',
      marginVertical: space[2],
    },
    line: { flex: 1, height: layout.border },
    error: { padding: space[3], borderWidth: layout.border, borderRadius: radius.control },
    footer: {
      marginTop: 'auto',
      paddingTop: space[5],
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
