import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text, Button, onboardingLayout as layout, radius, space, useTheme } from '@calipartner/ui';
import { CaliPartnerLogo } from '@/components/brand/CaliPartnerLogo';
import { EntryTerms } from '@/components/brand/EntryTerms';
import { t } from '@/i18n';

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg0 }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.brand}>
            <CaliPartnerLogo size={layout.entryLogo} testID="welcome-logo" />
            <Text variant="heading">{t('app.name')}</Text>
          </View>
          <View
            style={[styles.preview, { backgroundColor: colors.s1, borderColor: colors.hairline }]}
            testID="welcome-squad-preview"
          >
            <Text variant="micro" color={colors.textMid}>
              {t('entryRefresh.preview')}
            </Text>
            {(['you', 'partner'] as const).map((person, index) => (
              <View key={person} style={styles.previewRow}>
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: index === 0 ? colors.iris : colors.teal },
                  ]}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
                <View style={styles.flex}>
                  <Text variant="label">{t(`entryRefresh.${person}`)}</Text>
                  <Text variant="micro" color={colors.textMid}>
                    {t(index === 0 ? 'entryRefresh.ownGoals' : 'entryRefresh.partnerGoals')}
                  </Text>
                  <View style={[styles.bar, { backgroundColor: colors.hairline }]} />
                </View>
              </View>
            ))}
            <Text variant="micro" color={colors.textMid}>
              {t('entryRefresh.previewNote')}
            </Text>
          </View>
          <View style={styles.hero}>
            <Text
              variant="title1"
              style={styles.center}
              accessibilityRole="header"
              testID="welcome-title"
            >
              {t('entryRefresh.welcomeTitle')}
            </Text>
            <Text
              variant="bodyS"
              color={colors.textMid}
              style={styles.center}
              testID="welcome-subtitle"
            >
              {t('entryRefresh.welcomeBody')}
            </Text>
          </View>
          <View style={styles.actions}>
            <Button
              label={t('entryRefresh.createAccount')}
              onPress={() => router.push({ pathname: '/auth/sign-in', params: { mode: 'signup' } })}
              testID="btn-welcome-get-started"
            />
            <Button
              variant="secondary"
              label={t('entryRefresh.logIn')}
              onPress={() => router.push({ pathname: '/auth/sign-in', params: { mode: 'signin' } })}
              testID="btn-welcome-sign-in"
            />
            <EntryTerms />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, padding: space[5] },
  content: {
    flex: 1,
    maxWidth: layout.entryWidth,
    width: '100%',
    alignSelf: 'center',
    gap: space[6],
  },
  brand: { alignItems: 'center', paddingTop: space[7], gap: space[2] },
  preview: {
    borderWidth: layout.border,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[3],
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  avatar: { width: layout.previewAvatar, height: layout.previewAvatar, borderRadius: radius.full },
  flex: { flex: 1, gap: space[1] },
  bar: { height: layout.previewBar, borderRadius: radius.full, marginTop: space[1] },
  hero: { alignItems: 'center', gap: space[3] },
  center: { textAlign: 'center' },
  actions: { marginTop: 'auto', gap: space[3], paddingBottom: space[2] },
});
