import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import {
  BrandRingMark,
  PrimaryButton,
  ScreenTitle,
  ScreenWrapper,
  Text,
  borders,
  colors,
  elevation,
  fonts,
  radius,
  space,
} from '@calipartner/ui/v1';
import { t } from '@/i18n';

const RINGS_SIZE = 244;
const RING_CENTER = RINGS_SIZE / 2;
const RING_STROKE = 13;

function polarPoint(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [
    Math.round((cx + r * Math.cos(rad)) * 100) / 100,
    Math.round((cy + r * Math.sin(rad)) * 100) / 100,
  ];
}

function describeRingArc(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const [x1, y1] = polarPoint(cx, cy, r, startDeg);
  const [x2, y2] = polarPoint(cx, cy, r, endDeg);
  const sweepDeg = (((endDeg - startDeg) % 360) + 360) % 360;
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

const OUTER_ARC = describeRingArc(RING_CENTER, RING_CENTER, 110, 18, 286);
const MIDDLE_ARC = describeRingArc(RING_CENTER, RING_CENTER, 89, 352, 250);
const INNER_ARC = describeRingArc(RING_CENTER, RING_CENTER, 68, 4, 218);

export default function WelcomeScreen() {
  const router = useRouter();

  const footer = (
    <View style={styles.footer}>
      <PrimaryButton
        title={t('onboardingV1.welcomeCta')}
        showArrow
        onPress={() => router.push('/onboarding')}
        testID="btn-welcome-get-started"
      />
      <Text variant="meta" color="textLo" style={styles.footerNote} testID="welcome-setup-note">
        {t('onboardingV1.welcomeNote')}
      </Text>
    </View>
  );

  return (
    <ScreenWrapper footer={footer} testID="welcome-screen">
      <View style={styles.content}>
        <View style={styles.brandRow} testID="welcome-brand">
          <BrandRingMark size={22} />
          <Text maxFontSizeMultiplier={1.2} style={styles.brandText}>
            {t('onboardingV1.brandName')}
          </Text>
        </View>

        <View style={styles.heroSection}>
          <View style={styles.heroFrame} testID="welcome-hero">
            <View
              style={styles.ringsContainer}
              accessibilityRole="image"
              accessibilityLabel={`${t('onboardingV1.heroDay')}, ${t('onboardingV1.heroStartsToday')}`}
            >
              <Svg
                width={RINGS_SIZE}
                height={RINGS_SIZE}
                viewBox={`0 0 ${RINGS_SIZE} ${RINGS_SIZE}`}
              >
                <Circle cx={RING_CENTER} cy={RING_CENTER} r={61} fill={colors.apricotGlowSoft} />
                <Circle
                  cx={RING_CENTER}
                  cy={RING_CENTER}
                  r={110}
                  stroke={colors.s2}
                  strokeWidth={RING_STROKE}
                  fill="none"
                />
                <Path
                  d={OUTER_ARC}
                  stroke={colors.apricot}
                  strokeWidth={RING_STROKE}
                  strokeLinecap="round"
                  fill="none"
                />
                <Circle
                  cx={RING_CENTER}
                  cy={RING_CENTER}
                  r={89}
                  stroke={colors.s2}
                  strokeWidth={RING_STROKE}
                  fill="none"
                />
                <Path
                  d={MIDDLE_ARC}
                  stroke={colors.textMid}
                  strokeWidth={RING_STROKE}
                  strokeLinecap="round"
                  fill="none"
                />
                <Circle
                  cx={RING_CENTER}
                  cy={RING_CENTER}
                  r={68}
                  stroke={colors.s2}
                  strokeWidth={RING_STROKE}
                  fill="none"
                />
                <Path
                  d={INNER_ARC}
                  stroke={colors.apricotPressed}
                  strokeWidth={RING_STROKE}
                  strokeLinecap="round"
                  fill="none"
                />
              </Svg>
              <View style={styles.ringsCenterLabel}>
                <Text maxFontSizeMultiplier={1.2} style={styles.heroDay}>
                  {t('onboardingV1.heroDay')}
                </Text>
                <Text variant="meta" color="textLo" style={styles.heroStartsToday}>
                  {t('onboardingV1.heroStartsToday')}
                </Text>
              </View>
            </View>

            <View style={[styles.activityPill, styles.pillTopLeft]} testID="welcome-pill-priya">
              <View style={[styles.pillAvatar, styles.pillAvatarApricot]}>
                <Text maxFontSizeMultiplier={1.15} style={styles.pillAvatarInitial}>
                  {t('onboardingV1.pillPriyaInitial')}
                </Text>
              </View>
              <Text style={styles.pillLabel}>{t('onboardingV1.pillPriyaText')}</Text>
            </View>

            <View style={[styles.activityPill, styles.pillBottomRight]} testID="welcome-pill-jack">
              <View style={[styles.pillAvatar, styles.pillAvatarLight]}>
                <Text maxFontSizeMultiplier={1.15} style={styles.pillAvatarInitial}>
                  {t('onboardingV1.pillJackInitial')}
                </Text>
              </View>
              <Text style={styles.pillLabel}>{t('onboardingV1.pillJackText')}</Text>
            </View>
          </View>
        </View>

        <ScreenTitle
          size="displayL"
          title={t('onboardingV1.welcomeTitle')}
          accentWord={t('onboardingV1.welcomeAccent')}
          subtitle={t('onboardingV1.welcomeSubtitle')}
          spacingBottom={space.sm}
          testID="welcome-title"
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.optical10,
    paddingTop: space.xs,
  },
  brandText: {
    fontFamily: fonts.display,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.3,
    color: colors.textHi,
  },
  heroSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.md,
  },
  heroFrame: {
    width: '100%',
    maxWidth: 342,
    height: 264,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringsContainer: {
    width: RINGS_SIZE,
    height: RINGS_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringsCenterLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDay: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.8,
    color: colors.textHi,
  },
  heroStartsToday: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  activityPill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.full,
    paddingVertical: space.xs,
    paddingLeft: space.xs,
    paddingRight: space.md,
    ...elevation.floatingBar,
  },
  pillTopLeft: {
    top: 26,
    left: 0,
  },
  pillBottomRight: {
    bottom: 14,
    right: 0,
  },
  pillAvatar: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillAvatarApricot: {
    backgroundColor: colors.apricot,
  },
  pillAvatarLight: {
    backgroundColor: colors.textHi,
  },
  pillAvatarInitial: {
    fontFamily: fonts.extrabold,
    fontSize: 11,
    lineHeight: 14,
    color: colors.onBrand,
  },
  pillLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textHi,
  },
  footer: {
    width: '100%',
    alignItems: 'center',
  },
  footerNote: {
    marginTop: space.md,
    textAlign: 'center',
  },
});
