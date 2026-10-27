import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface FoodPhotoDailyLimitModalProps {
  visible: boolean;
  userState?: 'trial' | 'paid' | 'free' | 'free_after_trial' | string;
  usedToday?: number;
  dailyCap?: number;
  onClose: () => void;
  onUpgrade?: () => void;
  onLogManually?: () => void;
}

export function FoodPhotoDailyLimitModal({
  visible,
  userState = 'trial',
  usedToday,
  dailyCap,
  onClose,
  onUpgrade,
  onLogManually,
}: FoodPhotoDailyLimitModalProps) {
  const { colors } = useTheme();

  const getLimitBodyText = () => {
    switch (userState) {
      case 'paid':
      case 'paid_pro':
        return t('foodLog.photo.limitBodyPaid');
      case 'free':
      case 'free_taste':
      case 'free_after_trial':
        return t('foodLog.photo.limitBodyFree');
      case 'trial':
      default:
        return t('foodLog.photo.limitBodyTrial');
    }
  };

  const showUpsell = userState !== 'paid' && userState !== 'paid_pro';

  return (
    <Modal
      testID="modal-food-photo-limit"
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          testID="card-food-photo-limit"
          style={[
            styles.container,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {/* Top Status Icon */}
          <View style={[styles.iconWrap, { backgroundColor: colors.cardHighlight }]}>
            <Ionicons name="information-circle-outline" size={36} color={colors.accent} />
          </View>

          <Text testID="text-limit-title" style={[styles.title, { color: colors.text }]}>
            {t(
              userState === 'paid' || userState === 'paid_pro'
                ? 'foodLog.photo.limitTitle'
                : 'brandRepair.photoLimitTitle',
            )}
          </Text>

          <Text testID="text-limit-body" style={[styles.body, { color: colors.textMuted }]}>
            {getLimitBodyText()}
          </Text>

          {/* Scans Today Pill */}
          {!showUpsell && typeof usedToday === 'number' && typeof dailyCap === 'number' && (
            <View
              testID="pill-scan-usage"
              style={[
                styles.usagePill,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.usageText, { color: colors.textMuted }]}>
                {t('capture.todayScans')}:{' '}
                <Text style={{ color: colors.text, fontWeight: '700' }}>{usedToday}</Text> /{' '}
                {dailyCap}
              </Text>
            </View>
          )}

          {/* Gentle Upsell Card for Trial / Free users */}
          {showUpsell && (
            <View
              testID="card-gentle-upsell"
              style={[
                styles.upsellCard,
                { backgroundColor: colors.cardHighlight, borderColor: colors.border },
              ]}
            >
              <View style={styles.upsellHeader}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={colors.macroCalories}
                />
                <Text style={[styles.upsellHeaderTitle, { color: colors.text }]}>
                  Room Plan Perks
                </Text>
              </View>
              <Text style={[styles.upsellText, { color: colors.textMuted }]}>
                {t('foodLog.photo.upgradeUpsell')}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionCol}>
            {showUpsell && onUpgrade && (
              <Pressable
                testID="btn-view-room-plans"
                accessibilityRole="button"
                accessibilityLabel={t('foodLog.photo.upgradeButton')}
                onPress={onUpgrade}
                style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
              >
                <Ionicons name="information-circle-outline" size={18} color={colors.onAccent} />
                <Text style={[styles.primaryBtnText, { color: colors.onAccent }]}>
                  {t('foodLog.photo.upgradeButton')}
                </Text>
              </Pressable>
            )}

            {onLogManually && (
              <Pressable
                testID="btn-limit-log-manually"
                accessibilityRole="button"
                accessibilityLabel={t('foodLog.photo.logManuallyButton')}
                onPress={onLogManually}
                style={[
                  styles.secondaryBtn,
                  { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                ]}
              >
                <Ionicons name="create-outline" size={18} color={colors.text} />
                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
                  {t('foodLog.photo.logManuallyButton')}
                </Text>
              </Pressable>
            )}

            <Pressable
              testID="btn-close-limit-modal"
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
              onPress={onClose}
              style={styles.cancelBtn}
            >
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                {t('common.cancel')}
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
    maxWidth: 400,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  body: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  usagePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  usageText: {
    fontSize: fontSize.xs,
  },
  upsellCard: {
    width: '100%',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 6,
    marginBottom: spacing.lg,
  },
  upsellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  upsellHeaderTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  upsellText: {
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  actionCol: {
    width: '100%',
    gap: spacing.sm,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  primaryBtnText: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
});
