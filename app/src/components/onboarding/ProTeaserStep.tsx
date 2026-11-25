import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import {
  AvatarRing,
  Badge,
  BrandRingMark,
  Card,
  ScanIcon,
  ScreenTitle,
  Text,
  borders,
  colors,
  fonts,
  radius,
  space,
} from '@calipartner/ui/v1';
import { t } from '@/i18n';

export type ProTeaserSlide = 'pro_coach' | 'pro_partners' | 'pro_adaptive';

export interface ProTeaserStepProps {
  slide: ProTeaserSlide;
  nickname?: string;
}

const SQUAD_PREVIEW = [
  { key: 'p', initial: 'P', progress: 0.82, pct: '82%' },
  { key: 'j', initial: 'J', progress: 0.64, pct: '64%' },
  { key: 'a', initial: 'A', progress: 1, pct: '100%' },
  { key: 'm', initial: 'M', progress: 0.47, pct: '47%' },
] as const;

function AdaptiveCurveGraphic({
  youLabel,
  planLabel,
}: {
  youLabel: string;
  planLabel: string;
}): React.JSX.Element {
  const [width, setWidth] = useState(280);
  const w = Math.max(200, width);
  const h = 100;
  const padX = 12;
  const startY = 18;
  const endYPlan = 78;
  const endYYou = 70;
  const midX = Math.round(w * 0.56);
  const midYYou = 44;

  const planPath = `M ${padX} ${startY} L ${w - padX} ${endYPlan}`;
  const youPath = `M ${padX} ${startY} C ${Math.round(w * 0.28)} ${startY + 8}, ${Math.round(
    w * 0.42,
  )} ${midYYou - 6}, ${midX} ${midYYou} C ${Math.round(w * 0.72)} ${midYYou + 10}, ${Math.round(
    w * 0.86,
  )} ${endYYou - 4}, ${w - padX} ${endYYou}`;

  return (
    <View
      style={styles.chartWrap}
      onLayout={(e: LayoutChangeEvent) => {
        const nextW = Math.round(e.nativeEvent.layout.width);
        if (nextW > 40) setWidth(nextW);
      }}
      accessibilityRole="image"
      accessibilityLabel={`${youLabel} vs ${planLabel}`}
      testID="pro-adaptive-chart"
    >
      <Text
        variant="micro"
        color="textHi"
        style={[styles.chartTag, { left: midX - 10, top: midYYou - 24 }]}
      >
        {youLabel}
      </Text>
      <Text
        variant="micro"
        color="textLo"
        style={[styles.chartTag, { right: padX + 4, top: endYYou - 22 }]}
      >
        {planLabel}
      </Text>
      <Svg width={w} height={h}>
        <Path
          d={planPath}
          stroke={colors.hairlineLit}
          strokeWidth={1.5}
          strokeDasharray="4 4"
          fill="none"
        />
        <Path
          d={youPath}
          stroke={colors.apricot}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
        <Line
          x1={padX}
          y1={h - 6}
          x2={w - padX}
          y2={h - 6}
          stroke={colors.hairline}
          strokeWidth={1}
        />
        <Circle cx={midX} cy={midYYou} r={8} fill={colors.apricotHalo} />
        <Circle cx={midX} cy={midYYou} r={4} fill={colors.apricot} />
      </Svg>
    </View>
  );
}

