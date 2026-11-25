import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  PRICING_PLANS,
  hasPlan,
  type CheckoutDuration,
  type DodoCatalogProduct,
  type RoomPeriod,
} from '@calipartner/core';
import {
  Badge,
  Card,
  CheckIcon,
  ChevronLeftIcon,
  IconButton,
  LinkButton,
  PrimaryButton,
  Radio,
  ScreenTitle,
  Text,
  borders,
  colors,
  fonts,
  layout,
  radius,
  space,
} from '@calipartner/ui/v1';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { getLocale, t, type TranslationKey } from '@/i18n';
import { generateClientUuid } from '@/services/foodService';
import { findSubscriptionPackage } from '@/services/subscriptionPackages';
import {
  fetchWebCatalog,
  getCachedWebCatalog,
  startWebCheckout,
  type WebPaymentProvider,
} from '@/services/webBillingService';

export type PaywallV1Duration = 'annual' | 'semiannual' | 'quarterly' | 'monthly';

export interface PaywallV1StepProps {
  onContinueProSuccess: () => void;
  onContinueFree: () => void;
  onBack?: () => void;
  viewMode?: 'compare' | 'all_plans';
  onViewModeChange?: (mode: 'compare' | 'all_plans') => void;
}

type TableRow = {
  id: string;
  labelKey: TranslationKey;
  freeValue?: TranslationKey;
  proValue?: TranslationKey;
  isNew?: boolean;
};

const COMPARISON_ROWS: readonly TableRow[] = [
  { id: 'coach', labelKey: 'onboardingV1.paywallRowCoach' },
  { id: 'adaptive', labelKey: 'onboardingV1.paywallRowAdaptive', isNew: true },
  { id: 'finder', labelKey: 'onboardingV1.paywallRowFinder' },
  {
    id: 'squads',
    labelKey: 'onboardingV1.paywallRowSquads',
    freeValue: 'onboardingV1.paywallRowSquadsFree',
    proValue: 'onboardingV1.paywallRowSquadsPro',
  },
  { id: 'friendsFree', labelKey: 'onboardingV1.paywallRowFriendsFree' },
  { id: 'program', labelKey: 'onboardingV1.paywallRowProgram' },
  {
    id: 'fasting',
    labelKey: 'onboardingV1.paywallRowFasting',
    freeValue: 'onboardingV1.paywallRowFastingFree',
    proValue: 'onboardingV1.paywallRowFastingPro',
  },
  { id: 'recipes', labelKey: 'onboardingV1.paywallRowRecipes' },
  { id: 'macros', labelKey: 'onboardingV1.paywallRowMacros' },
  { id: 'photos', labelKey: 'onboardingV1.paywallRowPhotos' },
  { id: 'recaps', labelKey: 'onboardingV1.paywallRowRecaps' },
];

const DURATIONS: readonly {
  id: PaywallV1Duration;
  months: number;
  titleKey: TranslationKey;
  periodKey: TranslationKey;
  renewalKey: TranslationKey;
}[] = [
  {
    id: 'annual',
    months: 12,
    titleKey: 'onboardingV1.paywallPlan12Months',
    periodKey: 'onboardingV1.paywallPeriodYear',
    renewalKey: 'onboardingV1.paywallRenewalAnnual',
  },
  {
    id: 'semiannual',
    months: 6,
    titleKey: 'onboardingV1.paywallPlan6Months',
    periodKey: 'onboardingV1.paywallPeriod6Months',
    renewalKey: 'onboardingV1.paywallRenewalSemiannual',
  },
  {
    id: 'quarterly',
    months: 3,
    titleKey: 'onboardingV1.paywallPlan3Months',
    periodKey: 'onboardingV1.paywallPeriod3Months',
    renewalKey: 'onboardingV1.paywallRenewalQuarterly',
  },
  {
    id: 'monthly',
    months: 1,
    titleKey: 'onboardingV1.paywallPlan1Month',
    periodKey: 'onboardingV1.paywallPeriodMonth',
    renewalKey: 'onboardingV1.paywallRenewalMonthly',
  },
];

function formatMoney(amount: number, currency: string): string {
  const locale = currency === 'INR' ? 'en-IN' : currency === 'USD' ? 'en-US' : getLocale();
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    ...(currency === 'INR' ? { maximumFractionDigits: 0 } : { maximumFractionDigits: 2 }),
  }).format(amount);
}

