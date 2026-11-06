import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text, dark, homeLayout, space } from '@calipartner/ui';
import { t } from '@/i18n';

/** Geometry only: progress is calculated by the shared fasting engine. */
export function FastingProgressRing({ percent }: { percent: number }) {
  const size = homeLayout.compactRingSize;
  const stroke = homeLayout.ringStroke;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <View style={{ alignItems: 'center', gap: space[1] }}>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={t('homeRefresh.fastingProgress')}
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        testID="fasting-card-progress"
      >
        <Svg width={size} height={size} accessible={false}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={dark.s3}
            strokeWidth={stroke}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={dark.copper}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - percent / 100)}
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
      </View>
      <Text variant="micro" tabular>
        {t('homeRefresh.fastingProgressPercent', { percent })}
      </Text>
    </View>
  );
}
