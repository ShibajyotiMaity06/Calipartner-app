import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { getDaysDifference } from '@calipartner/core';
import {
  Card,
  ChartBarIcon,
  ChevronRightIcon,
  DumbbellIcon,
  Ring,
  ScaleIcon,
  Text,
  UtensilsIcon,
  borders,
  colors,
  fonts,
  radius,
  space,
} from '@calipartner/ui/v1';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentLocalDate } from '@/hooks/useCurrentLocalDate';
import { useTargets } from '@/hooks/useTargets';
import { t } from '@/i18n';

export interface CoachStartV1Props {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export function CoachStartV1({
  onSelectPrompt,
  disabled = false,
}: CoachStartV1Props): React.JSX.Element {
  const { user, profile } = useAuth();
  const { currentGoalProfile } = useTargets();
  const { localDate } = useCurrentLocalDate();

  const [guestName, setGuestName] = useState<string | null>(null);
  const [todayCalories, setTodayCalories] = useState<number>(0);
  const [todayLogsCount, setTodayLogsCount] = useState<number>(0);
  const [planRevision, setPlanRevision] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const ownerId = user?.id ?? 'guest-user';

    async function loadContext() {
      try {
        const [{ getDb }, { getDiaryDaySummary }, { getWorkoutsForDate }] = await Promise.all([
          import('@/db'),
          import('@/services/foodService'),
          import('@/services/workoutService'),
        ]);
        const db = await getDb();
        const [summary, workouts] = await Promise.all([
          getDiaryDaySummary(db, ownerId, localDate),
          getWorkoutsForDate(db, ownerId, localDate),
        ]);
        if (!active) return;
        setTodayCalories(Math.round(summary.totals.calories));
        const itemCount =
          summary.sections.breakfast.entries.length +
          summary.sections.lunch.entries.length +
          summary.sections.dinner.entries.length +
          summary.sections.snacks.entries.length +
          summary.sections.extra.entries.length +
          workouts.length;
        setTodayLogsCount(itemCount);

        if (!profile?.nickname) {
          const guestRow = await db.getFirstAsync<{ payload: string }>(
            `SELECT payload FROM guest_entries WHERE id = 'guest_profile' LIMIT 1`,
          );
          if (active && guestRow?.payload) {
            const parsed = JSON.parse(guestRow.payload);
            if (typeof parsed?.nickname === 'string' && parsed.nickname.trim()) {
              setGuestName(parsed.nickname.trim());
            }
          }
        }
      } catch {
        // Optional local reads; non-fatal in minimal contexts
      }

      if (user?.id) {
        try {
          const { getWorkoutPlan } = await import('@/services/workoutRoutineService');
          const plan = await getWorkoutPlan(user.id);
          if (active && typeof plan?.revision === 'number') {
            setPlanRevision(plan.revision);
          }
        } catch {
          // Plan may not exist yet
        }
      }
    }

    void loadContext();
    return () => {
      active = false;
    };
  }, [user?.id, localDate, profile?.nickname]);

  const rawName = profile?.nickname || guestName || profile?.username || t('homeRefresh.friend');
  const firstName = rawName.trim().split(/\s+/)[0] || rawName;

  const goalLabel = useMemo(() => {
    const goal = currentGoalProfile?.goal;
    if (goal === 'cut') return t('coachV1.goalLose');
    if (goal === 'bulk') return t('coachV1.goalGain');
    return t('coachV1.goalMaintain');
  }, [currentGoalProfile?.goal]);

  const planWeek = useMemo(() => {
    const origin = currentGoalProfile?.effective_from?.slice(0, 10);
    if (origin) {
      const days = getDaysDifference(localDate, origin);
      if (Number.isFinite(days) && days >= 0) {
        return Math.floor(days / 7) + 1;
      }
    }
    return Math.max(1, planRevision ?? 1);
  }, [planRevision, currentGoalProfile?.effective_from, localDate]);

  const caloriesLeft = useMemo(() => {
    const target = currentGoalProfile?.daily_calorie_target;
    if (!target || target <= 0) return null;
    return Math.max(0, Math.round(target - todayCalories));
  }, [currentGoalProfile?.daily_calorie_target, todayCalories]);

  const contextChips = useMemo(
    () => [
      {
        id: 'goal',
        label: t('coachV1.contextGoal', { goal: goalLabel }),
        prompt: null as string | null,
      },
      {
        id: 'plan',
        label: t('coachV1.contextPlanWeek', { week: planWeek }),
        prompt: t('coachV1.promptWeekTitle'),
      },
      {
        id: 'logs',
        label:
          todayLogsCount > 0
            ? t('coachV1.contextTodayLogsCount', { count: todayLogsCount })
            : t('coachV1.contextTodayLogs'),
        prompt: t('coachV1.promptWeekTitle'),
      },
    ],
    [goalLabel, planWeek, todayLogsCount],
  );

  const starters = useMemo(
    () => [
      {
        id: 'dinner',
        title: t('coachV1.promptDinnerTitle'),
        subtitle:
          caloriesLeft != null
            ? t('coachV1.promptDinnerWithLeft', { kcal: caloriesLeft })
            : t('coachV1.promptDinnerDefault'),
        prompt: t('coachV1.promptDinnerTitle'),
        icon: <UtensilsIcon size={18} color={colors.apricot} />,
      },
      {
        id: 'week',
        title: t('coachV1.promptWeekTitle'),
        subtitle: t('coachV1.promptWeekSub'),
        prompt: t('coachV1.promptWeekTitle'),
        icon: <ChartBarIcon size={18} color={colors.apricot} />,
      },
      {
        id: 'weight',
        title: t('coachV1.promptWeightTitle'),
        subtitle: t('coachV1.promptWeightSub'),
        prompt: t('coachV1.promptWeightTitle'),
        icon: <ScaleIcon size={18} color={colors.apricot} />,
      },
      {
        id: 'leg-day',
        title: t('coachV1.promptLegTitle'),
        subtitle: t('coachV1.promptLegSub'),
        prompt: t('coachV1.promptLegTitle'),
        icon: <DumbbellIcon size={18} color={colors.apricot} />,
      },
    ],
    [caloriesLeft],
  );

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      testID="coach-start-v1"
    >
      <View style={styles.heroBlock}>
        <View style={styles.haloOuter}>
          <View style={styles.haloGlow} />
          <Ring
            progress={0.72}
            size={56}
            strokeWidth={5}
            color={colors.apricot}
            trackColor={colors.hairline}
          />
        </View>

        <Text style={styles.headline}>
          <Text style={styles.headlineBase}>
            {t('coachV1.startHeadlineLead', { name: firstName })}
          </Text>
          <Text style={styles.headlineAccent}>{t('coachV1.startHeadlineAccent')}</Text>
          <Text style={styles.headlineBase}>{t('coachV1.startHeadlineTrail')}</Text>
        </Text>

        <Text variant="body" color="textMid" style={styles.subtitle}>
          {t('coachV1.startSubtitle')}
        </Text>
      </View>

      <View style={styles.contextRow}>
        {contextChips.map((chip) => (
          <View key={chip.id} style={styles.contextPill} testID={`coach-ctx-${chip.id}`}>
            <Text variant="micro" color="textMid" numberOfLines={2} style={styles.contextText}>
              {chip.label}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.startersList}>
        {starters.map((item) => (
          <Card
            key={item.id}
            onPress={disabled ? undefined : () => onSelectPrompt(item.prompt)}
            accessibilityLabel={item.title}
            style={styles.starterCard}
            testID={`coach-starter-${item.id}`}
          >
            <View style={styles.starterTile}>{item.icon}</View>
            <View style={styles.starterBody}>
              <Text variant="rowTitle" color="textHi" numberOfLines={1}>
                {item.title}
              </Text>
              <Text variant="meta" color="textLo" numberOfLines={1}>
                {item.subtitle}
              </Text>
            </View>
            <ChevronRightIcon size={18} color={colors.textLo} />
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    gap: space.md,
  },
  heroBlock: {
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.xs,
  },
  haloOuter: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  haloGlow: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: radius.full,
    backgroundColor: colors.apricotGlowSoft,
  },
  headline: {
    textAlign: 'center',
    maxWidth: 300,
  },
  headlineBase: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 33,
    color: colors.textHi,
    letterSpacing: -0.6,
  },
  headlineAccent: {
    fontFamily: fonts.displayItalic,
    fontSize: 28,
    lineHeight: 33,
    color: colors.apricot,
    letterSpacing: -0.6,
  },
  subtitle: {
    textAlign: 'center',
  },
  contextRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  contextPill: {
    flex: 1,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.chip,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    justifyContent: 'center',
    minHeight: 44,
  },
  contextText: {
    textAlign: 'center',
  },
  startersList: {
    gap: space.sm + 2,
  },
  starterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.optical14,
  },
  starterTile: {
    width: 40,
    height: 40,
    borderRadius: radius.iconTile,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starterBody: {
    flex: 1,
    gap: 2,
  },
});
