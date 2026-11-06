import React, { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Button, Text, dark, homeLayout, space } from '@calipartner/ui';
import type { DodoCatalogProduct } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { usePlusTrial } from '@/hooks/usePlusTrial';
import { fetchWebCatalog, getCachedWebCatalog } from '@/services/webBillingService';
import { findSubscriptionPackage } from '@/services/subscriptionPackages';
import { t } from '@/i18n';
import { squadStyles as styles } from '@/components/rooms/SquadViews';

export function OnboardingPaywall({
  onCheckout,
  onFree,
}: {
  onCheckout: (tier: 'plus' | 'pro', duration: 'monthly' | 'annual') => void;
  onFree: () => void;
}) {
  const { session } = useAuth(),
    subscription = useSubscription(),
    trial = usePlusTrial();
  const cached = Platform.OS === 'web' ? getCachedWebCatalog(session?.access_token) : undefined;
  const [period, setPeriod] = useState<'monthly' | 'annual'>('annual'),
    [catalog, setCatalog] = useState<DodoCatalogProduct[]>(cached?.products ?? []),
    [pending, setPending] = useState(Platform.OS === 'web' && !cached),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let active = true;
    setPending(!getCachedWebCatalog(session?.access_token));
    setError(false);
    void fetchWebCatalog({ force: retry > 0 })
      .then((result) => {
        if (active) setCatalog(result.products);
      })
      .catch(() => {
        if (active) {
          setError(true);
          setCatalog([]);
        }
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
    };
  }, [retry, session?.access_token]);
  const price = (tier: 'plus' | 'pro') => {
    if (Platform.OS !== 'web')
      return findSubscriptionPackage(subscription.offerings, tier, period)?.product.priceString;
    const product = catalog.find((product) => product.key === `${tier}_${period}`);
    return product
      ? new Intl.NumberFormat(product.currency === 'INR' ? 'en-IN' : 'en-US', {
          style: 'currency',
          currency: product.currency,
        }).format(product.amount)
      : undefined;
  };
  const loading = Platform.OS === 'web' ? pending : subscription.loading;
  return (
    <View style={styles.stack} testID="onboarding-support-paywall">
      <Text variant="title1">{t('aha.paywallTitle')}</Text>
      <Text>{t('aha.paywallBody')}</Text>
      <View style={styles.row} accessibilityRole="tablist">
        {(['monthly', 'annual'] as const).map((value) => (
          <Pressable
            key={value}
            onPress={() => setPeriod(value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: period === value }}
            style={{
              minHeight: homeLayout.touchSize,
              padding: space[3],
              borderBottomWidth: period === value ? space[1] : 0,
              borderColor: dark.copper,
            }}
            testID={`support-duration-${value}`}
          >
            <Text>{t(`aha.${value}`)}</Text>
          </Pressable>
        ))}
      </View>
      {(['plus', 'pro'] as const).map((tier) => (
        <View key={tier} style={styles.card} testID={`support-plan-${tier}`}>
          <Text variant="title2">{t(`entryRefresh.${tier}`)}</Text>
          {loading ? (
            <Text accessibilityLiveRegion="polite">{t('fixes.loadingPrices')}</Text>
          ) : price(tier) && !error ? (
            <Text variant="numeralM" tabular>
              {period === 'annual'
                ? t('aha.billed', { price: price(tier)! })
                : t('entryRefresh.monthly', { price: price(tier)! })}
            </Text>
          ) : (
            <Text accessibilityRole="alert">{t('entryRefresh.priceError')}</Text>
          )}
          <Text>{t(tier === 'plus' ? 'aha.plusBody' : 'aha.proBody')}</Text>
          {tier === 'plus' && trial.offer?.eligible && (
            <>
              <Text variant="bodyS">{t('cardlessTrial.noCard')}</Text>
              <Text variant="bodyS">{t('aha.previewBody')}</Text>
              <Button
                variant="secondary"
                label={t('entryRefresh.trialAction')}
                onPress={async () => {
                  if (await trial.start()) onFree();
                }}
                disabled={trial.starting}
                testID="support-start-plus-trial"
              />
            </>
          )}
          <Button
            variant={tier === 'pro' ? 'primary' : 'secondary'}
            label={t('entryRefresh.choosePlan', { plan: t(`entryRefresh.${tier}`) })}
            onPress={() => onCheckout(tier, period)}
            disabled={loading || error || !price(tier)}
            testID={`support-buy-${tier}`}
          />
        </View>
      ))}
      {(error || (!loading && (!price('plus') || !price('pro')))) && (
        <Button
          variant="secondary"
          label={t('common.retry')}
          onPress={() => {
            if (Platform.OS === 'web') setRetry((value) => value + 1);
            else void subscription.refresh();
          }}
          testID="support-prices-retry"
        />
      )}
      {trial.error && (
        <>
          <Text accessibilityRole="alert">{t('cardlessTrial.error')}</Text>
          <Button
            variant="secondary"
            label={t('common.retry')}
            onPress={() => void trial.refresh()}
            testID="support-trial-retry"
          />
        </>
      )}
      <View style={styles.card}>
        <Text>{t('aha.paywallBody')}</Text>
      </View>
      <Button
        variant="tertiary"
        label={t('aha.free')}
        onPress={onFree}
        testID="support-continue-free"
      />
    </View>
  );
}
