import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button, CoinIcon, Skeleton, Text, space } from '@calipartner/ui';
import { useAvatar } from '@/hooks/useAvatar';
import { useCoinCatalog } from '@/hooks/useCoinCatalog';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { startCCWebCheckout, ccWebStatus } from '@/services/ccWebService';
import { generateClientUuid } from '@/services/foodService';
import { t, getLocale } from '@/i18n';
export function WebCCPacks() {
  const { web: catalog, loading, error: catalogError, refresh: load } = useCoinCatalog();
  const { refresh } = useAvatar();
  const { isOnline } = useNetworkStatus();
  const params = useLocalSearchParams<{ cc_checkout?: string; cancelled?: string }>();
  const [error, setError] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(params.cc_checkout ?? null);
  const [confirmed, setConfirmed] = useState(false);
  const requestIds = useRef(new Map<string, string>());
  const busy = useRef(false);
  const check = useCallback(async () => {
    if (!pending) return;
    try {
      const status = await ccWebStatus(pending);
      if (status === 'paid' || status === 'refunded') {
        await refresh();
        setPending(null);
        setConfirmed(status === 'paid');
        requestIds.current.clear();
      }
    } catch {
      setError(true);
    }
  }, [pending, refresh]);
  useEffect(() => {
    if (!pending) return;
    void check();
    let attempts = 0;
    const timer = setInterval(() => {
      if (++attempts >= 10) clearInterval(timer);
      void check();
    }, 3000);
    return () => clearInterval(timer);
  }, [pending, check]);
  return (
    <View style={{ gap: space[3] }} testID="web-cc-packs">
      {loading && !catalog ? <Skeleton testID="coin-catalog-skeleton" /> : null}
      {catalogError && !catalog ? (
        <View>
          <Text accessibilityRole="alert">{t('avatar.webPacksError')}</Text>
          <Button
            variant="secondary"
            label={t('avatar.reloadPrices')}
            onPress={() => void load()}
            testID="web-cc-retry"
          />
        </View>
      ) : null}
      {error ? <Text accessibilityRole="alert">{t('avatar.purchaseError')}</Text> : null}
      {pending && params.cancelled !== '1' ? (
        <View>
          <Text accessibilityLiveRegion="polite">{t('avatar.packPending')}</Text>
          <Button
            variant="secondary"
            label={t('avatar.checkPayment')}
            onPress={() => void check()}
            testID="web-cc-check"
          />
        </View>
      ) : null}
      {confirmed ? <Text accessibilityLiveRegion="polite">{t('avatar.packConfirmed')}</Text> : null}
      {catalog?.products.map((pack) => (
        <Button
          key={pack.id}
          icon={<CoinIcon />}
          variant="secondary"
          disabled={isOnline === false || !!buying || (!!pending && params.cancelled !== '1')}
          loading={buying === pack.id}
          label={t('avatar.packBuy', {
            amount: pack.cc,
            price: new Intl.NumberFormat(getLocale(), {
              style: 'currency',
              currency: pack.currency,
            }).format(pack.amount / 100),
          })}
          testID={`web-cc-pack-${pack.id}`}
          onPress={() => {
            if (busy.current) return;
            busy.current = true;
            setBuying(pack.id);
            setError(false);
            setConfirmed(false);
            const id = requestIds.current.get(pack.id) ?? generateClientUuid();
            requestIds.current.set(pack.id, id);
            void startCCWebCheckout(pack, catalog.provider, id)
              .then(async (result) => {
                if (result === 'pending') setPending(id);
                if (result === 'paid' || result === 'refunded') {
                  await refresh();
                  requestIds.current.delete(pack.id);
                  setConfirmed(result === 'paid');
                }
              })
              .catch(() => {
                setError(true);
                void load();
              })
              .finally(() => {
                busy.current = false;
                setBuying(null);
              });
          }}
        />
      ))}
    </View>
  );
}
