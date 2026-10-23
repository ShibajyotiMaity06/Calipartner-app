import React, { useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, dark, radius, space } from '@calipartner/ui';

export interface TermsOfServiceModalProps {
  visible: boolean;
  onClose: () => void;
  onAccept?: () => void;
  testID?: string;
}

export function TermsOfServiceModal({
  visible,
  onClose,
  onAccept,
  testID = 'terms-of-service-modal',
}: TermsOfServiceModalProps) {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>('terms');

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
              Legal & Privacy
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close terms dialog"
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
                Terms of Service
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
                Privacy Policy
              </Text>
            </Pressable>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            style={styles.scrollView}
            testID="terms-scroll-view"
          >
            {activeTab === 'terms' ? (
              <View style={styles.textSection}>
                <Text variant="heading" color={dark.textHi} style={styles.sectionHeading}>
                  1. Acceptance of Terms
                </Text>
                <Text variant="body" color={dark.textMid} style={styles.paragraph}>
                  By creating an account, accessing, or using CaliPartner, you agree to be bound by
                  these Terms of Service. If you do not agree with any part of these terms, you may
                  not use our services.
                </Text>

                <Text variant="heading" color={dark.textHi} style={styles.sectionHeading}>
                  2. Health & Safety Disclaimer
                </Text>
                <Text variant="body" color={dark.textMid} style={styles.paragraph}>
                  CaliPartner is a nutrition, workout, and habits companion. We do NOT provide
                  medical advice, diagnosis, or treatment. Always consult a physician or certified
                  dietitian before starting any calorie deficit, intensive workout routine, or
                  fasting regimen.
                </Text>
                <Text variant="body" color={dark.textMid} style={styles.paragraph}>
                  Safety floors: We enforce hard calorie floors (minimum 1,200 kcal/day for women,
                  1,500 kcal/day for men) and safe weekly weight change limits to protect your
                  health.
                </Text>

                <Text variant="heading" color={dark.textHi} style={styles.sectionHeading}>
                  3. Community Standards & Zero Tolerance
                </Text>
                <Text variant="body" color={dark.textMid} style={styles.paragraph}>
                  We have zero tolerance for objectionable content or abusive behavior. In shared
                  rooms and chat, users must not post harassment, threats, hate speech, spam, or
                  sexually explicit material.
                </Text>
                <Text variant="body" color={dark.textMid} style={styles.paragraph}>
                  You may instantly block any abusive user or report inappropriate messages.
                  Reported content is reviewed promptly and offending accounts will be terminated.
                </Text>

                <Text variant="heading" color={dark.textHi} style={styles.sectionHeading}>
                  4. Account Deletion & Termination
                </Text>
                <Text variant="body" color={dark.textMid} style={styles.paragraph}>
                  You can permanently delete your account and all associated personal data directly
                  inside the app under Profile Settings at any time.
                </Text>
              </View>
            ) : (
              <View style={styles.textSection}>
                <Text variant="heading" color={dark.textHi} style={styles.sectionHeading}>
                  1. Information We Collect
                </Text>
                <Text variant="body" color={dark.textMid} style={styles.paragraph}>
                  We collect account credentials (email or Apple/Google sign-in identifiers),
                  fitness profile data (height, weight, date of birth, goal preferences), and logged
                  diary entries (food, water, workouts, focus time).
                </Text>

                <Text variant="heading" color={dark.textHi} style={styles.sectionHeading}>
                  2. Room Privacy & Peer Sharing
                </Text>
                <Text variant="body" color={dark.textMid} style={styles.paragraph}>
                  You control what your room partner sees. By default, partners view percentage
                  adherence to daily goals and shared activity check-ins. Exact calories, body
                  weight numbers, and private logs remain hidden unless you explicitly toggle them
                  on.
                </Text>

                <Text variant="heading" color={dark.textHi} style={styles.sectionHeading}>
                  3. AI Processing Privacy
                </Text>
                <Text variant="body" color={dark.textMid} style={styles.paragraph}>
                  AI features (Food Photo Scanning and Coach) are processed securely and
                  ephemerally. Your personal photos and diary entries are strictly protected and
                  never used to train third-party public models.
                </Text>

                <Text variant="heading" color={dark.textHi} style={styles.sectionHeading}>
                  4. Data Ownership & Storage
                </Text>
                <Text variant="body" color={dark.textMid} style={styles.paragraph}>
                  Your data belongs to you. You can export your entire history in JSON format or
                  delete your account with immediate data purging from both cloud servers and local
                  storage.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Bottom Accept Action */}
          <View style={styles.bottomBar}>
            <Button
              variant="primary"
              size="lg"
              label="I Agree & Continue"
              onPress={handleAgree}
              testID="btn-terms-agree"
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
