import { useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StepPermissionStatus } from '@/services/stepIntegrationService';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface HealthPermissionModalProps {
  visible: boolean;
  status: StepPermissionStatus;
  onClose: () => void;
  onRequestPermission: () => Promise<boolean>;
}

export function HealthPermissionModal({
  visible,
  status,
  onClose,
  onRequestPermission,
}: HealthPermissionModalProps) {
  const { colors } = useTheme();
  const [requesting, setRequesting] = useState(false);

  const isGranted = status === 'granted';
  const isDenied = status === 'denied';
  const isUnavailable = status === 'unavailable';

  const handleRequest = async () => {
    try {
      setRequesting(true);
      await onRequestPermission();
    } finally {
      setRequesting(false);
    }
  };

  const handleOpenSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      // Graceful fallback
    }
  };

  const platformName = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      testID="modal-health-permission"
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={t('common.cancel')}
        />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="heart-circle" size={24} color={colors.accent} />
              <View>
                <Text style={[styles.title, { color: colors.text }]}>
                  {t('trackers.permissions.title')}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                  {platformName}
                </Text>
              </View>
            </View>
            <Pressable
              testID="btn-close-permission"
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.scrollBody}
            showsVerticalScrollIndicator={false}
          >
            {/* Connection Status Banner */}
            <View
              testID="status-permission-badge"
              style={[
                styles.statusBanner,
                {
                  backgroundColor: isGranted
                    ? colors.cardHighlight
                    : isDenied
                    ? colors.surfaceAlt
                    : colors.surfaceAlt,
                  borderColor: isGranted ? colors.syncSynced : colors.border,
                },
              ]}
            >
              <Ionicons
                name={
                  isGranted
                    ? 'checkmark-circle'
                    : isDenied
                    ? 'alert-circle'
                    : isUnavailable
                    ? 'cloud-offline-outline'
                    : 'information-circle-outline'
                }
                size={22}
                color={
                  isGranted
                    ? colors.syncSynced
                    : isDenied
                    ? colors.danger
                    : colors.accent
                }
              />
              <View style={styles.statusBannerText}>
                <Text style={[styles.statusBannerTitle, { color: colors.text }]}>
                  {isGranted
                    ? t('trackers.permissions.statusGranted')
                    : isDenied
                    ? t('trackers.permissions.statusDenied')
                    : isUnavailable
                    ? t('trackers.permissions.statusUnavailable')
                    : t('trackers.permissions.statusNotRequested')}
                </Text>
                <Text style={[styles.statusBannerSub, { color: colors.textMuted }]}>
                  {isGranted
                    ? `Synchronized with ${platformName}`
                    : isDenied
                    ? 'Step counting permissions were declined'
                    : isUnavailable
                    ? 'Sensor data will use phone pedometer'
                    : `Tap below to connect ${platformName}`}
                </Text>
              </View>
            </View>

            {/* If Denied: "How to Enable" Detailed Guide */}
            {isDenied && (
              <View
                testID="how-to-enable-guide"
                style={[
                  styles.deniedGuideCard,
                  { backgroundColor: colors.surfaceAlt, borderColor: colors.danger },
                ]}
              >
                <View style={styles.guideHeader}>
                  <Ionicons name="settings-outline" size={18} color={colors.danger} />
                  <Text style={[styles.guideTitle, { color: colors.text }]}>
                    {t('trackers.permissions.howToEnableTitle')}
                  </Text>
                </View>

                {Platform.OS === 'android' ? (
                  <View style={styles.instructionsContainer}>
                    <Text style={[styles.platformHeader, { color: colors.accent }]}>
                      {t('trackers.permissions.androidTitle')}
                    </Text>
                    <Text style={[styles.instructionsText, { color: colors.text }]}>
                      {t('trackers.permissions.androidInstructions')}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.instructionsContainer}>
                    <Text style={[styles.platformHeader, { color: colors.accent }]}>
                      {t('trackers.permissions.iosTitle')}
                    </Text>
                    <Text style={[styles.instructionsText, { color: colors.text }]}>
                      {t('trackers.permissions.iosInstructions')}
                    </Text>
                  </View>
                )}

                <Pressable
                  testID="btn-open-settings"
                  onPress={() => void handleOpenSettings()}
                  style={[styles.settingsBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('trackers.permissions.openSettingsButton')}
                >
                  <Ionicons name="open-outline" size={16} color={colors.accent} />
                  <Text style={[styles.settingsBtnText, { color: colors.accent }]}>
                    {t('trackers.permissions.openSettingsButton')}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Value Propositions / Why Connect */}
            <View style={styles.featuresSection}>
              <Text style={[styles.featuresHeading, { color: colors.text }]}>
                {t('trackers.permissions.whyConnectTitle')}
              </Text>

              {/* Feature 1 */}
              <View style={styles.featureRow}>
                <View style={[styles.featureIcon, { backgroundColor: colors.cardHighlight }]}>
                  <Ionicons name="walk-outline" size={18} color={colors.accent} />
                </View>
                <View style={styles.featureText}>
                  <Text style={[styles.featureTitle, { color: colors.text }]}>
                    {t('trackers.permissions.feature1Title')}
                  </Text>
                  <Text style={[styles.featureDesc, { color: colors.textMuted }]}>
                    {t('trackers.permissions.feature1Desc')}
                  </Text>
                </View>
              </View>

              {/* Feature 2 */}
              <View style={styles.featureRow}>
                <View style={[styles.featureIcon, { backgroundColor: colors.cardHighlight }]}>
                  <Ionicons name="navigate-outline" size={18} color={colors.accent} />
                </View>
                <View style={styles.featureText}>
                  <Text style={[styles.featureTitle, { color: colors.text }]}>
                    {t('trackers.permissions.feature2Title')}
                  </Text>
                  <Text style={[styles.featureDesc, { color: colors.textMuted }]}>
                    {t('trackers.permissions.feature2Desc')}
                  </Text>
                </View>
              </View>

              {/* Feature 3 */}
              <View style={styles.featureRow}>
                <View style={[styles.featureIcon, { backgroundColor: colors.cardHighlight }]}>
                  <Ionicons name="battery-charging-outline" size={18} color={colors.accent} />
                </View>
                <View style={styles.featureText}>
                  <Text style={[styles.featureTitle, { color: colors.text }]}>
                    {t('trackers.permissions.feature3Title')}
                  </Text>
                  <Text style={[styles.featureDesc, { color: colors.textMuted }]}>
                    {t('trackers.permissions.feature3Desc')}
                  </Text>
                </View>
              </View>

              {/* Feature 4 */}
              <View style={styles.featureRow}>
                <View style={[styles.featureIcon, { backgroundColor: colors.cardHighlight }]}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
                </View>
                <View style={styles.featureText}>
                  <Text style={[styles.featureTitle, { color: colors.text }]}>
                    {t('trackers.permissions.feature4Title')}
                  </Text>
                  <Text style={[styles.featureDesc, { color: colors.textMuted }]}>
                    {t('trackers.permissions.feature4Desc')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Fallback Notice */}
            <Text style={[styles.fallbackNotice, { color: colors.textMuted }]}>
              {t('trackers.permissions.fallbackNotice')}
            </Text>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footerRow}>
            {!isGranted && !isUnavailable && (
              <Pressable
                testID="btn-grant-permission"
                onPress={() => void handleRequest()}
                disabled={requesting}
                style={[styles.primaryActionBtn, { backgroundColor: colors.accent }]}
                accessibilityRole="button"
                accessibilityLabel={
                  isDenied
                    ? t('trackers.permissions.reconnectButton')
                    : t('trackers.permissions.connectButton')
                }
              >
                <Ionicons name="link-outline" size={18} color={colors.onAccent} />
                <Text style={[styles.primaryActionText, { color: colors.onAccent }]}>
                  {requesting
                    ? t('common.loading')
                    : isDenied
                    ? t('trackers.permissions.reconnectButton')
                    : t('trackers.permissions.connectButton')}
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={onClose}
              style={[
                styles.closeButton,
                {
                  backgroundColor: isGranted ? colors.accent : colors.surfaceAlt,
                  borderColor: colors.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('trackers.permissions.close')}
            >
              <Text
                style={[
                  styles.closeButtonText,
                  { color: isGranted ? colors.onAccent : colors.text },
                ]}
              >
                {t('trackers.permissions.close')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: fontSize.xs,
  },
  contentScroll: {
    maxHeight: 440,
  },
  scrollBody: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  statusBannerText: {
    flex: 1,
    gap: 2,
  },
  statusBannerTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  statusBannerSub: {
    fontSize: fontSize.xs,
  },
  deniedGuideCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: spacing.sm,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guideTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  instructionsContainer: {
    gap: 4,
  },
  platformHeader: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  instructionsText: {
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginTop: 4,
  },
  settingsBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  featuresSection: {
    gap: spacing.sm,
  },
  featuresHeading: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  featureRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  featureDesc: {
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  fallbackNotice: {
    fontSize: fontSize.xs,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  footerRow: {
    gap: 8,
    marginTop: spacing.xs,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: radius.sm,
  },
  primaryActionText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  closeButton: {
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
