import { visualPrimitives } from '@calipartner/ui/tokens';
import { useTheme as useAppearance } from '@calipartner/ui/theme';
import { type as inputTypography } from '@calipartner/ui';
import { type as typography } from '@calipartner/ui';
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
  controls,
  radius,
  space,
  Text,
  onboardingLayout,
  useReducedMotion,
} from '@calipartner/ui';
import { t } from '@/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { openDodoPortal } from '@/services/dodoService';
import {
  fetchWebCatalog,
  getCachedWebCatalog,
  startWebCheckout,
  fetchRazorpayManagement,
  cancelRazorpayRenewal,
  type WebPaymentProvider,
} from '@/services/webBillingService';
import { generateClientUuid } from '@/services/foodService';
import { findSubscriptionPackage } from '@/services/subscriptionPackages';
import {
  hasPlan,
  isCardlessPlusTrial,
  type CheckoutDuration,
  type RoomPeriod,
  type DodoCatalogProduct,
} from '@calipartner/core';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { checkoutPrice, MAIN_PAYWALL_DURATIONS, PRO_BENEFITS } from './PaywallCheckout';
import { useSubscription } from '@/hooks/useSubscription';
import { playClickSound, playSuccessSound } from '@/lib/sound';

export type RoomSizeBracket = '2-5' | '6-20' | '21-50' | 'plus' | 'pro' | 'basic';
export type PlanDuration = CheckoutDuration;
export type PlanTier = 'basic' | 'plus' | 'pro';
export type PaywallContext =
  'room' | 'add_people' | 'coach' | 'partner_finder' | 'keep_going' | 'general' | 'weekly_plan';

export interface PaywallModalProps {
  onContinueFree?: () => void;
  preloadPrices?: boolean;
  completionPending?: boolean;
  trialExpired?: boolean;
  visible: boolean;
  onClose: () => void;
  context?: PaywallContext;
  roomPartnerName?: string;
  roomName?: string;
  preselectedTier?: PlanTier;
  preselectedDuration?: CheckoutDuration;
  sponsorRoomId?: string;
  isUpgrade?: boolean;
  onSuccess?: () => void;
  checkoutReturn?: { tier: 'plus' | 'pro'; duration: RoomPeriod; requestId: string };
  checkoutCancelled?: boolean;
}

const COMING_SOON = [
  'progressRefresh.coming',
  'launch.measurements',
  'launch.export',
  'launch.matching',
  'launch.seasons',
  'launch.records',
  'launch.collections',
  'launch.weekly',
] as const;
const FREE_BENEFITS = ['proPlan.logs', 'proPlan.workoutCalendar', 'proPlan.pair'] as const;
const COMPARISON_ROWS = [
  ...FREE_BENEFITS.map((label) => ({ label, free: true })),
  ...PRO_BENEFITS.map((label) => ({ label, free: false })),
  ...(['launch.fasting', 'launch.recipes', 'launch.workouts', 'launch.priority'] as const).map(
    (label) => ({ label, free: false }),
  ),
];

const DEFAULT_FALLBACK_PRODUCTS: DodoCatalogProduct[] = [
  { key: 'pro_annual', currency: 'INR', amount: 2499, trialDays: 0 },
  { key: 'pro_semiannual', currency: 'INR', amount: 1599, trialDays: 0 },
  { key: 'pro_quarterly', currency: 'INR', amount: 899, trialDays: 0 },
];

