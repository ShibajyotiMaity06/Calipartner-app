import { Button } from '@calipartner/ui';
import { useTheme as useAppearance } from '@calipartner/ui/theme';
import { NavigationIcon } from '@calipartner/ui';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { homeLayout, radius, space, Text } from '@calipartner/ui';
import { t } from '@/i18n';

const options = [
  { flow: 'cycling', icon: 'bicycle-outline' },
  { flow: 'running', icon: 'walk-outline' },
  { flow: 'steps', icon: 'footsteps-outline' },
] as const;

export function CardioHub({
  onSelect,
  onBack,
}: {
  onSelect: (flow: 'cycling' | 'running' | 'steps') => void;
  onBack: () => void;
}) {
  const { colors: dark } = useAppearance();
  const styles = createStyles(dark);

  return (
    <ScrollView contentContainerStyle={styles.content} testID="cardio-hub">
      <View style={styles.header}>
        <Button
          variant="tertiary"
          fullWidth={false}
          label={t('repairs.back')}
          iconOnly
          icon={<NavigationIcon action="back" />}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('repairs.back')}
          style={styles.back}
          testID="cardio-back"
        />
        <Text variant="title1">{t('homeRefresh.cardio')}</Text>
      </View>
      <View style={styles.noticeCard} testID="cardio-launch-notice">
        <Ionicons name="information-circle-outline" size={20} color={dark.sky} />
        <Text variant="bodyS" color={dark.textMid} style={{ flex: 1 }}>
          {t('workouts.cardio.storeLaunchNotice')}
        </Text>
      </View>
      {options.map(({ flow, icon }) => (
        <Pressable
          key={flow}
          disabled={true}
          accessibilityRole="button"
          accessibilityLabel={t(`homeRefresh.${flow}`)}
          accessibilityState={{ disabled: true }}
          style={[styles.option, styles.optionDisabled]}
          testID={`cardio-${flow}`}
        >
          <Ionicons name={icon} size={homeLayout.iconSize} color={dark.textLo} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" color={dark.textLo}>
              {t(`homeRefresh.${flow}`)}
            </Text>
            <Text variant="micro" color={dark.textLo}>
              {t('workouts.cardio.availableOnLaunch')}
            </Text>
          </View>
          <Ionicons name="lock-closed-outline" size={16} color={dark.textLo} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const createStyles = (dark: ReturnType<typeof useAppearance>['colors']) =>
  StyleSheet.create({
    content: { padding: space[3], gap: space[3], paddingBottom: space[7] },
    header: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
    noticeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[2],
      padding: space[3],
      backgroundColor: dark.s1,
      borderRadius: radius.control,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: dark.hairlineLit,
    },
    back: {
      minHeight: homeLayout.touchSize,
      minWidth: homeLayout.touchSize,
      alignItems: 'center',
      justifyContent: 'center',
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: homeLayout.touchSize,
      padding: space[3],
      gap: space[3],
      borderRadius: radius.control,
      backgroundColor: dark.s2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: dark.hairlineLit,
    },
    optionDisabled: {
      opacity: 0.6,
    },
  });
