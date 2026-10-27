import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
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
  dark,
  radius,
  space,
  Text,
  onboardingLayout,
  useReducedMotion,
} from '@calipartner/ui';
import { t } from '@/i18n';
import {
  createDodoCheckout,
  fetchDodoCatalog,
  navigateToCheckout,
  openDodoPortal,
} from '@/services/dodoService';
import { generateClientUuid } from '@/services/foodService';
import { findSubscriptionPackage } from '@/services/subscriptionPackages';
import { hasPlan, PRICING_PLANS, type DodoCatalogProduct } from '@calipartner/core';
import { useSubscription } from '@/hooks/useSubscription';
import { playClickSound, playSuccessSound } from '@/lib/sound';

export type RoomSizeBracket = '2-5' | '6-20' | '21-50' | 'plus' | 'pro' | 'basic';
export type PlanDuration = 'monthly' | 'quarterly' | 'annual';
export type PlanTier = 'basic' | 'plus' | 'pro';
export type PaywallContext =
  'room' | 'add_people' | 'coach' | 'partner_finder' | 'keep_going' | 'general';

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
  checkoutReturn?: { tier: 'plus' | 'pro'; duration: 'monthly' | 'annual'; requestId: string };
  checkoutCancelled?: boolean;
}

export const TIER_CONFIG = {
  plus: {
    key: 'plus' as PlanTier,
    label: 'Plus',
    title: 'CaliPartner Plus',
    badge: '7-DAY TRIAL',
    cap: 5,
    sizeRange: '3 to 5',
    summary: 'Rooms, Partner Finder, Fasting & Workouts',
    testID: 'picker-size-6-20',
    monthlyPrice: PRICING_PLANS.plus.inr.monthly,
    monthlyPriceUsd: PRICING_PLANS.plus.usd.monthly,
    monthlyPriceNum: PRICING_PLANS.plus.rawMonthly,
    quarterlyPrice: '₹80 / mo',
    quarterlyTotal: '₹239',
    annualPrice: PRICING_PLANS.plus.inr.perMonthAnnual,
    annualPriceUsd: PRICING_PLANS.plus.usd.perMonthAnnual,
    annualTotal: PRICING_PLANS.plus.inr.annual,
    annualTotalUsd: PRICING_PLANS.plus.usd.annual,
    hasTrial: true,
    trialDays: 7,
  },
  pro: {
    key: 'pro' as PlanTier,
    label: 'Pro',
    title: 'CaliPartner Pro',
    badge: 'AI COACH & SCANS',
    cap: 20,
    sizeRange: '6 to 20',
    summary: 'Everything in Plus + AI Coach & 5 Photo Scans/day',
    testID: 'picker-size-21-50',
    monthlyPrice: PRICING_PLANS.pro.inr.monthly,
    monthlyPriceUsd: PRICING_PLANS.pro.usd.monthly,
    monthlyPriceNum: PRICING_PLANS.pro.rawMonthly,
    quarterlyPrice: '₹160 / mo',
    quarterlyTotal: '₹479',
    annualPrice: PRICING_PLANS.pro.inr.perMonthAnnual,
    annualPriceUsd: PRICING_PLANS.pro.usd.perMonthAnnual,
    annualTotal: PRICING_PLANS.pro.inr.annual,
    annualTotalUsd: PRICING_PLANS.pro.usd.annual,
    hasTrial: false,
    trialDays: 0,
  },
  basic: {
    key: 'basic' as PlanTier,
    label: 'Basic',
    title: 'CaliPartner Free',
    badge: 'FREE FOREVER',
    cap: 2,
    sizeRange: '2 people',
    summary: 'Food diary, barcode, steps & GPS tracking free forever',
    testID: 'picker-size-2-5',
    monthlyPrice: '₹0 / mo',
    monthlyPriceUsd: '$0',
    monthlyPriceNum: 0,
    quarterlyPrice: '₹0',
    quarterlyTotal: '₹0',
    annualPrice: '₹0 / mo',
    annualPriceUsd: '$0',
    annualTotal: '₹0 / yr',
    annualTotalUsd: '$0',
    hasTrial: false,
    trialDays: 0,
  },
};

