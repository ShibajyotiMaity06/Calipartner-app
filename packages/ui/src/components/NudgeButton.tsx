import React, { useState } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  View,
  type AccessibilityProps,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { dark, type IdentityHue, getIdentityColor } from '../tokens/colors';
import { useReducedMotion } from '../theme/useReducedMotion';

export interface NudgeButtonProps extends AccessibilityProps {
  /** Partner display name (e.g. "Priya") */
  partnerName?: string;
  /** Partner identity hue for the pressed highlight */
  partnerHue?: IdentityHue;
  /** Current count of nudges sent to this partner today (Max 2 per SOC-1) */
  nudgesSentToday?: number;
  /** Max nudges allowed per recipient per day. Default 2 (PRD SOC-1) */
  maxNudgesPerDay?: number;
  /** Callback triggered when a successful nudge is sent */
  onNudge?: () => void;
  /** Callback when user hits limit */
  onLimitReached?: (message: string) => void;
  /** Custom test ID */
  testID?: string;
}

export function NudgeButton({
  partnerName = 'Partner',
  partnerHue = 'teal',
  nudgesSentToday = 0,
  maxNudgesPerDay = 2,
  onNudge,
  onLimitReached,
  testID = 'nudge-button',
  accessibilityLabel,
  ...rest
}: NudgeButtonProps): React.JSX.Element {
  const [isHighlighted, setIsHighlighted] = useState(false);
  const reduceMotion = useReducedMotion();

  const partnerColor = getIdentityColor(partnerHue);
  const isLimitReached = nudgesSentToday >= maxNudgesPerDay;

  const handlePress = () => {
    if (isLimitReached) {
      const msg = `You nudged ${partnerName} earlier. You can nudge again tomorrow.`;
      onLimitReached?.(msg);
      return;
    }

    // Brief fill in partner's hue (Spec 5.5)
    setIsHighlighted(true);
    setTimeout(() => {
      setIsHighlighted(false);
    }, reduceMotion ? 100 : 250);

    onNudge?.();
  };

  const a11y = accessibilityLabel || `Nudge ${partnerName}${isLimitReached ? ', daily limit reached' : ''}`;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      style={[
        styles.button,
        isHighlighted && { backgroundColor: partnerColor, borderColor: partnerColor },
      ]}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      {...rest}
    >
      <View style={styles.iconContainer}>
        {/* Custom 20x20 tap hand / nudge glyph */}
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path
            d="M9 11V6a2 2 0 0 1 4 0v5m-4 0a2 2 0 1 0-4 0v4.5A7.5 7.5 0 0 0 12.5 23H15a7 7 0 0 0 7-7v-3.5a2.5 2.5 0 0 0-5 0V13m-4-2a2 2 0 0 1 4 0v2"
            stroke={isHighlighted ? dark.onBrand : dark.textHi}
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    elevation: 3,
  },
  iconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
