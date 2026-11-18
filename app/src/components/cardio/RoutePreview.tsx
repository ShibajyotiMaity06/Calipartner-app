import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { Text } from '@calipartner/ui';
import { useTheme } from '@calipartner/ui/theme';
import { routeGeometry, type RoutePoint } from '@calipartner/core';
import { t } from '@/i18n';
export function RoutePreview({
  points,
  segments = [points],
}: {
  points: RoutePoint[];
  segments?: RoutePoint[][];
}) {
  const { colors } = useTheme();
  const route = routeGeometry(points),
    start = route[0],
    end = route.at(-1);
  let offset = 0;
  return (
    <View testID="gps-route">
      <Text>{t('launch.route')}</Text>
      <Svg
        viewBox="0 0 100 100"
        width="100%"
        style={{ aspectRatio: 1 }}
        accessibilityLabel={t('launch.routeSummary', { count: points.length })}
      >
        {segments.map((segment, index) => {
          const line = route.slice(offset, offset + segment.length);
          offset += segment.length;
          return (
            <Polyline
              key={index}
              points={line.map((p) => `${p.x},${p.y}`).join(' ')}
              stroke={colors.teal}
              strokeWidth={1}
              fill="none"
            />
          );
        })}
        {start && (
          <Circle cx={start.x} cy={start.y} r={3} fill={colors.bg0} stroke={colors.textHi} />
        )}
        {end && <Circle cx={end.x} cy={end.y} r={2} fill={colors.teal} />}
      </Svg>
      <Text>
        {t(points.length ? 'launch.routeSummary' : 'launch.routeEmpty', { count: points.length })}
      </Text>
    </View>
  );
}
