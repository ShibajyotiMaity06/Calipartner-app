import React, { useState } from 'react';
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

interface PlaceholderPaywallModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PlaceholderPaywallModal({ visible, onClose }: PlaceholderPaywallModalProps) {
  const { colors } = useTheme();
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'threeMonth' | 'monthly'>('annual');
  const [purchasedToast, setPurchasedToast] = useState(false);

  const plans = [
    {
      id: 'annual',
      title: t('rooms.paywall.annualPlan'),
      price: t('rooms.paywall.annualPrice'),
      badge: t('rooms.paywall.annualSavings'),
    },
    {
      id: 'threeMonth',
      title: t('rooms.paywall.threeMonthPlan'),
      price: t('rooms.paywall.threeMonthPrice'),
    },
    {
      id: 'monthly',
      title: t('rooms.paywall.monthlyPlan'),
      price: t('rooms.paywall.monthlyPrice'),
    },
  ] as const;

  const features = [
    { icon: 'people-outline', text: t('rooms.paywall.featureRooms') },
    { icon: 'chatbubbles-outline', text: t('rooms.paywall.featureChat') },
    { icon: 'trending-up-outline', text: t('rooms.paywall.featureProgress') },
    { icon: 'sparkles-outline', text: t('rooms.paywall.featureCoach') },
  ];

  const handleStartPremium = () => {
    // In Phase 5 this is a placeholder modal (real store purchases come in Phase 10)
    setPurchasedToast(true);
    setTimeout(() => {
      setPurchasedToast(false);
      onClose();
    }, 1500);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <View style={[styles.sparklePill, { backgroundColor: colors.cardHighlight }]}>
                <Ionicons name="sparkles" size={14} color={colors.accent} />
                <Text style={[styles.sparkleText, { color: colors.accent }]}>PREMIUM</Text>
              </View>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('rooms.paywall.title')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {t('rooms.paywall.subtitle')}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel="Close paywall"
              testID="btn-close-paywall"
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Features List */}
            <View style={[styles.featuresBox, { backgroundColor: colors.surfaceAlt }]}>
              {features.map((f, i) => (
                <View key={i} style={styles.featureItem}>
                  <Ionicons name={f.icon as keyof typeof Ionicons.glyphMap} size={18} color={colors.accent} />
                  <Text style={[styles.featureText, { color: colors.text }]}>{f.text}</Text>
                </View>
              ))}

              <View style={[styles.freeNoticeDivider, { backgroundColor: colors.border }]} />
              <View style={styles.freeNoticeRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.syncSynced} />
                <Text style={[styles.freeNoticeText, { color: colors.textMuted }]}>
                  {t('rooms.paywall.featureFree')}
                </Text>
              </View>
            </View>

            {/* Plans Selection */}
            <View style={styles.plansContainer}>
              {plans.map((p) => {
                const isSelected = selectedPlan === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setSelectedPlan(p.id)}
                    style={[
                      styles.planCard,
                      {
                        backgroundColor: isSelected ? colors.cardHighlight : colors.surface,
                        borderColor: isSelected ? colors.accent : colors.border,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    testID={`plan-card-${p.id}`}
                  >
                    <View style={styles.planCardLeft}>
                      <View style={styles.planTitleRow}>
                        <Text style={[styles.planTitle, { color: colors.text }]}>{p.title}</Text>
                        {'badge' in p && (
                          <View style={[styles.planBadge, { backgroundColor: colors.accent }]}>
                            <Text style={styles.planBadgeText}>{p.badge}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.planPrice, { color: colors.textMuted }]}>{p.price}</Text>
                    </View>

                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={isSelected ? colors.accent : colors.textMuted}
                    />
                  </Pressable>
                );
              })}
            </View>

            {/* Start Button */}
            <Pressable
              onPress={handleStartPremium}
              style={[styles.submitButton, { backgroundColor: colors.accent }]}
              accessibilityRole="button"
              accessibilityLabel="Start Premium"
              testID="btn-start-premium"
            >
              <Text style={styles.submitButtonText}>
                {purchasedToast ? 'Unlocked for Preview! ✨' : t('rooms.paywall.startPremium')}
              </Text>
            </Pressable>

            {/* Restore & Terms */}
            <Pressable
              onPress={onClose}
              style={styles.restoreButton}
              accessibilityRole="button"
              accessibilityLabel="Restore purchases"
            >
              <Text style={[styles.restoreText, { color: colors.textMuted }]}>
                {t('rooms.paywall.restorePurchases')}
              </Text>
            </Pressable>

            <Text style={[styles.termsText, { color: colors.textMuted }]}>
              {t('rooms.paywall.termsNotice')}
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  headerTitleGroup: {
    flex: 1,
  },
  sparklePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    gap: 4,
    marginBottom: spacing.xs,
  },
  sparkleText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  featuresBox: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    fontSize: fontSize.xs + 1,
    fontWeight: '600',
    flex: 1,
  },
  freeNoticeDivider: {
    height: 1,
    marginVertical: 4,
  },
  freeNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  freeNoticeText: {
    fontSize: 11,
    flex: 1,
  },
  plansContainer: {
    gap: spacing.xs + 2,
    marginBottom: spacing.md,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  planCardLeft: {
    flex: 1,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  planTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  planBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  planBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  planPrice: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  submitButton: {
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  restoreText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  termsText: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
});
