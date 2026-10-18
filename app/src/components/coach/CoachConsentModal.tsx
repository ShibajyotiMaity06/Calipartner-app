import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface CoachConsentModalProps {
  visible: boolean;
  onAgree: () => void;
  onDecline: () => void;
  onOpenDeleteHistory?: () => void;
}

export function CoachConsentModal({
  visible,
  onAgree,
  onDecline,
  onOpenDeleteHistory,
}: CoachConsentModalProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onDecline}
      testID="modal-coach-consent"
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.container,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: colors.cardHighlight },
              ]}
            >
              <Ionicons name="shield-checkmark" size={26} color={colors.accent} />
            </View>
            <Text
              style={[styles.title, { color: colors.text }]}
              testID="text-coach-consent-title"
            >
              {t('coach.consent.title')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {t('coach.consent.subtitle')}
            </Text>
          </View>

          {/* Bullet points explaining data usage and safeguards */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.bulletCard,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
            >
              <View style={styles.bulletRow}>
                <Ionicons
                  name="person-circle-outline"
                  size={20}
                  color={colors.accent}
                  style={styles.bulletIcon}
                />
                <Text style={[styles.bulletText, { color: colors.text }]}>
                  {t('coach.consent.bullet1')}
                </Text>
              </View>

              <View style={styles.bulletRow}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={colors.syncSynced}
                  style={styles.bulletIcon}
                />
                <Text style={[styles.bulletText, { color: colors.text }]}>
                  {t('coach.consent.bullet2')}
                </Text>
              </View>

              <View style={styles.bulletRow}>
                <Ionicons
                  name="eye-off-outline"
                  size={20}
                  color={colors.syncSynced}
                  style={styles.bulletIcon}
                />
                <Text style={[styles.bulletText, { color: colors.text }]}>
                  {t('coach.consent.bullet3')}
                </Text>
              </View>

              <View style={styles.bulletRow}>
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={colors.textMuted}
                  style={styles.bulletIcon}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bulletText, { color: colors.text }]}>
                    {t('coach.consent.bullet4')}
                  </Text>
                  {onOpenDeleteHistory && (
                    <Pressable
                      onPress={onOpenDeleteHistory}
                      testID="btn-coach-consent-delete-history"
                      accessibilityRole="button"
                      accessibilityLabel={t('coach.consent.deleteHistoryLink')}
                      style={{ marginTop: 6 }}
                    >
                      <Text
                        style={[
                          styles.linkText,
                          { color: colors.accent },
                        ]}
                      >
                        {t('coach.consent.deleteHistoryLink')} →
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.buttonGroup}>
            <Pressable
              onPress={onAgree}
              style={[
                styles.primaryBtn,
                { backgroundColor: colors.accent },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('coach.consent.agreeBtn')}
              testID="btn-coach-consent-agree"
            >
              <Text style={styles.primaryBtnText}>
                {t('coach.consent.agreeBtn')}
              </Text>
            </Pressable>

            <Pressable
              onPress={onDecline}
              style={[
                styles.secondaryBtn,
                { borderColor: colors.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('coach.consent.declineBtn')}
              testID="btn-coach-consent-decline"
            >
              <Text style={[styles.secondaryBtnText, { color: colors.textMuted }]}>
                {t('coach.consent.declineBtn')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  container: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: 4,
  },
  scrollArea: {
    maxHeight: 280,
    marginVertical: spacing.sm,
  },
  scrollContent: {
    paddingVertical: 2,
  },
  bulletCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bulletIcon: {
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  linkText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  buttonGroup: {
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  primaryBtn: {
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  secondaryBtn: {
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
});
