import { visualPrimitives } from '@calipartner/ui/tokens';
import { Button } from '@calipartner/ui';
import { Text } from '@calipartner/ui';
import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
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
            <Ionicons name="scan-outline" size={36} color={colors.accent} />
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

          {/* Action Buttons */}
          <View style={styles.actionCol}>
            {showUpsell && onUpgrade && (
              <Button
                label={t('foodLog.photo.upgradeButton')}
                icon={<Ionicons name="sparkles" size={18} color={colors.onBrand} />}
                testID="btn-view-room-plans"
                accessibilityRole="button"
                accessibilityLabel={t('foodLog.photo.upgradeButton')}
                onPress={onUpgrade}
              />
            )}

            {onLogManually && (
              <Button
                variant="secondary"
                label={t('foodLog.photo.logManuallyButton')}
                icon={<Ionicons name="create-outline" size={18} color={colors.text} />}
                testID="btn-limit-log-manually"
                accessibilityRole="button"
                accessibilityLabel={t('foodLog.photo.logManuallyButton')}
                onPress={onLogManually}
              />
            )}

            <Button
              variant="cancel"
              label={t('common.cancel')}
              testID="btn-close-limit-modal"
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
              onPress={onClose}
            />
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
    shadowColor: visualPrimitives.colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: visualPrimitives.effects[16],
    elevation: visualPrimitives.effects[8],
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
  actionCol: {
    width: '100%',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
});