export function PaywallV1Step({
  onContinueProSuccess,
  onContinueFree,
  viewMode: controlledMode,
  onViewModeChange,
}: PaywallV1StepProps): React.JSX.Element {
  const { session, profile } = useAuth();
  const {
    offerings,
    purchase,
    restore,
    refresh,
    hasActiveAccess,
    loading: subLoading,
  } = useSubscription();

  const [internalMode, setInternalMode] = useState<'compare' | 'all_plans'>('compare');
  const viewMode = controlledMode ?? internalMode;
  const setViewMode = (nextMode: 'compare' | 'all_plans') => {
    if (onViewModeChange) onViewModeChange(nextMode);
    else setInternalMode(nextMode);
  };

  const [selectedDuration, setSelectedDuration] = useState<PaywallV1Duration>('annual');
  const cached = Platform.OS === 'web' ? getCachedWebCatalog(session?.access_token) : undefined;
  const [catalog, setCatalog] = useState<DodoCatalogProduct[]>(cached?.products ?? []);
  const [webProvider, setWebProvider] = useState<WebPaymentProvider>(
    cached?.provider ?? 'razorpay',
  );
  const [actionLoading, setActionLoading] = useState(false);
  const [awaitingWebhook, setAwaitingWebhook] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const requestRef = useRef<{ key: string; id: string } | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !profile?.id) return;
    let active = true;
    void fetchWebCatalog()
      .then((res) => {
        if (!active) return;
        setCatalog(res.products);
        setWebProvider(res.provider);
      })
      .catch(() => {
        // Profile-less onboarding on web uses PRICING_PLANS display fallback until Screen 24.
      });
    return () => {
      active = false;
    };
  }, [profile?.id, session?.access_token]);

  useEffect(() => {
    if (!awaitingWebhook) return;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      const latest = await refresh();
      if (cancelled) return;
      if (hasPlan(latest)) {
        setAwaitingWebhook(false);
        onContinueProSuccess();
        return;
      }
      if (++attempts < 15) {
        timer = setTimeout(() => {
          void poll();
        }, 2000);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [awaitingWebhook, refresh, onContinueProSuccess]);

  const detectedCurrency: 'INR' | 'USD' = useMemo(() => {
    if (catalog[0]?.currency) return catalog[0].currency;
    if (profile?.country && profile.country !== 'IN') return 'USD';
    return getLocale().startsWith('en-US') ? 'USD' : 'INR';
  }, [catalog, profile?.country]);

  const getPlanQuote = useCallback(
    (duration: PaywallV1Duration) => {
      const meta = DURATIONS.find((item) => item.id === duration) ?? DURATIONS[0]!;
      const nativePkg =
        Platform.OS !== 'web' ? findSubscriptionPackage(offerings, 'pro', duration) : null;
      const webProd =
        Platform.OS === 'web' ? catalog.find((item) => item.key === `pro_${duration}`) : undefined;
      const fallbackPlan =
        detectedCurrency === 'INR' ? PRICING_PLANS.pro.inr : PRICING_PLANS.pro.usd;

      const currency = webProd?.currency ?? nativePkg?.product.currencyCode ?? detectedCurrency;
      const amount =
        webProd?.amount ??
        nativePkg?.product.price ??
        (duration === 'monthly'
          ? fallbackPlan.rawMonthly
          : fallbackPlan.terms[duration as CheckoutDuration].amount);

      const formattedTotal = nativePkg?.product.priceString ?? formatMoney(amount, currency);
      const monthlyRate = fallbackPlan.rawMonthly;
      const regularForPeriod = monthlyRate * meta.months;
      const perMonth = Math.round(amount / meta.months);
      const formattedPerMonth = `${formatMoney(
        currency === 'INR' ? perMonth : Math.round((amount / meta.months) * 100) / 100,
        currency,
      )} / month`;
      const savePercent =
        duration === 'monthly'
          ? 0
          : Math.max(0, Math.round(((regularForPeriod - amount) / regularForPeriod) * 100));

      return {
        ...meta,
        nativePkg,
        webProd,
        currency,
        amount,
        formattedTotal,
        formattedRegular: duration === 'annual' ? formatMoney(regularForPeriod, currency) : null,
        formattedPerMonth,
        savePercent,
      };
    },
    [catalog, detectedCurrency, offerings],
  );

  const selectedQuote = getPlanQuote(selectedDuration);

  const handleContinuePro = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setStatusMessage(null);
    try {
      if (hasActiveAccess) {
        onContinueProSuccess();
        return;
      }

      if (Platform.OS === 'web') {
        if (selectedDuration === 'monthly') {
          setStatusMessage(t('onboardingV1.paywallMonthlyStoreOnly'));
          return;
        }
        if (!profile?.id) {
          setStatusMessage(t('onboardingV1.paywallWebProfileNote'));
          return;
        }
        let products = catalog;
        let provider = webProvider;
        if (!products.length) {
          const fresh = await fetchWebCatalog({ force: true });
          products = fresh.products;
          provider = fresh.provider;
          setCatalog(products);
          setWebProvider(provider);
        }
        const key = `pro_${selectedDuration}`;
        if (requestRef.current?.key !== key) {
          requestRef.current = { key, id: generateClientUuid() };
        }
        const result = await startWebCheckout(
          provider,
          'pro',
          selectedDuration as CheckoutDuration,
          requestRef.current.id,
        );
        if (result === 'pending') {
          setAwaitingWebhook(true);
          setStatusMessage(t('fixes.paymentPending'));
        } else if (result === 'cancelled') {
          requestRef.current = null;
          setStatusMessage(t('fixes.storeCancelled'));
        }
        return;
      }

      const targetPkg = findSubscriptionPackage(offerings, 'pro', selectedDuration);
      if (!targetPkg) {
        setStatusMessage(t('setup.storeUnavailable'));
        return;
      }
      const outcome = await purchase(targetPkg, false);
      if (outcome === 'verified') {
        onContinueProSuccess();
      } else if (outcome === 'pending') {
        setAwaitingWebhook(true);
        setStatusMessage(t('fixes.paymentPending'));
      }
    } catch (err: unknown) {
      setStatusMessage(err instanceof Error ? err.message : t('common.errorBody'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setStatusMessage(null);
    try {
      const ok = await restore();
      if (ok) {
        setStatusMessage(t('onboardingV1.paywallRestoreSuccess'));
        onContinueProSuccess();
      } else {
        setStatusMessage(t('onboardingV1.paywallRestoreNone'));
      }
    } catch {
      setStatusMessage(t('onboardingV1.paywallRestoreNone'));
    } finally {
      setActionLoading(false);
    }
  };

  if (viewMode === 'all_plans') {
    const periodWord = t(selectedQuote.periodKey);
    const continueTitle = t('onboardingV1.paywallAllContinuePeriod', {
      price: selectedQuote.formattedTotal,
      period: periodWord,
    });

    return (
      <SafeAreaView style={styles.safe} testID="onboarding-screen-all-plans">
        <View style={styles.navRowWrap}>
          <IconButton
            icon={<ChevronLeftIcon size={18} color={colors.textHi} />}
            size={44}
            onPress={() => {
              setStatusMessage(null);
              setViewMode('compare');
            }}
            disabled={actionLoading}
            accessibilityLabel={t('onboarding.back')}
            testID="btn-all-plans-back"
          />
        </View>

        <ScrollView
          style={styles.flexOne}
          contentContainerStyle={styles.allPlansScroll}
          showsVerticalScrollIndicator={false}
        >
          <ScreenTitle
            eyebrow={t('onboardingV1.paywallAllEyebrow')}
            title={t('onboardingV1.paywallAllTitle')}
            accentWord={t('onboardingV1.paywallAllAccent')}
            subtitle={t('onboardingV1.paywallAllSubtitle')}
            spacingBottom={space.xl}
            testID="all-plans-header"
          />

          {statusMessage ? (
            <View style={styles.statusBanner} testID="paywall-status-banner">
              <Text variant="meta" color="textHi" accessibilityRole="alert">
                {statusMessage}
              </Text>
            </View>
          ) : null}

          <View style={styles.planCardsList} accessibilityRole="radiogroup">
            {DURATIONS.map((plan) => {
              const quote = getPlanQuote(plan.id as RoomPeriod | 'monthly');
              const selected = selectedDuration === plan.id;
              return (
                <Pressable
                  key={plan.id}
                  onPress={() => {
                    setSelectedDuration(plan.id);
                    setStatusMessage(null);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  testID={`plan-option-${plan.id}`}
                  style={[styles.planOptionCard, selected ? styles.planOptionSelected : null]}
                >
                  <Radio selected={selected} />
                  <View style={styles.planOptionMiddle}>
                    <View style={styles.planOptionTitleRow}>
                      <Text variant="rowTitle" color="textHi">
                        {t(plan.titleKey)}
                      </Text>
                      {plan.id === 'annual' ? <Badge variant="bestValue" mini /> : null}
                    </View>
                    <Text variant="meta" color="textLo" tabular>
                      {plan.id === 'monthly'
                        ? t('onboardingV1.paywallBilledMonthly')
                        : t('onboardingV1.paywallSavePercent', {
                            perMonth: quote.formattedPerMonth,
                            percent: quote.savePercent,
                          })}
                    </Text>
                  </View>
                  <Text variant="numM" color="textHi" tabular testID={`plan-price-${plan.id}`}>
                    {quote.formattedTotal}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text variant="meta" color="textLo" style={styles.allPlansFootNote}>
            {t('onboardingV1.paywallAllFooterNote')}
          </Text>
        </ScrollView>

        <View style={styles.footerDock}>
          <PrimaryButton
            title={continueTitle}
            showArrow
            loading={actionLoading || subLoading}
            onPress={() => void handleContinuePro()}
            testID="btn-all-plans-continue"
          />
          <View style={styles.centeredSecondary}>
            <LinkButton
              title={t('onboardingV1.paywallContinueFree')}
              disabled={actionLoading}
              onPress={onContinueFree}
              testID="btn-all-plans-free"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} testID="onboarding-screen-paywall">
      <View style={styles.compareTopBar}>
        <Badge variant="outlinePro" label={t('onboardingV1.paywallColPro')} />
        <Pressable
          onPress={() => void handleRestore()}
          disabled={actionLoading}
          accessibilityRole="button"
          style={styles.restoreButton}
          testID="btn-paywall-restore"
        >
          <Text variant="meta" color="textMid">
            {t('onboardingV1.paywallRestore')}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.flexOne}
        contentContainerStyle={styles.compareScroll}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitle
          title={t('onboardingV1.paywallTitle')}
          accentWord={t('onboardingV1.paywallAccent')}
          subtitle={t('onboardingV1.paywallSubtitle')}
          spacingBottom={space.xl}
          testID="paywall-header"
        />

        {statusMessage ? (
          <View style={styles.statusBanner} testID="paywall-status-banner">
            <Text variant="meta" color="textHi" accessibilityRole="alert">
              {statusMessage}
            </Text>
          </View>
        ) : null}

        <View style={styles.tableWrapper}>
          <View style={styles.proHighlightColumn} pointerEvents="none" />

          <View style={styles.tableHeaderRow}>
            <View style={styles.featureCol}>
              <Text variant="meta" color="textLo">
                {t('onboardingV1.paywallColIncluded')}
              </Text>
            </View>
            <View style={styles.freeCol}>
              <Text variant="meta" color="textLo" style={styles.centerText}>
                {t('onboardingV1.paywallColFree')}
              </Text>
            </View>
            <View style={styles.proCol}>
              <Badge variant="pro" label={t('onboardingV1.paywallColPro')} mini />
            </View>
          </View>

          {COMPARISON_ROWS.map((row, idx) => (
            <View
              key={row.id}
              style={[
                styles.tableRow,
                idx < COMPARISON_ROWS.length - 1 ? styles.tableRowDivider : null,
              ]}
            >
              <View style={styles.featureCol}>
                <View style={styles.featureTitleWrap}>
                  <Text variant="rowTitle" color="textHi" style={styles.featureText}>
                    {t(row.labelKey)}
                  </Text>
                  {row.isNew ? <Badge variant="new" mini /> : null}
                </View>
              </View>
              <View style={styles.freeCol}>
                <Text variant="meta" color="textLo" style={styles.centerText}>
                  {row.freeValue ? t(row.freeValue) : '—'}
                </Text>
              </View>
              <View style={styles.proCol}>
                {row.proValue ? (
                  <Text variant="label" color="apricot" style={styles.proValueText}>
                    {t(row.proValue)}
                  </Text>
                ) : (
                  <View style={styles.proCheckDot}>
                    <CheckIcon size={12} color={colors.onBrand} strokeWidth={2.8} />
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footerDock}>
        <Card variant="highlight" style={styles.summaryOfferCard} testID="paywall-selected-offer">
          <Radio selected />
          <View style={styles.summaryOfferMiddle}>
            <View style={styles.planOptionTitleRow}>
              <Text variant="rowTitle" color="textHi">
                {t(selectedQuote.titleKey)}
              </Text>
              {selectedDuration === 'annual' ? <Badge variant="bestValue" mini /> : null}
            </View>
            <Text variant="meta" color="textLo" tabular>
              {selectedDuration === 'monthly'
                ? t('onboardingV1.paywallBilledMonthly')
                : t('onboardingV1.paywallSavePercent', {
                    perMonth: selectedQuote.formattedPerMonth,
                    percent: selectedQuote.savePercent,
                  })}
            </Text>
          </View>
          <View style={styles.priceRightCol}>
            {selectedQuote.formattedRegular ? (
              <Text variant="micro" color="textOff" tabular style={styles.strikePrice}>
                {selectedQuote.formattedRegular}
              </Text>
            ) : null}
            <Text variant="numM" color="textHi" tabular testID="paywall-selected-price">
              {selectedQuote.formattedTotal}
            </Text>
          </View>
        </Card>

        <PrimaryButton
          title={t('onboardingV1.paywallProCta')}
          showArrow
          loading={actionLoading || subLoading}
          onPress={() => void handleContinuePro()}
          testID="btn-paywall-pro-continue"
        />

        <View style={styles.dualLinksRow}>
          <Pressable
            onPress={() => {
              setStatusMessage(null);
              setViewMode('all_plans');
            }}
            disabled={actionLoading}
            accessibilityRole="button"
            style={styles.dualLinkHit}
            testID="btn-see-other-plans"
          >
            <Text variant="meta" color="textMid">
              {t('onboardingV1.paywallSeeOtherPlans')}
            </Text>
          </Pressable>

          <Pressable
            onPress={onContinueFree}
            disabled={actionLoading}
            accessibilityRole="button"
            style={styles.dualLinkHit}
            testID="continue-free-onboarding"
          >
            <Text variant="meta" color="textMid">
              {t('onboardingV1.paywallContinueFree')}
            </Text>
          </Pressable>
        </View>

        <Text variant="micro" color="textLo" style={styles.legalRenewalText}>
          {t(selectedQuote.renewalKey)}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const PRO_COL_WIDTH = 72;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg0,
  },
  flexOne: {
    flex: 1,
  },
  navRowWrap: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space.md,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  compareTopBar: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space.md,
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  restoreButton: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: space.xs,
  },
  compareScroll: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space.md,
    paddingBottom: space.xl,
  },
  allPlansScroll: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: layout.navToTitle,
    paddingBottom: space.xl,
  },
  statusBanner: {
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.apricot,
    borderRadius: radius.chip,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    marginBottom: space.lg,
  },
  tableWrapper: {
    position: 'relative',
    paddingVertical: space.xs,
  },
  proHighlightColumn: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: PRO_COL_WIDTH,
    borderRadius: radius.card,
    borderWidth: borders.selectedWidth,
    borderColor: colors.apricot,
    backgroundColor: colors.s1,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    paddingRight: 0,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.optical10,
  },
  tableRowDivider: {
    borderBottomWidth: borders.width,
    borderBottomColor: colors.s2,
  },
  featureCol: {
    flex: 1,
    paddingRight: space.sm,
  },
  featureTitleWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
  },
  featureText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
  },
  freeCol: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proCol: {
    width: PRO_COL_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    textAlign: 'center',
    fontSize: 12,
  },
  proValueText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    textAlign: 'center',
  },
  proCheckDot: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerDock: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space.md,
    paddingBottom: layout.ctaBottomMin,
    borderTopWidth: borders.width,
    borderTopColor: colors.s2,
    backgroundColor: colors.bg0,
    gap: space.sm,
  },
  summaryOfferCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  summaryOfferMiddle: {
    flex: 1,
    gap: 2,
  },
  priceRightCol: {
    alignItems: 'flex-end',
  },
  strikePrice: {
    textDecorationLine: 'line-through',
    fontSize: 11,
  },
  dualLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xs,
  },
  dualLinkHit: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: space.xs,
  },
  legalRenewalText: {
    textAlign: 'center',
    fontSize: 11,
  },
  planCardsList: {
    gap: space.md,
  },
  planOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.optionCard,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
  },
  planOptionSelected: {
    backgroundColor: colors.s2,
    borderWidth: borders.selectedWidth,
    borderColor: colors.apricot,
  },
  planOptionMiddle: {
    flex: 1,
    gap: 2,
  },
  planOptionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    flexWrap: 'wrap',
  },
  allPlansFootNote: {
    textAlign: 'center',
    marginTop: space.xl,
  },
  centeredSecondary: {
    alignItems: 'center',
  },
});