export function ProTeaserStep({ slide, nickname }: ProTeaserStepProps): React.JSX.Element {
  const cleanName = nickname?.trim() ?? '';

  if (slide === 'pro_coach') {
    const replyText = cleanName
      ? t('onboardingV1.proCoachReplyNamed', { name: cleanName })
      : t('onboardingV1.proCoachReplyFallback');
    const [prefix, rest] = replyText.split('18 g short');

    return (
      <View style={styles.root} testID="step-pro_coach-v1">
        <ScreenTitle
          eyebrow={t('onboardingV1.proCoachEyebrow')}
          title={t('onboardingV1.proCoachTitle')}
          accentWord={t('onboardingV1.proCoachAccent')}
          subtitle={t('onboardingV1.proCoachSubtitle')}
          spacingBottom={space.xl}
          testID="pro-coach-header"
        />

        <Card style={styles.mealScanCard} testID="pro-coach-scan-card">
          <View style={styles.mealTopRow}>
            <View style={styles.scanTile}>
              <ScanIcon size={20} color={colors.apricot} />
            </View>
            <View style={styles.flexOne}>
              <Text variant="rowTitle" color="textHi">
                {t('onboardingV1.proCoachMealTitle')}
              </Text>
              <Text variant="meta" color="textLo">
                {t('onboardingV1.proCoachMealMeta')}
              </Text>
            </View>
            <View style={styles.kcalInline}>
              <Text variant="numS" color="textHi" tabular>
                {t('onboardingV1.proCoachMealKcal')}
              </Text>
              <Text variant="micro" color="textLo" style={styles.kcalUnit}>
                kcal
              </Text>
            </View>
          </View>

          <View style={styles.macroPillRow}>
            {[
              t('onboardingV1.proCoachProteinChip'),
              t('onboardingV1.proCoachCarbsChip'),
              t('onboardingV1.proCoachFatChip'),
            ].map((item) => (
              <View key={item} style={styles.macroPill}>
                <Text variant="micro" color="textMid" tabular>
                  {item}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <View style={styles.coachReplyRow} testID="pro-coach-reply-card">
          <View style={styles.coachAvatar}>
            <BrandRingMark size={16} color={colors.textHi} />
          </View>
          <Card style={styles.coachBubble}>
            <Text variant="body" color="textMid">
              {prefix}
              {rest !== undefined ? (
                <>
                  <Text variant="body" color="textHi" style={styles.boldInline}>
                    18 g short
                  </Text>
                  {rest}
                </>
              ) : null}
            </Text>
          </Card>
        </View>

        <View style={styles.promptChipRow}>
          <View style={styles.promptChip}>
            <Text variant="meta" color="textHi">
              {t('onboardingV1.proCoachPromptOne')}
            </Text>
          </View>
          <View style={styles.promptChip}>
            <Text variant="meta" color="textHi">
              {t('onboardingV1.proCoachPromptTwo')}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (slide === 'pro_partners') {
    return (
      <View style={styles.root} testID="step-pro_partners-v1">
        <ScreenTitle
          eyebrow={t('onboardingV1.proPartnersEyebrow')}
          title={t('onboardingV1.proPartnersTitle')}
          accentWord={t('onboardingV1.proPartnersAccent')}
          subtitle={t('onboardingV1.proPartnersSubtitle')}
          spacingBottom={space.xl}
          testID="pro-partners-header"
        />

        <Card style={styles.partnerCard} testID="pro-partners-match-card">
          <View style={styles.partnerTopRow}>
            <View style={styles.partnerAvatar}>
              <Text variant="numS" color="textHi">
                J
              </Text>
            </View>
            <View style={styles.flexOne}>
              <Text variant="rowTitle" color="textHi">
                {t('onboardingV1.proPartnersMatchName')}
              </Text>
              <Text variant="meta" color="textLo">
                {t('onboardingV1.proPartnersMatchMeta')}
              </Text>
            </View>
            <View style={styles.invitePill}>
              <Text variant="label" color="onBrand" style={styles.invitePillText}>
                {t('onboardingV1.proPartnersMatchInvite')}
              </Text>
            </View>
          </View>

          <View style={styles.tagRow}>
            {[
              t('onboardingV1.proPartnersTagAge'),
              t('onboardingV1.proPartnersTagStyle'),
              t('onboardingV1.proPartnersTagTime'),
            ].map((tag) => (
              <View key={tag} style={styles.tagPill}>
                <Text variant="micro" color="textMid" tabular>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <Card style={styles.squadCard} testID="pro-partners-squad-card">
          <View style={styles.squadHeader}>
            <View style={styles.flexOne}>
              <Text variant="rowTitle" color="textHi">
                {t('onboardingV1.proPartnersSquadName')}
              </Text>
              <Text variant="meta" color="textLo">
                {t('onboardingV1.proPartnersSquadMembers')}
              </Text>
            </View>
            <Badge variant="pro" label={t('onboardingV1.proPartnersFriendsFree')} mini />
          </View>

          <View style={styles.squadRingsRow}>
            {SQUAD_PREVIEW.map((member) => (
              <View key={member.key} style={styles.squadMemberCol}>
                <AvatarRing
                  initial={member.initial}
                  progress={member.progress}
                  color={colors.apricot}
                />
                <Text variant="micro" color="textMid" tabular style={styles.memberPct}>
                  {member.pct}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="step-pro_adaptive-v1">
      <ScreenTitle
        eyebrow={t('onboardingV1.proAdaptiveEyebrow')}
        title={t('onboardingV1.proAdaptiveTitle')}
        accentWord={t('onboardingV1.proAdaptiveAccent')}
        subtitle={t('onboardingV1.proAdaptiveSubtitle')}
        spacingBottom={space.xl}
        testID="pro-adaptive-header"
      />

      <Card variant="hero" style={styles.adaptiveCard} testID="pro-adaptive-card">
        <View style={styles.adaptiveHeader}>
          <Text variant="rowTitle" color="textHi">
            {t('onboardingV1.proAdaptiveCheckIn')}
          </Text>
          <View style={styles.dayPill}>
            <Text variant="micro" color="textMid">
              {t('onboardingV1.proAdaptiveDay')}
            </Text>
          </View>
        </View>

        <AdaptiveCurveGraphic
          youLabel={t('onboardingV1.proAdaptiveYou')}
          planLabel={t('onboardingV1.proAdaptivePlan')}
        />

        <View style={styles.adaptiveTileRow}>
          <Card variant="inner" style={styles.adaptiveTile}>
            <Text variant="meta" color="textLo">
              {t('onboardingV1.proAdaptiveCalories')}
            </Text>
            <View style={styles.adaptiveValueRow}>
              <Text variant="numS" color="textHi" tabular>
                {t('onboardingV1.proAdaptiveCaloriesNew')}
              </Text>
              <Text variant="meta" color="textOff" tabular style={styles.strikeText}>
                {t('onboardingV1.proAdaptiveCaloriesOld')}
              </Text>
            </View>
          </Card>

          <Card variant="inner" style={styles.adaptiveTile}>
            <Text variant="meta" color="textLo">
              {t('onboardingV1.proAdaptiveProtein')}
            </Text>
            <View style={styles.adaptiveValueRow}>
              <Text variant="numS" color="textHi" tabular>
                {t('onboardingV1.proAdaptiveProteinNew')}
              </Text>
              <Text variant="meta" color="textOff" tabular style={styles.strikeText}>
                {t('onboardingV1.proAdaptiveProteinOld')}
              </Text>
            </View>
          </Card>
        </View>

        <Text variant="meta" color="textLo">
          {t('onboardingV1.proAdaptiveNote')}
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: space.lg,
  },
  flexOne: {
    flex: 1,
  },
  mealScanCard: {
    gap: space.lg,
  },
  mealTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  scanTile: {
    width: 44,
    height: 44,
    borderRadius: radius.iconTile,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kcalInline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.xs,
  },
  kcalUnit: {
    fontSize: 12,
  },
  macroPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  macroPill: {
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
  },
  coachReplyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  coachAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xs,
  },
  coachBubble: {
    flex: 1,
  },
  boldInline: {
    fontFamily: fonts.bold,
  },
  promptChipRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingLeft: 44,
  },
  promptChip: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.full,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  partnerCard: {
    gap: space.lg,
  },
  partnerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  partnerAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invitePill: {
    backgroundColor: colors.apricot,
    borderRadius: radius.full,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  invitePillText: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  tagPill: {
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
  },
  squadCard: {
    gap: space.lg,
  },
  squadHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  squadRingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  squadMemberCol: {
    flex: 1,
    alignItems: 'center',
    gap: space.sm,
  },
  memberPct: {
    fontSize: 12,
  },
  adaptiveCard: {
    gap: space.lg,
  },
  adaptiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  dayPill: {
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
  },
  chartWrap: {
    position: 'relative',
    width: '100%',
    height: 100,
    justifyContent: 'center',
  },
  chartTag: {
    position: 'absolute',
    zIndex: 1,
  },
  adaptiveTileRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  adaptiveTile: {
    flex: 1,
    gap: space.xs,
  },
  adaptiveValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
  },
  strikeText: {
    textDecorationLine: 'line-through',
  },
});
