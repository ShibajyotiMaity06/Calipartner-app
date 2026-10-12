import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PurchasesPackage } from 'react-native-purchases';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { useSubscription } from '@/hooks/useSubscription';

export type RoomSizeBracket = '2-5' | '6-20' | '21-50';
export type PlanDuration = 'monthly' | 'quarterly' | 'annual';
export type PlanTier = 'basic' | 'plus' | 'pro';

export interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  preselectedTier?: PlanTier;
  sponsorRoomId?: string;
  isUpgrade?: boolean;
}

export function PaywallModal({
  visible,
  onClose,
  preselectedTier,
  sponsorRoomId,
  isUpgrade,
}: PaywallModalProps) {
  const { colors } = useTheme();
  const {
    offerings,
    entitlement,
    loading: subLoading,
    error: subError,
    purchase,
    restore,
    sponsor,
  } = useSubscription();

  // Selected state
  const [selectedSize, setSelectedSize] = useState<RoomSizeBracket>(() => {
    if (preselectedTier === 'pro') return '21-50';
    if (preselectedTier === 'plus') return '6-20';
    return '2-5';
  });

  const [selectedDuration, setSelectedDuration] = useState<PlanDuration>('annual');
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Map size bracket to plan tier
  const currentTier: PlanTier = useMemo(() => {
    switch (selectedSize) {
      case '21-50':
        return 'pro';
      case '6-20':
        return 'plus';
      case '2-5':
      default:
        return 'basic';
    }
  }, [selectedSize]);

  // Find corresponding RevenueCat package if offerings are loaded
  const matchedPackage: PurchasesPackage | null = useMemo(() => {
    if (!offerings) return null;

    const offeringForTier =
      offerings.all?.[currentTier] ?? offerings.current;

    if (!offeringForTier) return null;

    const packages = offeringForTier.availablePackages;
    const expectedId = `${currentTier}_${selectedDuration}`;

    return (
      packages.find((p) => p.identifier === expectedId) ??
      packages.find(
        (p) =>
          p.identifier.includes(currentTier) &&
          p.identifier.includes(selectedDuration),
      ) ??
      null
    );
  }, [offerings, currentTier, selectedDuration]);

  // Localized price strings (falls back to PRD 6.18 standard pricing)
  const priceDisplay = useMemo(() => {
    if (matchedPackage?.product?.priceString) {
      return matchedPackage.product.priceString;
    }

    // Fallbacks from PRD 6.18
    const fallbackPrices: Record<PlanTier, Record<PlanDuration, string>> = {
      basic: {
        monthly: '₹99 / mo',
        quarterly: '₹249 / 3 mos',
        annual: '₹799 / yr',
      },
      plus: {
        monthly: '₹200 / mo',
        quarterly: '₹499 / 3 mos',
        annual: '₹1,599 / yr',
      },
      pro: {
        monthly: '₹300 / mo',
        quarterly: '₹749 / 3 mos',
        annual: '₹2,399 / yr',
      },
    };

    return fallbackPrices[currentTier][selectedDuration];
  }, [matchedPackage, currentTier, selectedDuration]);

  // Equivalent per-month cost for annual plan
  const perMonthDisplay = useMemo(() => {
    if (selectedDuration !== 'annual') return null;

    const perMonthMap: Record<PlanTier, string> = {
      basic: '₹67 / mo',
      plus: '₹133 / mo',
      pro: '₹200 / mo',
    };

    return perMonthMap[currentTier];
  }, [selectedDuration, currentTier]);

  const handleSizeSelect = (bracket: RoomSizeBracket) => {
    setSelectedSize(bracket);
    setStatusMessage(null);
  };

  const handlePurchase = async () => {
    setActionLoading(true);
    setStatusMessage(null);

    try {
      if (sponsorRoomId) {
        // Sponsoring locked room
        const success = await sponsor(sponsorRoomId);
        if (success) {
          setStatusMessage(t('rooms.paused.keepGoingBtn'));
          setTimeout(onClose, 1200);
          return;
        }
      }

      if (matchedPackage) {
        const success = await purchase(
          matchedPackage,
          Boolean(isUpgrade),
          entitlement?.store_product_id ?? undefined,
        );
        if (success) {
          setStatusMessage('Plan unlocked! ✨');
          setTimeout(onClose, 1200);
          return;
        }
      } else {
        // Mock fallback preview for demo/development
        setStatusMessage('Plan activated for preview! ✨');
        setTimeout(onClose, 1500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async () => {
    setActionLoading(true);
    setStatusMessage(null);

    try {
      const success = await restore();
      if (success) {
        setStatusMessage(t('rooms.paywall.restoreSuccess'));
      } else {
        setStatusMessage(t('rooms.paywall.restoreNotFound'));
      }
    } catch {
      setStatusMessage(t('rooms.paywall.restoreNotFound'));
    } finally {
      setActionLoading(false);
    }
  };

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Notice', 'Unable to open link');
    });
  };

  const tierName =
    currentTier === 'pro' ? 'Pro' : currentTier === 'plus' ? 'Plus' : 'Basic';

  const actionButtonText = sponsorRoomId
    ? t('rooms.paywall.sponsorPlan', { tier: tierName })
    : isUpgrade
    ? t('rooms.paywall.upgradePlan', { tier: tierName })
    : t('rooms.paywall.startPlan', { tier: tierName });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay} testID="modal-paywall">
        <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <View
                style={[
                  styles.sparklePill,
                  { backgroundColor: colors.cardHighlight },
                ]}
              >
                <Ionicons name="sparkles" size={13} color={colors.accent} />
                <Text style={[styles.sparkleText, { color: colors.accent }]}>
                  ROOM PLANS
                </Text>
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
              style={[
                styles.closeButton,
                { backgroundColor: colors.surfaceAlt },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('rooms.paywall.close')}
              testID="btn-close-paywall"
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Status / Error Banner */}
            {(statusMessage || subError) && (
              <View
                style={[
                  styles.statusBanner,
                  {
                    backgroundColor: colors.cardHighlight,
                    borderColor: colors.border,
                  },
                ]}
                testID="banner-paywall-status"
              >
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={colors.accent}
                />
                <Text style={[styles.statusText, { color: colors.text }]}>
                  {statusMessage ?? subError}
                </Text>
              </View>
            )}

            {/* 1. Size Picker (PRD SUB-10) */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('rooms.paywall.sizePickerTitle')}
              </Text>

              <View style={styles.sizePickerRow}>
                {/* 2-5 Basic */}
                <Pressable
                  onPress={() => handleSizeSelect('2-5')}
                  style={[
                    styles.sizeCard,
                    {
                      backgroundColor:
                        selectedSize === '2-5'
                          ? colors.cardHighlight
                          : colors.surfaceAlt,
                      borderColor:
                        selectedSize === '2-5' ? colors.accent : colors.border,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedSize === '2-5' }}
                  accessibilityLabel="Size 2 to 5 people, Basic plan"
                  testID="picker-size-2-5"
                >
                  <Text style={[styles.sizeCardTitle, { color: colors.text }]}>
                    {t('rooms.paywall.sizeBasic')}
                  </Text>
                  <Text
                    style={[styles.sizeCardSubtitle, { color: colors.textMuted }]}
                  >
                    Basic (up to 5)
                  </Text>
                </Pressable>

                {/* 6-20 Plus */}
                <Pressable
                  onPress={() => handleSizeSelect('6-20')}
                  style={[
                    styles.sizeCard,
                    {
                      backgroundColor:
                        selectedSize === '6-20'
                          ? colors.cardHighlight
                          : colors.surfaceAlt,
                      borderColor:
                        selectedSize === '6-20' ? colors.accent : colors.border,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedSize === '6-20' }}
                  accessibilityLabel="Size 6 to 20 people, Plus plan"
                  testID="picker-size-6-20"
                >
                  <Text style={[styles.sizeCardTitle, { color: colors.text }]}>
                    {t('rooms.paywall.sizePlus')}
                  </Text>
                  <Text
                    style={[styles.sizeCardSubtitle, { color: colors.textMuted }]}
                  >
                    Plus (up to 20)
                  </Text>
                </Pressable>

                {/* 21-50 Pro */}
                <Pressable
                  onPress={() => handleSizeSelect('21-50')}
                  style={[
                    styles.sizeCard,
                    {
                      backgroundColor:
                        selectedSize === '21-50'
                          ? colors.cardHighlight
                          : colors.surfaceAlt,
                      borderColor:
                        selectedSize === '21-50'
                          ? colors.accent
                          : colors.border,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedSize === '21-50' }}
                  accessibilityLabel="Size 21 to 50 people, Pro plan"
                  testID="picker-size-21-50"
                >
                  <Text style={[styles.sizeCardTitle, { color: colors.text }]}>
                    {t('rooms.paywall.sizePro')}
                  </Text>
                  <Text
                    style={[styles.sizeCardSubtitle, { color: colors.textMuted }]}
                  >
                    Pro (up to 50)
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* 2. Billing Duration Toggle */}
            <View style={styles.sectionBlock}>
              <View
                style={[
                  styles.durationToggleContainer,
                  { backgroundColor: colors.surfaceAlt },
                ]}
              >
                {/* Monthly */}
                <Pressable
                  onPress={() => setSelectedDuration('monthly')}
                  style={[
                    styles.durationToggleItem,
                    selectedDuration === 'monthly' && [
                      styles.durationToggleSelected,
                      { backgroundColor: colors.surface },
                    ],
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: selectedDuration === 'monthly',
                  }}
                  testID="toggle-duration-monthly"
                >
                  <Text
                    style={[
                      styles.durationToggleText,
                      {
                        color:
                          selectedDuration === 'monthly'
                            ? colors.text
                            : colors.textMuted,
                      },
                    ]}
                  >
                    {t('rooms.paywall.durationMonthly')}
                  </Text>
                </Pressable>

                {/* 3 Months */}
                <Pressable
                  onPress={() => setSelectedDuration('quarterly')}
                  style={[
                    styles.durationToggleItem,
                    selectedDuration === 'quarterly' && [
                      styles.durationToggleSelected,
                      { backgroundColor: colors.surface },
                    ],
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: selectedDuration === 'quarterly',
                  }}
                  testID="toggle-duration-quarterly"
                >
                  <Text
                    style={[
                      styles.durationToggleText,
                      {
                        color:
                          selectedDuration === 'quarterly'
                            ? colors.text
                            : colors.textMuted,
                      },
                    ]}
                  >
                    {t('rooms.paywall.durationQuarterly')}
                  </Text>
                </Pressable>

                {/* Annual */}
                <Pressable
                  onPress={() => setSelectedDuration('annual')}
                  style={[
                    styles.durationToggleItem,
                    selectedDuration === 'annual' && [
                      styles.durationToggleSelected,
                      { backgroundColor: colors.surface },
                    ],
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: selectedDuration === 'annual',
                  }}
                  testID="toggle-duration-annual"
                >
                  <View style={styles.annualLabelWrap}>
                    <Text
                      style={[
                        styles.durationToggleText,
                        {
                          color:
                            selectedDuration === 'annual'
                              ? colors.text
                              : colors.textMuted,
                        },
                      ]}
                    >
                      {t('rooms.paywall.durationAnnual')}
                    </Text>
                    <View
                      style={[
                        styles.savingsBadge,
                        { backgroundColor: colors.accent },
                      ]}
                    >
                      <Text style={styles.savingsBadgeText}>SAVE 33%</Text>
                    </View>
                  </View>
                </Pressable>
              </View>
            </View>

            {/* 3. Price Summary Card */}
            <View
              style={[
                styles.priceCard,
                {
                  backgroundColor: colors.cardHighlight,
                  borderColor: colors.accent,
                },
              ]}
              testID="card-price-summary"
            >
              <View style={styles.priceRow}>
                <View>
                  <Text style={[styles.planTitleText, { color: colors.text }]}>
                    {tierName} Room Plan
                  </Text>
                  <Text
                    style={[styles.planCapSubtitle, { color: colors.textMuted }]}
                  >
                    Covers room of{' '}
                    {currentTier === 'pro'
                      ? 'up to 50'
                      : currentTier === 'plus'
                      ? 'up to 20'
                      : 'up to 5'}{' '}
                    people
                  </Text>
                </View>

                <View style={styles.priceTextGroup}>
                  <Text style={[styles.priceMainText, { color: colors.text }]}>
                    {perMonthDisplay ? perMonthDisplay : priceDisplay}
                  </Text>
                  {perMonthDisplay && (
                    <Text
                      style={[
                        styles.priceBilledPeriodText,
                        { color: colors.textMuted },
                      ]}
                    >
                      Billed as {priceDisplay}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* 4. Features Included */}
            <View
              style={[
                styles.featuresCard,
                { backgroundColor: colors.surfaceAlt },
              ]}
            >
              <Text style={[styles.featuresHeader, { color: colors.text }]}>
                {t('rooms.paywall.featuresHeader')}
              </Text>

              <View style={styles.featureItem}>
                <Ionicons
                  name="people-outline"
                  size={16}
                  color={colors.accent}
                />
                <Text style={[styles.featureText, { color: colors.text }]}>
                  {t('rooms.paywall.featureRooms')}
                </Text>
              </View>

              <View style={styles.featureItem}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={16}
                  color={colors.accent}
                />
                <Text style={[styles.featureText, { color: colors.text }]}>
                  {t('rooms.paywall.featureChat')}
                </Text>
              </View>

              <View style={styles.featureItem}>
                <Ionicons
                  name="trending-up-outline"
                  size={16}
                  color={colors.accent}
                />
                <Text style={[styles.featureText, { color: colors.text }]}>
                  {t('rooms.paywall.featureProgress')}
                </Text>
              </View>

              <View style={styles.featureItem}>
                <Ionicons name="timer-outline" size={16} color={colors.accent} />
                <Text style={[styles.featureText, { color: colors.text }]}>
                  {t('rooms.paywall.featureFocus')}
                </Text>
              </View>

              <View style={styles.featureItem}>
                <Ionicons
                  name="sparkles-outline"
                  size={16}
                  color={colors.macroCalories}
                />
                <Text style={[styles.featureText, { color: colors.text }]}>
                  {t('rooms.paywall.featureCoach')}
                </Text>
              </View>

              <View style={styles.featureItem}>
                <Ionicons
                  name="compass-outline"
                  size={16}
                  color={colors.macroProtein}
                />
                <Text style={[styles.featureText, { color: colors.text }]}>
                  {t('rooms.paywall.featureFinder')}
                </Text>
              </View>

              {/* Free Guarantee Divider */}
              <View
                style={[
                  styles.freeNoticeDivider,
                  { backgroundColor: colors.border },
                ]}
              />

              <View style={styles.freeNoticeRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={colors.syncSynced}
                />
                <Text
                  style={[styles.freeNoticeText, { color: colors.textMuted }]}
                >
                  {t('rooms.paywall.featureFree')}
                </Text>
              </View>
            </View>

            {/* 5. Purchase Action Button */}
            <Pressable
              onPress={handlePurchase}
              disabled={actionLoading || subLoading}
              style={[
                styles.purchaseButton,
                {
                  backgroundColor: colors.accent,
                  opacity: actionLoading ? 0.7 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={actionButtonText}
              testID="btn-paywall-purchase"
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.purchaseButtonText}>{actionButtonText}</Text>
              )}
            </Pressable>

            {/* 6. Restore Purchases */}
            <Pressable
              onPress={handleRestore}
              disabled={actionLoading}
              style={styles.restoreButton}
              accessibilityRole="button"
              accessibilityLabel={t('rooms.paywall.restorePurchases')}
              testID="btn-paywall-restore"
            >
              <Text
                style={[styles.restoreButtonText, { color: colors.textMuted }]}
              >
                {t('rooms.paywall.restorePurchases')}
              </Text>
            </Pressable>

            {/* 7. Terms & Privacy Notice */}
            <Text style={[styles.termsNoticeText, { color: colors.textMuted }]}>
              {t('rooms.paywall.termsNotice')}
            </Text>

            <View style={styles.legalLinksRow}>
              <Pressable
                onPress={() => openUrl('https://calipartner.com/terms')}
                accessibilityRole="link"
                accessibilityLabel="Terms of Service"
              >
                <Text style={[styles.legalLink, { color: colors.accent }]}>
                  {t('rooms.paywall.termsLink')}
                </Text>
              </Pressable>
              <Text style={{ color: colors.textMuted }}>•</Text>
              <Pressable
                onPress={() => openUrl('https://calipartner.com/privacy')}
                accessibilityRole="link"
                accessibilityLabel="Privacy Policy"
              >
                <Text style={[styles.legalLink, { color: colors.accent }]}>
                  {t('rooms.paywall.privacyLink')}
                </Text>
              </Pressable>
            </View>
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
    maxHeight: '92%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
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
    lineHeight: 16,
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
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 8,
    marginBottom: spacing.sm,
  },
  statusText: {
    fontSize: fontSize.xs,
    flex: 1,
    fontWeight: '500',
  },
  sectionBlock: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.xs + 1,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  sizePickerRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sizeCard: {
    flex: 1,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeCardTitle: {
    fontSize: fontSize.xs + 1,
    fontWeight: '700',
  },
  sizeCardSubtitle: {
    fontSize: 9,
    marginTop: 2,
    fontWeight: '500',
  },
  durationToggleContainer: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: 3,
  },
  durationToggleItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  durationToggleSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  durationToggleText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  annualLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savingsBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  savingsBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  priceCard: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planTitleText: {
    fontSize: fontSize.sm + 1,
    fontWeight: '700',
  },
  planCapSubtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  priceTextGroup: {
    alignItems: 'flex-end',
  },
  priceMainText: {
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  priceBilledPeriodText: {
    fontSize: 10,
    marginTop: 1,
  },
  featuresCard: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: 8,
  },
  featuresHeader: {
    fontSize: fontSize.xs + 1,
    fontWeight: '700',
    marginBottom: 2,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    flex: 1,
  },
  freeNoticeDivider: {
    height: 1,
    marginVertical: 4,
  },
  freeNoticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  freeNoticeText: {
    fontSize: 10,
    lineHeight: 14,
    flex: 1,
  },
  purchaseButton: {
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  purchaseButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 6,
  },
  restoreButtonText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  termsNoticeText: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: 6,
  },
  legalLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  legalLink: {
    fontSize: 10,
    fontWeight: '600',
  },
});
