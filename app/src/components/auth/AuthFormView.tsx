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
import {
  AppleIcon,
  ChevronLeftIcon,
  EyeIcon,
  EyeOffIcon,
  GoogleIcon,
  IconButton,
  Input,
  LinkButton,
  PrimaryButton,
  ScreenTitle,
  SocialButton,
  Text,
  borders,
  colors,
  fonts,
  layout,
  radius,
  space,
} from '@calipartner/ui/v1';
import { TermsOfServiceModal } from '@/components/legal';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/i18n';

export type AuthFormMode = 'signup' | 'signin';

export interface AuthFormViewProps {
  mode: AuthFormMode;
  onModeChange: (mode: AuthFormMode) => void;
  onBack?: () => void;
  onAuthenticated?: () => void;
  topAction?: React.ReactNode;
  testID?: string;
}

export function AuthFormView({
  mode,
  onModeChange,
  onBack,
  onAuthenticated,
  topAction,
  testID = 'v1-auth-form',
}: AuthFormViewProps): React.JSX.Element {
  const {
    user,
    signUpWithPassword,
    signInWithPassword,
    resetPassword,
    signInWithGoogle,
    signInWithApple,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleWaiting, setGoogleWaiting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [legalTab, setLegalTab] = useState<'terms' | 'privacy' | null>(null);

  const pending = useRef(false);
  const googleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const googleAttempt = useRef(0);
  const isSignUp = mode === 'signup';

  useEffect(
    () => () => {
      if (googleTimer.current) clearTimeout(googleTimer.current);
      googleAttempt.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (user?.id) {
      onAuthenticated?.();
    }
  }, [user?.id, onAuthenticated]);

  const authenticate = async (
    operation: () => Promise<{
      error: { message: string } | null;
      needsEmailConfirmation?: boolean;
    }>,
    onSuccess?: (result: { needsEmailConfirmation?: boolean }) => void,
  ) => {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      const result = await operation();
      if (result.error) {
        setErrorMessage(
          result.error.message === 'DISPOSABLE_EMAIL'
            ? t('auth.disposableEmailError')
            : result.error.message,
        );
      } else {
        onSuccess?.(result);
      }
    } catch {
      setErrorMessage(t('common.errorBody'));
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (googleWaiting || pending.current) return;
    const attempt = ++googleAttempt.current;
    setGoogleWaiting(true);
    setErrorMessage(null);
    setInfoMessage(null);
    // OAuth redirects can stall in embedded browsers; keep email + password usable throughout.
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

  const handleEmailSubmit = () => {
    googleAttempt.current += 1;
    if (googleTimer.current) clearTimeout(googleTimer.current);
    setGoogleWaiting(false);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage(t('auth.invalidEmailError'));
      return;
    }
    if (isSignUp && password.length < 8) {
      setErrorMessage(t('onboardingV1.authPasswordShortError'));
      return;
    }
    if (!isSignUp && !password) {
      setErrorMessage(t('onboardingV1.authPasswordMissingError'));
      return;
    }

    if (isSignUp) {
      void authenticate(
        () => signUpWithPassword(cleanEmail, password),
        (res) => {
          if (res.needsEmailConfirmation) {
            setInfoMessage(t('onboardingV1.authCheckInbox'));
          } else {
            onAuthenticated?.();
          }
        },
      );
      return;
    }

    void authenticate(
      () => signInWithPassword(cleanEmail, password),
      () => onAuthenticated?.(),
    );
  };

  const handleForgotPassword = () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage(t('auth.invalidEmailError'));
      return;
    }
    void authenticate(
      () => resetPassword(cleanEmail),
      () => {
        setInfoMessage(t('onboardingV1.authResetSent', { email: cleanEmail }));
      },
    );
  };

  const handleSwitchMode = (nextMode: AuthFormMode) => {
    if (loading) return;
    setErrorMessage(null);
    setInfoMessage(null);
    setPassword('');
    onModeChange(nextMode);
  };

  return (
    <SafeAreaView style={styles.safe} testID={testID}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.frame}>
            {topAction ??
              (onBack ? (
                <View style={styles.navRow}>
                  <IconButton
                    icon={<ChevronLeftIcon size={18} color={colors.textHi} />}
                    size={44}
                    onPress={onBack}
                    disabled={loading}
                    accessibilityLabel={t('onboarding.back')}
                    testID="btn-auth-top-back"
                  />
                </View>
              ) : null)}

            <ScreenTitle
              title={t(isSignUp ? 'onboardingV1.authCreateTitle' : 'onboardingV1.authSignInTitle')}
              accentWord={t(
                isSignUp ? 'onboardingV1.authCreateAccent' : 'onboardingV1.authSignInAccent',
              )}
              subtitle={t(
                isSignUp ? 'onboardingV1.authCreateSubtitle' : 'onboardingV1.authSignInSubtitle',
              )}
              spacingBottom={space.xl}
              testID="auth-header"
            />

            {errorMessage ? (
              <View style={styles.errorBanner} testID="auth-error-banner">
                <Text
                  variant="meta"
                  color="danger"
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                >
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            {infoMessage ? (
              <View style={styles.infoBanner} testID="auth-info-banner">
                <Text
                  variant="meta"
                  color="apricot"
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                >
                  {infoMessage}
                </Text>
              </View>
            ) : null}

            <View style={styles.socialStack}>
              <SocialButton
                provider="apple"
                title={t('onboardingV1.continueApple')}
                icon={<AppleIcon size={18} color={colors.onBrand} />}
                disabled={loading}
                onPress={() => void authenticate(signInWithApple, () => onAuthenticated?.())}
                testID="btn-apple-signin"
              />
              <SocialButton
                provider="google"
                title={t('onboardingV1.continueGoogle')}
                icon={<GoogleIcon size={18} />}
                loading={googleWaiting}
                disabled={loading || googleWaiting}
                onPress={() => void handleGoogle()}
                testID="btn-google-signin"
              />
            </View>

            {Platform.OS === 'web' ? (
              <Text
                variant="micro"
                color="textLo"
                style={styles.browserHelp}
                testID="auth-browser-help"
                accessibilityLiveRegion="polite"
              >
                {t('publicSite.browserHelp')}
              </Text>
            ) : null}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text variant="meta" color="textLo">
                {t('onboardingV1.authDivider')}
              </Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.inputStack}>
              <Input
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setErrorMessage(null);
                  setInfoMessage(null);
                }}
                placeholder={t('onboardingV1.authEmailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                editable={!loading}
                returnKeyType="next"
                testID="input-email"
              />
              <Input
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setErrorMessage(null);
                  setInfoMessage(null);
                }}
                placeholder={t(
                  isSignUp
                    ? 'onboardingV1.authPasswordPlaceholderCreate'
                    : 'onboardingV1.authPasswordPlaceholderSignIn',
                )}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                textContentType={isSignUp ? 'newPassword' : 'password'}
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={handleEmailSubmit}
                trailingIcon={
                  <Pressable
                    onPress={() => setShowPassword((prev) => !prev)}
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      showPassword
                        ? 'onboardingV1.authHidePassword'
                        : 'onboardingV1.authShowPassword',
                    )}
                    hitSlop={10}
                    style={styles.eyeButton}
                    testID="btn-toggle-password"
                  >
                    {showPassword ? (
                      <EyeOffIcon size={18} color={colors.textLo} />
                    ) : (
                      <EyeIcon size={18} color={colors.textLo} />
                    )}
                  </Pressable>
                }
                testID="input-password"
              />
            </View>

            {!isSignUp ? (
              <View style={styles.forgotRow}>
                <LinkButton
                  title={t('onboardingV1.authForgotPassword')}
                  variant="accent"
                  disabled={loading}
                  onPress={handleForgotPassword}
                  style={styles.forgotBtn}
                  testID="btn-forgot-password"
                />
              </View>
            ) : null}

            <PrimaryButton
              title={t(isSignUp ? 'onboardingV1.authCreateCta' : 'onboardingV1.authSignInCta')}
              showArrow={false}
              loading={loading}
              disabled={loading}
              onPress={handleEmailSubmit}
              style={styles.submitBtn}
              testID="btn-submit-email-auth"
            />

            <View style={styles.bottomSpacer} />

            <View style={styles.footer}>
              {isSignUp ? (
                <Text variant="micro" color="textLo" style={styles.legalText}>
                  {t('onboardingV1.authTermsPrefix')}
                  <Text
                    variant="micro"
                    color="textMid"
                    style={styles.legalLink}
                    onPress={() => setLegalTab('terms')}
                    accessibilityRole="link"
                    testID="link-terms-of-service"
                  >
                    {t('onboardingV1.authTermsLink')}
                  </Text>
                  {t('onboardingV1.authTermsJoin')}
                  <Text
                    variant="micro"
                    color="textMid"
                    style={styles.legalLink}
                    onPress={() => setLegalTab('privacy')}
                    accessibilityRole="link"
                    testID="link-privacy-policy"
                  >
                    {t('onboardingV1.authPrivacyLink')}
                  </Text>
                </Text>
              ) : null}

              <Pressable
                onPress={() => handleSwitchMode(isSignUp ? 'signin' : 'signup')}
                disabled={loading}
                accessibilityRole="button"
                style={styles.switchBtn}
                testID="auth-switch-mode"
              >
                <Text variant="meta" color="textLo">
                  {t(isSignUp ? 'onboardingV1.authHaveAccount' : 'onboardingV1.authNewUser')}{' '}
                  <Text variant="meta" color="apricot" style={styles.switchAccent}>
                    {t(
                      isSignUp
                        ? 'onboardingV1.authHaveAccountAction'
                        : 'onboardingV1.authNewUserAction',
                    )}
                  </Text>
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <TermsOfServiceModal
        initialTab={legalTab ?? 'terms'}
        visible={legalTab !== null}
        onClose={() => setLegalTab(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg0,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space.md,
    paddingBottom: layout.ctaBottomMin,
  },
  frame: {
    flex: 1,
    width: '100%',
  },
  navRow: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: layout.navToTitle,
  },
  errorBanner: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.danger,
    borderRadius: radius.chip,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    marginBottom: space.lg,
  },
  infoBanner: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.apricot,
    borderRadius: radius.chip,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    marginBottom: space.lg,
  },
  socialStack: {
    gap: space.md,
  },
  browserHelp: {
    marginTop: space.sm,
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginVertical: space.xl,
  },
  dividerLine: {
    flex: 1,
    height: borders.width,
    backgroundColor: colors.hairline,
  },
  inputStack: {
    gap: space.md,
  },
  eyeButton: {
    minWidth: layout.minTouchTarget,
    minHeight: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -space.sm,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: space.xs,
  },
  forgotBtn: {
    paddingHorizontal: 0,
  },
  submitBtn: {
    marginTop: space.lg,
  },
  bottomSpacer: {
    flex: 1,
    minHeight: space.xxl,
  },
  footer: {
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.lg,
  },
  legalText: {
    textAlign: 'center',
  },
  legalLink: {
    textDecorationLine: 'underline',
  },
  switchBtn: {
    minHeight: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  switchAccent: {
    fontFamily: fonts.bold,
  },
});
