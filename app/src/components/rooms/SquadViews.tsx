import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Button, dark, homeLayout, radius, space, Text } from '@calipartner/ui';
import type {
  RankedSquadMember,
  SquadMeal,
  SquadMemberDetails,
  SquadWorkout,
} from '@calipartner/core';
import { t, getLocale } from '@/i18n';
import { SquadFoodItem } from './SquadFoodItem';

export const squadStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.bg0 },
  content: {
    width: '100%',
    maxWidth: homeLayout.maxContentWidth,
    alignSelf: 'center',
    padding: space[4],
    paddingBottom: homeLayout.touchSize * 3,
    gap: space[5],
  },
  stack: { gap: space[3] },
  metricGroup: { gap: space[1], paddingTop: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], flexWrap: 'wrap' },
  spread: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space[3],
    flexWrap: 'wrap',
  },
  flex: { flex: 1, minWidth: 0 },
  card: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: dark.hairline,
    padding: space[4],
    gap: space[3],
  },
  touch: { minHeight: homeLayout.touchSize, justifyContent: 'center' },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  column: { flex: 1, minWidth: 0, gap: space[3] },
  track: {
    height: space[2],
    borderRadius: radius.full,
    backgroundColor: dark.s3,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.full },
  secondLap: {
    position: 'absolute',
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: dark.cream,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: dark.hairline,
    paddingTop: space[3],
  },
  leader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: homeLayout.touchSize + space[3],
    paddingVertical: space[2],
  },
  rank: { minWidth: space[5] },
  name: { flexShrink: 1 },
  selector: {
    flex: 1,
    minWidth: space[8] * 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: dark.hairline,
    borderRadius: radius.control,
    padding: space[3],
    minHeight: homeLayout.touchSize,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[2],
  },
  back: {
    minHeight: homeLayout.touchSize,
    minWidth: homeLayout.touchSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: dark.hairline,
    borderRadius: radius.full,
  },
});
export function numberText(value: number) {
  return value.toLocaleString(getLocale(), { maximumFractionDigits: 1 });
}
export function memberName(member: RankedSquadMember) {
  return member.is_self ? t('repairs.you') : member.nickname;
}
export function goalName(member: RankedSquadMember) {
  return member.goal
    ? t(
        member.goal === 'cut'
          ? 'squadDesign.goalCut'
          : member.goal === 'bulk'
            ? 'squadDesign.goalBulk'
            : 'squadDesign.goalMaintain',
      )
    : t('squadDesign.noGoals');
}

