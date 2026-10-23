import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface CaliPartnerLogoProps {
  size?: number;
  animate?: boolean;
  testID?: string;
}

/**
 * Official CaliPartner Brand Logo:
 * Two partners on 3 stepped progress pillars helping each other rise.
 * Designed from user's official app logo reference.
 */
export function CaliPartnerLogo({
  size = 180,
  animate = true,
  testID = 'calipartner-brand-logo',
}: CaliPartnerLogoProps) {
  const progressAnim = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animate) return;

    Animated.sequence([
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.03,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
      ),
    ]).start();
  }, [animate, progressAnim, pulseAnim]);

  const scale = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });

  const opacity = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 1],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          opacity,
          transform: [{ scale }, { scale: pulseAnim }],
        },
      ]}
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel="CaliPartner logo: One person helping partner up progress steps"
    >
      <Svg viewBox="0 0 400 400" width={size} height={size}>
        {/* Background rounded container (Dark Espresso/Chocolate #22140A) */}
        <Rect x="10" y="10" width="380" height="380" rx="72" fill="#251408" />

        {/* 3 Stepped Progress Pillars (#FCE7D0 warm cream) */}
        {/* Step 1: Leftmost lowest block */}
        <Rect x="54" y="288" width="90" height="54" rx="27" fill="#FCE7D0" />

        {/* Step 2: Middle step */}
        <Rect x="152" y="244" width="92" height="98" rx="24" fill="#FCE7D0" />

        {/* Step 3: Rightmost highest step */}
        <Rect x="252" y="200" width="94" height="142" rx="24" fill="#FCE7D0" />

        {/* --- Top Partner (Person on right pillar reaching down to help) --- */}
        {/* Head */}
        <Circle cx="256" cy="74" r="21" fill="#FCE7D0" />
        {/* Torso & reaching arm & leg standing on high block */}
        <Path
          d="M 252 100
             C 240 106, 222 120, 212 142
             C 214 140, 230 130, 248 126
             C 256 124, 266 128, 276 138
             L 302 178
             L 322 198
             C 324 200, 314 202, 310 198
             L 288 170
             L 262 136
             C 254 154, 240 188, 226 234
             C 240 200, 258 170, 270 152
             C 260 148, 244 146, 232 152
             L 214 144
             Z"
          fill="#FCE7D0"
        />
        {/* Reaching arm connecting with lower partner */}
        <Path
          d="M 234 148
             C 220 156, 196 172, 178 182
             C 186 186, 206 172, 226 158
             Z"
          fill="#FCE7D0"
        />

        {/* --- Lower Partner (Person climbing up from step 1 to step 2) --- */}
        {/* Head */}
        <Circle cx="152" cy="142" r="19" fill="#FCE7D0" />
        {/* Torso & dynamic climbing pose */}
        <Path
          d="M 148 166
             C 134 172, 118 190, 108 214
             C 96 242, 70 284, 66 288
             C 74 286, 100 248, 118 226
             C 126 216, 138 218, 148 226
             L 174 244
             L 182 242
             L 164 218
             C 152 206, 146 196, 146 186
             C 156 182, 180 168, 208 152
             C 192 160, 168 174, 154 178
             Z"
          fill="#FCE7D0"
        />

        {/* Clasped Hands Junction Glow Indicator */}
        <Circle cx="210" cy="150" r="5" fill="#FFB27D" opacity="0.9" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
});
