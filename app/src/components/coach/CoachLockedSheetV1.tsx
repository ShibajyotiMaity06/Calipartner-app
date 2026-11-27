import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PRICING_PLANS, hasPlan, type DodoCatalogProduct } from '@calipartner/core';
import {
  Badge,
  CheckCircleIcon,
  CloseIcon,
  PrimaryButton,
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
import { getLocale, t } from '@/i18n';
import { generateClientUuid } from '@/services/foodService';
import { findSubscriptionPackage } from '@/services/subscriptionPackages';
import {
  fetchWebCatalog,
  getCachedWebCatalog,
  startWebCheckout,
  type WebPaymentProvider,
} from '@/services/webBillingService';
import { checkoutPrice } from '@/components/rooms/PaywallCheckout';

export interface CoachLockedSheetV1Props {
  visible: boolean;
  onClose: () => void;
  onSeeAllPlans: () => void;
  onUnlocked?: () => void;
}

const FEATURES = [
  'coachV1.lockedFeature1',
  'coachV1.lockedFeature2',
  'coachV1.lockedFeature3',
  'coachV1.lockedFeature4',
] as const;

export function CoachLockedSheetV1({
  visible,
  onClose,
  onSeeAllPlans,
  onUnlocked,
}: CoachLockedSheetV1Props): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { offerings, purchase, refresh, loading: subscriptionLoading } = useSubscription();

  const cachedCatalog =
    Platform.OS === 'web' ? getCachedWebCatalog(session?.access_token) : undefined;
  const [catalog, setCatalog] = useState<DodoCatalogProduct[]>(cachedCatalog?.products ?? []);
  const [webProvider, setWebProvider] = useState<WebPaymentProvider>(
    cachedCatalog?.provider ?? 'razorpay',
  );
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);

  const loadWebPricing = useCallback(async () => {
    if (Platform.OS !== 'web') return;
    setCatalogLoading(true);
    try {
      const result = await fetchWebCatalog();
      setCatalog(result.products);
      setWebProvider(result.provider);
    } catch {
      // Fall through cleanly; fallback pricing comes from live billing config/subscriptionTerm
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible && Platform.OS === 'web' && !cachedCatalog?.products?.length) {
      void loadWebPricing();
    }
  }, [visible, cachedCatalog?.products?.length, loadWebPricing]);

  useEffect(() => {
    if (!visible) {
      setStatusMessage(null);
      setBusy(false);
    }
  }, [visible]);

  const webAnnual = useMemo(() => catalog.find((item) => item.key === 'pro_annual'), [catalog]);
  const nativeAnnual = useMemo(
    () => findSubscriptionPackage(offerings, 'pro', 'annual'),
    [offerings],
  );

  const quote = useMemo(
    () =>
      Platform.OS === 'web'
        ? checkoutPrice('pro', 'annual', webAnnual)
        : checkoutPrice('pro', 'annual', undefined, nativeAnnual),
    [webAnnual, nativeAnnual],
  );

  const savePercent = useMemo(() => {
    const isUsd = webAnnual?.currency === 'USD' || nativeAnnual?.product?.currencyCode === 'USD';
    const plan = isUsd ? PRICING_PLANS.pro.usd : PRICING_PLANS.pro.inr;
    const baseMonthly = plan.rawMonthly;
    const annualAmount =
      webAnnual?.amount ?? nativeAnnual?.product?.price ?? plan.terms.annual.amount;
    if (!baseMonthly || !annualAmount || annualAmount <= 0) return null;
    const eqMonthly = annualAmount / 12;
    const pct = Math.round((1 - eqMonthly / baseMonthly) * 100);
    return pct > 0 && pct < 100 ? pct : null;
  }, [webAnnual, nativeAnnual]);

  const perMonthLabel = useMemo(() => {
    if (!quote) return '';
    const cleanEq = quote.equivalent.replace(/\s*\/\s*mo(?:nth)?\s*$/i, '').trim();
    if (savePercent != null) {
      return t('coachV1.lockedPerMonthSave', {
        amount: cleanEq,
        percent: savePercent,
      });
    }
    return t('coachV1.lockedPerMonth', { amount: cleanEq });
  }, [quote, savePercent]);

  const handleUnlock = async () => {
    if (busy) return;
    setBusy(true);
    setStatusMessage(null);
    try {
      if (Platform.OS === 'web') {
        if (!catalog.length) {
          await loadWebPricing();
        }
        requestIdRef.current ??= generateClientUuid();
        const result = await startWebCheckout(webProvider, 'pro', 'annual', requestIdRef.current);
        if (result === 'pending') {
          const latest = await refresh();
          if (hasPlan(latest)) {
            onUnlocked?.();
            return;
          }
          setStatusMessage(t('fixes.paymentPending'));
          return;
        }
        if (result === 'cancelled') {
          requestIdRef.current = null;
          setStatusMessage(t('fixes.storeCancelled'));
        }
        return;
      }

      if (!nativeAnnual) {
        onClose();
        onSeeAllPlans();
        return;
      }
      await purchase(nativeAnnual);
      const latest = await refresh();
      if (hasPlan(latest)) {
        onUnlocked?.();
      }
    } catch (err) {
      setStatusMessage(err instanceof Error && err.message ? err.message : t('common.errorBody'));
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  const isPriceLoading = (catalogLoading || subscriptionLoading) && !quote;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID="modal-coach-locked-sheet"
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('coachV1.lockedNotNow')}
        />

        <View
          style={[styles.sheet, { paddingBottom: Math.max(space.xxl, insets.bottom + space.md) }]}
          testID="sheet-coach-locked"
        >
          <View style={styles.handleBar} />

          <View style={styles.topRow}>
            <View style={styles.eyebrowPill}>
              <Text variant="eyebrow" color="apricot" style={styles.eyebrowText}>
                {t('coachV1.lockedEyebrow')}
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('coachV1.lockedNotNow')}
              style={({ pressed }) => [styles.closeBtn, pressed ? styles.pressedBg : null]}
              testID="btn-coach-locked-close"
            >
              <CloseIcon size={16} color={colors.textMid} />
            </Pressable>
          </View>

          <Text style={styles.headline}>
            <Text style={styles.headlineBase}>{t('coachV1.lockedHeadlineLead')}</Text>
            <Text style={styles.headlineAccent}>{t('coachV1.lockedHeadlineAccent')}</Text>
          </Text>

          <Text variant="body" color="textMid" style={styles.subtitle}>
            {t('coachV1.lockedSubtitle')}
          </Text>

          <View style={styles.featuresList}>
            {FEATURES.map((key) => (
              <View key={key} style={styles.featureRow}>
                <CheckCircleIcon size={18} color={colors.apricot} />
                <Text variant="body" color="textHi" style={styles.featureText}>
                  {t(key)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.planCard} testID="coach-locked-price-card">
            <View style={styles.planLeft}>
              <View style={styles.planTitleRow}>
                <Text variant="rowTitle" color="textHi">
                  {t('coachV1.lockedPlanTerm')}
                </Text>
                <Badge variant="bestValue" mini label={t('coachV1.lockedBestValue')} />
              </View>
              {quote ? (
                <Text variant="meta" color="textLo" tabular>
                  {perMonthLabel}
                </Text>
              ) : null}
            </View>

            <View style={styles.planRight}>
              {isPriceLoading ? (
                <ActivityIndicator size="small" color={colors.apricot} />
              ) : (
                <Text style={styles.priceText} tabular testID="coach-locked-price">
                  {quote?.total ??
                    PRICING_PLANS.pro.inr.terms.annual.amount.toLocaleString(getLocale())}
                </Text>
              )}
            </View>
          </View>

          {statusMessage ? (
            <Text variant="meta" color="danger" accessibilityRole="alert" style={styles.errorText}>
              {statusMessage}
            </Text>
          ) : null}

          <PrimaryButton
            title={t('coachV1.lockedUnlockBtn')}
            showArrow
            loading={busy}
            onPress={() => void handleUnlock()}
            testID="btn-coach-unlock-pro"
          />

          <View style={styles.footerLinks}>
            <Pressable
              onPress={() => {
                onClose();
                onSeeAllPlans();
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('coachV1.lockedSeePlans')}
              style={({ pressed }) => [styles.footerBtn, pressed ? styles.pressedOpacity : null]}
              testID="btn-coach-see-plans"
            >
              <Text variant="label" color="textMid">
                {t('coachV1.lockedSeePlans')}
              </Text>
            </Pressable>

            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('coachV1.lockedNotNow')}
              style={({ pressed }) => [styles.footerBtn, pressed ? styles.pressedOpacity : null]}
              testID="btn-coach-not-now"
            >
              <Text variant="label" color="textLo">
                {t('coachV1.lockedNotNow')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.s1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: borders.width,
    borderColor: colors.hairlineLit,
    paddingHorizontal: layout.sheetPaddingX,
    paddingTop: space.md,
    gap: space.md,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: radius.bar,
    backgroundColor: colors.s3,
    alignSelf: 'center',
    marginBottom: space.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrowPill: {
    borderRadius: radius.full,
    borderWidth: borders.width,
    borderColor: colors.hairlineLit,
    backgroundColor: colors.s2,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  eyebrowText: {
    letterSpacing: 1.1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    marginTop: space.xs,
  },
  headlineBase: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 35,
    color: colors.textHi,
    letterSpacing: -0.6,
  },
  headlineAccent: {
    fontFamily: fonts.displayItalic,
    fontSize: 30,
    lineHeight: 35,
    color: colors.apricot,
    letterSpacing: -0.6,
  },
  subtitle: {
    marginBottom: space.xs,
  },
  featuresList: {
    gap: space.sm + 2,
    marginBottom: space.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  featureText: {
    flex: 1,
  },
  planCard: {
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairlineLit,
    borderRadius: radius.optionCard,
    paddingHorizontal: space.lg,
    paddingVertical: space.optical14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  planLeft: {
    flex: 1,
    gap: 3,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    flexWrap: 'wrap',
  },
  planRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  priceText: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 32,
    color: colors.textHi,
    letterSpacing: -0.8,
  },
  errorText: {
    textAlign: 'center',
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space.xs,
  },
  footerBtn: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: space.xs,
  },
  pressedBg: {
    backgroundColor: colors.s3,
  },
  pressedOpacity: {
    opacity: 0.7,
  },
});
