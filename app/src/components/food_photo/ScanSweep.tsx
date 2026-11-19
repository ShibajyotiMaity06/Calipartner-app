import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { space, useTheme } from '@calipartner/ui';

export function ScanSweep({ overlay = false }: { overlay?: boolean }) {
  const { colors, reduceMotion } = useTheme();
  const [height, setHeight] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.setValue(reduceMotion ? 0.5 : 0);
    if (reduceMotion) return;
    const move = (toValue: number) =>
      Animated.timing(progress, {
        toValue,
        duration: 900,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
        isInteraction: false,
      });
    const sweep = Animated.loop(Animated.sequence([move(1), move(0)]));
    sweep.start();
    return () => sweep.stop();
  }, [progress, reduceMotion]);
  return (
    <View
      accessible={false}
      pointerEvents="none"
      testID="scan-sweep"
      style={overlay ? StyleSheet.absoluteFill : [styles.track, { backgroundColor: colors.s2 }]}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
    >
      <Animated.View
        style={[
          styles.line,
          {
            backgroundColor: colors.apricot,
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, Math.max(0, height - space[1])],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', minHeight: space[7], overflow: 'hidden' },
  line: { height: space[1], width: '100%' },
});