export function ProgressTrack({
  percent,
  color = dark.copper,
}: {
  percent: number | null;
  color?: string;
}) {
  return (
    <View style={squadStyles.track} accessible={false}>
      {percent !== null && (
        <View
          style={[
            squadStyles.fill,
            { width: `${Math.max(0, Math.min(100, percent))}%`, backgroundColor: color },
          ]}
        />
      )}
      {percent !== null && percent > 100 && (
        <View style={[squadStyles.secondLap, { width: `${Math.min(100, percent - 100)}%` }]} />
      )}
    </View>
  );
}
export function SquadLeaderboard({
  members,
  limit,
  onMember,
}: {
  members: RankedSquadMember[];
  limit?: number;
  onMember: (member: RankedSquadMember) => void;
}) {
  if (!members.length) return <Text>{t('squadDesign.empty')}</Text>;
  return (
    <View testID="squad-leaderboard-list">
      {members.slice(0, limit).map((member) => (
        <Pressable
          key={member.user_id}
          onPress={() => onMember(member)}
          style={squadStyles.leader}
          accessibilityRole="button"
          accessibilityHint={t('squadDesign.scoreRule')}
          accessibilityLabel={
            member.score == null
              ? memberName(member) + ', ' + t('squadDesign.noGoals')
              : t('squadDesign.scoreSummary', { name: memberName(member), score: member.score })
          }
          testID={`squad-member-${member.user_id}`}
        >
          <Text variant="label" tabular style={squadStyles.rank}>
            {member.rank ?? '—'}
          </Text>
          <Avatar
            name={memberName(member)}
            uri={member.avatar_url ?? undefined}
            size="sm"
            identityHue={member.is_self ? 'iris' : 'teal'}
          />
          <View style={[squadStyles.flex, squadStyles.stack]}>
            <View style={squadStyles.spread}>
              <Text variant="heading" style={squadStyles.name}>
                {memberName(member)}
              </Text>
              <Text variant="bodyS" tabular style={squadStyles.name}>
                {member.targets
                  ? t('squadDesign.amount', {
                      value: numberText(member.calories),
                      target: numberText(member.targets.calories),
                      unit: t('squadDesign.kcal'),
                    })
                  : t('squadDesign.noGoals')}
              </Text>
            </View>
            <ProgressTrack percent={member.score} />
          </View>
          <Text variant="numeralM" tabular>
            {member.score == null ? '—' : t('squadDesign.percent', { value: member.score })}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export const metricKeys = ['calories', 'protein', 'carbs', 'fat', 'steps'] as const;
export function MetricValue({
  member,
  metric,
  label,
  color = dark.copper,
}: {
  member: RankedSquadMember;
  metric: (typeof metricKeys)[number];
  label?: string;
  color?: string;
}) {
  const value = member[metric],
    target = member.targets?.[metric] ?? null;
  const unit = t(
    metric === 'steps'
      ? 'squadDesign.stepUnit'
      : metric === 'calories'
        ? 'squadDesign.kcal'
        : 'squadDesign.grams',
  );
  const percent =
    target == null ? null : target > 0 ? (value / target) * 100 : value === 0 ? 100 : 200;
  return (
    <View
      style={{ gap: space[1] }}
      accessible
      accessibilityLabel={
        target == null
          ? memberName(member) + ': ' + t('squadDesign.noGoals')
          : t('squadDesign.metricSummary', {
              name: memberName(member),
              label: t(`squadDesign.${metric}`),
              value: numberText(value),
              target: numberText(target),
              unit,
            })
      }
    >
      {label ? (
        <View style={squadStyles.spread}>
          <Text variant="bodyS">{label}</Text>
          <Text variant="bodyS" tabular style={squadStyles.name}>
            {target == null
              ? numberText(value) + ' · ' + t('squadDesign.noGoals')
              : t('squadDesign.amount', {
                  value: numberText(value),
                  target: numberText(target),
                  unit,
                })}
          </Text>
        </View>
      ) : (
        <View style={squadStyles.spread}>
          <Text variant="heading" tabular color={dark.textHi}>
            {numberText(value)}
          </Text>
          <Text variant="micro" tabular style={{ maxWidth: '100%' }}>
            {target == null
              ? t('squadDesign.noGoals')
              : t('squadDesign.of', { target: numberText(target), unit })}
          </Text>
        </View>
      )}
      <ProgressTrack percent={percent} color={color} />
      {percent !== null && percent > 100 && <Text variant="bodyS">{t('homeRefresh.over')}</Text>}
    </View>
  );
}
export function MemberMetrics({ member }: { member: RankedSquadMember }) {
  return (
    <View style={squadStyles.card} testID="member-macros-steps">
      <View style={squadStyles.spread}>
        <Text variant="heading">{t('squadDesign.goal')}</Text>
        <Text variant="numeralL" tabular>
          {member.score == null
            ? t('squadDesign.noGoals')
            : t('squadDesign.percent', { value: member.score })}
        </Text>
      </View>
      <ProgressTrack percent={member.score} />
      {metricKeys.map((metric) => (
        <MetricValue
          key={metric}
          member={member}
          metric={metric}
          label={t(`squadDesign.${metric}`)}
        />
      ))}
    </View>
  );
}
export function PeopleSelector({
  left,
  right,
  onChoose,
}: {
  left: RankedSquadMember;
  right: RankedSquadMember;
  onChoose: (side: 'left' | 'right') => void;
}) {
  return (
    <View style={squadStyles.row}>
      {(
        [
          ['left', left],
          ['right', right],
        ] as const
      ).map(([side, member], index) => (
        <React.Fragment key={side}>
          {index === 1 && <Text variant="bodyS">{t('squadDesign.vs')}</Text>}
          <Pressable
            onPress={() => onChoose(side)}
            accessibilityRole="button"
            accessibilityLabel={t('squadDesign.choose') + ': ' + memberName(member)}
            style={squadStyles.selector}
            testID={`compare-choose-${side}`}
          >
            <Avatar
              name={memberName(member)}
              uri={member.avatar_url ?? undefined}
              size="sm"
              identityHue={side === 'left' ? 'iris' : 'teal'}
            />
            <Text style={squadStyles.flex}>{memberName(member)}</Text>
            <Ionicons name="chevron-down" size={homeLayout.iconSize} color={dark.textMid} />
          </Pressable>
        </React.Fragment>
      ))}
    </View>
  );
}
export function PlusDetailsCard({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <View style={squadStyles.card} testID="squad-details-paywall">
      <View style={squadStyles.row}>
        <Ionicons name="lock-closed-outline" size={homeLayout.iconSize} color={dark.copper} />
        <View style={squadStyles.flex}>
          <Text variant="heading">{t('squadDesign.details')}</Text>
          <Text variant="bodyS">{t('squadDesign.detailsHint')}</Text>
        </View>
        <Text>{t('squadDesign.plus')}</Text>
      </View>
      <Button label={t('squadDesign.unlock')} onPress={onUpgrade} testID="unlock-squad-details" />
    </View>
  );
}
export function MealContent({
  meal,
  roomId,
  memberId,
}: {
  meal: SquadMeal | undefined;
  roomId?: string;
  memberId?: string;
}) {
  if (!meal) return <Text variant="bodyS">{t('squadDesign.noLogs')}</Text>;
  return (
    <View style={squadStyles.stack}>
      <Text variant="heading" tabular>
        {numberText(meal.calories)} {t('squadDesign.kcal')}
      </Text>
      {meal.items.map((item) => (
        <SquadFoodItem
          key={item.id}
          item={item}
          roomId={roomId}
          memberId={memberId}
          section={meal.section}
        />
      ))}
      <Text variant="bodyS" tabular>
        {t('squadDesign.protein')} {numberText(meal.protein)} {t('squadDesign.grams')} ·{' '}
        {t('squadDesign.carbs')} {numberText(meal.carbs)} {t('squadDesign.grams')} ·{' '}
        {t('squadDesign.fat')} {numberText(meal.fat)} {t('squadDesign.grams')}
      </Text>
    </View>
  );
}
export function WorkoutContent({ workouts }: { workouts: SquadWorkout[] }) {
  if (!workouts.length) return <Text variant="bodyS">{t('squadDesign.noLogs')}</Text>;
  return (
    <View style={squadStyles.stack}>
      {workouts.map((workout) => (
        <View key={workout.id} style={squadStyles.stack}>
          <Text variant="heading">{workout.name}</Text>
          <Text variant="bodyS" tabular>
            {t('squadDesign.minutes', { count: workout.duration_minutes })}
          </Text>
          {workout.exercises.map((exercise) => (
            <View key={exercise.id} style={squadStyles.stack}>
              <Text>{exercise.name}</Text>
              {exercise.sets.map((set) => (
                <View key={set.set_number} style={squadStyles.stack}>
                  <Text variant="bodyS" tabular>
                    {t('squadDesign.set', { number: set.set_number, reps: set.reps ?? '—' })}
                    {set.weight_kg != null
                      ? ' · ' + t('squadDesign.load', { weight: set.weight_kg })
                      : ''}
                    {set.duration_seconds != null
                      ? ' · ' + t('squadDesign.seconds', { count: set.duration_seconds })
                      : ''}
                    {set.distance_meters != null
                      ? ' · ' + t('squadDesign.meters', { count: set.distance_meters })
                      : ''}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
export const mealSections = ['breakfast', 'lunch', 'dinner', 'snacks', 'extra'] as const;
export function MemberDetailsContent({
  details,
  roomId,
  memberId,
}: {
  details: SquadMemberDetails;
  roomId?: string;
  memberId?: string;
}) {
  return (
    <View style={squadStyles.stack}>
      <View style={squadStyles.card}>
        <Text variant="heading">{t('squadDesign.meals')}</Text>
        {mealSections.map((section) => (
          <View key={section} style={[squadStyles.stack, squadStyles.divider]}>
            <Text>{t(`diary.sections.${section}`)}</Text>
            <MealContent
              meal={details.meals.find((meal) => meal.section === section)}
              roomId={roomId}
              memberId={memberId}
            />
          </View>
        ))}
      </View>
      <View style={squadStyles.card}>
        <Text variant="heading">{t('squadDesign.workouts')}</Text>
        <WorkoutContent workouts={details.workouts} />
      </View>
    </View>
  );
}
