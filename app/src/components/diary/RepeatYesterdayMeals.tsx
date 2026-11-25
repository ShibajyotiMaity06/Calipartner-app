import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Sheet, Text, space } from '@calipartner/ui';
import { LinkButton } from '@calipartner/ui/v1';
import { useAuth } from '@/contexts/AuthContext';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { t } from '@/i18n';
import { RepeatPreviousMeal } from './RepeatPreviousMeal';

const meals = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;

export function RepeatYesterdayMeals({
  localDate,
  variant = 'default',
}: {
  localDate: string;
  variant?: 'default' | 'v1';
}) {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  useBrowserModalBack(visible, () => setVisible(false));
  if (!user) return null;
  return (
    <>
      {variant === 'v1' ? (
        <View style={styles.v1Trigger}>
          <LinkButton
            title={t('homeRefresh.repeatYesterday')}
            variant="accent"
            onPress={() => setVisible(true)}
            testID="home-repeat-yesterday"
          />
        </View>
      ) : (
        <Button
          variant="secondary"
          label={t('homeRefresh.repeatYesterday')}
          onPress={() => setVisible(true)}
          testID="home-repeat-yesterday"
        />
      )}
      <Sheet
        visible={visible}
        onClose={() => setVisible(false)}
        snapPoint="tall"
        accessibilityLabel={t('homeRefresh.repeatYesterday')}
        testID="repeat-yesterday-meals"
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text variant="title2">{t('homeRefresh.repeatYesterday')}</Text>
          <Text>{t('homeRefresh.choosePreviousMeal')}</Text>
          {meals.map((section) => (
            <RepeatPreviousMeal
              key={`${localDate}-${section}`}
              localDate={localDate}
              section={section}
              labelMode="meal"
            />
          ))}
          <Button
            variant="tertiary"
            label={t('homeRefresh.close')}
            onPress={() => setVisible(false)}
            testID="repeat-yesterday-close"
          />
        </ScrollView>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: space[3], gap: space[3] },
  v1Trigger: { alignItems: 'center', justifyContent: 'center' },
});
