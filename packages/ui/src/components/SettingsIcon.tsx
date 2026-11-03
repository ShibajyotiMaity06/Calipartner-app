import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { dark } from '../tokens/colors';

export function SettingsIcon({
  size = 24,
  color = dark.textHi,
}: {
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m10 3-.7 2.3-2 .9-2.2-.6-2 3.4 1.6 1.7v2.6L3.1 15l2 3.4 2.2-.6 2 .9L10 21h4l.7-2.3 2-.9 2.2.6 2-3.4-1.6-1.7v-2.6l1.6-1.7-2-3.4-2.2.6-2-.9L14 3Z"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.75} />
    </Svg>
  );
}
