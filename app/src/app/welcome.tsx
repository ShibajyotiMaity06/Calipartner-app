import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text, Button, onboardingLayout as layout, space, useTheme } from '@calipartner/ui';
import { CaliPartnerLogo } from '@/components/brand/CaliPartnerLogo';
import { t } from '@/i18n';

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg0 }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View
            style={styles.brand}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <CaliPartnerLogo size={layout.logo} testID="welcome-logo" />
            <Text fontSet="onboarding" variant="title1" color={colors.textHi}>
              {t('app.name')}
            </Text>
          </View>
          <View style={styles.hero}>
            <Text fontSet="onboarding" variant="bodyS" color={colors.textMid}>
              {t('setup.welcomeEyebrow')}
            </Text>
            <Text
              fontSet="onboarding"
              variant="title1"
              color={colors.textHi}
              style={styles.center}
              testID="welcome-title"
            >
              {t('welcome.title')}
            </Text>
            <Text
              fontSet="onboarding"
              variant="body"
              color={colors.textMid}
              style={styles.center}
              testID="welcome-subtitle"
            >
              {t('welcome.subtitle')}
            </Text>
            <Text fontSet="onboarding" variant="bodyS" color={colors.textMid} style={styles.center}>
              {t('setup.welcomeNote')}
            </Text>
          </View>
          <View style={styles.actions}>
            <Button
              fontSet="onboarding"
              label={t('setup.signup')}
              onPress={() => router.push({ pathname: '/auth/sign-in', params: { mode: 'signup' } })}
              testID="btn-welcome-get-started"
            />
            <Button
              fontSet="onboarding"
              variant="secondary"
              label={t('welcome.alreadyHaveAccount')}
              onPress={() => router.push({ pathname: '/auth/sign-in', params: { mode: 'signin' } })}
              testID="btn-welcome-sign-in"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, padding: space[4] },
  content: {
    flex: 1,
    maxWidth: layout.contentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: space[6],
  },
  brand: { alignItems: 'center', paddingTop: space[6], gap: space[2] },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: space[4],
    paddingVertical: space[6],
  },
  center: { textAlign: 'center' },
  actions: { gap: space[3], paddingBottom: space[4] },
});
