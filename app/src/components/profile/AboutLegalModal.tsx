import React from 'react';
import {
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Card, ChevronLeftIcon, dark, space, Text } from '@calipartner/ui';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';

export interface AboutLegalModalProps {
  visible: boolean;
  onClose: () => void;
  testID?: string;
}

export function AboutLegalModal({
  visible,
  onClose,
  testID = 'modal-about-legal',
}: AboutLegalModalProps) {
  const openUrl = (url: string) => {
    playClickSound();
    Linking.openURL(url).catch(() => {});
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
              testID="btn-close-about-legal"
            >
              <ChevronLeftIcon color={dark.textHi} size={24} />
            </TouchableOpacity>
            <Text variant="heading" color={dark.textHi}>
              {t('me.aboutLegal.title')}
            </Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {/* Version info */}
            <Card elevation="s1" style={styles.card}>
              <Text variant="heading" color={dark.textHi}>
                {t('me.aboutLegal.versionValue')}
              </Text>
              <Text variant="micro" color={dark.textLo} style={styles.versionSub}>
                Built with offline-first SQLite and Supabase Edge Architecture
              </Text>
            </Card>

            {/* Health Disclaimer (Safety Rule PRD 8) */}
            <Card elevation="s2" style={styles.card}>
              <Text variant="label" color={dark.apricot} style={styles.sectionHeader}>
                {t('me.aboutLegal.disclaimerTitle')}
              </Text>
              <Text variant="bodyS" color={dark.textMid} style={styles.disclaimerText}>
                {t('me.aboutLegal.disclaimerBody')}
              </Text>
            </Card>

            {/* Data Attributions */}
            <Card elevation="s1" style={styles.card}>
              <Text variant="label" color={dark.textHi} style={styles.sectionHeader}>
                {t('me.aboutLegal.attributionsTitle')}
              </Text>
              <Text variant="bodyS" color={dark.textMid} style={styles.attrItem}>
                • {t('me.aboutLegal.openFoodFacts')}
              </Text>
              <Text variant="bodyS" color={dark.textMid} style={styles.attrItem}>
                • {t('me.aboutLegal.ifct')}
              </Text>
              <Text variant="bodyS" color={dark.textMid} style={styles.attrItem}>
                • USDA FoodData Central (Public Domain)
              </Text>
            </Card>

            {/* Legal Links */}
            <Card elevation="s1" style={styles.card}>
              <TouchableOpacity
                onPress={() => openUrl('https://calipartner.com/terms')}
                style={styles.linkRow}
                accessibilityRole="link"
                testID="link-terms-of-service"
              >
                <Text variant="heading" color={dark.apricot}>
                  {t('me.aboutLegal.termsLink')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => openUrl('https://calipartner.com/privacy')}
                style={styles.linkRow}
                accessibilityRole="link"
                testID="link-privacy-policy"
              >
                <Text variant="heading" color={dark.apricot}>
                  {t('me.aboutLegal.privacyLink')}
                </Text>
              </TouchableOpacity>
            </Card>
          </ScrollView>

          <View style={styles.bottomBar}>
            <Button
              variant="secondary"
              label="Done"
              onPress={onClose}
              testID="btn-done-about-legal"
              style={styles.doneBtn}
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  card: {
    padding: space[4],
    marginBottom: space[4],
  },
  versionSub: {
    marginTop: space[1],
  },
  sectionHeader: {
    marginBottom: space[2],
  },
  disclaimerText: {
    lineHeight: 22,
  },
  attrItem: {
    marginBottom: space[2],
    lineHeight: 20,
  },
  linkRow: {
    paddingVertical: space[2],
    minHeight: 44,
    justifyContent: 'center',
  },
  bottomBar: {
    padding: space[4],
    borderTopWidth: 1,
    borderTopColor: dark.hairline,
    backgroundColor: dark.bg0,
  },
  doneBtn: {
    width: '100%',
  },
});
