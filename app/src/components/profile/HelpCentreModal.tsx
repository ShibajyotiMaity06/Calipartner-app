import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme as useAppearance } from '@calipartner/ui/theme';
import { NavigationIcon } from '@calipartner/ui';
import { type as inputTypography } from '@calipartner/ui';
import React, { useState } from 'react';
import {
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Card, radius, space, Text } from '@calipartner/ui';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';

export interface HelpCentreModalProps {
  visible: boolean;
  onClose: () => void;
  testID?: string;
}

export function HelpCentreModal({
  visible,
  onClose,
  testID = 'modal-help-centre',
}: HelpCentreModalProps) {
  const { colors: dark } = useAppearance();
  const styles = createStyles(dark);

  const [query, setQuery] = useState('');
  const [contactError, setContactError] = useState(false);
  const { user, profile } = useAuth();
  const { currentTier, hasActiveAccess, loading } = useSubscription();
  const pro = !loading && hasActiveAccess && currentTier === 'pro';

  const faqs = [
    {
      q: t('me.helpCentre.faq1Question'),
      a: t('me.helpCentre.faq1Answer'),
    },
    {
      q: t('me.helpCentre.faq2Question'),
      a: t('me.helpCentre.faq2Answer'),
    },
    {
      q: t('me.helpCentre.faq3Question'),
      a: t('me.helpCentre.faq3Answer'),
    },
  ];

  const filteredFaqs = query.trim()
    ? faqs.filter(
        (f) =>
          f.q.toLowerCase().includes(query.toLowerCase()) ||
          f.a.toLowerCase().includes(query.toLowerCase()),
      )
    : faqs;

  const handleContactSupport = async () => {
    playClickSound();
    setContactError(false);
    const subject = pro
      ? t('launch.supportSubject', { username: profile?.username ?? '' })
      : t('launch.supportGeneral');
    const body = t('launch.supportBody', {
      id: user?.id ?? '',
      plan: pro ? 'CaliPartner Pro (Active)' : currentTier,
      version: Constants.expoConfig?.version ?? '',
      os: Platform.OS,
    });
    try {
      await Linking.openURL(
        'mailto:shibajyoti.maity06@gmail.com?subject=' +
          encodeURIComponent(subject) +
          '&body=' +
          encodeURIComponent(body),
      );
    } catch {
      setContactError(true);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container} testID={testID}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.backButton}
              testID="btn-close-help-centre"
            >
              <NavigationIcon action="back" />
            </TouchableOpacity>
            <Text variant="heading" color={dark.textHi}>
              {t('me.helpCentre.title')}
            </Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Text variant="bodyS" color={dark.textMid} style={styles.introSubtitle}>
              {t('me.helpCentre.subtitle')}
            </Text>

            {pro && (
              <Card elevation="s1" testID="priority-support-card">
                <Text variant="heading">{t('launch.priorityTitle')}</Text>
                <Text>{t('launch.priorityHint')}</Text>
              </Card>
            )}
            {contactError && <Text accessibilityRole="alert">{t('launch.supportError')}</Text>}
            {/* Search input */}
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('me.helpCentre.searchPlaceholder')}
              placeholderTextColor={dark.textOff}
              style={[styles.searchInput, { fontFamily: inputTypography.body.fontFamily }]}
              testID="input-help-search"
              accessibilityLabel="Search help articles"
            />

            {/* FAQs List */}
            <View style={styles.faqsList}>
              {filteredFaqs.map((faq, index) => (
                <Card key={index} elevation="s1" style={styles.faqCard}>
                  <Text variant="heading" color={dark.textHi} style={styles.faqQuestion}>
                    {faq.q}
                  </Text>
                  <Text variant="bodyS" color={dark.textMid} style={styles.faqAnswer}>
                    {faq.a}
                  </Text>
                </Card>
              ))}

              {filteredFaqs.length === 0 && (
                <Card elevation="s2" style={styles.noResultsCard}>
                  <Text variant="bodyS" color={dark.textMid}>
                    No articles found matching &quot;{query}&quot;.
                  </Text>
                </Card>
              )}
            </View>

            {/* Support button */}
            <View style={styles.supportWrap}>
              <Button
                variant="secondary"
                label={pro ? t('launch.priorityTitle') : t('me.helpCentre.contactSupportBtn')}
                onPress={handleContactSupport}
                testID="btn-contact-support"
                style={styles.supportBtn}
              />
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const createStyles = (dark: ReturnType<typeof useAppearance>['colors']) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: dark.bg0,
    },
    container: {
      flex: 1,
      backgroundColor: dark.bg0,
    },
    topBar: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space[4],
      borderBottomWidth: 1,
      borderBottomColor: dark.hairline,
    },
    backButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backButtonPlaceholder: {
      width: 44,
    },
    content: {
      padding: space[4],
    },
    introSubtitle: {
      marginBottom: space[3],
    },
    searchInput: {
      backgroundColor: dark.s2,
      borderColor: dark.hairline,
      borderWidth: 1,
      borderRadius: radius.control,
      height: 48,
      paddingHorizontal: space[3],
      color: dark.textHi,
      fontSize: 16,
      marginBottom: space[4],
    },
    faqsList: {
      marginBottom: space[4],
    },
    faqCard: {
      padding: space[4],
      marginBottom: space[3],
    },
    faqQuestion: {
      marginBottom: space[2],
    },
    faqAnswer: {
      lineHeight: 22,
    },
    noResultsCard: {
      padding: space[4],
    },
    supportWrap: {
      marginTop: space[2],
    },
    supportBtn: {
      width: '100%',
    },
  });
