import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { controls } from '../tokens/controls';
export function AddIcon({ color }: { color: string }) {
  return (
    <Svg width={controls.icon} height={controls.icon} viewBox="0 0 24 24" accessible={false}>
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}
