import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Text, space, radius, useTheme, avatarLayout } from '@calipartner/ui';
import { useAvatar } from '@/hooks/useAvatar';
import { AvatarPage } from '@/components/avatar/AvatarPage';
import { t } from '@/i18n';
export default function ShopScreen() {
  const { state } = useAvatar();
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <AvatarPage title={t('avatar.shop')}>
      {state?.enabled ? (
        !state.profile ? (
          <Button
            label={t('avatar.create')}
            onPress={() => router.push('/avatar/create')}
            testID="shop-create-character"
          />
        ) : (
          <>
            <Button
              variant="secondary"
              label={t('avatar.buyCC')}
              onPress={() => router.push('/wallet')}
              testID="shop-wallet"
            />
            {(['free', 'plus', 'pro'] as const).map((tier) => (
              <View key={tier} style={styles.section}>
                <Text variant="heading">
                  {tier === 'free' ? 'Basic' : tier === 'plus' ? 'Plus' : 'Pro'}
                </Text>
                {state.collections
                  .filter((c) => c.tier_required === tier)
                  .map((collection) => {
                    const products = state.products.filter(
                      (p) =>
                        p.active &&
                        p.collection_id === collection.id &&
                        p.genders.includes(state.profile!.gender),
                    );
                    const owned = products.filter((p) => p.owned).length;
                    return (
                      <View
                        key={collection.id}
                        style={[
                          styles.card,
                          { backgroundColor: colors.s1, borderColor: colors.hairline },
                        ]}
                      >
                        <Text variant="title2">{collection.name}</Text>
                        <Text tabular>
                          {t('avatar.ownedCount', { owned, total: products.length })}
                        </Text>
                        {owned === products.length ? <Text>{t('avatar.setBadge')}</Text> : null}
                        <Button
                          variant="secondary"
                          label={t('avatar.collection')}
                          onPress={() =>
                            router.push({
                              pathname: '/shop/[collectionId]',
                              params: { collectionId: collection.id },
                            })
                          }
                          testID={`shop-collection-${collection.id}`}
                        />
                      </View>
                    );
                  })}
              </View>
            ))}
            <Text variant="heading">{t('avatar.wishlist')}</Text>
            {state.products
              .filter((p) => state.wishlist.includes(p.id))
              .map((p) => (
                <Button
                  key={p.id}
                  variant="secondary"
                  label={
                    state.balances.earned + state.balances.purchased >=
                    (p.effective_price ?? p.price_cc)
                      ? t('avatar.affordable', { name: p.name })
                      : p.name
                  }
                  onPress={() =>
                    router.push({
                      pathname: '/shop/[collectionId]',
                      params: { collectionId: p.collection_id },
                    })
                  }
                  testID={`wishlist-${p.id}`}
                />
              ))}
          </>
        )
      ) : null}
    </AvatarPage>
  );
}
const styles = StyleSheet.create({
  section: { gap: space[3] },
  card: {
    padding: space[4],
    borderWidth: avatarLayout.borderWidth,
    borderRadius: radius.card,
    gap: space[2],
  },
});
