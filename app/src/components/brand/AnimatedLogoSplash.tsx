import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { Text, entryLayout, space, useTheme } from '@calipartner/ui';
import { t } from '@/i18n';
import { splashFrame, splashTimeline } from './splashTimeline';

const artwork = [
  'M204.8,143.8C204.8,143.8 205.9,141.6 202.8,143.0C199.6,144.4 191.6,149.5 186.0,152.0C180.4,154.5 174.8,156.5 169.0,158.0C163.2,159.5 158.4,160.5 151.0,161.0C143.6,161.5 131.0,160.3 124.8,161.0C118.5,161.7 117.2,163.0 113.2,165.2C109.3,167.5 105.1,170.2 101.2,174.2C97.4,178.2 93.1,184.3 90.2,189.2C87.4,194.2 86.7,193.6 84.0,203.8C81.3,213.9 76.7,239.6 74.0,250.0C71.3,260.4 71.2,259.6 68.0,266.0C64.8,272.4 59.4,281.8 54.8,288.5C50.1,295.2 40.2,306.2 40.2,306.2C40.2,306.2 45.5,305.2 49.0,303.8C52.5,302.3 56.9,300.4 61.5,297.5C66.1,294.6 71.8,291.0 76.8,286.5C81.8,282.0 86.0,277.9 91.5,270.5C97.0,263.1 105.8,247.6 110.0,242.0C114.2,236.4 114.5,238.0 116.8,236.8C119.0,235.5 119.9,234.8 123.8,234.8C127.6,234.8 135.2,235.4 140.0,236.8C144.8,238.1 148.5,240.3 152.5,243.0C156.5,245.7 163.8,252.8 163.8,252.8C163.8,252.8 170.0,251.3 171.5,250.5C173.0,249.7 174.1,251.6 172.8,247.8C171.4,243.9 167.2,233.2 163.5,227.2C159.8,221.3 155.0,216.2 150.8,212.2C146.5,208.3 140.3,206.1 138.0,203.5C135.7,200.9 135.9,199.3 136.8,196.8C137.6,194.2 138.7,190.7 143.2,188.0C147.8,185.3 157.1,184.0 164.0,180.8C170.9,177.5 178.4,173.2 184.5,168.5C190.6,163.8 197.1,156.9 200.5,152.8C203.9,148.6 204.8,143.8 204.8,143.8Z',
  'M301.0,83.0C298.2,82.0 295.7,81.3 293.0,81.0C290.3,80.7 288.1,80.5 284.8,81.0C281.4,81.5 276.2,82.8 272.8,84.0C269.3,85.2 269.7,84.4 264.2,88.2C258.8,92.1 248.5,98.8 240.0,107.2C231.5,115.7 213.0,138.8 213.0,138.8C213.0,138.8 214.0,141.2 214.0,141.2C214.0,141.2 211.2,143.7 217.0,140.8C222.8,137.8 241.0,127.4 248.8,123.8C256.5,120.1 260.1,119.2 263.8,118.8C267.4,118.3 268.6,119.2 270.5,121.0C272.4,122.8 274.6,126.1 275.0,129.8C275.4,133.4 278.8,129.8 273.0,143.0C267.2,156.2 247.7,192.5 240.0,208.8C232.3,225.0 229.2,234.7 227.0,240.8C224.8,246.8 226.5,245.2 226.5,245.2C226.5,245.2 265.4,197.2 276.0,185.0C286.6,172.8 286.1,175.2 290.2,172.0C294.4,168.8 298.1,167.0 300.8,165.8C303.4,164.5 303.8,164.2 306.0,164.8C308.2,165.3 311.2,166.0 313.8,169.0C316.2,172.0 319.1,177.8 321.0,182.8C322.9,187.8 323.9,196.0 325.0,199.0C326.1,202.0 326.5,200.8 327.8,200.8C329.0,200.8 332.8,199.0 332.8,199.0C332.8,199.0 337.8,180.2 338.8,171.0C339.8,161.8 339.4,151.5 338.8,143.8C338.1,136.0 337.0,131.3 334.8,124.8C332.5,118.2 328.0,109.0 325.5,104.2C323.0,99.5 322.2,98.8 319.5,96.0C316.8,93.2 312.6,89.4 309.5,87.2C306.4,85.1 303.8,84.0 301.0,83.0Z',
  'M50,309H116A12,12 0 0 1 128,321V366A0,0 0 0 1 128,366H50A24,24 0 0 1 26,342V333A24,24 0 0 1 50,309Z',
  'M155,257H229A17,17 0 0 1 246,274V366A0,0 0 0 1 246,366H138A0,0 0 0 1 138,366V274A17,17 0 0 1 155,257Z',
  'M278,205H344A22,22 0 0 1 366,227V348A18,18 0 0 1 348,366H256A0,0 0 0 1 256,366V227A22,22 0 0 1 278,205Z',
];

/** Shared static boot surface and launch animation; never renders a replay control. */
export function AnimatedLogoSplash({
  onComplete,
  animate = true,
}: {
  onComplete?: () => void;
  animate?: boolean;
}) {
  const { colors, reduceMotion } = useTheme();
  const { width, height } = useWindowDimensions();
  const [elapsed, setElapsed] = useState(animate ? 0 : splashTimeline.end);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  useEffect(() => {
    if (!animate) return;
    if (reduceMotion) {
      setElapsed(splashTimeline.end);
      complete.current?.();
      return;
    }
    let raf = 0,
      start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const seconds = (now - start) / 1000;
      setElapsed(Math.min(seconds, splashTimeline.end));
      if (seconds < splashTimeline.end) raf = requestAnimationFrame(tick);
      else complete.current?.();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animate, reduceMotion]);
  const frame = splashFrame(reduceMotion ? splashTimeline.end : elapsed);
  const size = Math.min(entryLayout.logoMax, Math.min(width, height) * entryLayout.logoViewport);
  return (
    <View
      style={[styles.container, { backgroundColor: colors.splashBackground }]}
      testID="animated-logo-splash"
    >
      <Svg
        width={size}
        height={size}
        viewBox="-4.5 2 400 400"
        accessibilityLabel={t('entryPolish.logo')}
        role="img"
        style={{ transform: [{ scale: frame.scale }] }}
      >
        <G fill={colors.splashForeground} opacity={frame.opacity} transform={frame.figureA}>
          <Circle cx={140.5} cy={136} r={21.5} />
          <Path d={artwork[0]} />
        </G>
        <G fill={colors.splashForeground} opacity={frame.opacity} transform={frame.figureB}>
          <Circle cx={260} cy={62} r={23} />
          <Path d={artwork[1]} />
        </G>
        {frame.bars.map((scale, i) => (
          <Path
            key={i}
            d={artwork[i + 2]}
            fill={colors.splashForeground}
            transform={`translate(0 366) scale(1 ${scale}) translate(0 -366)`}
          />
        ))}
      </Svg>
      <Text variant="splashTitle" color={colors.splashForeground}>
        {t('app.name')}
      </Text>
      <Text variant="body" color={colors.splashForeground} style={styles.tagline}>
        {t('entryPolish.tagline')}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[5],
    gap: space[2],
  },
  tagline: {
    fontSize: entryLayout.taglineSize,
    lineHeight: entryLayout.taglineLine,
    opacity: entryLayout.taglineOpacity,
    textAlign: 'center',
  },
});
