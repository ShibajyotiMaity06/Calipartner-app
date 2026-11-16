import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button, Text, space } from '@calipartner/ui';
import { useAvatar } from '@/hooks/useAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { fetchCCWebCatalog, startCCWebCheckout, ccWebStatus } from '@/services/ccWebService';
import { generateClientUuid } from '@/services/foodService';
import { t, getLocale } from '@/i18n';
type Catalog = Awaited<ReturnType<typeof fetchCCWebCatalog>>;
export function WebCCPacks() {
  const { user } = useAuth();
  const { refresh } = useAvatar();
  const { isOnline } = useNetworkStatus();
  const params = useLocalSearchParams<{ cc_checkout?: string; cancelled?: string }>();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(params.cc_checkout ?? null);
  const [confirmed, setConfirmed] = useState(false);
  const requestIds = useRef(new Map<string, string>());
  const busy = useRef(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setCatalog(await fetchCCWebCatalog());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load, user?.id]);
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
      {loading ? <Text>{t('common.loading')}</Text> : null}
      {error ? (
        <View>
          <Text accessibilityRole="alert">{t('avatar.webPacksError')}</Text>
          <Button
            variant="secondary"
            label={t('common.retry')}
            onPress={() => void load()}
            testID="web-cc-retry"
          />
        </View>
      ) : null}
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
              .catch(() => setError(true))
              .finally(() => {
                busy.current = false;
                setBuying(null);
              });
          }}
        />
      ))}
      <Text variant="bodyS">{t('avatar.checkoutPrice')}</Text>
    </View>
  );
}