const PLUS_FEATURES = [
  'setup.plusFriendRequests',
  'setup.plusRoomFeature',
  'setup.plusChatFeature',
  'setup.pairChallengeFeature',
  'Partner Finder: browse suggestions and send match requests',
  'Fasting tracker and eating windows',
  'Full 150+ recipe library, meal planner & grocery lists',
  'Workout routines, rest timer, personal records & shared workouts',
  'Body measurements and private progress photos',
  'Data export',
];

const PRO_FEATURES = [
  'Everything in CaliPartner Plus',
  'Personal AI Coach (10 messages a day)',
  'AI photo food logging (5 scans a day)',
  'Chat-to-log ("I ate two rotis and dal")',
  'Coach-suggested recipes & "fits my day" collections',
  'Weekly AI progress insights & macro adjustments',
  'setup.proRoomFeature',
  'setup.proMediaFeature',
  'setup.proReviewFeature',
  'Priority support',
];

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
  checkoutReturn,
  checkoutCancelled = false,
}: PaywallModalProps) {
  const reduceMotion = useReducedMotion();
  const {
    offerings,
    entitlement,
    error: subError,
    purchase,
    restore,
    sponsor,
    hasActiveAccess,
    refresh,
    loading: subscriptionLoading,
  } = useSubscription();

  // Selected Tier (Plus, Pro) - default to Plus
  const [selectedTier, setSelectedTier] = useState<PlanTier>(() => {
    if (checkoutReturn) return checkoutReturn.tier;
    if (preselectedTier === 'pro') return 'pro';
    return 'plus';
  });

  // Selected Duration (Monthly, Annual — default to Annual as per Pricing Plan section 1.1)
  const [selectedDuration, setSelectedDuration] = useState<PlanDuration>(
    checkoutReturn?.duration ?? 'annual',
  );
  const actionInFlight = useRef(false);
  const webRequest = useRef<{ key: string; id: string } | null>(
    checkoutReturn
      ? { key: `${checkoutReturn.tier}_${checkoutReturn.duration}`, id: checkoutReturn.requestId }
      : null,
  );
  const [actionLoading, setActionLoading] = useState(false);
  const [awaitingEntitlement, setAwaitingEntitlement] = useState(
    Boolean(checkoutReturn) && !checkoutCancelled,
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(
    checkoutCancelled ? t('fixes.storeCancelled') : null,
  );
  const [catalog, setCatalog] = useState<DodoCatalogProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(Platform.OS === 'web');
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      setCatalog(await fetchDodoCatalog());
    } catch (err) {
      setCatalog([]);
      setCatalogError(err instanceof Error ? err.message : t('fixes.dodoNotReady'));
    } finally {
      setCatalogLoading(false);
    }
  }, []);
  useEffect(() => {
    if (visible && Platform.OS === 'web') void loadCatalog();
  }, [visible, loadCatalog]);

  // Sub-modal states
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoMessage, setPromoMessage] = useState<string | null>(null);

  // A redirect is only a cue to poll our server; it never proves that payment succeeded.
  const returnedCheckoutId = checkoutReturn?.requestId;
  useEffect(() => {
    if (!visible || !returnedCheckoutId || !awaitingEntitlement) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const check = async () => {
      const latest = await refresh();
      if (cancelled) return;
      const active =
        hasPlan(latest) ||
        Boolean(
          latest?.status === 'trial' &&
          latest.period_end &&
          new Date(latest.period_end) > new Date(),
        );
      if (
        active &&
        latest?.source === 'dodo' &&
        latest.tier === selectedTier &&
        latest.period === selectedDuration
      ) {
        setAwaitingEntitlement(false);
        playSuccessSound();
        setShowSuccessModal(true);
        return;
      }
      if (++attempts < 15)
        timer = setTimeout(() => {
          void check();
        }, 2000);
    };
    void check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [visible, returnedCheckoutId, awaitingEntitlement, refresh, selectedTier, selectedDuration]);

  // Contextual Title (CaliPartner pricing, not room plan)
  const contextualTitle = useMemo(() => {
    switch (context) {
      case 'room':
        return roomPartnerName ? `Keep your room with ${roomPartnerName}` : 'Keep your room going';
      case 'add_people':
        return 'Add more people';
      case 'coach':
        return 'Unlock AI Coach';
      case 'partner_finder':
        return 'Find a workout partner';
      case 'keep_going':
        return 'Keep your room going';
      case 'general':
      default:
        return 'Choose your CaliPartner plan';
    }
  }, [context, roomPartnerName]);

  const activeTierConfig = TIER_CONFIG[selectedTier === 'basic' ? 'plus' : selectedTier];

  // Find corresponding RevenueCat package if offerings are loaded
  const matchedPackage: PurchasesPackage | null = useMemo(
    () => findSubscriptionPackage(offerings, selectedTier, selectedDuration),
    [offerings, selectedTier, selectedDuration],
  );
  const storePrice = (tier: PlanTier) => {
    if (Platform.OS === 'web') {
      const product = catalog.find((p) => p.key === `${tier}_${selectedDuration}`);
      if (!product) return t(catalogLoading ? 'fixes.loadingPrices' : 'fixes.priceUnavailable');
      return t('fixes.storePrice', {
        price: new Intl.NumberFormat(product.currency === 'INR' ? 'en-IN' : 'en-US', {
          style: 'currency',
          currency: product.currency,
        }).format(product.amount),
        period: t(selectedDuration === 'annual' ? 'fixes.annual' : 'fixes.monthly'),
      });
    }
    const pkg = findSubscriptionPackage(offerings, tier, selectedDuration);
    return pkg
      ? t('fixes.storePrice', {
          price: pkg.product.priceString,
          period: t(selectedDuration === 'annual' ? 'fixes.annual' : 'fixes.monthly'),
        })
      : t('fixes.priceUnavailable');
  };

  const handlePurchase = async () => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    playClickSound();
    setActionLoading(true);
    setStatusMessage(null);

    try {
      if (awaitingEntitlement) {
        const latest = await refresh();
        const active =
          hasPlan(latest) ||
          Boolean(
            latest?.status === 'trial' &&
            latest.period_end &&
            new Date(latest.period_end) > new Date(),
          );
        const matches =
          latest?.tier === selectedTier &&
          latest?.period === selectedDuration &&
          (!checkoutReturn || latest?.source === 'dodo');
        if (!active || !matches) {
          setStatusMessage(t('fixes.paymentPending'));
          return;
        }
        if (sponsorRoomId && !(await sponsor(sponsorRoomId))) {
          setStatusMessage(t('setup.takeoverCheck'));
          return;
        }
        setAwaitingEntitlement(false);
        playSuccessSound();
        setShowSuccessModal(true);
        return;
      }
      if (sponsorRoomId && hasActiveAccess) {
        const success = await sponsor(sponsorRoomId);
        if (success) {
          playSuccessSound();
          setShowSuccessModal(true);
          return;
        }
        if (entitlement?.tier === selectedTier || entitlement?.tier === 'pro') {
          setStatusMessage(t('setup.takeoverCheck'));
          return;
        }
      }

      if (Platform.OS === 'web') {
        if (!catalog.length) {
          await loadCatalog();
          return;
        }
        if (hasActiveAccess) {
          if (entitlement?.source === 'dodo') await openDodoPortal();
          else setStatusMessage(t('fixes.nativeManagement'));
          return;
        }
        const tier = selectedTier === 'pro' ? 'pro' : 'plus';
        const duration = selectedDuration === 'monthly' ? 'monthly' : 'annual';
        const key = `${tier}_${duration}`;
        if (webRequest.current?.key !== key) webRequest.current = { key, id: generateClientUuid() };
        const url = await createDodoCheckout(tier, duration, webRequest.current.id);
        navigateToCheckout(url);
        return;
      }

      if (matchedPackage) {
        const success = await purchase(
          matchedPackage,
          Boolean(isUpgrade),
          entitlement?.store_product_id ?? undefined,
        );
        if (success === 'pending') {
          setAwaitingEntitlement(true);
          setStatusMessage(t('fixes.paymentPending'));
          return;
        }
        if (success === 'verified') {
          if (sponsorRoomId && !(await sponsor(sponsorRoomId))) {
            setAwaitingEntitlement(true);
            setStatusMessage(t('setup.subscriptionPending'));
            return;
          }
          playSuccessSound();
          setShowSuccessModal(true);
          return;
        }
      } else {
        setStatusMessage(t('setup.storeUnavailable'));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(msg);
    } finally {
      actionInFlight.current = false;
      setActionLoading(false);
    }
  };

  const handleRestore = async () => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
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
      actionInFlight.current = false;
      setActionLoading(false);
    }
  };

  const handleApplyPromoCode = () => {
    const clean = promoCode.trim().toUpperCase();
    if (!clean) return;

    setPromoMessage(t('fixes.promoUnavailable'));
  };

  const openUrl = (url: string) => {
    playClickSound();
    Linking.openURL(url).catch(() => {
      Alert.alert('Notice', 'Unable to open link');
    });
  };

  const renewalSentence = t('fixes.storeTerms');

  // Trial eligibility and the final terms are confirmed by the store.
  const primaryCtaLabel = useMemo(() => {
    if (awaitingEntitlement) return t('fixes.checkPayment');
    if (actionLoading) return t('fixes.connectingPayment');
    if (catalogError) return t('fixes.retryPrices');
    if (sponsorRoomId || context === 'keep_going') {
      return `Keep room going with ${activeTierConfig.label}`;
    }
    if (isUpgrade) {
      return `Upgrade to CaliPartner ${activeTierConfig.label}`;
    }
    if (selectedTier === 'plus') {
      return t('fixes.buyPlus');
    }
    return t('fixes.buyPro');
  }, [
    actionLoading,
    awaitingEntitlement,
    sponsorRoomId,
    context,
    isUpgrade,
    activeTierConfig.label,
    selectedTier,
    catalogError,
  ]);

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container} testID="modal-paywall">
          {/* Top Bar with Top-Left Close Button */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('setup.closePremium')}
              style={styles.closeButton}
              testID="btn-close-paywall"
            >
              <Ionicons name="close-outline" color={dark.textHi} size={onboardingLayout.icon} />
            </TouchableOpacity>
            <Text variant="heading" color={dark.textHi} style={styles.topBarTitle}>
              CaliPartner Plans
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
                Personal tracking is 100% free forever. Upgrade for rooms, partner finder, and AI
                coach.
              </Text>
            </View>

            {/* Status / Error Banner if any */}
            {(statusMessage || subError || catalogError) && (
              <Card elevation="s2" style={styles.statusBanner} testID="banner-paywall-status">
                <Text variant="bodyS" color={dark.apricot}>
                  {statusMessage ?? subError ?? catalogError}
                </Text>
              </Card>
            )}

            {/* 1. Billing Duration Toggle: Annual (Save 50%) vs Monthly */}
            <View style={styles.sectionWrap}>
              <View style={styles.durationToggleContainer}>
                {/* Annual (Preselected Default) */}
                <TouchableOpacity
                  disabled={actionLoading || awaitingEntitlement}
                  onPress={() => setSelectedDuration('annual')}
                  style={[
                    styles.durationToggleItem,
                    selectedDuration === 'annual' && styles.durationToggleSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedDuration === 'annual' }}
                  accessibilityLabel={t('fixes.annual')}
                  testID="toggle-duration-annual"
                >
                  <View style={styles.durationLabelWithChip}>
                    <Text
                      variant="label"
                      color={selectedDuration === 'annual' ? dark.textHi : dark.textMid}
                      style={{ fontWeight: '700' }}
                    >
                      Annual
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Monthly */}
                <TouchableOpacity
                  disabled={actionLoading || awaitingEntitlement}
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
                    style={{ fontWeight: selectedDuration === 'monthly' ? '700' : '500' }}
                  >
                    Monthly
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 2. Plan Selection Cards: Plus vs Pro (Spacious stacked layout) */}
            <View style={styles.sectionWrap}>
              <Text variant="label" color={dark.textHi} style={styles.sectionHeading}>
                Select your plan
              </Text>

              <View style={styles.planCardsStack}>
                {/* Plus Card */}
                <TouchableOpacity
                  disabled={actionLoading || awaitingEntitlement}
                  onPress={() => setSelectedTier('plus')}
                  style={[styles.planCard, selectedTier === 'plus' && styles.planCardSelected]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedTier === 'plus' }}
                  accessibilityLabel={`CaliPartner Plus, ${storePrice('plus')}`}
                  testID="picker-size-6-20"
                >
                  <View style={styles.planCardTopRow}>
                    <View style={styles.planRadioRow}>
                      <View
                        style={[
                          styles.radioCircle,
                          selectedTier === 'plus' && styles.radioCircleActive,
                        ]}
                      >
                        {selectedTier === 'plus' && <View style={styles.radioDot} />}
                      </View>
                      <View>
                        <Text
                          variant="heading"
                          color={selectedTier === 'plus' ? dark.apricot : dark.textHi}
                          style={styles.planNameText}
                        >
                          Plus
                        </Text>
                        <Text variant="micro" color={dark.textLo}>
                          {t('setup.plusRoomFeature')}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Text variant="bodyS" color={dark.textMid} style={styles.planSummaryText}>
                    Rooms, chat, side-by-side, Partner Finder, fasting & workouts.
                  </Text>

                  <View style={styles.priceDivider} />

                  <View style={styles.priceContainer}>
                    <View style={styles.priceMainRow}>
                      <Text variant="numeralM" color={dark.textHi} style={styles.priceHighlight}>
                        {storePrice('plus')}
                      </Text>
                    </View>
                    <Text variant="micro" color={dark.teal} style={styles.trialSubNote}>
                      {t('fixes.plusTrialTerms')}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Pro Card */}
                <TouchableOpacity
                  disabled={actionLoading || awaitingEntitlement}
                  onPress={() => setSelectedTier('pro')}
                  style={[styles.planCard, selectedTier === 'pro' && styles.planCardSelected]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedTier === 'pro' }}
                  accessibilityLabel={`CaliPartner Pro, ${storePrice('pro')}`}
                  testID="picker-size-21-50"
                >
                  <View style={styles.planCardTopRow}>
                    <View style={styles.planRadioRow}>
                      <View
                        style={[
                          styles.radioCircle,
                          selectedTier === 'pro' && styles.radioCircleActive,
                        ]}
                      >
                        {selectedTier === 'pro' && <View style={styles.radioDot} />}
                      </View>
                      <View>
                        <Text
                          variant="heading"
                          color={selectedTier === 'pro' ? dark.apricot : dark.textHi}
                          style={styles.planNameText}
                        >
                          Pro
                        </Text>
                        <Text variant="micro" color={dark.textLo}>
                          {t('setup.proRoomFeature')}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Text variant="bodyS" color={dark.textMid} style={styles.planSummaryText}>
                    Everything in Plus + Personal AI Coach & 5 photo food scans/day.
                  </Text>

                  <View style={styles.priceDivider} />

                  <View style={styles.priceContainer}>
                    <View style={styles.priceMainRow}>
                      <Text variant="numeralM" color={dark.textHi} style={styles.priceHighlight}>
                        {storePrice('pro')}
                      </Text>
                    </View>
                    <Text variant="micro" color={dark.textLo} style={styles.trialSubNote}>
                      {t('fixes.proBillingTerms')}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* 3. Section 7 Feature Checklist: Dynamic for Selected Plan */}
            <Card elevation="s1" style={styles.whatYouGetCard}>
              <View style={styles.featuresHeaderRow}>
                <Text variant="label" color={dark.textHi} style={styles.whatYouGetHeader}>
                  {selectedTier === 'pro' ? 'What you get with Pro:' : 'What you get with Plus:'}
                </Text>
                {selectedTier === 'plus' && (
                  <View style={styles.badgeQuiet}>
                    <Text variant="micro" color={dark.apricot} style={{ fontWeight: '600' }}>
                      7 days free
                    </Text>
                  </View>
                )}
              </View>

              {(selectedTier === 'pro' ? PRO_FEATURES : PLUS_FEATURES).map((feat, index) => (
                <View key={index} style={styles.whatYouGetItem}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={dark.apricot}
                    style={styles.checkIcon}
                  />
                  <Text variant="bodyS" color={dark.textHi} style={styles.featureItemText}>
                    {feat.startsWith('setup.') ? t(feat as Parameters<typeof t>[0]) : feat}
                  </Text>
                </View>
              ))}

              <View style={styles.freeSentenceDivider} />

              <View style={styles.freeGuaranteeBlock}>
                <Ionicons name="lock-open-outline" size={15} color={dark.teal} />
                <Text variant="micro" color={dark.textMid} style={styles.freeSentenceText}>
                  Personal food diary, barcode scan, water, steps, distance, GPS tracking, workouts
                  & weight stay 100% free forever.
                </Text>
              </View>
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

          {/* Primary CTA Block */}
          <View style={styles.ctaBottomBar}>
            <Button
              variant="primary"
              label={primaryCtaLabel}
              onPress={handlePurchase}
              disabled={actionLoading || subscriptionLoading || catalogLoading}
              testID="btn-paywall-cta"
              style={styles.ctaButton}
            />

            {awaitingEntitlement ? (
              <Button
                variant="secondary"
                size="md"
                label={t('fixes.choosePlanAgain')}
                onPress={() => {
                  setAwaitingEntitlement(false);
                  setStatusMessage(null);
                }}
                testID="btn-resume-plan-selection"
              />
            ) : null}

            <Text
              variant="micro"
              color={dark.textMid}
              style={styles.renewalSentence}
              testID="text-renewal-sentence"
            >
              {renewalSentence}
            </Text>

            {/* Footer Links */}
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
            animationType={reduceMotion ? 'none' : 'fade'}
            onRequestClose={() => {
              setShowSuccessModal(false);
              onClose();
              if (onSuccess) onSuccess();
            }}
          >
            <View style={styles.modalBackdrop}>
              <Card elevation="s1" style={styles.successModalCard} testID="modal-purchase-success">
                <Ionicons
                  name="sparkles"
                  size={36}
                  color={dark.apricot}
                  style={styles.successIcon}
                />
                <Text variant="title1" color={dark.textHi} style={styles.successTitle}>
                  {activeTierConfig.title} Unlocked
                </Text>
                <Text variant="body" color={dark.textMid} style={styles.successSubtitle}>
                  {selectedTier === 'pro'
                    ? 'AI Coach, 5 daily photo scans, and 5 rooms unlocked.'
                    : `${roomName} now fits up to ${activeTierConfig.cap} members.`}
                </Text>

                <Button
                  variant="primary"
                  label="Done"
                  onPress={() => {
                    setShowSuccessModal(false);
                    onClose();
                    if (onSuccess) onSuccess();
                  }}
                  testID="btn-paywall-success-done"
                  style={styles.successDoneBtn}
                />
              </Card>
            </View>
          </Modal>

          {/* O09 Restore Results Modal */}
          <Modal
            visible={showRestoreModal}
            transparent
            animationType={reduceMotion ? 'none' : 'fade'}
            onRequestClose={() => setShowRestoreModal(false)}
          >
            <View style={styles.modalBackdrop}>
              <Card elevation="s1" style={styles.resultModalCard} testID="modal-restore-result">
                <Ionicons
                  name={restoreSuccess ? 'checkmark-circle' : 'alert-circle-outline'}
                  size={36}
                  color={restoreSuccess ? dark.teal : dark.apricot}
                  style={styles.successIcon}
                />
                <Text variant="heading" color={dark.textHi} style={styles.resultTitle}>
                  {restoreSuccess ? 'Purchases Restored' : 'No Purchases Found'}
                </Text>
                <Text variant="bodyS" color={dark.textMid} style={styles.resultSubtitle}>
                  {restoreSuccess
                    ? 'Your plan has been successfully restored.'
                    : 'We could not find any active subscriptions for this store account.'}
                </Text>
                <Button
                  variant="secondary"
                  label="Close"
                  onPress={() => setShowRestoreModal(false)}
                  testID="btn-restore-result-close"
                  style={styles.resultCloseBtn}
                />
              </Card>
            </View>
          </Modal>

          {/* O10 Partner Promo Code Modal */}
          <Modal
            visible={showPromoModal}
            transparent
            animationType={reduceMotion ? 'none' : 'fade'}
            onRequestClose={() => setShowPromoModal(false)}
          >
            <View style={styles.modalBackdrop}>
              <Card elevation="s1" style={styles.promoModalCard} testID="modal-promo-code">
                <Text variant="heading" color={dark.textHi} style={styles.promoTitle}>
                  Partner Promo Code
                </Text>
                <Text variant="bodyS" color={dark.textMid} style={styles.promoSubtitle}>
                  Enter a partner collaboration code for 50% off your first year.
                </Text>

                <TextInput
                  value={promoCode}
                  onChangeText={setPromoCode}
                  placeholder="e.g. PARTNER50"
                  placeholderTextColor={dark.textLo}
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
                    setPromoCode('');
                    setPromoMessage(null);
                  }}
                  testID="btn-cancel-promo"
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
  topBarTitle: {
    fontWeight: '700',
  },
  closeButton: {
    width: onboardingLayout.touch,
    minHeight: onboardingLayout.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPlaceholder: {
    width: 44,
  },
  scrollContent: {
    paddingHorizontal: space[4],
    paddingTop: space[4],
    paddingBottom: space[6],
  },
  headerBlock: {
    marginBottom: space[4],
  },
  titleText: {
    marginBottom: space[1],
    fontWeight: '700',
  },
  keepGoingSubtitle: {
    marginBottom: space[1],
  },
  subtitleText: {
    lineHeight: 20,
  },
  statusBanner: {
    padding: space[3],
    marginBottom: space[3],
    backgroundColor: dark.s2,
  },
  sectionWrap: {
    marginBottom: space[4],
  },
  sectionHeading: {
    marginBottom: space[2],
    fontWeight: '700',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  quietChip: {
    backgroundColor: dark.s1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 0.5,
    borderColor: dark.teal,
  },
  planCardsStack: {
    gap: space[3],
  },
  planCard: {
    width: '100%',
    padding: space[4],
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: dark.hairline,
  },
  planCardSelected: {
    borderColor: dark.apricot,
    backgroundColor: dark.s2,
  },
  planCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space[2],
  },
  planRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: dark.hairlineLit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: dark.apricot,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: dark.apricot,
  },
  planNameText: {
    fontWeight: '800',
    fontSize: 18,
  },
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: dark.s3,
    paddingHorizontal: space[2],
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: dark.apricot,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: dark.s3,
    paddingHorizontal: space[2],
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: dark.teal,
  },
  planSummaryText: {
    lineHeight: 18,
    marginBottom: space[2],
  },
  priceDivider: {
    height: 1,
    backgroundColor: dark.hairline,
    marginVertical: space[2],
  },
  priceContainer: {
    gap: 2,
  },
  priceMainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[2],
  },
  priceHighlight: {
    fontWeight: '700',
  },
  usdText: {
    fontVariant: ['tabular-nums'],
  },
  monthlyEquiv: {
    fontWeight: '600',
  },
  trialSubNote: {
    marginTop: 2,
  },
  whatYouGetCard: {
    padding: space[4],
    marginBottom: space[4],
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  featuresHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space[3],
  },
  whatYouGetHeader: {
    fontWeight: '700',
  },
  badgeQuiet: {
    backgroundColor: dark.s2,
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  whatYouGetItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: space[2],
    gap: space[2],
  },
  checkIcon: {
    marginTop: 2,
  },
  featureItemText: {
    flex: 1,
    lineHeight: 19,
  },
  freeSentenceDivider: {
    height: 1,
    backgroundColor: dark.hairline,
    marginVertical: space[3],
  },
  freeGuaranteeBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
  },
  freeSentenceText: {
    flex: 1,
    lineHeight: 17,
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
