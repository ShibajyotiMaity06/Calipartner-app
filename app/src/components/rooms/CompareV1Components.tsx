import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import {
  formatCompareDuration,
  formatCompareVolumeKg,
  type CompareHeadToHeadItem,
  type CompareMacroItem,
  type CompareRange,
  type CompareTodayTrackerRow,
  type SquadComparePayload,
} from '@calipartner/core';
import {
  ArrowRightIcon,
  AvatarRing,
  Badge,
  CheckIcon,
  CloseIcon,
  IconButton,
  InfoCircleIcon,
  LockIcon,
  PrimaryButton,
  ProgressBar,
  Sheet,
  Text,
  borders,
  colors,
  fonts,
  layout,
  radius,
  space,
} from '@calipartner/ui/v1';
import { t } from '@/i18n';

export function VennSyncDiagram({ inSyncPct }: { inSyncPct: number }): React.JSX.Element {
  return (
    <View
      style={styles.vennContainer}
      accessibilityLabel={`${inSyncPct}% ${t('compareV1.inSync')}`}
    >
      <Svg width={104} height={68} viewBox="0 0 104 68" fill="none">
        <Circle
          cx={38}
          cy={34}
          r={29}
          stroke={colors.apricot}
          strokeWidth={1.8}
          fill="rgba(244, 182, 125, 0.08)"
        />
        <Circle
          cx={66}
          cy={34}
          r={29}
          stroke={colors.hairlineLit}
          strokeWidth={1.8}
          fill="rgba(133, 117, 95, 0.08)"
        />
      </Svg>
      <View style={styles.vennCenterOverlay} pointerEvents="none">
        <Text variant="numM" color="textHi" tabular style={styles.vennPctText}>
          {inSyncPct}%
        </Text>
        <Text variant="micro" color="textMid" style={styles.vennSubLabel}>
          {t('compareV1.inSync')}
        </Text>
      </View>
    </View>
  );
}

