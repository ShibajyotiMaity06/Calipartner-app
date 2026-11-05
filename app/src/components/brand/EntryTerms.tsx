import React, { useState } from 'react';
import { Button, Text, space, useTheme } from '@calipartner/ui';
import { View } from 'react-native';
import { TermsOfServiceModal } from '@/components/legal';
import { t } from '@/i18n';

export function EntryTerms() {
  const [visible, setVisible] = useState(false);
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: space[1] }}>
      <Text variant="micro" color={colors.textMid} style={{ textAlign: 'center' }}>
        {t('entryRefresh.termsPrefix')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button
          variant="tertiary"
          size="sm"
          fullWidth={false}
          label={t('entryRefresh.terms')}
          onPress={() => setVisible(true)}
          testID="link-terms-of-service"
        />
        <Button
          variant="tertiary"
          size="sm"
          fullWidth={false}
          label={t('entryRefresh.privacy')}
          onPress={() => setVisible(true)}
          testID="link-privacy-policy"
        />
      </View>
      <TermsOfServiceModal visible={visible} onClose={() => setVisible(false)} />
    </View>
  );
}
