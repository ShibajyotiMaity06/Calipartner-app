import React, { useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Button, Text, space, radius, useTheme, avatarLayout } from '@calipartner/ui';
import { useAvatar } from '@/hooks/useAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { AvatarPage } from '@/components/avatar/AvatarPage';
import { AvatarView } from '@/components/avatar/AvatarView';
import { PurchaseSheet, type AvatarQuote } from '@/components/avatar/PurchaseSheet';
import { getSupabase } from '@/lib/supabase';
import { setAvatarWishlist } from '@/services/avatarService';
import { t } from '@/i18n';
export default function CollectionScreen() {
  const params = useLocalSearchParams<{ collectionId: string }>();
  const router = useRouter();
  const { state, refresh } = useAvatar();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [quote, setQuote] = useState<AvatarQuote | null>(null);
  const [error, setError] = useState(false);
  const busy = useRef(false);
  const collection = state?.collections.find((c) => c.id === params.collectionId);
  const products =
    state?.products.filter(
      (p) =>
        (p.active || p.owned) &&
        p.collection_id === params.collectionId &&
        p.genders.includes(state.profile?.gender ?? 'm'),
    ) ?? [];
  const access =
    collection?.tier_required === 'free' ||
    state?.tier === 'pro' ||
    state?.tier === collection?.tier_required;
  const wish = async (id: string) => {
    if (!user || busy.current) return;
    busy.current = true;
    setError(false);
    try {
      await setAvatarWishlist(getSupabase(), user.id, id, !state?.wishlist.includes(id));
      await refresh();
    } catch {
      setError(true);
    } finally {
      busy.current = false;
    }
  };
  return (
    <AvatarPage title={collection?.name ?? t('avatar.collection')}>
      {!collection ? (
        <Text>{t('common.unavailable')}</Text>
      ) : !state?.profile ? (
        <Button
          label={t('avatar.create')}
          onPress={() => router.push('/avatar/create')}
          testID="collection-create"
        />
      ) : (
        <>
          {!access ? (
            <Button
              variant="secondary"
              label={t('avatar.unlock', { tier: collection.tier_required })}
              onPress={() => router.push('/paywall')}
              testID="collection-unlock"
            />
          ) : null}
          <Text tabular>
            {t('avatar.ownedCount', {
              owned: products.filter((p) => p.owned).length,
              total: products.length,
            })}
          </Text>
          {!collection.earn_only &&
          products.some((p) => !p.owned) &&
          access &&
          collection.price_to_complete != null ? (
            <Button
              label={`${t('avatar.completeSet')} · ${t('avatar.price', { amount: collection.price_to_complete })}`}
              onPress={() =>
                setQuote({
                  name: collection.name,
                  price: collection.price_to_complete!,
                  productId: null,
                  collectionId: collection.id,
                })
              }
              testID="collection-complete-set"
            />
          ) : null}
          <View style={styles.grid}>
            {products.map((product) => {
              const profile = state.profile!;
              const preview =
                product.slot === 'finish'
                  ? profile
                  : { ...profile, slots: { ...profile.slots, [product.slot]: product.id } };
              return (
                <View
                  key={product.id}
                  style={[
                    styles.card,
                    { backgroundColor: colors.s1, borderColor: colors.hairline },
                  ]}
                >
                  {product.slot === 'finish' ? (
                    <Text variant="heading">{product.name}</Text>
                  ) : (
                    <AvatarView
                      profile={preview}
                      products={state.products}
                      tints={state.tints}
                      height={avatarLayout.thumbnailHeight}
                      preview
                    />
                  )}
                  <Text variant="heading">{product.name}</Text>
                  <Text variant="bodyS">
                    {product.owned
                      ? t('avatar.owned')
                      : product.earn_only
                        ? t('avatar.earnedOnly')
                        : t('avatar.price', {
                            amount: product.effective_price ?? product.price_cc,
                          })}
                  </Text>
                  {product.slot !== 'finish' ? (
                    <Button
                      size="sm"
                      variant="tertiary"
                      label={t('avatar.preview')}
                      onPress={() =>
                        router.push({ pathname: '/avatar', params: { try: product.id } })
                      }
                      testID={`preview-${product.id}`}
                    />
                  ) : null}
                  {!product.owned && !product.earn_only ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      label={t(product.accessible ? 'avatar.buy' : 'avatar.unlock', {
                        tier: collection.tier_required,
                      })}
                      onPress={() =>
                        product.accessible
                          ? setQuote({
                              name: product.name,
                              price: product.effective_price ?? product.price_cc,
                              productId: product.id,
                              collectionId: null,
                            })
                          : router.push('/paywall')
                      }
                      testID={`buy-${product.id}`}
                    />
                  ) : null}
                  {!product.owned ? (
                    <Button
                      size="sm"
                      variant="tertiary"
                      label={t(
                        state.wishlist.includes(product.id)
                          ? 'avatar.wishlisted'
                          : 'avatar.wishlist',
                      )}
                      onPress={() => void wish(product.id)}
                      testID={`wish-${product.id}`}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
          {error ? <Text accessibilityRole="alert">{t('avatar.saveError')}</Text> : null}
        </>
      )}
      {quote ? <PurchaseSheet quote={quote} onClose={() => setQuote(null)} /> : null}
    </AvatarPage>
  );
}
const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  card: {
    width: '46%',
    minWidth: avatarLayout.cardMinWidth,
    padding: space[3],
    borderWidth: avatarLayout.borderWidth,
    borderRadius: radius.card,
    gap: space[2],
  },
});
