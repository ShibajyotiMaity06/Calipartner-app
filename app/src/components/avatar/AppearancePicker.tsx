import { transitionTheme } from './themeTransition';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, type View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, space, radius, avatarLayout, motion, themePalettes } from '@calipartner/ui';
import { t } from '@/i18n';
export function AppearancePicker() {
  const { theme, setTheme, colors, reduceMotion } = useTheme();
  const button = useRef<View>(null);
  const position = useRef(new Animated.Value(theme === 'light' ? 0 : 1)).current;
  useEffect(() => {
    const animation = Animated.timing(position, {
      toValue: theme === 'light' ? 0 : 1,
      duration: reduceMotion ? 0 : motion.base.duration,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [theme, position, reduceMotion]);
  return (
    <Pressable
      ref={button}
      accessibilityRole="switch"
      accessibilityLabel={t('avatar.theme')}
      accessibilityState={{ checked: theme !== 'light' }}
      onPress={() =>
        transitionTheme(
          button.current,
          () => setTheme(theme === 'light' ? 'yellow' : 'light'),
          reduceMotion,
          themePalettes[theme === 'light' ? 'yellow' : 'light'].bg0,
        )
      }
      testID="theme-toggle"
      style={[styles.track, { backgroundColor: colors.s2, borderColor: colors.hairline }]}
    >
      <Animated.View
        style={[
          styles.thumb,
          {
            backgroundColor: colors.s1,
            transform: [
              {
                translateX: position.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, space[5]],
                }),
              },
            ],
          },
        ]}
      >
        <Ionicons
          name={theme === 'light' ? 'sunny-outline' : 'moon-outline'}
          size={space[5]}
          color={colors.textHi}
        />
      </Animated.View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  track: {
    width: avatarLayout.tapSize + space[5],
    minHeight: avatarLayout.tapSize,
    borderRadius: radius.full,
    borderWidth: avatarLayout.borderWidth,
    justifyContent: 'center',
    padding: space[1],
  },
  thumb: {
    width: avatarLayout.tapSize - space[2],
    height: avatarLayout.tapSize - space[2],
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
