import { CoinAmount } from './CoinAmount';
import React, { useRef, useState } from 'react';
import { Modal, SafeAreaView, View, StyleSheet } from 'react-native';
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
}
export function PurchaseSheet({ quote, onClose }: { quote: AvatarQuote; onClose: () => void }) {
  const { state, acknowledge } = useAvatar();
  const { colors } = useTheme();
  const router = useRouter();
  const request = useRef(generateClientUuid());
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const balance = (state?.balances.earned ?? 0) + (state?.balances.purchased ?? 0);
  const debt = (state?.balances.purchased ?? 0) < 0;
  const shortfall = Math.max(0, quote.price - balance);
  const buy = async () => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
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
        <View style={[styles.sheet, { backgroundColor: colors.s1, borderColor: colors.hairline }]}>
          <Text variant="title2">{quote.name}</Text>
          {shortfall > 0 || debt ? (
            <Text accessibilityRole="alert">
              {t('avatar.insufficientItem', { name: quote.name })}
            </Text>
          ) : (
            <>
              <Text>{t('avatar.confirmPurchase')}</Text>
              <CoinAmount amount={quote.price} />
              <Text variant="bodyS">{t('avatar.remaining')}</Text>
              <CoinAmount amount={balance - quote.price} />
            </>
          )}
          {error ? <Text accessibilityRole="alert">{error}</Text> : null}
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
        </View>
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
