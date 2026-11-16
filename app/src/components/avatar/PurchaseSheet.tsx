import { CoinAmount } from './CoinAmount';
import React, { useRef, useState } from 'react';
import { Modal, SafeAreaView, View, StyleSheet, ScrollView } from 'react-native';
import { Button, Text, useTheme, space, radius, avatarLayout } from '@calipartner/ui';
import { useRouter } from 'expo-router';
import { purchaseAvatarProduct } from '@/services/avatarService';
import { getSupabase } from '@/lib/supabase';
import { generateClientUuid } from '@/services/foodService';
import { useAvatar } from '@/hooks/useAvatar';
import { t } from '@/i18n';
export interface AvatarQuote {
  name: string;
  price: number;
  productId: string | null;
  collectionId: string | null;
  items?: { productId: string; name: string; price: number }[];
}
export function PurchaseSheet({
  quote,
  onClose,
  onBeforePurchase,
}: {
  quote: AvatarQuote;
  onClose: () => void;
  onBeforePurchase?: () => Promise<void>;
}) {
  const { state, acknowledge } = useAvatar();
  const { colors } = useTheme();
  const router = useRouter();
  const request = useRef(generateClientUuid());
  const requests = useRef(new Map<string, string>());
  const completed = useRef(new Set<string>());
  const [completedCount, setCompletedCount] = useState(0);
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const balance = (state?.balances.earned ?? 0) + (state?.balances.purchased ?? 0);
  const debt = (state?.balances.purchased ?? 0) < 0;
  const remainingItems = quote.items?.filter((item) => !completed.current.has(item.productId));
  const remainingPrice = remainingItems
    ? remainingItems.reduce((sum, item) => sum + item.price, 0)
    : quote.price;
  const shortfall = Math.max(0, remainingPrice - balance);
  const buy = async () => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      await onBeforePurchase?.();
      if (quote.items) {
        for (const item of quote.items) {
          if (completed.current.has(item.productId)) continue;
          if (!requests.current.has(item.productId))
            requests.current.set(item.productId, generateClientUuid());
          const result = await purchaseAvatarProduct(
            getSupabase(),
            requests.current.get(item.productId)!,
            item.price,
            item.productId,
            null,
          );
          acknowledge(result);
          completed.current.add(item.productId);
          setCompletedCount(completed.current.size);
        }
      } else
        acknowledge(
          await purchaseAvatarProduct(
            getSupabase(),
            request.current,
            quote.price,
            quote.productId,
            quote.collectionId,
          ),
        );
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      setError(
        t(
          message.includes('PRICE_CHANGED')
            ? 'avatar.priceChanged'
            : message.includes('PURCHASED_BALANCE_NEGATIVE')
              ? 'avatar.debt'
              : message.includes('NETWORK_UNAVAILABLE')
                ? 'avatar.offline'
                : 'avatar.purchaseError',
        ),
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={() => {
        if (!saving) onClose();
      }}
    >
      <SafeAreaView style={[styles.overlay, { backgroundColor: colors.bg0 }]}>
        <ScrollView
          contentContainerStyle={[
            styles.sheet,
            { backgroundColor: colors.s1, borderColor: colors.hairline },
          ]}
        >
          <Text variant="title2">{quote.name}</Text>
          {quote.items?.map((item) => (
            <View key={item.productId} style={styles.actions}>
              <Text style={styles.action}>{item.name}</Text>
              <CoinAmount amount={item.price} />
            </View>
          ))}
          {completedCount > 0 ? (
            <Text accessibilityLiveRegion="polite">
              {t('avatar.purchaseProgress', {
                count: completedCount,
                total: quote.items?.length ?? 1,
              })}
            </Text>
          ) : null}
          {shortfall > 0 || debt ? (
            <Text accessibilityRole="alert">
              {t('avatar.insufficientItem', { name: quote.name })}
            </Text>
          ) : (
            <>
              <Text>{t('avatar.confirmPurchase')}</Text>
              <CoinAmount amount={remainingPrice} />
              <Text variant="bodyS">{t('avatar.remaining')}</Text>
              <CoinAmount amount={balance - remainingPrice} />
            </>
          )}
          {error ? <Text accessibilityRole="alert">{error}</Text> : null}
          {error && completedCount > 0 ? <Text>{t('avatar.purchasePartial')}</Text> : null}
          <View style={styles.actions}>
            <View style={styles.action}>
              {shortfall > 0 || debt ? (
                <Button
                  label={t('avatar.buyCC')}
                  onPress={() => {
                    onClose();
                    router.push('/wallet');
                  }}
                  testID="purchase-buy-cc"
                />
              ) : (
                <Button
                  label={t('avatar.confirmPurchase')}
                  loading={saving}
                  onPress={() => void buy()}
                  testID="avatar-confirm-purchase"
                />
              )}
            </View>
            <View style={styles.action}>
              <Button
                variant="destructive"
                disabled={saving}
                label={t('avatar.cancel')}
                onPress={onClose}
                testID="avatar-cancel-purchase"
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: space[3] },
  action: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', padding: space[4] },
  sheet: {
    borderWidth: avatarLayout.borderWidth,
    borderRadius: radius.sheet,
    padding: space[5],
    gap: space[4],
  },
});
