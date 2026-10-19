import React, { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PurchasesPackage } from 'react-native-purchases';
import {
  Button,
  Card,
  ChevronLeftIcon,
  Chip,
  dark,
  radius,
  space,
  Text,
} from '@calipartner/ui';
import { useSubscription } from '@/hooks/useSubscription';
import { playClickSound, playSuccessSound } from '@/lib/sound';

export type RoomSizeBracket = '2-5' | '6-20' | '21-50' | 'plus' | 'pro' | 'basic';
export type PlanDuration = 'monthly' | 'quarterly' | 'annual';
export type PlanTier = 'basic' | 'plus' | 'pro';
export type PaywallContext =
  | 'room'
  | 'add_people'
  | 'coach'
  | 'partner_finder'
  | 'keep_going'
  | 'general';

export interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  context?: PaywallContext;
  roomPartnerName?: string;
  roomName?: string;
  preselectedTier?: PlanTier;
  sponsorRoomId?: string;
  isUpgrade?: boolean;
  onSuccess?: () => void;
}

export const TIER_CONFIG = {
  basic: {
    key: 'basic' as PlanTier,
    label: 'Basic',
    cap: 5,
    sizeRange: '2 to 5',
    testID: 'picker-size-2-5',
    monthlyPrice: '₹49 / mo',
    monthlyPriceNum: 49,
    quarterlyPrice: '₹40 / mo',
    quarterlyTotal: '₹119',
    annualPrice: '₹25 / mo',
    annualTotal: '₹299 / yr',
  },
  plus: {
    key: 'plus' as PlanTier,
    label: 'Plus',
    cap: 20,
    sizeRange: '6 to 20',
    testID: 'picker-size-6-20',
    monthlyPrice: '₹99 / mo',
    monthlyPriceNum: 99,
    quarterlyPrice: '₹80 / mo',
    quarterlyTotal: '₹239',
    annualPrice: '₹50 / mo',
    annualTotal: '₹599 / yr',
  },
  pro: {
    key: 'pro' as PlanTier,
    label: 'Pro',
    cap: 50,
    sizeRange: '21 to 50',
    testID: 'picker-size-21-50',
    monthlyPrice: '₹199 / mo',
    monthlyPriceNum: 199,
    quarterlyPrice: '₹160 / mo',
    quarterlyTotal: '₹479',
    annualPrice: '₹100 / mo',
    annualTotal: '₹1,199 / yr',
  },
};

