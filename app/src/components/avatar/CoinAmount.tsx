import React from 'react';
import { View } from 'react-native';
import { CoinIcon, Text, space } from '@calipartner/ui';
import { t, getLocale } from '@/i18n';

export function CoinAmount({
  amount,
  large = false,
  signed = false,
}: {
  amount: number;
  large?: boolean;
  signed?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityLabel={t('avatar.cc', { amount })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}
    >
      <CoinIcon size={large ? space[7] : space[5]} />
      <Text variant={large ? 'numeralL' : 'label'} tabular>
        {new Intl.NumberFormat(getLocale(), { signDisplay: signed ? 'exceptZero' : 'auto' }).format(
          amount,
        )}
      </Text>
    </View>
  );
}