export function PaywallModal({
  onContinueFree,
  preloadPrices = false,
  completionPending = false,
  visible,
  onClose,
  context = 'general',
  roomPartnerName,
  preselectedDuration,
  sponsorRoomId,
  isUpgrade,
  onSuccess,
  checkoutReturn,
  checkoutCancelled = false,
  trialExpired = false,
}: PaywallModalProps) {
  const { colors: dark } = useAppearance();
  const styles = createStyles(dark);

  const { session } = useAuth();
  const preparedCatalog =
    Platform.OS === 'web' ? getCachedWebCatalog(session?.access_token) : undefined;
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

  const selectedTier = checkoutReturn?.tier ?? 'pro';
  const [selectedDuration, setSelectedDuration] = useState<RoomPeriod>(
    checkoutReturn?.duration ?? preselectedDuration ?? 'annual',
  );
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const completed = useRef(false);
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
  const [catalog, setCatalog] = useState<DodoCatalogProduct[]>(
    preparedCatalog?.products?.length ? preparedCatalog.products : DEFAULT_FALLBACK_PRODUCTS,
  );
  const [webProvider, setWebProvider] = useState<WebPaymentProvider>(
    preparedCatalog?.provider ?? 'razorpay',
  );
  const [requiresWebManagement, setRequiresWebManagement] = useState(
    Boolean(preparedCatalog?.managementRequired),
  );
  const [management, setManagement] = useState<{ request_id: string; cancelled: boolean } | null>(
    null,
  );
  const [confirmCancellation, setConfirmCancellation] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const cardlessActive = isCardlessPlusTrial(entitlement);
  const loadCatalog = useCallback(async () => {
    setCatalogLoading(!preparedCatalog);
    setCatalogError(null);
    try {
      const result = await fetchWebCatalog();
      setCatalog(result.products);
      setWebProvider(result.provider);
      setRequiresWebManagement(Boolean(result.managementRequired));
    } catch (err) {
      setCatalog([]);
      setCatalogError(err instanceof Error ? err.message : t('webBilling.unavailable'));
    } finally {
      setCatalogLoading(false);
    }
  }, [preparedCatalog]);
  useEffect(() => {
    if (preparedCatalog) {
      setCatalogError(null);
      setCatalog(preparedCatalog.products);
      setWebProvider(preparedCatalog.provider);
      setRequiresWebManagement(Boolean(preparedCatalog.managementRequired));
      setCatalogLoading(false);
    }
  }, [preparedCatalog]);
  useEffect(() => {
    if ((visible || preloadPrices) && Platform.OS === 'web') void loadCatalog();
  }, [visible, preloadPrices, loadCatalog]);

  // Sub-modal states
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountDismissed, setDiscountDismissed] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoMessage, setPromoMessage] = useState<string | null>(null);

  // A redirect is only a cue to poll our server; it never proves that payment succeeded.
  const returnedCheckoutId = checkoutReturn?.requestId ?? webRequest.current?.id;
  const expectedWebSource = checkoutReturn ? 'dodo' : webProvider;
  useEffect(() => {
    if (!visible || !returnedCheckoutId || !awaitingEntitlement) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const check = async () => {
      const latest = await refresh();
      if (cancelled) return;
      const active = hasPlan(latest);
      if (
        active &&
        latest?.source === expectedWebSource &&
        latest.tier === selectedTier &&
        latest.period === selectedDuration
      ) {
        setAwaitingEntitlement(false);
        playSuccessSound();
        completed.current = true;
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
  }, [
    visible,
    returnedCheckoutId,
    awaitingEntitlement,
    refresh,
    selectedTier,
    selectedDuration,
    expectedWebSource,
  ]);

  // Contextual Title (CaliPartner pricing, not room plan)
  const contextualTitle = useMemo(() => {
    if (trialExpired) return t('cardlessTrial.expiredTitle');
    switch (context) {
      case 'weekly_plan':
        return t('fixNovember.lockedTitle');
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
        return t('proPlan.title');
    }
  }, [context, roomPartnerName, trialExpired]);

  // Find corresponding RevenueCat package if offerings are loaded
  const matchedPackage: PurchasesPackage | null = useMemo(
    () => findSubscriptionPackage(offerings, 'pro', selectedDuration),
    [offerings, selectedDuration],
  );
  const quote = (tier: 'plus' | 'pro', duration: CheckoutDuration) =>
    Platform.OS === 'web'
      ? checkoutPrice(
          tier,
          duration,
          catalog.find((p) => p.key === tier + '_' + duration),
        )
      : checkoutPrice(
          tier,
          duration,
          undefined,
          findSubscriptionPackage(offerings, tier, duration),
        );
  const mainDuration = selectedDuration === 'monthly' ? 'annual' : selectedDuration;
  const managing = (hasActiveAccess && !cardlessActive) || requiresWebManagement;
  const requestClose = () => {
    if (completionPending || actionInFlight.current) return;
    if (!hasActiveAccess && !discountDismissed && !completed.current) {
      setShowDiscountModal(true);
      return;
    }
    onClose();
  };
  useBrowserModalBack(visible, requestClose, {
    depth: 1,
    onDepthChange: requestClose,
  });

  const handlePurchase = async (durationOverride?: RoomPeriod) => {
    if (completionPending || actionInFlight.current) return;
    const duration = durationOverride ?? selectedDuration;
    if (durationOverride) setSelectedDuration(durationOverride);
    actionInFlight.current = true;
    playClickSound();
    setActionLoading(true);
    setStatusMessage(null);

    try {
      if (awaitingEntitlement) {
        const latest = await refresh();
        const active = hasPlan(latest);
        const matches =
          latest?.tier === selectedTier &&
          latest?.period === duration &&
          (Platform.OS !== 'web' || latest?.source === (checkoutReturn ? 'dodo' : webProvider));
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
        completed.current = true;
        setShowSuccessModal(true);
        return;
      }
      if (sponsorRoomId && hasActiveAccess) {
        const success = await sponsor(sponsorRoomId);
        if (success) {
          playSuccessSound();
          completed.current = true;
          setShowSuccessModal(true);
          return;
        }
        if (entitlement?.tier === selectedTier || entitlement?.tier === 'pro') {
          setStatusMessage(t('setup.takeoverCheck'));
          return;
        }
      }

      if (
        (hasActiveAccess && !cardlessActive) ||
        (Platform.OS === 'web' && requiresWebManagement)
      ) {
        if (entitlement?.source === 'razorpay') {
          if (Platform.OS === 'web') {
            setStatusMessage(null);
            setManagement(await fetchRazorpayManagement());
          } else setStatusMessage(t('webBilling.webManagement'));
        } else if (entitlement?.source === 'dodo') await openDodoPortal();
        else if (Platform.OS === 'web') setStatusMessage(t('fixes.nativeManagement'));
        else
          await Linking.openURL(
            Platform.OS === 'android'
              ? 'https://play.google.com/store/account/subscriptions'
              : 'https://apps.apple.com/account/subscriptions',
          );
        return;
      }

      if (Platform.OS === 'web') {
        if (!catalog.length) {
          await loadCatalog();
          return;
        }
        const tier = 'pro';
        if (duration === 'monthly' || !quote(tier, duration)) {
          setStatusMessage(t('fixes.priceUnavailable'));
          return;
        }
        const key = `${tier}_${duration}`;
        if (webRequest.current?.key !== key) webRequest.current = { key, id: generateClientUuid() };
        const result = await startWebCheckout(webProvider, tier, duration, webRequest.current.id);
        if (result === 'pending') {
          setAwaitingEntitlement(true);
          setStatusMessage(t('fixes.paymentPending'));
        } else if (result === 'cancelled') {
          webRequest.current = null;
          setStatusMessage(t('fixes.storeCancelled'));
        }
        return;
      }

      const targetPackage =
        duration === selectedDuration
          ? matchedPackage
          : findSubscriptionPackage(offerings, 'pro', duration);
      if (targetPackage && duration !== 'monthly' && quote('pro', duration)) {
        const success = await purchase(
          targetPackage,
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
          completed.current = true;
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
    if (completionPending || actionInFlight.current) return;
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

  const handleCancelRenewal = async () => {
    if (!management || actionInFlight.current) return;
    actionInFlight.current = true;
    setActionLoading(true);
    try {
      await cancelRazorpayRenewal(management.request_id);
      setManagement({ ...management, cancelled: true });
      setConfirmCancellation(false);
      setStatusMessage(null);
      await refresh();
      await loadCatalog();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : t('webBilling.unavailable'));
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
  const primaryCtaLabel = awaitingEntitlement
    ? t('fixes.checkPayment')
    : actionLoading
      ? t('fixes.connectingPayment')
      : managing && !sponsorRoomId
        ? t('brandRepair.manage')
        : catalogError
          ? t('fixes.retryPrices')
          : t('releaseUpdate.upgradeNow', { tier: t('proPlan.pro') });

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      transparent={false}
      onRequestClose={requestClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container} testID="modal-paywall">
          {/* Top Bar with Top-Left Close Button */}
          <View
            style={styles.topBar}
            testID="paywall-swipe-header"
            onTouchStart={(event) => {
              swipeStart.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
            }}
            onTouchEnd={(event) => {
              const start = swipeStart.current;
              swipeStart.current = null;
              if (
                start &&
                event.nativeEvent.pageY - start.y > space[8] &&
                event.nativeEvent.pageY - start.y > Math.abs(event.nativeEvent.pageX - start.x)
              )
                requestClose();
            }}
          >
            <Button
              variant="tertiary"
              fullWidth={false}
              label={t('setup.closePremium')}
              iconOnly
              icon={
                <Ionicons name="close-outline" color={dark.textHi} size={onboardingLayout.icon} />
              }
              onPress={requestClose}
              disabled={completionPending}
              accessibilityRole="button"
              accessibilityLabel={t('setup.closePremium')}
              style={styles.closeButton}
              testID="btn-close-paywall"
            />
            <Text variant="heading" color={dark.textHi} style={styles.topBarTitle}>
              {t('proPlan.title')}
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
              {context === 'weekly_plan' && (
                <Text variant="bodyS" color={dark.textHi}>
                  {t('fixNovember.lockedBody')}
                </Text>
              )}
            </View>

            {/* Status / Error Banner if any */}
            {(statusMessage || subError || catalogError) && (
              <Card elevation="s2" style={styles.statusBanner} testID="banner-paywall-status">
                <Text
                  variant="bodyS"
                  color={dark.textHi}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                >
                  {statusMessage ?? subError ?? catalogError}
                </Text>
              </Card>
            )}

            {management && Platform.OS === 'web' && (
              <Card elevation="s2" style={styles.statusBanner} testID="razorpay-management">
                <Text variant="heading">{t('webBilling.manageTitle')}</Text>
                <Text>
                  {t(management.cancelled ? 'webBilling.cancelled' : 'webBilling.cancelBody')}
                </Text>
                {!management.cancelled &&
                  (confirmCancellation ? (
                    <>
                      <Button
                        label={t('webBilling.confirmCancel')}
                        variant="destructive"
                        disabled={actionLoading}
                        onPress={handleCancelRenewal}
                        testID="btn-confirm-razorpay-cancel"
                      />
                      <Button
                        label={t('webBilling.keepRenewal')}
                        variant="secondary"
                        disabled={actionLoading}
                        onPress={() => setConfirmCancellation(false)}
                        testID="btn-keep-razorpay-renewal"
                      />
                    </>
                  ) : (
                    <Button
                      label={t('webBilling.cancelRenewal')}
                      variant="secondary"
                      onPress={() => setConfirmCancellation(true)}
                      testID="btn-razorpay-cancel"
                    />
                  ))}
              </Card>
            )}

            {/* Billing term selection */}
            <View style={styles.durationToggleContainer} accessibilityRole="radiogroup">
              {MAIN_PAYWALL_DURATIONS.map((duration) => (
                <TouchableOpacity
                  key={duration}
                  onPress={() => setSelectedDuration(duration)}
                  disabled={actionLoading || awaitingEntitlement}
                  style={[
                    styles.durationToggleItem,
                    mainDuration === duration && styles.durationToggleSelected,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: mainDuration === duration }}
                  accessibilityLabel={t(`releaseUpdate.${duration}`)}
                  testID={`toggle-duration-${duration}`}
                >
                  <Text variant="label">{t(`releaseUpdate.${duration}`)}</Text>
                  <Text variant="micro" tabular>
                    {quote('pro', duration)?.total}
                  </Text>
                  {duration === 'annual' && (
                    <Text variant="micro" color={dark.actionInk}>
                      {t('releaseUpdate.bestValue')}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Symmetry 2-Column Minimal Comparison Table */}
            <View style={styles.tableContainer}>
              <View style={styles.tableHeaderRow}>
                <View style={styles.featureCol} />
                <View style={styles.checkCol}>
                  <Text variant="label" color={dark.textMid} style={styles.colHeaderText}>
                    {t('proPlan.free')}
                  </Text>
                </View>
                <View style={styles.checkCol}>
                  <Text variant="label" color={dark.apricot} style={styles.colHeaderText}>
                    {t('proPlan.pro')}
                  </Text>
                </View>
              </View>

              {COMPARISON_ROWS.map((row) => {
                const label = t(row.label);
                return (
                  <View key={row.label} style={styles.tableRow}>
                    <View style={styles.featureCol}>
                      <Text variant="bodyS" color={dark.textHi} style={styles.featureRowText}>
                        {label}
                      </Text>
                    </View>
                    <View style={styles.checkCol}>
                      {row.free ? (
                        <Ionicons name="checkmark" size={18} color={dark.textMid} />
                      ) : (
                        <Text color={dark.textLo} style={styles.dashText}>
                          —
                        </Text>
                      )}
                    </View>
                    <View style={styles.checkCol}>
                      <Ionicons name="checkmark" size={18} color={dark.apricot} />
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Subtle Coming Soon for future roadmap */}
            <View testID="paywall-coming-soon" style={styles.comingSoonWrap}>
              <Text variant="label" color={dark.textMid} style={styles.comingSoonTitle}>
                {t('launch.soon')}
              </Text>
              <Text variant="micro" color={dark.textLo} style={styles.comingSoonItems}>
                {COMING_SOON.map((f) => t(f)).join(' · ')}
              </Text>
            </View>

            {/* Promo Code Trigger */}
            <Button
              variant="secondary"
              fullWidth={false}
              label="Have a partner promo code? Enter code"
              onPress={() => setShowPromoModal(true)}
              style={styles.promoTrigger}
              accessibilityRole="button"
              accessibilityLabel="Have a partner promo code?"
              testID="btn-promo-code"
            />
          </ScrollView>

          {/* Primary CTA Block */}
          <View style={styles.ctaBottomBar}>
            <Text
              variant="micro"
              color={dark.textMid}
              style={styles.renewalSentence}
              testID="text-renewal-sentence"
            >
              {catalogLoading && !managing && (
                <Text
                  testID="paywall-pro-price-placeholder"
                  variant="micro"
                  accessibilityLiveRegion="polite"
                >
                  {t('fixes.loadingPrices')}{' '}
                </Text>
              )}
              {quote('pro', mainDuration) && !managing
                ? t('releaseUpdate.charged', { total: quote('pro', mainDuration)!.total }) +
                  ' · ' +
                  quote('pro', mainDuration)!.equivalent +
                  '. '
                : ''}
              {renewalSentence} {t('proPlan.tax')}
            </Text>
            <Button
              variant="primary"
              label={primaryCtaLabel}
              onPress={() => void handlePurchase()}
              disabled={
                completionPending ||
                actionLoading ||
                (subscriptionLoading && !awaitingEntitlement) ||
                (!managing &&
                  (catalogLoading ||
                    (!catalogError && !awaitingEntitlement && !quote('pro', mainDuration))))
              }
              testID="btn-paywall-cta"
              style={styles.ctaButton}
            />
            {(trialExpired || onContinueFree) && (
              <>
                {trialExpired && <Text variant="bodyS">{t('cardlessTrial.expiredBody')}</Text>}
                <Button
                  variant="secondary"
                  label={t('cardlessTrial.continueFree')}
                  onPress={onContinueFree ?? onClose}
                  disabled={completionPending}
                  loading={completionPending}
                  testID={onContinueFree ? 'continue-free-onboarding' : 'continue-free-after-trial'}
                />
              </>
            )}

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

            {/* Footer Links */}
            <View style={styles.footerLinksRow}>
              <TouchableOpacity
                onPress={handleRestore}
                accessibilityRole="button"
                disabled={completionPending}
                style={styles.footerLink}
                testID="btn-restore-purchases"
              >
                <Text variant="micro" color={dark.textLo}>
                  {t('releaseUpdate.restorePurchases')}
                </Text>
              </TouchableOpacity>
              <Text variant="micro" color={dark.hairlineLit}>
                •
              </Text>
              <TouchableOpacity
                onPress={() => openUrl('https://app.calipartner.site/terms')}
                accessibilityRole="link"
                style={styles.footerLink}
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
                onPress={() => openUrl('https://app.calipartner.site/privacy')}
                accessibilityRole="link"
                style={styles.footerLink}
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
                <Text variant="title1" color={dark.textHi} style={styles.successTitle}>
                  {t('brandRepair.unlocked', { plan: t('proPlan.pro') })}
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
                <Button
                  variant="secondary"
                  label="Close"
                  onPress={() => setShowRestoreModal(false)}
                  testID="btn-restore-result-close"
                  style={[styles.resultCloseBtn, { alignSelf: 'flex-end' }]}
                />
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
                  style={[styles.promoInput, { fontFamily: inputTypography.body.fontFamily }]}
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
                  variant="cancel"
                  label={t('common.cancel')}
                  onPress={() => {
                    setShowPromoModal(false);
                    setPromoCode('');
                    setPromoMessage(null);
                  }}
                  testID="btn-cancel-promo"
                />
              </Card>
            </View>
          </Modal>

          {/* Exit-Intent Discount Modal: 3 Months Pro Offer */}
          <Modal
            visible={showDiscountModal}
            transparent
            animationType={reduceMotion ? 'none' : 'fade'}
            onRequestClose={() => {
              setShowDiscountModal(false);
              setDiscountDismissed(true);
              onClose();
            }}
          >
            <View style={styles.modalBackdrop}>
              <Card elevation="s2" style={styles.discountModalCard} testID="modal-discount-offer">
                <View style={styles.discountBadge}>
                  <Text variant="micro" color={dark.onBrand} style={styles.discountBadgeText}>
                    {t('discountOffer.badge')}
                  </Text>
                </View>
                <Text variant="heading" color={dark.textHi} style={styles.discountTitle}>
                  {t('discountOffer.title')}
                </Text>
                <Text variant="bodyS" color={dark.textMid} style={styles.discountSubtitle}>
                  {t('discountOffer.subtitle')}
                </Text>

                <View style={styles.discountPriceBox}>
                  <Text variant="title1" color={dark.apricot} tabular>
                    {quote('pro', 'quarterly')?.total ?? '₹899'}
                  </Text>
                  <Text variant="label" color={dark.textMid}>
                    {t('discountOffer.monthlyHint', {
                      amount: quote('pro', 'quarterly')?.equivalent ?? '₹299 / mo',
                    })}
                  </Text>
                </View>

                <Button
                  variant="primary"
                  label={t('discountOffer.claim', {
                    price: quote('pro', 'quarterly')?.total ?? '₹899',
                  })}
                  onPress={() => {
                    setShowDiscountModal(false);
                    setDiscountDismissed(true);
                    void handlePurchase('quarterly');
                  }}
                  testID="btn-claim-discount"
                  style={styles.discountCtaBtn}
                />
                <Button
                  variant="cancel"
                  label={t('discountOffer.decline')}
                  onPress={() => {
                    setShowDiscountModal(false);
                    setDiscountDismissed(true);
                    onClose();
                  }}
                  testID="btn-decline-discount"
                />
              </Card>
            </View>
          </Modal>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const createStyles = (dark: ReturnType<typeof useAppearance>['colors']) =>
  StyleSheet.create({
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
    badgeWrapper: {
      alignItems: 'center',
      marginBottom: space[3],
    },
    brandBadge: {
      paddingHorizontal: space[3],
      paddingVertical: space[1],
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: dark.hairline,
      backgroundColor: dark.s1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[2],
    },
    brandBadgeText: {
      letterSpacing: 1.5,
      fontWeight: '700',
    },
    headerBlock: {
      marginBottom: space[4],
      alignItems: 'center',
    },
    titleText: {
      marginBottom: space[1],
      fontWeight: '700',
      textAlign: 'center',
    },
    keepGoingSubtitle: {
      marginBottom: space[1],
      textAlign: 'center',
    },
    statusBanner: {
      padding: space[3],
      marginBottom: space[3],
      backgroundColor: dark.s2,
    },
    tierSelectorRow: {
      flexDirection: 'row',
      gap: space[2],
      marginBottom: space[3],
    },
    tierTab: {
      flex: 1,
      paddingVertical: space[2],
      paddingHorizontal: space[3],
      borderRadius: radius.control,
      backgroundColor: dark.s1,
      borderWidth: 1,
      borderColor: dark.hairline,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    tierTabSelected: {
      borderColor: dark.apricot,
      backgroundColor: dark.s2,
    },
    tierTabText: {
      letterSpacing: 1,
      fontWeight: '700',
    },
    tableContainer: {
      marginTop: space[3],
      marginBottom: space[3],
      borderTopWidth: 1,
      borderTopColor: dark.hairline,
    },
    tableHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: space[2],
      borderBottomWidth: 1,
      borderBottomColor: dark.hairline,
    },
    colHeaderText: {
      letterSpacing: 1,
      fontWeight: '700',
      textAlign: 'center',
    },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: space[3],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: dark.hairline,
    },
    featureCol: {
      flex: 1,
      paddingRight: space[2],
    },
    featureRowText: {
      fontSize: 14,
      lineHeight: 20,
    },
    checkCol: {
      width: 56,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dashText: {
      fontSize: 16,
    },
    muchMoreText: {
      textAlign: 'center',
      marginVertical: space[5],
      fontStyle: 'italic',
      letterSpacing: 0.5,
    },
    comingSoonWrap: {
      backgroundColor: dark.s1,
      padding: space[3],
      borderRadius: radius.control,
      marginBottom: space[4],
      gap: space[1],
    },
    comingSoonTitle: {
      letterSpacing: 0.5,
      fontWeight: '700',
    },
    comingSoonItems: {
      lineHeight: 18,
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
      borderRadius: visualPrimitives.radii[11],
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
      borderRadius: visualPrimitives.radii[5],
      backgroundColor: dark.apricot,
    },
    planNameText: {
      fontWeight: '800',
      fontFamily: typography.body.fontFamily,
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
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      gap: space[2],
    },
    footerLink: {
      minHeight: controls.touch,
      minWidth: controls.touch,
      justifyContent: 'center',
      alignItems: 'center',
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
      fontFamily: typography.body.fontFamily,
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
    discountModalCard: {
      width: '100%',
      maxWidth: 380,
      padding: space[5],
      alignItems: 'center',
      gap: space[3],
    },
    discountBadge: {
      paddingHorizontal: space[3],
      paddingVertical: space[1],
      borderRadius: radius.full,
      backgroundColor: dark.apricot,
    },
    discountBadgeText: {
      letterSpacing: 1.5,
      fontWeight: '700',
    },
    discountTitle: {
      textAlign: 'center',
      fontWeight: '700',
    },
    discountSubtitle: {
      textAlign: 'center',
      lineHeight: 20,
    },
    discountPriceBox: {
      alignItems: 'center',
      paddingVertical: space[2],
      gap: space[1],
    },
    discountCtaBtn: {
      width: '100%',
    },
  });
