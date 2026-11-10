import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { dark } from '../tokens/colors';
import { space } from '../tokens/space';

/** Decorative glyph; the enclosing button supplies the accessible action name. */
export function NavigationIcon({ action }: { action: 'back' | 'close' }) {
  return (
    <Svg
      width={space[7]}
      height={space[7]}
      style={{ flexShrink: 0 }}
      viewBox="0 0 28 28"
      accessible={false}
    >
      <Circle cx="14" cy="14" r="12" stroke={dark.textMid} strokeWidth="1.5" fill="none" />
      <Path
        d={action === 'back' ? 'M16 9l-5 5 5 5M11 14h9' : 'M10 10l8 8M18 10l-8 8'}
        stroke={dark.textHi}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
