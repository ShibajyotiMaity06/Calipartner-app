import React from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Card, ChevronLeftIcon, dark, PairedCard, space, Text } from '@calipartner/ui';
import { t } from '@/i18n';

export interface PreviewAsPartnerModalProps {
  visible: boolean;
  onClose: () => void;
  userName?: string;
  userPercent?: number;
  partnerName?: string;
  isPartnerDataHidden?: boolean;
  testID?: string;
}

export function PreviewAsPartnerModal({
  visible,
  onClose,
  userName = 'You',
  userPercent = 78,
  partnerName = 'Priya',
  isPartnerDataHidden = false,
  testID = 'modal-preview-as-partner',
}: PreviewAsPartnerModalProps) {
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
              testID="btn-close-preview-partner"
            >
              <ChevronLeftIcon color={dark.textHi} size={24} />
            </TouchableOpacity>
            <Text variant="heading" color={dark.textHi}>
              {t('me.previewPartner.title')}
            </Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text variant="bodyS" color={dark.textMid} style={styles.introSubtitle}>
              {t('me.previewPartner.subtitle')}
            </Text>

            {/* Read-only rule card */}
            <Card elevation="s2" style={styles.ruleCard}>
              <Text variant="bodyS" color={dark.textMid}>
                {t('me.previewPartner.readOnlyNotice')}
              </Text>
              <Text variant="micro" color={dark.textLo} style={styles.ruleSub}>
                {t('me.previewPartner.goalCompletionOnly')}
              </Text>
            </Card>

            {/* Simulated Paired Card preview as partner sees it */}
            <View style={styles.previewContainer}>
              <PairedCard
                userName={userName}
                userHue="iris"
                userPercent={userPercent}
                hasPartner={true}
                partnerName={partnerName}
                partnerHue="teal"
                partnerPercent={85}
                seamState="half-lit"
                isPartnerDataHidden={isPartnerDataHidden}
                testID="paired-card-partner-preview"
              />
            </View>

            {/* Explanation of privacy badges */}
            <Card elevation="s1" style={styles.infoCard}>
              <Text variant="label" color={dark.textHi} style={styles.infoTitle}>
                Privacy guarantees in side-by-side view:
              </Text>
              <Text variant="bodyS" color={dark.textMid} style={styles.bulletItem}>
                • Raw calorie intake is never shown to other people
              </Text>
              <Text variant="bodyS" color={dark.textMid} style={styles.bulletItem}>
                • Metrics you keep private display a quiet lock glyph
              </Text>
              <Text variant="bodyS" color={dark.textMid} style={styles.bulletItem}>
                • Weight numbers and body photos are always hidden unless you choose to share
              </Text>
            </Card>
          </ScrollView>
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
  scrollContent: {
    padding: space[4],
    paddingBottom: space[8],
  },
  introSubtitle: {
    marginBottom: space[3],
  },
  ruleCard: {
    padding: space[3],
    marginBottom: space[4],
  },
  ruleSub: {
    marginTop: space[1],
  },
  previewContainer: {
    marginBottom: space[4],
  },
  infoCard: {
    padding: space[4],
  },
  infoTitle: {
    marginBottom: space[2],
  },
  bulletItem: {
    marginBottom: space[2],
    lineHeight: 20,
  },
});
