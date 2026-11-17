import { useTheme as useAppearance } from '@calipartner/ui/theme';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, radius, space } from '@calipartner/ui';
import { t } from '@/i18n';
import { publicSite } from '@/i18n/publicSite';

export interface TermsOfServiceModalProps {
  visible: boolean;
  initialTab?: 'terms' | 'privacy';
  onClose: () => void;
  onAccept?: () => void;
  testID?: string;
}

export function TermsOfServiceModal({
  visible,
  initialTab = 'terms',
  onClose,
  onAccept,
  testID = 'terms-of-service-modal',
}: TermsOfServiceModalProps) {
  const { colors: dark } = useAppearance();
  const styles = createStyles(dark);

  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(initialTab);
  useEffect(() => {
    if (visible) setActiveTab(initialTab);
  }, [visible, initialTab]);

  const handleAgree = () => {
    onAccept?.();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      testID={testID}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Top Bar Header */}
          <View style={styles.topBar}>
            <Text variant="title2" color={dark.textHi} style={styles.headerTitle}>
              {t('publicSite.legalTitle')}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('publicSite.closeLegal')}
              style={styles.closeBtn}
              testID="btn-terms-close"
            >
              <Ionicons name="close" size={24} color={dark.textHi} />
            </Pressable>
          </View>

          {/* Segmented Control */}
          <View style={styles.tabsRow}>
            <Pressable
              onPress={() => setActiveTab('terms')}
              style={[styles.tabButton, activeTab === 'terms' && styles.tabButtonActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'terms' }}
              testID="tab-terms-of-service"
            >
              <Text
                variant="body"
                color={activeTab === 'terms' ? dark.onBrand : dark.textMid}
                style={styles.tabText}
              >
                {t('entryRefresh.terms')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('privacy')}
              style={[styles.tabButton, activeTab === 'privacy' && styles.tabButtonActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'privacy' }}
              testID="tab-privacy-policy"
            >
              <Text
                variant="body"
                color={activeTab === 'privacy' ? dark.onBrand : dark.textMid}
                style={styles.tabText}
              >
                {t('entryRefresh.privacy')}
              </Text>
            </Pressable>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            style={styles.scrollView}
            testID="terms-scroll-view"
          >
            <Text variant="body">{t('avatar.terms')}</Text>
            <Text variant="body">{t('avatar.deletionTerms')}</Text>
            <View style={styles.textSection}>
              <Text variant="micro" color={dark.textMid}>
                {t('publicSite.updated')}
              </Text>
              {publicSite[activeTab].sections.map((section) => (
                <View key={section.title}>
                  <Text
                    variant="heading"
                    accessibilityRole="header"
                    color={dark.textHi}
                    style={styles.sectionHeading}
                  >
                    {section.title}
                  </Text>
                  <Text variant="body" color={dark.textMid} style={styles.paragraph}>
                    {section.body}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Bottom Accept Action */}
          <View style={styles.bottomBar}>
            <Button
              variant="primary"
              size="lg"
              label={t(onAccept ? 'publicSite.agree' : 'publicSite.done')}
              onPress={handleAgree}
              testID="btn-terms-agree"
            />
          </View>
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space[4],
      paddingVertical: space[3],
      borderBottomWidth: 1,
      borderBottomColor: dark.hairline,
    },
    headerTitle: {
      fontWeight: '700',
    },
    closeBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.full,
    },
    tabsRow: {
      flexDirection: 'row',
      paddingHorizontal: space[4],
      paddingVertical: space[2],
      gap: space[2],
      backgroundColor: dark.s1,
    },
    tabButton: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.button,
      backgroundColor: dark.s2,
    },
    tabButtonActive: {
      backgroundColor: dark.apricot,
    },
    tabText: {
      fontWeight: '600',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: space[4],
      paddingBottom: space[7],
    },
    textSection: {
      gap: space[3],
    },
    sectionHeading: {
      marginTop: space[2],
      fontWeight: '700',
    },
    paragraph: {
      lineHeight: 22,
    },
    bottomBar: {
      padding: space[4],
      borderTopWidth: 1,
      borderTopColor: dark.hairline,
      backgroundColor: dark.s1,
    },
  });