export function CompareOverviewHeroCard({
  data,
}: {
  data: SquadComparePayload;
}): React.JSX.Element {
  return (
    <View style={styles.heroCard} testID="compare-overview-hero">
      <View style={styles.heroTopRow}>
        <View style={styles.heroSideCol}>
          <Text variant="meta" color="textMid" numberOfLines={1}>
            {data.left.name}
          </Text>
          <Text variant="numL" color="textHi" tabular style={styles.heroBigPct}>
            {data.left.overall_pct}%
          </Text>
          <Text variant="micro" color="textLo">
            {t('compareV1.ofOwnGoals')}
          </Text>
        </View>

        <VennSyncDiagram inSyncPct={data.in_sync_pct} />

        <View style={styles.heroSideCol}>
          <Text variant="meta" color="textMid" numberOfLines={1}>
            {data.right.name}
          </Text>
          <Text variant="numL" color="textHi" tabular style={styles.heroBigPct}>
            {data.right.overall_pct}%
          </Text>
          <Text variant="micro" color="textLo">
            {t('compareV1.ofOwnGoals')}
          </Text>
        </View>
      </View>

      <View style={styles.heroPillsRow}>
        <View style={styles.metaPill}>
          <Text variant="meta" color="textMid" tabular>
            {t('compareV1.daysTogetherPill', { count: data.days_together })}
          </Text>
        </View>
        <View style={styles.metaPill}>
          <Text variant="meta" color="textMid" tabular>
            {t('compareV1.sharedWorkoutsPill', { count: data.shared_workouts })}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function CompareDaysTogetherCard({
  data,
}: {
  data: SquadComparePayload;
}): React.JSX.Element {
  const strip = data.days_strip.slice(0, 7);

  return (
    <View style={styles.card} testID="compare-days-together-card">
      <View style={styles.cardHeaderRow}>
        <Text variant="label" color="textHi" style={styles.boldText}>
          {t('compareV1.daysTogetherTitle')}
        </Text>
        <Text variant="meta" color="textLo">
          {t('compareV1.daysTogetherMeta')}
        </Text>
      </View>

      <View style={styles.daysCirclesRow}>
        {strip.map((day, idx) => (
          <View
            key={`${day.date}-${idx}`}
            style={[
              styles.dayCircle,
              day.status === 'both'
                ? styles.dayCircleBoth
                : day.status === 'one'
                  ? styles.dayCircleOne
                  : styles.dayCircleNeither,
            ]}
            accessibilityLabel={`${day.date} ${day.status}`}
            testID={`compare-day-dot-${idx}`}
          >
            <Text
              variant="label"
              color={day.status === 'both' ? 'onBrand' : day.status === 'one' ? 'textHi' : 'textLo'}
              style={styles.boldText}
            >
              {day.label}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.legendRow}>
        <Text variant="micro" color="textLo">
          {t('compareV1.legendBoth')}
        </Text>
        <Text variant="micro" color="textLo">
          {t('compareV1.legendOne')}
        </Text>
        <Text variant="micro" color="textLo">
          {t('compareV1.legendNeither')}
        </Text>
      </View>
    </View>
  );
}

function MirroredDualBarRow({
  label,
  leftText,
  rightText,
  leftFraction,
  rightFraction,
}: {
  label: string;
  leftText: string;
  rightText: string;
  leftFraction: number;
  rightFraction: number;
}): React.JSX.Element {
  const clamp = (n: number) => Math.max(0.06, Math.min(1, Number.isFinite(n) ? n : 0));

  return (
    <View style={styles.mirrorRowWrap}>
      <Text variant="meta" color="textMid" style={styles.mirrorTitle}>
        {label}
      </Text>
      <View style={styles.mirrorBarLine}>
        <Text
          variant="label"
          color="textHi"
          tabular
          style={[styles.boldText, styles.mirrorLeftVal]}
        >
          {leftText}
        </Text>

        <View style={styles.mirrorTracksPair}>
          <View style={styles.mirrorTrackLeft}>
            <View
              style={[
                styles.mirrorFillLeft,
                { width: `${Math.round(clamp(leftFraction) * 100)}%` },
              ]}
            />
          </View>
          <View style={styles.mirrorTrackRight}>
            <View
              style={[
                styles.mirrorFillRight,
                { width: `${Math.round(clamp(rightFraction) * 100)}%` },
              ]}
            />
          </View>
        </View>

        <Text
          variant="label"
          color="textHi"
          tabular
          style={[styles.boldText, styles.mirrorRightVal]}
        >
          {rightText}
        </Text>
      </View>
    </View>
  );
}

export function CompareHeadToHeadCard({
  items,
}: {
  items: CompareHeadToHeadItem[];
}): React.JSX.Element | null {
  if (items.length === 0) return null;

  return (
    <View style={styles.card} testID="compare-head-to-head-card">
      <View style={styles.cardHeaderRow}>
        <Text variant="label" color="textHi" style={styles.boldText}>
          {t('compareV1.headToHeadTitle')}
        </Text>
        <Text variant="meta" color="textLo">
          {t('compareV1.headToHeadMeta')}
        </Text>
      </View>

      <View style={styles.barsStack}>
        {items.map((item) => {
          const maxCount = Math.max(item.left_value, item.right_value, 1);
          const leftFrac =
            item.unit === 'count' ? item.left_value / maxCount : item.left_value / 100;
          const rightFrac =
            item.unit === 'count' ? item.right_value / maxCount : item.right_value / 100;
          const label =
            item.key === 'workouts'
              ? t('compareV1.metricWorkouts')
              : item.key === 'steps'
                ? t('compareV1.metricSteps')
                : t('compareV1.metricWater');

          return (
            <MirroredDualBarRow
              key={item.key}
              label={label}
              leftText={item.unit === 'pct' ? `${item.left_value}%` : String(item.left_value)}
              rightText={item.unit === 'pct' ? `${item.right_value}%` : String(item.right_value)}
              leftFraction={leftFrac}
              rightFraction={rightFrac}
            />
          );
        })}
      </View>
    </View>
  );
}

export function CompareMacrosCard({
  macros,
}: {
  macros: CompareMacroItem[];
}): React.JSX.Element | null {
  if (macros.length === 0) return null;

  return (
    <View style={styles.sectionBlock} testID="compare-macros-card">
      <Text variant="eyebrow" color="textLo">
        {t('compareV1.macrosTitle')}
      </Text>
      <View style={[styles.card, styles.barsStack]}>
        {macros.map((m) => (
          <MirroredDualBarRow
            key={m.key}
            label={
              m.key === 'protein'
                ? t('compareV1.protein')
                : m.key === 'carbs'
                  ? t('compareV1.carbs')
                  : t('compareV1.fat')
            }
            leftText={`${m.left_pct}%`}
            rightText={`${m.right_pct}%`}
            leftFraction={m.left_pct / 100}
            rightFraction={m.right_pct / 100}
          />
        ))}
      </View>
    </View>
  );
}

export function CompareWorkoutsProCard({
  data,
}: {
  data: SquadComparePayload;
}): React.JSX.Element | null {
  const detail = data.workouts_detail;
  if (!detail) return null;

  const renderCol = (name: string, summary: typeof detail.left, isRightCol: boolean) => (
    <View style={[styles.splitCol, isRightCol ? styles.splitColBorder : null]}>
      <Text variant="meta" color="textLo">
        {name}
      </Text>
      {!summary.shared ? (
        <View style={styles.privateBox}>
          <LockIcon size={14} color={colors.textLo} />
          <Text variant="meta" color="textLo">
            {t('compareV1.privateLocked')}
          </Text>
        </View>
      ) : (
        <>
          <Text variant="numL" color="textHi" tabular style={styles.workoutBigCount}>
            {summary.count}
          </Text>
          <View style={styles.splitPillsWrap}>
            {summary.splits.map((s) => (
              <View key={s.label} style={styles.splitPill}>
                <Text variant="meta" color="textMid">
                  {s.count > 1 ? `${s.label} ×${s.count}` : s.label}
                </Text>
              </View>
            ))}
          </View>
          <Text variant="meta" color="textLo" tabular>
            {`${formatCompareDuration(summary.duration_minutes)} · ${formatCompareVolumeKg(summary.volume_kg)}`}
          </Text>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.sectionBlock} testID="compare-workouts-card">
      <View style={styles.cardHeaderRow}>
        <Text variant="eyebrow" color="textLo">
          {t('compareV1.workoutsTitle')}
        </Text>
        <Text variant="meta" color="textLo">
          {t('compareV1.sharedByName', { name: data.right.name })}
        </Text>
      </View>

      <View style={[styles.card, styles.twoColRow]}>
        {renderCol(data.left.name, detail.left, false)}
        {renderCol(data.right.name, detail.right, true)}
      </View>
    </View>
  );
}

export function CompareMealsProCard({
  data,
}: {
  data: SquadComparePayload;
}): React.JSX.Element | null {
  const detail = data.meals_detail;
  if (!detail) return null;

  const renderCol = (name: string, summary: typeof detail.left, isRightCol: boolean) => (
    <View style={[styles.splitCol, isRightCol ? styles.splitColBorder : null]}>
      <Text variant="meta" color="textLo" numberOfLines={1}>
        {`${name} · ${t('compareV1.mostLogged')}`}
      </Text>
      {!summary.shared ? (
        <View style={styles.privateBox}>
          <LockIcon size={14} color={colors.textLo} />
          <Text variant="meta" color="textLo">
            {t('compareV1.privateLocked')}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.mealsListCol}>
            {summary.top_items.length === 0 ? (
              <Text variant="meta" color="textLo">
                {t('compareV1.nothingYet')}
              </Text>
            ) : (
              summary.top_items.map((item) => (
                <View key={item.name} style={styles.mealItemRow}>
                  <Text variant="meta" color="textHi" numberOfLines={1} style={styles.flexOne}>
                    {item.name}
                  </Text>
                  <Text variant="meta" color="textHi" tabular style={styles.boldText}>
                    {item.count}
                  </Text>
                </View>
              ))
            )}
          </View>
          <Text variant="meta" color="textLo" tabular>
            {t('compareV1.mealsPerDay', { count: summary.meals_per_day })}
          </Text>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.sectionBlock} testID="compare-meals-card">
      <View style={styles.cardHeaderRow}>
        <Text variant="eyebrow" color="textLo">
          {t('compareV1.mealsTitle')}
        </Text>
        <Text variant="meta" color="textLo">
          {t('compareV1.sharedByName', { name: data.right.name })}
        </Text>
      </View>

      <View style={[styles.card, styles.twoColRow]}>
        {renderCol(data.left.name, detail.left, false)}
        {renderCol(data.right.name, detail.right, true)}
      </View>
    </View>
  );
}

export function CompareProLockedCard({
  partnerName,
  onUnlock,
}: {
  partnerName: string;
  onUnlock: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.lockedOuterWrap} testID="compare-pro-locked-card">
      <View style={styles.lockedCard}>
        <View style={styles.lockIconCircle}>
          <LockIcon size={20} color={colors.textMid} />
        </View>

        <Badge variant="outlinePro" label={t('onboardingV1.paywallColPro')} />

        <Text variant="titleM" color="textHi" style={styles.lockedTitle}>
          {`${t('compareV1.lockedHeadlineStart', { name: partnerName })} `}
          <Text variant="titleM" italic color="apricot">
            {t('compareV1.lockedHeadlineAccent')}
          </Text>
        </Text>

        <Text variant="body" color="textLo" style={styles.lockedBody}>
          {t('compareV1.lockedBody', { name: partnerName })}
        </Text>

        <View style={styles.fullWidthBtn}>
          <PrimaryButton
            title={t('compareV1.unlockWithPro')}
            icon={<ArrowRightIcon size={16} color={colors.onBrand} />}
            onPress={onUnlock}
            testID="btn-compare-unlock-pro"
          />
        </View>
      </View>

      <Text variant="meta" color="textLo" style={styles.lockedFooter}>
        {t('compareV1.lockedFooter')}
      </Text>
    </View>
  );
}

export function CompareScrolledContextBar({
  leftName,
  rightName,
  rangeLabel,
  progressPct,
  onCycleRange,
}: {
  leftName: string;
  rightName: string;
  rangeLabel: string;
  progressPct: number;
  onCycleRange: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.scrolledContextBar} testID="compare-scrolled-context-bar">
      <View style={styles.scrolledLeftGroup}>
        <AvatarRing
          initial={leftName.slice(0, 1).toUpperCase()}
          size={34}
          progress={progressPct / 100}
          isSelf
        />
        <Text variant="label" color="textHi" style={styles.boldText}>
          {t('compareV1.vsTitle', { left: leftName, right: rightName })}
        </Text>
      </View>

      <Pressable
        onPress={onCycleRange}
        accessibilityRole="button"
        accessibilityLabel={rangeLabel}
        style={styles.metaPill}
        testID="btn-compare-cycle-range"
      >
        <Text variant="meta" color="textMid">
          {rangeLabel}
        </Text>
      </Pressable>
    </View>
  );
}

export function CompareTodayView({
  data,
  onOpenCustomizeTrackers,
}: {
  data: SquadComparePayload;
  onOpenCustomizeTrackers: () => void;
}): React.JSX.Element {
  const bothTrackRows = data.today_rows.filter((r) => r.left_tracks && r.right_tracks);
  const oneTracksRows = data.today_rows.filter((r) => r.left_tracks !== r.right_tracks);

  const labelForRow = (row: CompareTodayTrackerRow) => {
    switch (row.key) {
      case 'workout':
        return t('compareV1.workoutLabel');
      case 'meals':
        return t('compareV1.mealsLabel');
      case 'water':
        return t('compareV1.waterLabel');
      case 'steps':
        return t('compareV1.stepsLabel');
      default:
        return row.key;
    }
  };

  return (
    <View style={styles.todayStack} testID="compare-today-view">
      <View style={[styles.card, styles.todayScoreCard]}>
        <View style={styles.todaySideCol}>
          <Text variant="meta" color="textLo">
            {`${data.left.name} · ${t('compareV1.soFar')}`}
          </Text>
          <Text variant="numL" color="textHi" tabular style={styles.heroBigPct}>
            {data.left.overall_pct}%
          </Text>
          <View style={styles.metaPill}>
            <Text variant="micro" color="textMid" tabular>
              {t('compareV1.trackersCount', { count: data.left.tracker_count })}
            </Text>
          </View>
        </View>

        <View style={[styles.todaySideCol, styles.todaySideRight]}>
          <Text variant="meta" color="textLo">
            {`${data.right.name} · ${t('compareV1.soFar')}`}
          </Text>
          <Text variant="numL" color="textHi" tabular style={styles.heroBigPct}>
            {data.right.overall_pct}%
          </Text>
          <View style={styles.metaPill}>
            <Text variant="micro" color="textMid" tabular>
              {t('compareV1.trackersCount', { count: data.right.tracker_count })}
            </Text>
          </View>
        </View>
      </View>

      {bothTrackRows.length > 0 ? (
        <View style={styles.sectionBlock}>
          <Text variant="eyebrow" color="textLo">
            {t('compareV1.youBothTrack')}
          </Text>
          <View style={styles.card}>
            {bothTrackRows.map((row, idx) => (
              <View
                key={row.key}
                style={[
                  styles.todayMatrixRow,
                  idx < bothTrackRows.length - 1 ? styles.rowDivider : null,
                ]}
              >
                <View style={styles.todayCellLeft}>
                  {row.key === 'workout' ? (
                    row.left_done ? (
                      <View style={styles.workoutDoneInline}>
                        <View style={styles.smallCheckCircle}>
                          <CheckIcon size={11} color={colors.onBrand} strokeWidth={2.4} />
                        </View>
                        <Text
                          variant="meta"
                          color="textHi"
                          style={styles.boldText}
                          numberOfLines={2}
                        >
                          {row.left_label}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.metaPill}>
                        <Text variant="micro" color="textLo">
                          {row.left_is_rest ? t('compareV1.restDay') : t('compareV1.nothingYet')}
                        </Text>
                      </View>
                    )
                  ) : row.key === 'meals' ? (
                    row.left_done ? (
                      <Text variant="meta" color="textHi" style={styles.boldText}>
                        {t('compareV1.mealsLoggedCount', { count: row.left_label ?? '1' })}
                      </Text>
                    ) : (
                      <View style={styles.metaPill}>
                        <Text variant="micro" color="textLo">
                          {t('compareV1.nothingYet')}
                        </Text>
                      </View>
                    )
                  ) : (
                    <View style={styles.todayProgressInline}>
                      <View style={styles.todayMiniBar}>
                        <ProgressBar
                          progress={(row.left_pct ?? 0) / 100}
                          height={6}
                          fillColor={colors.apricot}
                        />
                      </View>
                      <Text variant="meta" color="textHi" tabular style={styles.boldText}>
                        {row.left_pct ?? 0}%
                      </Text>
                    </View>
                  )}
                </View>

                <Text variant="meta" color="textLo" style={styles.todayCenterLabel}>
                  {labelForRow(row)}
                </Text>

                <View style={styles.todayCellRight}>
                  {row.key === 'workout' ? (
                    row.right_done ? (
                      <View style={styles.workoutDoneInline}>
                        <View style={styles.smallCheckCircle}>
                          <CheckIcon size={11} color={colors.onBrand} strokeWidth={2.4} />
                        </View>
                        <Text
                          variant="meta"
                          color="textHi"
                          style={styles.boldText}
                          numberOfLines={2}
                        >
                          {row.right_label}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.metaPill}>
                        <Text variant="micro" color="textLo">
                          {row.right_is_rest ? t('compareV1.restDay') : t('compareV1.nothingYet')}
                        </Text>
                      </View>
                    )
                  ) : row.key === 'meals' ? (
                    row.right_done ? (
                      <Text variant="meta" color="textHi" style={styles.boldText}>
                        {t('compareV1.mealsLoggedCount', { count: row.right_label ?? '1' })}
                      </Text>
                    ) : (
                      <View style={styles.metaPill}>
                        <Text variant="micro" color="textLo">
                          {t('compareV1.nothingYet')}
                        </Text>
                      </View>
                    )
                  ) : (
                    <View style={styles.todayProgressInline}>
                      <Text variant="meta" color="textHi" tabular style={styles.boldText}>
                        {row.right_pct ?? 0}%
                      </Text>
                      <View style={styles.todayMiniBar}>
                        <ProgressBar
                          progress={(row.right_pct ?? 0) / 100}
                          height={6}
                          fillColor={colors.hairlineLit}
                        />
                      </View>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {oneTracksRows.length > 0 ? (
        <View style={styles.sectionBlock}>
          <Text variant="eyebrow" color="textLo">
            {t('compareV1.onlyOneTracks')}
          </Text>
          <View style={styles.card}>
            {oneTracksRows.map((row, idx) => (
              <View
                key={row.key}
                style={[
                  styles.todayMatrixRow,
                  idx < oneTracksRows.length - 1 ? styles.rowDivider : null,
                ]}
              >
                <View style={styles.todayCellLeft}>
                  {row.left_tracks ? (
                    <View style={styles.todayProgressInline}>
                      <View style={styles.todayMiniBar}>
                        <ProgressBar
                          progress={(row.left_pct ?? 0) / 100}
                          height={6}
                          fillColor={colors.apricot}
                        />
                      </View>
                      <Text variant="meta" color="textHi" tabular style={styles.boldText}>
                        {row.left_pct ?? 0}%
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.notTrackingCol}>
                      <View style={styles.metaPill}>
                        <Text variant="micro" color="textLo">
                          {t('compareV1.notTracking')}
                        </Text>
                      </View>
                      <Pressable
                        onPress={onOpenCustomizeTrackers}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={t('compareV1.trackMetricLink', { metric: row.key })}
                        testID={`btn-track-missing-${row.key}`}
                      >
                        <Text variant="meta" color="apricot" style={styles.boldText}>
                          {t('compareV1.trackMetricLink', { metric: row.key })}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>

                <Text variant="meta" color="textLo" style={styles.todayCenterLabel}>
                  {labelForRow(row)}
                </Text>

                <View style={styles.todayCellRight}>
                  {row.right_tracks ? (
                    <View style={styles.todayProgressInline}>
                      <Text variant="meta" color="textHi" tabular style={styles.boldText}>
                        {row.right_pct ?? 0}%
                      </Text>
                      <View style={styles.todayMiniBar}>
                        <ProgressBar
                          progress={(row.right_pct ?? 0) / 100}
                          height={6}
                          fillColor={colors.hairlineLit}
                        />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.metaPill}>
                      <Text variant="micro" color="textLo">
                        {t('compareV1.doesntTrack')}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.infoNoteCard}>
        <InfoCircleIcon size={16} color={colors.textLo} />
        <Text variant="meta" color="textLo" style={styles.flexOne}>
          {t('compareV1.todayNote')}
        </Text>
      </View>
    </View>
  );
}

export function CompareRulesSheetV1({
  visible,
  partnerName,
  onClose,
}: {
  visible: boolean;
  partnerName: string;
  onClose: () => void;
}): React.JSX.Element | null {
  if (!visible) return null;

  const rules = [
    t('compareV1.rule1'),
    t('compareV1.rule2'),
    t('compareV1.rule3'),
    t('compareV1.rule4'),
    t('compareV1.rule5'),
    t('compareV1.rule6'),
    t('compareV1.rule7', { name: partnerName }),
  ];

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={t('compareV1.rulesTitle')}
      testID="sheet-how-compare-works"
    >
      <View style={styles.rulesSheetWrap}>
        <View style={styles.rulesHeader}>
          <Text variant="titleM" color="textHi">
            {t('compareV1.rulesTitle')}
          </Text>
          <IconButton
            icon={<CloseIcon size={18} color={colors.textHi} />}
            accessibilityLabel={t('squadDesign.close')}
            onPress={onClose}
            testID="btn-close-compare-rules"
          />
        </View>

        <View style={styles.rulesList}>
          {rules.map((text, idx) => (
            <View
              key={idx}
              style={[styles.ruleRow, idx < rules.length - 1 ? styles.rowDivider : null]}
            >
              <View style={styles.ruleBadge}>
                <Text variant="micro" color="apricot" tabular style={styles.boldText}>
                  {idx + 1}
                </Text>
              </View>
              <Text variant="body" color="textMid" style={styles.flexOne}>
                {text}
              </Text>
            </View>
          ))}
        </View>

        <PrimaryButton title={t('compareV1.gotIt')} onPress={onClose} testID="btn-rules-got-it" />
      </View>
    </Sheet>
  );
}

export function rangeDisplayLabel(range: CompareRange): string {
  if (range === 'today') return t('compareV1.rangeToday');
  if (range === '30d') return t('compareV1.range30d');
  return t('compareV1.range7d');
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: radius.hero,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    padding: space.xl,
    gap: space.lg,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  heroSideCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  heroBigPct: {
    fontSize: 32,
    lineHeight: 38,
  },
  vennContainer: {
    width: 104,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  vennCenterOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vennPctText: {
    fontSize: 20,
    lineHeight: 22,
  },
  vennSubLabel: {
    marginTop: -2,
  },
  heroPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    flexWrap: 'wrap',
  },
  metaPill: {
    borderRadius: radius.full,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 1,
    alignSelf: 'flex-start',
  },
  card: {
    borderRadius: radius.card,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    padding: space.lg,
    gap: space.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  boldText: {
    fontFamily: fonts.bold,
  },
  daysCirclesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.xs,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleBoth: {
    backgroundColor: colors.apricot,
  },
  dayCircleOne: {
    borderWidth: 1.5,
    borderColor: colors.apricot,
    backgroundColor: colors.s1,
  },
  dayCircleNeither: {
    borderWidth: borders.width,
    borderColor: colors.hairline,
    backgroundColor: colors.s1,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  barsStack: {
    gap: space.md,
  },
  mirrorRowWrap: {
    gap: space.xs + 1,
  },
  mirrorTitle: {
    textAlign: 'center',
  },
  mirrorBarLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
  },
  mirrorLeftVal: {
    width: 44,
    textAlign: 'left',
  },
  mirrorRightVal: {
    width: 44,
    textAlign: 'right',
  },
  mirrorTracksPair: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mirrorTrackLeft: {
    flex: 1,
    height: 8,
    borderRadius: radius.bar,
    backgroundColor: colors.s2,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  mirrorFillLeft: {
    height: '100%',
    borderRadius: radius.bar,
    backgroundColor: colors.apricot,
  },
  mirrorTrackRight: {
    flex: 1,
    height: 8,
    borderRadius: radius.bar,
    backgroundColor: colors.s2,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  mirrorFillRight: {
    height: '100%',
    borderRadius: radius.bar,
    backgroundColor: colors.hairlineLit,
  },
  sectionBlock: {
    gap: space.sm,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 0,
    padding: 0,
    overflow: 'hidden',
  },
  splitCol: {
    flex: 1,
    padding: space.lg,
    gap: space.sm + 2,
  },
  splitColBorder: {
    borderLeftWidth: borders.width,
    borderLeftColor: colors.hairline,
  },
  workoutBigCount: {
    fontSize: 30,
    lineHeight: 34,
  },
  splitPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs + 2,
  },
  splitPill: {
    borderRadius: radius.full,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 3,
  },
  mealsListCol: {
    gap: space.xs + 2,
  },
  mealItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  privateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: space.sm,
  },
  flexOne: {
    flex: 1,
  },
  lockedOuterWrap: {
    gap: space.sm,
  },
  lockedCard: {
    borderRadius: radius.hero,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    padding: space.xl,
    alignItems: 'center',
    gap: space.md,
  },
  lockIconCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedTitle: {
    textAlign: 'center',
  },
  lockedBody: {
    textAlign: 'center',
  },
  fullWidthBtn: {
    width: '100%',
    marginTop: space.xs,
  },
  lockedFooter: {
    textAlign: 'center',
  },
  scrolledContextBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingX,
    paddingVertical: space.sm,
    backgroundColor: colors.bg0,
    borderBottomWidth: borders.width,
    borderBottomColor: colors.hairline,
  },
  scrolledLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  todayStack: {
    gap: space.lg,
  },
  todayScoreCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  todaySideCol: {
    flex: 1,
    gap: space.xs + 2,
  },
  todaySideRight: {
    alignItems: 'flex-end',
  },
  todayMatrixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    gap: space.sm,
  },
  rowDivider: {
    borderBottomWidth: borders.width,
    borderBottomColor: colors.hairline,
  },
  todayCellLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  todayCenterLabel: {
    width: 68,
    textAlign: 'center',
  },
  todayCellRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  workoutDoneInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
  },
  smallCheckCircle: {
    width: 18,
    height: 18,
    borderRadius: radius.full,
    backgroundColor: colors.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayProgressInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    width: '100%',
  },
  todayMiniBar: {
    flex: 1,
  },
  notTrackingCol: {
    gap: space.xs + 2,
    alignItems: 'flex-start',
  },
  infoNoteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    borderRadius: radius.card,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    padding: space.lg,
  },
  rulesSheetWrap: {
    gap: space.md,
  },
  rulesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rulesList: {
    gap: 0,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: space.md,
  },
  ruleBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
});