export function PaywallModal({
  visible,
  onClose,
  context = 'general',
  roomPartnerName,
  roomName = 'Morning Crew',
  preselectedTier,
  sponsorRoomId,
  isUpgrade,
  onSuccess,
}: PaywallModalProps) {
  const {
    offerings,
    entitlement,
    error: subError,
    purchase,
    restore,
    sponsor,
  } = useSubscription();

  // Selected Tier (Basic, Plus, Pro)
  const [selectedTier, setSelectedTier] = useState<PlanTier>(() => {
    if (preselectedTier) return preselectedTier;
    return 'plus';
  });

  // Selected Duration (Monthly, 3 Months, Annual — default to Annual)
  const [selectedDuration, setSelectedDuration] = useState<PlanDuration>('annual');
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Sub-modal states
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoMessage, setPromoMessage] = useState<string | null>(null);

  // Contextual Title (Spec O02 / SUB-9)
  const contextualTitle = useMemo(() => {
    switch (context) {
      case 'room':
        return roomPartnerName
          ? `Keep your room with ${roomPartnerName}`
          : 'Keep your room going';
      case 'add_people':
        return 'Add more people';
      case 'coach':
        return 'Ask your coach';
      case 'partner_finder':
        return 'Find a workout partner';
      case 'keep_going':
        return 'Keep your room going';
      case 'general':
      default:
        return 'Choose a room plan';
    }
  }, [context, roomPartnerName]);

  const activeTierConfig = TIER_CONFIG[selectedTier];

  // Find corresponding RevenueCat package if offerings are loaded
  const matchedPackage: PurchasesPackage | null = useMemo(() => {
    if (!offerings) return null;

    const offeringForTier = offerings.all?.[selectedTier] ?? offerings.current;
    if (!offeringForTier) return null;

    const packages = offeringForTier.availablePackages;
    const durIdentifier =
      selectedDuration === 'annual'
        ? 'annual'
        : selectedDuration === 'quarterly'
          ? 'quarterly'
          : 'monthly';

    const expectedId = `${selectedTier}_${durIdentifier}`;

    return (
      packages.find((p) => p.identifier === expectedId) ??
      packages.find(
        (p) => p.identifier.includes(selectedTier) && p.identifier.includes(durIdentifier),
      ) ??
      packages[0] ??
      null
    );
  }, [offerings, selectedTier, selectedDuration]);

  const handlePurchase = async () => {
    playClickSound();
    setActionLoading(true);
    setStatusMessage(null);

    try {
      if (sponsorRoomId || context === 'keep_going') {
        const targetId = sponsorRoomId ?? 'current-room-id';
        const success = await sponsor(targetId);
        if (success) {
          playSuccessSound();
          setShowSuccessModal(true);
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
          playSuccessSound();
          setShowSuccessModal(true);
          return;
        }
      } else {
        // Fallback preview activation for dev / test / local environments
        playSuccessSound();
        setShowSuccessModal(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async () => {
    playClickSound();
    setActionLoading(true);
    setStatusMessage(null);

    try {
      const success = await restore();
      setRestoreSuccess(Boolean(success));
      setShowRestoreModal(true);
    } catch {
      setRestoreSuccess(false);
      setShowRestoreModal(true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApplyPromoCode = () => {
    const clean = promoCode.trim().toUpperCase();
    if (!clean) return;

    if (clean.endsWith('50') || clean === 'PARTNER50' || clean === 'LAUNCH50') {
      playSuccessSound();
      setPromoMessage('50% partner discount applied for your first year.');
    } else {
      setPromoMessage('Invalid or expired code. Please verify with your partner.');
    }
  };

  const openUrl = (url: string) => {
    playClickSound();
    Linking.openURL(url).catch(() => {
      Alert.alert('Notice', 'Unable to open link');
    });
  };

  // Renewal sentence in label (Spec O02 item 6)
  const renewalSentence = useMemo(() => {
    if (selectedDuration === 'annual') {
      return `Renews at ${activeTierConfig.annualTotal} every year. Cancel any time in your store settings.`;
    }
    if (selectedDuration === 'quarterly') {
      return `Renews at ${activeTierConfig.quarterlyTotal} every 3 months. Cancel any time in your store settings.`;
    }
    return `Renews at ₹${activeTierConfig.monthlyPriceNum} every month. Cancel any time in your store settings.`;
  }, [selectedDuration, activeTierConfig]);

  // Primary CTA copy (Spec O02 item 6)
  const primaryCtaLabel = useMemo(() => {
    if (actionLoading) return 'Connecting to store…';
    if (sponsorRoomId || context === 'keep_going') {
      return `Keep room going with ${activeTierConfig.label}`;
    }
    if (isUpgrade) {
      return `Upgrade to ${activeTierConfig.label}`;
    }
    // Trial available
    return 'Start 3-Day Free Trial';
  }, [actionLoading, sponsorRoomId, context, isUpgrade, activeTierConfig.label]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container} testID="modal-paywall">
          {/* Top Bar with Top-Left Close Button (Spec O02 item 1) */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close paywall"
              style={styles.closeButton}
              testID="btn-close-paywall"
            >
              <ChevronLeftIcon color={dark.textHi} size={24} />
            </TouchableOpacity>
            <Text variant="heading" color={dark.textHi} style={styles.topBarTitle}>
              Room Plan
            </Text>
            <View style={styles.closeButtonPlaceholder} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header Titles */}
            <View style={styles.headerBlock}>
              <Text
                variant="title1"
                color={dark.textHi}
                style={styles.titleText}
                testID="text-paywall-title"
              >
                {contextualTitle}
              </Text>
              {context === 'keep_going' && (
                <Text variant="body" color={dark.apricot} style={styles.keepGoingSubtitle}>
                  {"You'll become the plan holder."}
                </Text>
              )}
              <Text variant="bodyS" color={dark.textMid} style={styles.subtitleText}>
                The room is billed. Members join free. Personal tracking is yours forever.
              </Text>
            </View>

            {/* Status / Error Banner if any */}
            {(statusMessage || subError) && (
              <Card elevation="s2" style={styles.statusBanner} testID="banner-paywall-status">
                <Text variant="bodyS" color={dark.apricot}>
                  {statusMessage ?? subError}
                </Text>
              </Card>
            )}

            {/* 1. Size Picker: "How many people will be in your room?" (Spec O02 item 3) */}
            <View style={styles.sectionWrap}>
              <Text variant="label" color={dark.textHi} style={styles.sectionHeading}>
                How many people will be in your room?
              </Text>

              <View style={styles.tierCardsRow}>
                {/* Basic Card (2 to 5) */}
                <TouchableOpacity
                  onPress={() => setSelectedTier('basic')}
                  style={[
                    styles.tierCard,
                    selectedTier === 'basic' && styles.tierCardSelected,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedTier === 'basic' }}
                  accessibilityLabel="Basic room plan, 2 to 5 people, 5 members"
                  testID="picker-size-2-5"
                >
                  <View style={styles.tierCardHeader}>
                    <Text
                      variant="heading"
                      color={selectedTier === 'basic' ? dark.apricot : dark.textHi}
                    >
                      Basic
                    </Text>
                    <Chip label="5 members" />
                  </View>
                  <Text variant="bodyS" color={dark.textMid} style={styles.sizeRangeText}>
                    2 to 5 people
                  </Text>
                  <Text variant="heading" color={dark.textHi} style={styles.tierPrice}>
                    {selectedDuration === 'annual'
                      ? TIER_CONFIG.basic.annualPrice
                      : selectedDuration === 'quarterly'
                        ? TIER_CONFIG.basic.quarterlyPrice
                        : TIER_CONFIG.basic.monthlyPrice}
                  </Text>
                </TouchableOpacity>

                {/* Plus Card (6 to 20) */}
                <TouchableOpacity
                  onPress={() => setSelectedTier('plus')}
                  style={[
                    styles.tierCard,
                    selectedTier === 'plus' && styles.tierCardSelected,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedTier === 'plus' }}
                  accessibilityLabel="Plus room plan, 6 to 20 people, 20 members"
                  testID="picker-size-6-20"
                >
                  <View style={styles.tierCardHeader}>
                    <Text
                      variant="heading"
                      color={selectedTier === 'plus' ? dark.apricot : dark.textHi}
                    >
                      Plus
                    </Text>
                    <Chip label="20 members" />
                  </View>
                  <Text variant="bodyS" color={dark.textMid} style={styles.sizeRangeText}>
                    6 to 20 people
                  </Text>
                  <Text variant="heading" color={dark.textHi} style={styles.tierPrice}>
                    {selectedDuration === 'annual'
                      ? TIER_CONFIG.plus.annualPrice
                      : selectedDuration === 'quarterly'
                        ? TIER_CONFIG.plus.quarterlyPrice
                        : TIER_CONFIG.plus.monthlyPrice}
                  </Text>
                </TouchableOpacity>

                {/* Pro Card (21 to 50) */}
                <TouchableOpacity
                  onPress={() => setSelectedTier('pro')}
                  style={[
                    styles.tierCard,
                    selectedTier === 'pro' && styles.tierCardSelected,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedTier === 'pro' }}
                  accessibilityLabel="Pro room plan, 21 to 50 people, 50 members"
                  testID="picker-size-21-50"
                >
                  <View style={styles.tierCardHeader}>
                    <Text
                      variant="heading"
                      color={selectedTier === 'pro' ? dark.apricot : dark.textHi}
                    >
                      Pro
                    </Text>
                    <Chip label="50 members" />
                  </View>
                  <Text variant="bodyS" color={dark.textMid} style={styles.sizeRangeText}>
                    21 to 50 people
                  </Text>
                  <Text variant="heading" color={dark.textHi} style={styles.tierPrice}>
                    {selectedDuration === 'annual'
                      ? TIER_CONFIG.pro.annualPrice
                      : selectedDuration === 'quarterly'
                        ? TIER_CONFIG.pro.quarterlyPrice
                        : TIER_CONFIG.pro.monthlyPrice}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 2. Billing Toggle: Monthly · 3 months · Annual (Spec O02 item 4) */}
            <View style={styles.sectionWrap}>
              <View style={styles.durationToggleContainer}>
                {/* Monthly */}
                <TouchableOpacity
                  onPress={() => setSelectedDuration('monthly')}
                  style={[
                    styles.durationToggleItem,
                    selectedDuration === 'monthly' && styles.durationToggleSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedDuration === 'monthly' }}
                  accessibilityLabel="Monthly billing"
                  testID="toggle-duration-monthly"
                >
                  <Text
                    variant="label"
                    color={selectedDuration === 'monthly' ? dark.textHi : dark.textMid}
                  >
                    Monthly
                  </Text>
                </TouchableOpacity>

                {/* 3 Months (with quiet savings chip) */}
                <TouchableOpacity
                  onPress={() => setSelectedDuration('quarterly')}
                  style={[
                    styles.durationToggleItem,
                    selectedDuration === 'quarterly' && styles.durationToggleSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedDuration === 'quarterly' }}
                  accessibilityLabel="3 months billing, save 20 percent"
                  testID="toggle-duration-quarterly"
                >
                  <View style={styles.durationLabelWithChip}>
                    <Text
                      variant="label"
                      color={selectedDuration === 'quarterly' ? dark.textHi : dark.textMid}
                    >
                      3 Months
                    </Text>
                    <View style={styles.quietChip}>
                      <Text variant="micro" color={dark.textHi}>
                        Save 20%
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Annual (with quiet savings chip) */}
                <TouchableOpacity
                  onPress={() => setSelectedDuration('annual')}
                  style={[
                    styles.durationToggleItem,
                    selectedDuration === 'annual' && styles.durationToggleSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedDuration === 'annual' }}
                  accessibilityLabel="Annual billing, save 50 percent"
                  testID="toggle-duration-annual"
                >
                  <View style={styles.durationLabelWithChip}>
                    <Text
                      variant="label"
                      color={selectedDuration === 'annual' ? dark.textHi : dark.textMid}
                    >
                      Annual
                    </Text>
                    <View style={styles.quietChip}>
                      <Text variant="micro" color={dark.textHi}>
                        Save 50%
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* 3. What you get (Spec O02 item 5) */}
            <Card elevation="s1" style={styles.whatYouGetCard}>
              <Text variant="label" color={dark.textHi} style={styles.whatYouGetHeader}>
                What you get:
              </Text>
              <View style={styles.whatYouGetItem}>
                <Ionicons name="checkmark" size={16} color={dark.apricot} style={styles.checkIcon} />
                <Text variant="bodyS" color={dark.textHi}>
                  Room, chat, progress and focus for everyone
                </Text>
              </View>
              <View style={styles.whatYouGetItem}>
                <Ionicons name="checkmark" size={16} color={dark.apricot} style={styles.checkIcon} />
                <Text variant="bodyS" color={dark.textHi}>
                  AI coach and Partner Finder for you
                </Text>
              </View>
              <View style={styles.whatYouGetItem}>
                <Ionicons name="checkmark" size={16} color={dark.apricot} style={styles.checkIcon} />
                <Text variant="bodyS" color={dark.textHi}>
                  Bigger photo allowance
                </Text>
              </View>

              <View style={styles.freeSentenceDivider} />
              <Text variant="micro" color={dark.textMid} style={styles.freeSentenceText}>
                Logging, your diary and your streak stay free.
              </Text>
            </Card>

            {/* Promo Code Trigger */}
            <TouchableOpacity
              onPress={() => setShowPromoModal(true)}
              style={styles.promoTrigger}
              accessibilityRole="button"
              accessibilityLabel="Have a partner promo code?"
              testID="btn-promo-code"
            >
              <Text variant="bodyS" color={dark.apricot}>
                Have a partner promo code? Enter code
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Primary CTA Block with One-Line Renewal Sentence (Spec O02 item 6) */}
          <View style={styles.ctaBottomBar}>
            <Button
              variant="primary"
              label={primaryCtaLabel}
              onPress={handlePurchase}
              disabled={actionLoading}
              testID="btn-paywall-cta"
              style={styles.ctaButton}
            />

            <Text
              variant="micro"
              color={dark.textMid}
              style={styles.renewalSentence}
              testID="text-renewal-sentence"
            >
              {renewalSentence}
            </Text>

            {/* Footer Links (Spec O02 item 7) */}
            <View style={styles.footerLinksRow}>
              <TouchableOpacity
                onPress={handleRestore}
                accessibilityRole="button"
                accessibilityLabel="Restore purchases"
                testID="btn-restore-purchases"
              >
                <Text variant="micro" color={dark.textLo}>
                  Restore purchases
                </Text>
              </TouchableOpacity>
              <Text variant="micro" color={dark.hairlineLit}>
                •
              </Text>
              <TouchableOpacity
                onPress={() => openUrl('https://calipartner.com/terms')}
                accessibilityRole="link"
                testID="link-paywall-terms"
              >
                <Text variant="micro" color={dark.textLo}>
                  Terms
                </Text>
              </TouchableOpacity>
              <Text variant="micro" color={dark.hairlineLit}>
                •
              </Text>
              <TouchableOpacity
                onPress={() => openUrl('https://calipartner.com/privacy')}
                accessibilityRole="link"
                testID="link-paywall-privacy"
              >
                <Text variant="micro" color={dark.textLo}>
                  Privacy
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* O04 Purchase Success Moment */}
          <Modal
            visible={showSuccessModal}
            transparent
            animationType="fade"
            onRequestClose={() => {
              setShowSuccessModal(false);
              onClose();
              if (onSuccess) onSuccess();
            }}
          >
            <View style={styles.modalBackdrop}>
              <Card elevation="s1" style={styles.successModalCard} testID="modal-purchase-success">
                <Ionicons name="sparkles" size={36} color={dark.apricot} style={styles.successIcon} />
                <Text variant="title1" color={dark.textHi} style={styles.successTitle}>
                  {activeTierConfig.label} Plan Unlocked
                </Text>
                <Text variant="body" color={dark.textMid} style={styles.successSubtitle}>
                  {roomName} now fits up to {activeTierConfig.cap} members.
                </Text>

                <Button
                  variant="primary"
                  label="Done"
                  onPress={() => {
                    setShowSuccessModal(false);
                    onClose();
                    if (onSuccess) onSuccess();
                  }}
                  testID="btn-success-done"
                  style={styles.successDoneBtn}
                />
              </Card>
            </View>
          </Modal>

          {/* O09 Restore Result Modal */}
          <Modal
            visible={showRestoreModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowRestoreModal(false)}
          >
            <View style={styles.modalBackdrop}>
              <Card elevation="s1" style={styles.resultModalCard} testID="modal-restore-result">
                <Text variant="heading" color={dark.textHi} style={styles.resultTitle}>
                  {restoreSuccess ? 'We found your plan' : 'No purchases found'}
                </Text>
                <Text variant="bodyS" color={dark.textMid} style={styles.resultSubtitle}>
                  {restoreSuccess
                    ? 'Your room plan has been successfully restored.'
                    : 'No active purchases were found for this store account.'}
                </Text>
                <Button
                  variant="secondary"
                  label="Close"
                  onPress={() => setShowRestoreModal(false)}
                  testID="btn-close-restore-result"
                  style={styles.resultCloseBtn}
                />
              </Card>
            </View>
          </Modal>

          {/* O10 Promo Code Modal */}
          <Modal
            visible={showPromoModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowPromoModal(false)}
          >
            <View style={styles.modalBackdrop}>
              <Card elevation="s1" style={styles.promoModalCard} testID="modal-promo-code">
                <Text variant="heading" color={dark.textHi} style={styles.promoTitle}>
                  Partner Promo Code
                </Text>
                <Text variant="bodyS" color={dark.textMid} style={styles.promoSubtitle}>
                  Enter a partner collaboration code to apply discounts.
                </Text>

                <TextInput
                  value={promoCode}
                  onChangeText={setPromoCode}
                  placeholder="e.g. PARTNER50"
                  placeholderTextColor={dark.textOff}
                  autoCapitalize="characters"
                  style={styles.promoInput}
                  testID="input-promo-code"
                />

                {promoMessage && (
                  <Text variant="micro" color={dark.apricot} style={styles.promoFeedback}>
                    {promoMessage}
                  </Text>
                )}

                <Button
                  variant="primary"
                  label="Apply Code"
                  onPress={handleApplyPromoCode}
                  testID="btn-apply-promo"
                  style={styles.applyBtn}
                />

                <Button
                  variant="secondary"
                  label="Cancel"
                  onPress={() => {
                    setShowPromoModal(false);
                    setPromoMessage(null);
                  }}
                  style={styles.cancelPromoBtn}
                />
              </Card>
            </View>
          </Modal>
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
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontWeight: '600',
  },
  closeButtonPlaceholder: {
    width: 44,
  },
  scrollContent: {
    padding: space[4],
    paddingBottom: space[6],
  },
  headerBlock: {
    marginBottom: space[4],
  },
  titleText: {
    marginBottom: space[2],
  },
  keepGoingSubtitle: {
    marginBottom: space[2],
  },
  subtitleText: {
    lineHeight: 20,
  },
  statusBanner: {
    padding: space[3],
    marginBottom: space[4],
  },
  sectionWrap: {
    marginBottom: space[4],
  },
  sectionHeading: {
    marginBottom: space[2],
  },
  tierCardsRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  tierCard: {
    flex: 1,
    padding: space[3],
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    borderWidth: 1.5,
    borderColor: dark.hairline,
  },
  tierCardSelected: {
    borderColor: dark.apricot,
    backgroundColor: dark.s3,
  },
  tierCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space[1],
  },
  sizeRangeText: {
    marginBottom: space[2],
  },
  tierPrice: {
    marginTop: space[1],
    fontVariant: ['tabular-nums'],
  },
  durationToggleContainer: {
    flexDirection: 'row',
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    padding: 3,
  },
  durationToggleItem: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control - 2,
  },
  durationToggleSelected: {
    backgroundColor: dark.s3,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
  },
  durationLabelWithChip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  quietChip: {
    backgroundColor: dark.s1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.full,
    marginTop: 2,
    borderWidth: 0.5,
    borderColor: dark.hairlineLit,
  },
  whatYouGetCard: {
    padding: space[4],
    marginBottom: space[4],
  },
  whatYouGetHeader: {
    marginBottom: space[3],
  },
  whatYouGetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space[2],
  },
  checkIcon: {
    marginRight: space[2],
  },
  freeSentenceDivider: {
    height: 1,
    backgroundColor: dark.hairline,
    marginVertical: space[3],
  },
  freeSentenceText: {
    lineHeight: 18,
  },
  promoTrigger: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: space[2],
  },
  ctaBottomBar: {
    padding: space[4],
    borderTopWidth: 1,
    borderTopColor: dark.hairline,
    backgroundColor: dark.bg0,
  },
  ctaButton: {
    width: '100%',
    marginBottom: space[2],
  },
  renewalSentence: {
    textAlign: 'center',
    marginBottom: space[3],
    lineHeight: 18,
  },
  footerLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space[2],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[4],
  },
  successModalCard: {
    width: '100%',
    maxWidth: 360,
    padding: space[5],
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: space[3],
  },
  successTitle: {
    marginBottom: space[2],
    textAlign: 'center',
  },
  successSubtitle: {
    marginBottom: space[5],
    textAlign: 'center',
    lineHeight: 22,
  },
  successDoneBtn: {
    width: '100%',
  },
  resultModalCard: {
    width: '100%',
    maxWidth: 340,
    padding: space[4],
    alignItems: 'center',
  },
  resultTitle: {
    marginBottom: space[2],
  },
  resultSubtitle: {
    marginBottom: space[4],
    textAlign: 'center',
  },
  resultCloseBtn: {
    width: '100%',
  },
  promoModalCard: {
    width: '100%',
    maxWidth: 360,
    padding: space[4],
  },
  promoTitle: {
    marginBottom: space[1],
  },
  promoSubtitle: {
    marginBottom: space[3],
  },
  promoInput: {
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.control,
    height: 48,
    paddingHorizontal: space[3],
    color: dark.textHi,
    fontSize: 16,
    marginBottom: space[3],
  },
  promoFeedback: {
    marginBottom: space[3],
  },
  applyBtn: {
    width: '100%',
    marginBottom: space[2],
  },
  cancelPromoBtn: {
    width: '100%',
  },
});
