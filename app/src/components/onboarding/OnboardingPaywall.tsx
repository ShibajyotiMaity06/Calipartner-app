import { useTheme as useAppearance } from '@calipartner/ui/theme';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Button, Text, homeLayout, space } from '@calipartner/ui';
import {
  CHECKOUT_DURATIONS,
  type CheckoutDuration,
  type DodoCatalogProduct,
} from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { fetchWebCatalog, getCachedWebCatalog } from '@/services/webBillingService';
import { findSubscriptionPackage } from '@/services/subscriptionPackages';
import { t } from '@/i18n';
import { checkoutPrice, PRO_BENEFITS } from '@/components/rooms/PaywallCheckout';
import { useSquadStyles } from '@/components/rooms/SquadViews';

export function OnboardingPaywall({
  onCheckout,
  onFree,
}: {
  onCheckout: (tier: 'pro', duration: CheckoutDuration) => void;
  onFree: () => void;
}) {
  const styles = useSquadStyles();

  const { colors: dark } = useAppearance();

  const { session } = useAuth(),
    subscription = useSubscription();
  const cached = Platform.OS === 'web' ? getCachedWebCatalog(session?.access_token) : undefined;
  const [period, setPeriod] = useState<CheckoutDuration>('annual'),
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
  const price = () => {
    return Platform.OS !== 'web'
      ? checkoutPrice(
          'pro',
          period,
          undefined,
          findSubscriptionPackage(subscription.offerings, 'pro', period),
        )?.total
      : checkoutPrice(
          'pro',
          period,
          catalog.find((product) => product.key === 'pro_' + period),
        )?.total;
  };
  const loading = Platform.OS === 'web' ? pending : subscription.loading;
  return (
    <View style={styles.stack} testID="onboarding-support-paywall">
      <Text variant="title1">{t('aha.paywallTitle')}</Text>
      <Text>{t('aha.paywallBody')}</Text>
      <View style={styles.row} accessibilityRole="tablist">
        {CHECKOUT_DURATIONS.map((value) => (
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
            <Text>{t(`releaseUpdate.${value}`)}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.card} testID="support-plan-pro">
        <Text variant="title2">{t('proPlan.pro')}</Text>
        {loading ? (
          <Text accessibilityLiveRegion="polite">{t('fixes.loadingPrices')}</Text>
        ) : price() && !error ? (
          <Text variant="numeralM" tabular>
            {t('releaseUpdate.charged', { total: price()! })}
          </Text>
        ) : (
          <Text accessibilityRole="alert">{t('entryRefresh.priceError')}</Text>
        )}
        <Text>{t('proPlan.tax')}</Text>
        {PRO_BENEFITS.map((benefit) => (
          <Text key={benefit}>{t(benefit)}</Text>
        ))}
        <Button
          variant="primary"
          label={t('entryRefresh.choosePlan', { plan: t('proPlan.pro') })}
          onPress={() => onCheckout('pro', period)}
          disabled={loading || error || !price()}
          testID="support-buy-pro"
        />
      </View>
      {(error || (!loading && !price())) && (
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
      <Text>{t('releaseUpdate.freeForever')}</Text>
      <Button
        variant="tertiary"
        label={t('aha.free')}
        onPress={onFree}
        testID="support-continue-free"
      />
    </View>
  );
}
