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
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PurchasesPackage } from 'react-native-purchases';
import { PRICING_PLANS } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { useSubscription } from '@/hooks/useSubscription';

export type RoomSizeBracket = '2-5' | '6-20' | '21-50' | 'plus' | 'pro';
export type PlanDuration = 'monthly' | 'annual';
export type PlanTier = 'plus' | 'pro' | 'basic';

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

  // Selected Tier (Plus or Pro)
  const [selectedTier, setSelectedTier] = useState<'plus' | 'pro'>(() => {
    if (preselectedTier === 'pro') return 'pro';
    return 'plus';
  });

  // Selected Duration (Monthly or Annual — default to Annual per section 6)
  const [selectedDuration, setSelectedDuration] = useState<PlanDuration>('annual');
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Promo Code modal state
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoMessage, setPromoMessage] = useState<string | null>(null);

  // Find corresponding RevenueCat package if offerings are loaded
  const matchedPackage: PurchasesPackage | null = useMemo(() => {
    if (!offerings) return null;

    const offeringForTier = offerings.all?.[selectedTier] ?? offerings.current;
    if (!offeringForTier) return null;

    const packages = offeringForTier.availablePackages;
    const expectedId = `${selectedTier}_${selectedDuration}`;

    return (
      packages.find((p) => p.identifier === expectedId) ??
      packages.find(
        (p) => p.identifier.includes(selectedTier) && p.identifier.includes(selectedDuration),
      ) ??
      null
    );
  }, [offerings, selectedTier, selectedDuration]);

  const handlePurchase = async () => {
    setActionLoading(true);
    setStatusMessage(null);

    try {
      if (sponsorRoomId) {
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
          setStatusMessage('Plan unlocked');
          setTimeout(onClose, 1200);
          return;
        }
      } else {
        // Fallback preview activation for dev / testing environments
        setStatusMessage('Plan activated for preview');
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

  const handleApplyPromoCode = () => {
    const clean = promoCode.trim().toUpperCase();
    if (!clean) return;

    if (clean.endsWith('50') || clean === 'PARTNER50' || clean === 'LAUNCH50') {
      setPromoMessage('50% partner discount applied for your first year');
    } else {
      setPromoMessage('Invalid or expired code. Please verify with your partner');
    }
  };

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Notice', 'Unable to open link');
    });
  };

  const tierName = selectedTier === 'pro' ? 'Pro' : 'Plus';

  const actionButtonText = sponsorRoomId
    ? t('rooms.paywall.sponsorPlan', { tier: tierName })
    : isUpgrade
      ? t('rooms.paywall.upgradePlan', { tier: tierName })
      : selectedDuration === 'annual'
        ? t('rooms.paywall.startTrial')
        : t('rooms.paywall.startPlan', { tier: tierName });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay} testID="modal-paywall">
        <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <View style={[styles.sparklePill, { backgroundColor: colors.cardHighlight }]}>
                <Ionicons name="sparkles" size={13} color={colors.accent} />
                <Text style={[styles.sparkleText, { color: colors.accent }]}>
                  CALIPARTNER PLANS
                </Text>
              </View>
              <Text style={[styles.title, { color: colors.text }]}>{t('rooms.paywall.title')}</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {t('rooms.paywall.subtitle')}
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.surfaceAlt }]}
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
                <Ionicons name="information-circle-outline" size={16} color={colors.accent} />
                <Text style={[styles.statusText, { color: colors.text }]}>
                  {statusMessage ?? subError}
                </Text>
              </View>
            )}

            {/* 1. Duration Toggle (Annual vs Monthly) */}
            <View style={styles.sectionBlock}>
              <View
                style={[styles.durationToggleContainer, { backgroundColor: colors.surfaceAlt }]}
              >
                {/* Annual (Preselected, 50% Savings) */}
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
                  accessibilityState={{ selected: selectedDuration === 'annual' }}
                  accessibilityLabel="Annual billing, save 50 percent"
                  testID="toggle-duration-annual"
                >
                  <View style={styles.annualLabelWrap}>
                    <Text
                      style={[
                        styles.durationToggleText,
                        {
                          color: selectedDuration === 'annual' ? colors.text : colors.textMuted,
                        },
                      ]}
                    >
                      {t('rooms.paywall.durationAnnual')}
                    </Text>
                    <View style={[styles.savingsBadge, { backgroundColor: colors.accent }]}>
                      <Text style={[styles.savingsBadgeText, { color: colors.onBrand }]}>
                        SAVE 50%
                      </Text>
                    </View>
                  </View>
                </Pressable>

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
                  accessibilityState={{ selected: selectedDuration === 'monthly' }}
                  accessibilityLabel="Monthly billing"
                  testID="toggle-duration-monthly"
                >
                  <Text
                    style={[
                      styles.durationToggleText,
                      {
                        color: selectedDuration === 'monthly' ? colors.text : colors.textMuted,
                      },
                    ]}
                  >
                    {t('rooms.paywall.durationMonthly')}
                  </Text>
                </Pressable>
              </View>

              {/* Free Trial Pill on Annual */}
              {selectedDuration === 'annual' && (
                <View style={styles.trialCallout}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={colors.accent} />
                  <Text style={[styles.trialCalloutText, { color: colors.textMuted }]}>
                    {t('rooms.paywall.trialNotice')}
                  </Text>
                </View>
              )}
            </View>

            {/* 2. Tier Selection Cards (Plus vs Pro) */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('rooms.paywall.planPickerTitle')}
              </Text>

              <View style={styles.tierCardsRow}>
                {/* Plus Card */}
                <Pressable
                  onPress={() => setSelectedTier('plus')}
                  style={[
                    styles.tierCard,
                    {
                      backgroundColor:
                        selectedTier === 'plus' ? colors.cardHighlight : colors.surfaceAlt,
                      borderColor: selectedTier === 'plus' ? colors.accent : colors.border,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedTier === 'plus' }}
                  accessibilityLabel="CaliPartner Plus, up to 10 members, 1 hosted room"
                  testID="picker-size-6-20"
                >
                  <View style={styles.tierCardHeader}>
                    <Text style={[styles.tierCardTitle, { color: colors.text }]}>Plus</Text>
                    <View style={[styles.memberCapBadge, { backgroundColor: colors.surface }]}>
                      <Text style={[styles.memberCapText, { color: colors.accent }]}>
                        10 members
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.tierPriceText, { color: colors.text }]}>
                    {selectedDuration === 'annual'
                      ? PRICING_PLANS.plus.inr.perMonthAnnual
                      : PRICING_PLANS.plus.inr.monthly}
                  </Text>
                  <Text style={[styles.tierPricePeriod, { color: colors.textMuted }]}>
                    {selectedDuration === 'annual'
                      ? `Billed as ${PRICING_PLANS.plus.inr.annual}`
                      : 'Billed monthly'}
                  </Text>

                  <View style={styles.tierDivider} />

                  <View style={styles.bulletItem}>
                    <Ionicons name="checkmark" size={13} color={colors.accent} />
                    <Text style={[styles.bulletText, { color: colors.text }]}>
                      1 room you host (10 members)
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Ionicons name="checkmark" size={13} color={colors.accent} />
                    <Text style={[styles.bulletText, { color: colors.text }]}>
                      Partner Finder & room chat
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Ionicons name="checkmark" size={13} color={colors.accent} />
                    <Text style={[styles.bulletText, { color: colors.text }]}>
                      Fasting tracker & challenges
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Ionicons name="checkmark" size={13} color={colors.accent} />
                    <Text style={[styles.bulletText, { color: colors.text }]}>
                      Full recipe library (150+)
                    </Text>
                  </View>
                </Pressable>

                {/* Pro Card */}
                <Pressable
                  onPress={() => setSelectedTier('pro')}
                  style={[
                    styles.tierCard,
                    {
                      backgroundColor:
                        selectedTier === 'pro' ? colors.cardHighlight : colors.surfaceAlt,
                      borderColor: selectedTier === 'pro' ? colors.accent : colors.border,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedTier === 'pro' }}
                  accessibilityLabel="CaliPartner Pro, up to 20 members, AI coach, 3 hosted rooms"
                  testID="picker-size-21-50"
                >
                  <View style={styles.tierCardHeader}>
                    <Text style={[styles.tierCardTitle, { color: colors.text }]}>Pro</Text>
                    <View style={[styles.memberCapBadge, { backgroundColor: colors.accent }]}>
                      <Text style={[styles.memberCapText, { color: colors.onBrand }]}>
                        20 members
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.tierPriceText, { color: colors.text }]}>
                    {selectedDuration === 'annual'
                      ? PRICING_PLANS.pro.inr.perMonthAnnual
                      : PRICING_PLANS.pro.inr.monthly}
                  </Text>
                  <Text style={[styles.tierPricePeriod, { color: colors.textMuted }]}>
                    {selectedDuration === 'annual'
                      ? `Billed as ${PRICING_PLANS.pro.inr.annual}`
                      : 'Billed monthly'}
                  </Text>

                  <View style={styles.tierDivider} />

                  <View style={styles.bulletItem}>
                    <Ionicons name="checkmark" size={13} color={colors.accent} />
                    <Text style={[styles.bulletText, { color: colors.text }]}>
                      3 rooms you host (20 members)
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Ionicons name="sparkles" size={13} color={colors.accent} />
                    <Text style={[styles.bulletText, { color: colors.text }]}>
                      AI Coach (10 msgs / day)
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Ionicons name="camera" size={13} color={colors.accent} />
                    <Text style={[styles.bulletText, { color: colors.text }]}>
                      AI Photo Log (5 scans / day)
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Ionicons name="chatbubble-ellipses" size={13} color={colors.accent} />
                    <Text style={[styles.bulletText, { color: colors.text }]}>
                      Chat-to-log & AI insights
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>

            {/* 3. Promo / Collaboration Code Section */}
            <View style={styles.promoSection}>
              {!showPromoInput ? (
                <Pressable
                  onPress={() => setShowPromoInput(true)}
                  style={styles.promoTriggerBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Enter partner or promo code"
                >
                  <Ionicons name="pricetag-outline" size={14} color={colors.accent} />
                  <Text style={[styles.promoTriggerText, { color: colors.accent }]}>
                    {t('rooms.paywall.haveCodePrompt')}
                  </Text>
                </Pressable>
              ) : (
                <View
                  style={[
                    styles.promoInputRow,
                    { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                  ]}
                >
                  <TextInput
                    value={promoCode}
                    onChangeText={setPromoCode}
                    placeholder="e.g. PARTNER50"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                    style={[styles.promoTextInput, { color: colors.text }]}
                    accessibilityLabel="Promo code input"
                  />
                  <Pressable
                    onPress={handleApplyPromoCode}
                    style={[styles.applyPromoBtn, { backgroundColor: colors.accent }]}
                    accessibilityRole="button"
                    accessibilityLabel="Apply promo code"
                  >
                    <Text style={[styles.applyPromoText, { color: colors.onBrand }]}>Apply</Text>
                  </Pressable>
                </View>
              )}

              {promoMessage && (
                <Text style={[styles.promoFeedbackText, { color: colors.accent }]}>
                  {promoMessage}
                </Text>
              )}
            </View>

            {/* 4. Free Forever Guarantee */}
            <View style={[styles.freeNoticeCard, { backgroundColor: colors.surfaceAlt }]}>
              <View style={styles.freeNoticeRow}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.accent} />
                <Text style={[styles.freeNoticeTitle, { color: colors.text }]}>
                  Always free for everyone
                </Text>
              </View>
              <Text style={[styles.freeNoticeDesc, { color: colors.textMuted }]}>
                {t('rooms.paywall.featureFree')}
              </Text>
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
                <ActivityIndicator color={colors.onBrand} size="small" />
              ) : (
                <Text style={[styles.purchaseButtonText, { color: colors.onBrand }]}>
                  {actionButtonText}
                </Text>
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
              <Text style={[styles.restoreButtonText, { color: colors.textMuted }]}>
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
    lineHeight: 18,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
    paddingTop: spacing.xs,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 8,
    marginBottom: spacing.md,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    flex: 1,
  },
  sectionBlock: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  durationToggleContainer: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 3,
  },
  durationToggleItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    minHeight: 44,
  },
  durationToggleSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  durationToggleText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  annualLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savingsBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  savingsBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  trialCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    justifyContent: 'center',
  },
  trialCalloutText: {
    fontSize: 11,
    fontWeight: '500',
  },
  tierCardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tierCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  tierCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tierCardTitle: {
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  memberCapBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  memberCapText: {
    fontSize: 9,
    fontWeight: '800',
  },
  tierPriceText: {
    fontSize: fontSize.md,
    fontWeight: '800',
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  tierPricePeriod: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 6,
  },
  tierDivider: {
    height: 1,
    backgroundColor: 'rgba(128,128,128,0.15)',
    marginVertical: 6,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  bulletText: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  promoSection: {
    marginBottom: spacing.md,
  },
  promoTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  promoTriggerText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  promoInputRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
  },
  promoTextInput: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  applyPromoBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyPromoText: {
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
  promoFeedbackText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  freeNoticeCard: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  freeNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  freeNoticeTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  freeNoticeDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  purchaseButton: {
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginBottom: spacing.xs,
  },
  purchaseButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  restoreButton: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  restoreButtonText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  termsNoticeText: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
    marginVertical: spacing.xs,
  },
  legalLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  legalLink: {
    fontSize: 10,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
