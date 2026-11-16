import { CoinAmount } from '@/components/avatar/CoinAmount';
import { useCoinCatalog } from '@/hooks/useCoinCatalog';
import { WebCCPacks } from '@/components/avatar/WebCCPacks';
import React, { useRef, useState } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import {
  Button,
  CoinIcon,
  Skeleton,
  Text,
  space,
  useTheme,
  radius,
  avatarLayout,
} from '@calipartner/ui';
import type { PurchasesPackage } from 'react-native-purchases';
import { useAvatar } from '@/hooks/useAvatar';
import { buyAvatarPack } from '@/services/avatarPackService';
import { AvatarPage } from '@/components/avatar/AvatarPage';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { t, type TranslationKey, getLocale } from '@/i18n';
const reasons: Record<string, TranslationKey> = {
  pack_purchase: 'avatar.packReason',
  pack_refund: 'avatar.refundReason',
  cosmetics: 'avatar.purchaseReason',
};
export default function WalletScreen() {
  const { state, refresh } = useAvatar();
  const { packages, loading, refresh: reloadCatalog } = useCoinCatalog();
  const { colors } = useTheme();
  const { isOnline } = useNetworkStatus();
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const busy = useRef(false);
  const ids =
    state?.packs
      ?.map((p) => p.store_product_id)
      .sort()
      .join(',') ?? '';
  const buy = async (pkg: PurchasesPackage) => {
    if (busy.current || isOnline === false) return;
    busy.current = true;
    setBuying(pkg.identifier);
    setError(false);
    try {
      await buyAvatarPack(pkg, ids.split(','));
      setPending(true);
      await refresh();
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setBuying(null);
    }
  };
  return (
    <AvatarPage title={t('avatar.wallet')}>
      {state?.enabled ? (
        <>
          <View style={[styles.card, { backgroundColor: colors.s1, borderColor: colors.hairline }]}>
            <Text>{t('avatar.total')}</Text>
            <CoinAmount large amount={state.balances.earned + state.balances.purchased} />
            <Text tabular>
              {t('avatar.earned')}: {state.balances.earned}
            </Text>
            <Text tabular>
              {t('avatar.purchased')}: {state.balances.purchased}
            </Text>
          </View>
          <Text variant="heading">{t('avatar.buyCC')}</Text>
          {isOnline === false ? <Text accessibilityRole="alert">{t('avatar.offline')}</Text> : null}
          {Platform.OS === 'web' ? (
            <WebCCPacks />
          ) : loading && !packages.length ? (
            <Skeleton />
          ) : packages.length === 0 ? (
            <>
              <Text>{t('avatar.packsUnavailable')}</Text>
              <Button
                variant="secondary"
                label={t('avatar.reloadPrices')}
                onPress={() => void reloadCatalog()}
                testID="wallet-retry-packs"
              />
            </>
          ) : (
            packages.map((pkg) => (
              <Button
                key={pkg.identifier}
                icon={<CoinIcon />}
                variant="secondary"
                disabled={isOnline === false || !!buying}
                loading={buying === pkg.identifier}
                label={t('avatar.packBuy', {
                  amount:
                    state.packs.find((p) => p.store_product_id === pkg.product.identifier)?.cc ?? 0,
                  price: pkg.product.priceString,
                })}
                onPress={() => void buy(pkg)}
                testID={`wallet-pack-${pkg.product.identifier}`}
              />
            ))
          )}
          {error ? <Text accessibilityRole="alert">{t('avatar.purchaseError')}</Text> : null}
          {pending ? <Text accessibilityLiveRegion="polite">{t('avatar.packPending')}</Text> : null}
          <Text variant="heading">{t('avatar.history')}</Text>
          {state.ledger.length === 0 ? (
            <Text>{t('avatar.emptyHistory')}</Text>
          ) : (
            state.ledger.map((entry) => (
              <View key={entry.id} style={[styles.row, { borderColor: colors.hairline }]}>
                <View style={styles.flex}>
                  <Text variant="bodyS">{t(reasons[entry.reason] ?? 'avatar.earnedReason')}</Text>
                  <Text variant="label">
                    {new Date(entry.created_at).toLocaleDateString(getLocale())} ·{' '}
                    {t(entry.wallet === 'earned' ? 'avatar.earned' : 'avatar.purchased')}
                  </Text>
                </View>
                <CoinAmount signed amount={entry.delta} />
              </View>
            ))
          )}
        </>
      ) : null}
    </AvatarPage>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: space[4],
    borderRadius: radius.card,
    borderWidth: avatarLayout.borderWidth,
    gap: space[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    borderBottomWidth: avatarLayout.borderWidth,
  },
  flex: { flex: 1 },
});
