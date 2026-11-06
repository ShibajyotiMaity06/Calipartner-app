import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Sheet, Text, space } from '@calipartner/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { t } from '@/i18n';
import { RepeatPreviousMeal } from './RepeatPreviousMeal';

const meals = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;

export function RepeatYesterdayMeals({ localDate }: { localDate: string }) {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  useBrowserModalBack(visible, () => setVisible(false));
  if (!user) return null;
  return (
    <>
      <Button
        variant="secondary"
        label={t('homeRefresh.repeatYesterday')}
        onPress={() => setVisible(true)}
        testID="home-repeat-yesterday"
      />
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

const styles = StyleSheet.create({ content: { padding: space[3], gap: space[3] } });
