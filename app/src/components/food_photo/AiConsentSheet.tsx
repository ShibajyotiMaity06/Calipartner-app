import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface AiConsentSheetProps {
  visible: boolean;
  onAccept: () => void | Promise<void>;
  onDecline: () => void;
  loading?: boolean;
}

export function AiConsentSheet({
  visible,
  onAccept,
  onDecline,
  loading = false,
}: AiConsentSheetProps) {
  const { colors } = useTheme();

  return (
    <Modal
      testID="modal-ai-consent-sheet"
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDecline}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.container,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {/* Header Icon */}
          <View style={[styles.iconWrap, { backgroundColor: colors.cardHighlight }]}>
            <Ionicons name="information-circle-outline" size={32} color={colors.accent} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            {t('foodLog.photo.consentTitle')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('foodLog.photo.consentSubtitle')}
          </Text>

          {/* Itemized Privacy Guarantees */}
          <View style={styles.bulletsWrap}>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletIcon, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="eye-outline" size={18} color={colors.accent} />
              </View>
              <Text style={[styles.bulletText, { color: colors.text }]}>
                {t('foodLog.photo.consentBullet1')}
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <View style={[styles.bulletIcon, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="trash-bin-outline" size={18} color={colors.accent} />
              </View>
              <Text style={[styles.bulletText, { color: colors.text }]}>
                {t('foodLog.photo.consentBullet2')}
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <View style={[styles.bulletIcon, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
              </View>
              <Text style={[styles.bulletText, { color: colors.text }]}>
                {t('foodLog.photo.consentBullet3')}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionsWrap}>
            <Pressable
              testID="btn-accept-ai-consent"
              accessibilityRole="button"
              accessibilityLabel={t('foodLog.photo.acceptConsent')}
              disabled={loading}
              onPress={onAccept}
              style={[
                styles.primaryBtn,
                { backgroundColor: colors.accent, opacity: loading ? 0.7 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color={colors.onAccent} size="small" />
              ) : (
                <Text style={[styles.primaryBtnText, { color: colors.onAccent }]}>
                  {t('foodLog.photo.acceptConsent')}
                </Text>
              )}
            </Pressable>

            <Pressable
              testID="btn-decline-ai-consent"
              accessibilityRole="button"
              accessibilityLabel={t('foodLog.photo.declineConsent')}
              disabled={loading}
              onPress={onDecline}
              style={styles.secondaryBtn}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.textMuted }]}>
                {t('foodLog.photo.declineConsent')}
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  bulletsWrap: {
    width: '100%',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bulletIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  actionsWrap: {
    width: '100%',
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
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  secondaryBtn: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
