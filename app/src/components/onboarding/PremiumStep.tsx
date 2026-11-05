import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  CheckIcon,
  Text,
  onboardingLayout as layout,
  radius,
  space,
  useTheme,
} from '@calipartner/ui';
import type { DodoCatalogProduct } from '@calipartner/core';
import { useSubscription } from '@/hooks/useSubscription';
import { fetchWebCatalog } from '@/services/webBillingService';
import { findSubscriptionPackage } from '@/services/subscriptionPackages';
import { t } from '@/i18n';
import { PlanCard, planStyles } from './PlanPrimitives';

export function PremiumStep({
  onContinue,
  onSkip,
}: {
  onContinue: (tier: 'plus' | 'pro') => void;
  onSkip: () => void;
}) {
  const { colors } = useTheme();
  const { offerings, loading: storeLoading, refresh } = useSubscription();
  const [tier, setTier] = useState<'plus' | 'pro'>('plus');
  const [catalog, setCatalog] = useState<DodoCatalogProduct[]>([]);
  const [loading, setLoading] = useState(Platform.OS === 'web');
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let active = true;
    setLoading(true);
    setError(false);
    void fetchWebCatalog()
      .then((result) => {
        if (active) setCatalog(result.products);
      })
      .catch(() => {
        if (active) {
          setCatalog([]);
          setError(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  const price = useCallback(
    (duration: 'monthly' | 'annual') => {
      if (Platform.OS !== 'web')
        return findSubscriptionPackage(offerings, tier, duration)?.product.priceString;
      const product = catalog.find((item) => item.key === `${tier}_${duration}`);
      return product
        ? new Intl.NumberFormat(product.currency === 'INR' ? 'en-IN' : 'en-US', {
            style: 'currency',
            currency: product.currency,
          }).format(product.amount)
        : undefined;
    },
    [catalog, offerings, tier],
  );
  const monthly = price('monthly'),
    annual = price('annual');
  const waiting = Platform.OS === 'web' ? loading : storeLoading;
  const trial =
    tier === 'plus' &&
    (Platform.OS === 'web'
      ? catalog.some((item) => item.key === 'plus_monthly' && item.trialDays === 7)
      : findSubscriptionPackage(offerings, tier, 'monthly')?.product.introPrice?.price === 0);
  return (
    <View style={styles.frame} testID="premium-highlights">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="title1" accessibilityRole="header" testID="onboarding-title">
          {t('entryRefresh.plansTitle')}
        </Text>
        <Text variant="bodyS" color={colors.textMid}>
          {t('entryRefresh.plansSubtitle')}
        </Text>
        <View
          style={[styles.tabs, { backgroundColor: colors.s1, borderColor: colors.hairline }]}
          accessibilityRole="tablist"
        >
          {(['plus', 'pro'] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => setTier(value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tier === value }}
              testID={`onboarding-plan-${value}`}
              style={[
                styles.tab,
                { backgroundColor: tier === value ? colors.apricot : 'transparent' },
              ]}
            >
              <Text variant="label" color={tier === value ? colors.onBrand : colors.textMid}>
                {t(`entryRefresh.${value}`)}
              </Text>
            </Pressable>
          ))}
        </View>
        <PlanCard testID="premium-week-preview">
          <Text variant="label">{t('entryRefresh.exampleWeek')}</Text>
          <View style={styles.days}>
            {[0, 1, 2, 3, 4, 5, 6].map((day) => (
              <View key={day} style={[styles.day, { backgroundColor: colors.bg0 }]}>
                <Text variant="micro" color={colors.textMid}>
                  {t(`entryRefresh.days.${day}` as 'entryRefresh.days.0')}
                </Text>
                <Text variant="micro">
                  {t(`entryRefresh.workouts.${day}` as 'entryRefresh.workouts.0')}
                </Text>
              </View>
            ))}
          </View>
          <Text variant="micro" color={colors.textMid}>
            {t('entryRefresh.exampleLabel')}
          </Text>
          <Text variant="bodyS" color={colors.textMid}>
            {t('entryRefresh.recipes')}
          </Text>
          <View style={styles.cuisines}>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <View key={index} style={[styles.chip, { borderColor: colors.hairline }]}>
                <Text variant="micro" color={colors.textMid}>
                  {t(`entryRefresh.cuisines.${index}` as 'entryRefresh.cuisines.0')}
                </Text>
              </View>
            ))}
          </View>
        </PlanCard>
        {(['One', 'Two', 'Three', 'Four'] as const).map((number) => (
          <View key={number} style={planStyles.row}>
            <CheckIcon size={layout.icon} color={colors.apricot} />
            <Text variant="bodyS" style={planStyles.flex}>
              {t(`entryRefresh.${tier}${number}`)}
            </Text>
          </View>
        ))}
        {trial && (
          <Text variant="micro" color={colors.textMid}>
            {t('entryRefresh.trialNote')}
          </Text>
        )}
      </ScrollView>
      <View style={[styles.purchase, { borderTopColor: colors.hairline }]}>
        {waiting ? (
          <Text accessibilityLiveRegion="polite">{t('fixes.loadingPrices')}</Text>
        ) : monthly && annual && !error ? (
          <>
            <View style={styles.priceRow}>
              <Text variant="title2" tabular testID="onboarding-monthly-price">
                {t('entryRefresh.monthly', { price: monthly })}
              </Text>
              {trial && (
                <Text variant="label" color={colors.apricot}>
                  {t('entryRefresh.trial')}
                </Text>
              )}
            </View>
            <Text variant="bodyS" tabular color={colors.textMid}>
              {t('entryRefresh.annual', { price: annual })}
            </Text>
            {Platform.OS === 'web' && (
              <Text variant="micro" color={colors.textMid}>
                {t(
                  catalog[0]?.currency === 'INR'
                    ? 'entryRefresh.paymentIndia'
                    : 'entryRefresh.paymentInternational',
                )}
              </Text>
            )}
          </>
        ) : (
          <>
            <Text variant="bodyS" accessibilityRole="alert">
              {t('entryRefresh.priceError')}
            </Text>
            <Button
              variant="secondary"
              label={t('common.retry')}
              onPress={() => {
                if (Platform.OS === 'web') setRetry((value) => value + 1);
                else void refresh();
              }}
              testID="onboarding-prices-retry"
            />
          </>
        )}
        <Button
          label={
            trial
              ? t('entryRefresh.trialAction')
              : t('entryRefresh.choosePlan', { plan: t(`entryRefresh.${tier}`) })
          }
          onPress={() => onContinue(tier)}
          disabled={waiting || !monthly || !annual || error}
          testID="btn-onboarding-next"
        />
        <Button
          variant="tertiary"
          label={t('entryRefresh.skip')}
          onPress={onSkip}
          testID="btn-onboarding-free"
        />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  frame: { flex: 1 },
  content: { gap: space[4], padding: space[4] },
  tabs: {
    flexDirection: 'row',
    borderRadius: radius.full,
    padding: space[1],
    borderWidth: layout.border,
  },
  tab: {
    flex: 1,
    minHeight: layout.touch,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[2],
    borderRadius: radius.full,
  },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1] },
  day: {
    flexGrow: 1,
    alignItems: 'center',
    minWidth: space[7],
    padding: space[1],
    borderRadius: radius.control,
  },
  cuisines: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1] },
  chip: {
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radius.full,
    borderWidth: layout.border,
  },
  purchase: {
    gap: space[3],
    borderTopWidth: layout.border,
    padding: space[4],
  },
  priceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space[2],
  },
});
