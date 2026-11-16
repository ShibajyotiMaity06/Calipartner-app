import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { coin, space } from '../tokens';

/** Decorative currency glyph. The parent provides the localized accessible label. */
export function CoinIcon({ size = space[5] }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Circle cx="12" cy="12" r="10" fill={coin.fill} stroke={coin.edge} strokeWidth="1.5" />
      <Circle cx="12" cy="12" r="7.5" fill="none" stroke={coin.edge} strokeWidth="0.75" />
      <Path
        d="M15 8.5c-1-1.5-6-1.5-6 1 0 3 6 1 6 4 0 2.5-5 2.5-6 1M12 6v12"
        fill="none"
        stroke={coin.ink}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}
