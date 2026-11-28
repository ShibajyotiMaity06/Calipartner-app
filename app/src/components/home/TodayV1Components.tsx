import React, { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import {
  rankSquadMembers,
  weeklyPlanDayIndex,
  type DiarySectionSummary,
  type MealSection,
  type RankedSquadMember,
  type WorkoutPlanView,
} from '@calipartner/core';
import {
  AddButton,
  AvatarRing,
  Badge,
  BowlIcon,
  Card,
  ChatBubbleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DumbbellIcon,
  EditIcon,
  LockIcon,
  MoonIcon,
  PlusIcon,
  PrimaryButton,
  Ring,
  SunIcon,
  Text,
  borders,
  colors,
  fonts,
  layout,
  macroColors,
  radius,
  space,
} from '@calipartner/ui/v1';
import { FastingTimerModal } from '@/components/fasting/FastingTimerModal';
import { WorkoutHubModal } from '@/components/workouts/WorkoutHubModal';
import { useAuth } from '@/contexts/AuthContext';
import { useFasting } from '@/hooks/useFasting';
import { useSquadMentions, useSquadToday } from '@/hooks/useSquad';
import { getLocale, t } from '@/i18n';
import { getWorkoutPlan } from '@/services/workoutRoutineService';
import type { RoomSummary } from '@/types/rooms';

function formatShortHeaderDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(parsed);
  const day = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(parsed);
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(parsed);
  return `${weekday} · ${day} ${month}`.toUpperCase();
}

function formatStickyDate(isoDate: string, isToday: boolean): string {
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  const day = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(parsed);
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(parsed);
  if (isToday) return `${t('homeV1.todayLabel')}, ${day} ${month}`;
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(parsed);
  return `${weekday}, ${day} ${month}`;
}

function formatWaterCompact(
  valueMl: number,
  targetMl: number | null,
): { current: string; target: string } {
  const formatVol = (ml: number) => {
    if (ml >= 1000) {
      const liters = Math.round((ml / 1000) * 10) / 10;
      return `${liters} L`;
    }
    return `${ml} ml`;
  };
  return {
    current: formatVol(valueMl),
    target: targetMl != null ? ` / ${formatVol(targetMl)}` : '',
  };
}

function formatRelativeAgo(iso: string): string {
  const diffMs = Date.now() - Date.parse(iso);
  if (!Number.isFinite(diffMs) || diffMs < 60_000) return 'now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export interface TodayHeaderV1Props {
  selectedDate: string;
  userName: string;
  isPro: boolean;
  coinBalance: number | null;
  onUpgradePress: () => void;
  onCoinPress: () => void;
  onProfilePress: () => void;
}

export function TodayHeaderV1({
  selectedDate,
  userName,
  isPro,
  coinBalance,
  onUpgradePress,
  onCoinPress,
  onProfilePress,
}: TodayHeaderV1Props): React.JSX.Element {
  const cleanInitial = (userName.trim().slice(0, 1) || 'P').toUpperCase();

  return (
    <View style={styles.headerBlock} testID="today-header-v1">
      <View style={styles.headerTopRow}>
        <Text variant="eyebrow" color="textLo" testID="today-header-date">
          {formatShortHeaderDate(selectedDate)}
        </Text>
        <Pressable
          onPress={onUpgradePress}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={isPro ? t('onboardingV1.paywallColPro') : t('homeV1.upgradeCta')}
          style={({ pressed }) => [
            isPro ? styles.proBadgeTrigger : styles.upgradePill,
            !isPro && pressed ? styles.pressedTile : null,
            isPro && pressed ? styles.pressedOpacity : null,
          ]}
          testID="today-upgrade-pill"
        >
          {isPro ? (
            <Badge variant="outlinePro" label={t('onboardingV1.paywallColPro')} />
          ) : (
            <Text variant="meta" color="textMid" style={styles.upgradeText}>
              {`✦ ${t('homeV1.upgradeCta')}`}
            </Text>
          )}
        </Pressable>
      </View>

      <View style={styles.greetingRow}>
        <Text
          variant="titleM"
          color="textHi"
          style={styles.greetingText}
          testID="today-greeting-title"
        >
          {t('homeV1.helloGreeting', { name: userName })}
        </Text>

        <View style={styles.headerActions}>
          {coinBalance != null ? (
            <Pressable
              onPress={onCoinPress}
              accessibilityRole="button"
              accessibilityLabel={`${coinBalance} Cali Coins`}
              style={({ pressed }) => [styles.coinPill, pressed ? styles.pressedTile : null]}
              testID="today-coin-pill"
            >
              <View style={styles.coinDot}>
                <View style={styles.coinInnerDot} />
              </View>
              <Text variant="label" color="textHi" tabular style={styles.coinText}>
                {coinBalance.toLocaleString(getLocale())}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={onProfilePress}
            accessibilityRole="button"
            accessibilityLabel={t('tabs.me')}
            style={({ pressed }) => [styles.profileButton, pressed ? styles.profilePressed : null]}
            testID="today-profile-avatar"
          >
            <Text variant="buttonS" color="onBrand">
              {cleanInitial}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export interface TodayDayCardV1Props {
  eatenCalories: number;
  targetCalories: number | null;
  protein: { value: number; target: number | null };
  carbs: { value: number; target: number | null };
  fat: { value: number; target: number | null };
  steps: { value: number; target: number | null; loading?: boolean; error?: boolean };
  water: { valueMl: number; targetMl: number | null; loading?: boolean; error?: boolean };
  loading: boolean;
  error: boolean;
  errorMessage?: string;
  onRetry: () => void;
  onOpenDetail: () => void;
  onEditTracking?: () => void;
  onQuickAddWater: () => void;
  onOpenWater: () => void;
}

export function TodayDayCardV1({
  eatenCalories,
  targetCalories,
  protein,
  carbs,
  fat,
  steps,
  water,
  loading,
  error,
  errorMessage,
  onRetry,
  onOpenDetail,
  onEditTracking,
  onQuickAddWater,
  onOpenWater,
}: TodayDayCardV1Props): React.JSX.Element {
  const hasTarget = targetCalories != null && targetCalories > 0;
  const remaining = hasTarget ? targetCalories - eatenCalories : null;
  const isOver = remaining != null && remaining < 0;
  const heroValue = remaining != null ? Math.abs(Math.round(remaining)) : Math.round(eatenCalories);
  const calProgress = hasTarget ? Math.min(1, Math.max(0, eatenCalories / targetCalories)) : 0;

  const macroRows = [
    {
      key: 'protein',
      label: t('homeV1.protein'),
      value: Math.round(protein.value),
      target: protein.target != null ? Math.round(protein.target) : null,
      color: macroColors.protein,
    },
    {
      key: 'carbs',
      label: t('homeV1.carbs'),
      value: Math.round(carbs.value),
      target: carbs.target != null ? Math.round(carbs.target) : null,
      color: macroColors.carbs,
    },
    {
      key: 'fat',
      label: t('homeV1.fat'),
      value: Math.round(fat.value),
      target: fat.target != null ? Math.round(fat.target) : null,
      color: macroColors.fat,
    },
  ] as const;

  const stepsProgress =
    steps.target != null && steps.target > 0
      ? Math.min(1, Math.max(0, steps.value / steps.target))
      : 0;
  const waterProgress =
    water.targetMl != null && water.targetMl > 0
      ? Math.min(1, Math.max(0, water.valueMl / water.targetMl))
      : 0;
  const waterFormatted = formatWaterCompact(water.valueMl, water.targetMl);

  return (
    <Card variant="hero" style={styles.heroCard} testID="personal-day-card">
      <View style={styles.cardTopRow}>
        <Text variant="rowTitle" color="textHi">
          {t('homeV1.yourDay')}
        </Text>
        {onEditTracking ? (
          <Pressable
            onPress={onEditTracking}
            accessibilityRole="button"
            accessibilityLabel={t('personalDay.editTracking')}
            hitSlop={8}
            style={({ pressed }) => [styles.pencilCircle, pressed ? styles.pressedTile : null]}
            testID="edit-daily-tracking"
          >
            <EditIcon size={15} color={colors.textMid} />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <Text variant="meta" color="textLo" accessibilityLiveRegion="polite">
          {t('common.loading')}
        </Text>
      ) : error ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={t('common.retry')}
          style={styles.retryTouch}
          testID="personal-day-retry"
        >
          <Text variant="meta" color="danger" accessibilityRole="alert">
            {`${errorMessage ?? t('common.errorBody')} · ${t('common.retry')}`}
          </Text>
        </Pressable>
      ) : (
        <>
          <Pressable
            onPress={onOpenDetail}
            accessibilityRole="button"
            accessibilityLabel={`${heroValue} ${t(isOver ? 'homeV1.kcalOver' : 'homeV1.kcalLeft')}`}
            style={styles.heroSummaryRow}
            testID="personal-day-open"
          >
            <Ring
              progress={calProgress}
              size={132}
              strokeWidth={12}
              color={colors.apricot}
              trackColor={colors.s2}
              testID="today-calorie-ring"
            >
              <Text variant="numM" color="textHi" tabular style={styles.ringValue}>
                {heroValue.toLocaleString(getLocale())}
              </Text>
              <Text variant="micro" color="textLo">
                {t(isOver ? 'homeV1.kcalOver' : 'homeV1.kcalLeft')}
              </Text>
            </Ring>

            <View style={styles.macroCol}>
              {macroRows.map((row) => {
                const ratio =
                  row.target != null && row.target > 0
                    ? Math.min(1, Math.max(0, row.value / row.target))
                    : 0;
                return (
                  <View key={row.key} style={styles.macroItem}>
                    <View style={styles.macroLabelRow}>
                      <Text variant="meta" color="textMid">
                        {row.label}
                      </Text>
                      <Text variant="meta" color="textLo" tabular>
                        <Text variant="meta" color="textHi" style={styles.boldInline} tabular>
                          {String(row.value)}
                        </Text>
                        {row.target != null ? ` / ${row.target} g` : ' g'}
                      </Text>
                    </View>
                    <View style={styles.linearTrack}>
                      <View
                        style={[
                          styles.linearFill,
                          { width: `${Math.round(ratio * 100)}%`, backgroundColor: row.color },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </Pressable>

          <View style={styles.miniTilesRow}>
            <Card variant="inner" style={styles.miniTile} testID="today-steps-tile">
              <Text variant="meta" color="textMid">
                {t('homeV1.steps')}
              </Text>
              <View style={styles.miniValueRow}>
                <Text variant="numS" color="textHi" tabular>
                  {steps.value.toLocaleString(getLocale())}
                </Text>
                {steps.target != null ? (
                  <Text variant="meta" color="textLo" tabular>
                    {` / ${steps.target.toLocaleString(getLocale())}`}
                  </Text>
                ) : null}
              </View>
              <View style={styles.linearTrack}>
                <View
                  style={[
                    styles.linearFill,
                    {
                      width: `${Math.round(stepsProgress * 100)}%`,
                      backgroundColor: colors.apricot,
                    },
                  ]}
                />
              </View>
            </Card>

            <Pressable
              onPress={onOpenWater}
              accessibilityRole="button"
              accessibilityLabel={t('homeV1.water')}
              style={[styles.miniTile, styles.innerTileCard]}
              testID="today-water-tile"
            >
              <View style={styles.waterTopRow}>
                <Text variant="meta" color="textMid">
                  {t('homeV1.water')}
                </Text>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    onQuickAddWater();
                  }}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('homeV1.addWaterLabel')}
                  style={({ pressed }) => [
                    styles.waterQuickAdd,
                    pressed ? styles.profilePressed : null,
                  ]}
                  testID="today-water-quick-add"
                >
                  <PlusIcon size={14} color={colors.onBrand} strokeWidth={2.5} />
                </Pressable>
              </View>
              <View style={styles.miniValueRow}>
                <Text variant="numS" color="textHi" tabular>
                  {waterFormatted.current}
                </Text>
                <Text variant="meta" color="textLo" tabular>
                  {waterFormatted.target}
                </Text>
              </View>
              <View style={styles.linearTrack}>
                <View
                  style={[
                    styles.linearFill,
                    {
                      width: `${Math.round(waterProgress * 100)}%`,
                      backgroundColor: colors.apricot,
                    },
                  ]}
                />
              </View>
            </Pressable>
          </View>
        </>
      )}
    </Card>
  );
}

export interface TodaySquadCardV1Props {
  rooms: RoomSummary[];
  loading: boolean;
  error: unknown;
  visible: boolean;
  onRetry: () => void;
}

export function TodaySquadCardV1({
  rooms,
  loading,
  error,
  visible,
  onRetry,
}: TodaySquadCardV1Props): React.JSX.Element {
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const safeIndex = Math.min(selectedIndex, Math.max(0, rooms.length - 1));
  const room = rooms[safeIndex] ?? null;

  const squadToday = useSquadToday(room?.id ?? null, visible && Boolean(room));
  const squadMentions = useSquadMentions(room?.id ?? null, visible && Boolean(room));

  if (loading && !rooms.length) {
    return (
      <Card variant="hero" style={styles.squadCard} testID="today-squad-card">
        <Text variant="meta" color="textLo">
          {t('common.loading')}
        </Text>
      </Card>
    );
  }

  if (error && !rooms.length) {
    return (
      <Card variant="hero" style={styles.squadCard} testID="today-squad-card">
        <Pressable onPress={onRetry} accessibilityRole="button" testID="home-squad-retry">
          <Text variant="meta" color="danger">
            {`${t('repairs.squadError')} · ${t('common.retry')}`}
          </Text>
        </Pressable>
      </Card>
    );
  }

  if (!room) {
    return (
      <Card
        variant="hero"
        onPress={() =>
          router.push({ pathname: '/(tabs)/room', params: { action: 'create', returnTo: 'home' } })
        }
        style={styles.squadCard}
        testID="today-squad-empty"
      >
        <View style={styles.squadTopRow}>
          <View style={styles.flexOne}>
            <Text variant="rowTitle" color="textHi">
              {t('homeV1.emptySquadTitle')}
            </Text>
            <Text variant="meta" color="textLo">
              {t('homeV1.emptySquadSubtitle')}
            </Text>
          </View>
          <Text variant="label" color="apricot">
            {t('homeV1.emptySquadAction')}
          </Text>
        </View>
      </Card>
    );
  }

  const members: RankedSquadMember[] = squadToday.data?.members
    ? rankSquadMembers(squadToday.data.members)
    : [];
  const latestMention = squadMentions.data?.mentions?.[0] ?? null;

  return (
    <Card variant="hero" style={styles.squadCard} testID="today-squad-card">
      <View style={styles.squadTopRow}>
        <View style={styles.squadTitleGroup}>
          <Text variant="rowTitle" color="textHi" style={styles.squadName}>
            {room.name}
          </Text>
          <Text variant="meta" color="textLo" tabular>
            {t('homeV1.membersCount', { count: room.member_count })}
          </Text>
        </View>

        <View style={styles.squadRightActions}>
          {rooms.length > 1 ? (
            <View style={styles.squadSwitchers}>
              <Pressable
                onPress={() => setSelectedIndex((prev) => Math.max(0, prev - 1))}
                disabled={safeIndex === 0}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('avatar.previousSquad')}
              >
                <ChevronLeftIcon
                  size={14}
                  color={safeIndex === 0 ? colors.textOff : colors.textMid}
                />
              </Pressable>
              <Pressable
                onPress={() => setSelectedIndex((prev) => Math.min(rooms.length - 1, prev + 1))}
                disabled={safeIndex >= rooms.length - 1}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('avatar.nextSquad')}
              >
                <ChevronRightIcon
                  size={14}
                  color={safeIndex >= rooms.length - 1 ? colors.textOff : colors.textMid}
                />
              </Pressable>
            </View>
          ) : null}

          <Pressable
            onPress={() => router.push({ pathname: '/(tabs)/room', params: { room: room.id } })}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('homeRefresh.openSquad', { name: room.name })}
            testID="today-squad-open"
          >
            <Text variant="label" color="apricot">
              {t('homeV1.open')}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.squadRingsRow}>
        {members.slice(0, 4).map((member) => {
          const pct = member.score;
          const label = member.is_self ? t('repairs.you') : member.nickname;
          return (
            <Pressable
              key={member.user_id}
              onPress={() =>
                router.push(
                  `/squad/person?room=${encodeURIComponent(room.id)}&member=${encodeURIComponent(
                    member.user_id,
                  )}` as Href,
                )
              }
              accessibilityRole="button"
              accessibilityLabel={
                pct != null ? `${label}, ${Math.round(pct)}%` : `${label}, locked`
              }
              style={styles.memberCol}
            >
              <AvatarRing
                initial={member.nickname || label}
                progress={pct != null ? Math.min(1, Math.max(0, pct / 100)) : 0}
                color={colors.apricot}
              />
              {pct != null ? (
                <Text variant="meta" color="textMid" tabular style={styles.memberPct}>
                  {`${Math.round(pct)}%`}
                </Text>
              ) : (
                <LockIcon size={12} color={colors.textLo} />
              )}
            </Pressable>
          );
        })}

        <Pressable
          onPress={() => router.push('/friends' as Href)}
          accessibilityRole="button"
          accessibilityLabel={t('homeV1.invite')}
          style={styles.inviteCol}
          testID="today-squad-invite"
        >
          <View style={styles.inviteDashedCircle}>
            <PlusIcon size={18} color={colors.textLo} strokeWidth={2} />
          </View>
          <Text variant="meta" color="textLo" style={styles.memberPct}>
            {t('homeV1.invite')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.squadDivider} />

      <Pressable
        onPress={() => router.push({ pathname: '/(tabs)/room', params: { room: room.id } })}
        accessibilityRole="button"
        style={styles.squadFooterRow}
      >
        {latestMention ? (
          <>
            <View style={styles.activityInitial}>
              <Text variant="micro" color="onBrand" style={styles.boldInline}>
                {(latestMention.nickname.slice(0, 1) || '?').toUpperCase()}
              </Text>
            </View>
            <Text variant="meta" color="textMid" style={styles.flexOne}>
              {`${latestMention.nickname} ${latestMention.text}`}
            </Text>
            <Text variant="micro" color="textLo">
              {formatRelativeAgo(latestMention.created_at)}
            </Text>
          </>
        ) : (
          <Text variant="meta" color="textLo">
            {t('homeV1.squadHintFallback')}
          </Text>
        )}
      </Pressable>
    </Card>
  );
}

export interface TodayStickyBarV1Props {
  selectedDate: string;
  isToday: boolean;
  caloriesLeft: number | null;
  onPrevDay: () => void;
  onNextDay: () => void;
  onOpenDatePicker: () => void;
  onOpenCaloriesDetail: () => void;
}

export function TodayStickyBarV1({
  selectedDate,
  isToday,
  caloriesLeft,
  onPrevDay,
  onNextDay,
  onOpenDatePicker,
  onOpenCaloriesDetail,
}: TodayStickyBarV1Props): React.JSX.Element {
  return (
    <View style={styles.stickyBar} testID="today-sticky-date-bar">
      <View style={styles.stickyDateCluster}>
        <Pressable
          onPress={onPrevDay}
          accessibilityRole="button"
          accessibilityLabel={t('diary.previousDay')}
          style={styles.stickyArrowBtn}
          testID="sticky-prev-day"
        >
          <ChevronLeftIcon size={16} color={colors.textMid} />
        </Pressable>
        <Pressable
          onPress={onOpenDatePicker}
          accessibilityRole="button"
          accessibilityLabel={selectedDate}
          style={styles.stickyDateLabel}
        >
          <Text variant="label" color="textHi">
            {formatStickyDate(selectedDate, isToday)}
          </Text>
        </Pressable>
        <Pressable
          onPress={onNextDay}
          accessibilityRole="button"
          accessibilityLabel={t('diary.nextDay')}
          style={styles.stickyArrowBtn}
          testID="sticky-next-day"
        >
          <ChevronRightIcon size={16} color={colors.textMid} />
        </Pressable>
      </View>

      {caloriesLeft != null ? (
        <Pressable
          onPress={onOpenCaloriesDetail}
          accessibilityRole="button"
          style={styles.kcalChip}
        >
          <View style={styles.kcalDot} />
          <Text variant="meta" color="textHi" tabular style={styles.boldInline}>
            {`${Math.abs(Math.round(caloriesLeft)).toLocaleString(getLocale())} ${t(
              caloriesLeft < 0 ? 'homeV1.kcalOver' : 'homeV1.kcalLeft',
            )}`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export interface TodayMealRowV1Props {
  section: MealSection;
  summary: DiarySectionSummary;
  suggested: boolean;
  onPress: () => void;
  onAdd: () => void;
}

function mealIcon(section: MealSection) {
  switch (section) {
    case 'breakfast':
      return <SunIcon size={20} color={colors.textMid} />;
    case 'lunch':
      return <BowlIcon size={20} color={colors.textMid} />;
    case 'dinner':
      return <MoonIcon size={20} color={colors.textMid} />;
    case 'snacks':
    default:
      return <View style={styles.snackCircleIcon} />;
  }
}

function emptyMealSubtitle(section: MealSection, suggested: boolean): string {
  if (!suggested) return t('homeV1.nothingYet');
  switch (section) {
    case 'breakfast':
      return t('homeV1.breakfastUsualHint');
    case 'lunch':
      return t('homeV1.lunchUsualHint');
    case 'dinner':
      return t('homeV1.dinnerUsualHint');
    case 'snacks':
    default:
      return t('homeV1.snacksUsualHint');
  }
}

export function TodayMealRowV1({
  section,
  summary,
  suggested,
  onPress,
  onAdd,
}: TodayMealRowV1Props): React.JSX.Element {
  const sectionLabel = t(`diary.sections.${section}` as Parameters<typeof t>[0]);
  const summaryNames =
    summary.entries.length > 0
      ? summary.entries
          .slice(0, 2)
          .map((e) => e.food_name)
          .join(' · ')
      : emptyMealSubtitle(section, suggested);

  return (
    <Card
      onPress={onPress}
      style={styles.mealCard}
      testID={`card-section-${section}`}
      accessibilityLabel={sectionLabel}
    >
      <View style={styles.mealTile44}>{mealIcon(section)}</View>
      <View style={styles.mealBody}>
        <Text variant="rowTitle" color="textHi">
          {sectionLabel}
        </Text>
        <Text variant="meta" color="textLo">
          {summaryNames}
        </Text>
      </View>
      {summary.calories > 0 ? (
        <View style={styles.mealKcalWrap}>
          <Text variant="label" color="textHi" tabular>
            {Math.round(summary.calories).toLocaleString(getLocale())}
          </Text>
          <Text variant="micro" color="textLo">
            {` ${t('homeV1.kcalUnit')}`}
          </Text>
        </View>
      ) : null}
      <AddButton
        filled={suggested}
        size={36}
        onPress={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        accessibilityLabel={t('repairs.addFood', { section: sectionLabel })}
        testID={`btn-add-food-${section}`}
      />
    </Card>
  );
}

export function TodayFastingCardV1(): React.JSX.Element | null {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const {
    settings,
    activeSession,
    computedState,
    gating,
    hasPaidAccess,
    loading,
    startFast,
    endFast,
  } = useFasting({ userId });

  const [timerOpen, setTimerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  if (loading || (!activeSession && (!settings.enabled || !gating.canAccess || !hasPaidAccess))) {
    return null;
  }

  const isFasting = Boolean(activeSession && computedState.isActive);
  const elapsedHours = Math.floor(computedState.elapsedMinutes / 60);
  const elapsedMinutes = computedState.elapsedMinutes % 60;
  const remainingHours = Math.floor(computedState.remainingMinutes / 60);
  const remainingMinutes = computedState.remainingMinutes % 60;
  const protocolLabel = settings.protocol.toUpperCase();

  const subtitle = isFasting
    ? computedState.isCompleted
      ? t('homeV1.fastingTargetReached', { protocol: protocolLabel })
      : t('homeV1.fastingEndsIn', {
          protocol: protocolLabel,
          hours: remainingHours,
          minutes: remainingMinutes,
        })
    : t('homeV1.fastingReadyWindow', {
        protocol: protocolLabel,
        time: settings.eating_window_end || '20:00',
      });

  const handleToggle = async () => {
    try {
      setBusy(true);
      if (isFasting) {
        await endFast();
      } else {
        await startFast();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card onPress={() => setTimerOpen(true)} style={styles.fastingCard} testID="fasting-card">
        <Ring
          progress={isFasting ? Math.min(1, computedState.progressPercentage / 100) : 0}
          size={42}
          strokeWidth={4}
          color={colors.apricot}
          trackColor={colors.s3}
        />
        <View style={styles.flexOne}>
          <Text variant="rowTitle" color="textHi" tabular>
            {isFasting
              ? t('homeV1.fastingElapsedInline', {
                  hours: elapsedHours,
                  minutes: elapsedMinutes,
                })
              : t('homeV1.fastingReadyInline')}
          </Text>
          <Text variant="meta" color="textLo">
            {subtitle}
          </Text>
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            if (isFasting) setConfirmEnd(true);
            else void handleToggle();
          }}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t(isFasting ? 'homeV1.endFast' : 'homeV1.startFast')}
          style={({ pressed }) => [styles.fastActionPill, pressed ? styles.pressedTile : null]}
          testID="button-fasting-card-action"
        >
          <Text variant="label" color="textHi">
            {t(isFasting ? 'homeV1.endFast' : 'homeV1.startFast')}
          </Text>
        </Pressable>
      </Card>

      <Modal
        visible={confirmEnd}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmEnd(false)}
      >
        <View style={styles.confirmScrim}>
          <Card variant="hero" style={styles.confirmDialog}>
            <Text variant="titleS" color="textHi">
              {t('fasting.endFast')}
            </Text>
            <Text variant="body" color="textMid">
              {t('homeRefresh.fastingRemaining', {
                hours: remainingHours,
                minutes: remainingMinutes,
              })}
            </Text>
            <View style={styles.confirmActions}>
              <Pressable onPress={() => setConfirmEnd(false)} style={styles.confirmSecondary}>
                <Text variant="label" color="textMid">
                  {t('common.cancel')}
                </Text>
              </Pressable>
              <PrimaryButton
                title={t('homeV1.endFast')}
                compact
                onPress={() => {
                  setConfirmEnd(false);
                  void handleToggle();
                }}
              />
            </View>
          </Card>
        </View>
      </Modal>

      <FastingTimerModal visible={timerOpen} onClose={() => setTimerOpen(false)} userId={userId} />
    </>
  );
}

export function TodayWorkoutCardV1({
  localDate,
  hasWorkout,
  onSaved,
}: {
  localDate: string;
  hasWorkout: boolean;
  onSaved: () => void;
}): React.JSX.Element | null {
  const { user } = useAuth();
  const userId = user?.id;
  const router = useRouter();
  const [plan, setPlan] = useState<WorkoutPlanView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loggerOpen, setLoggerOpen] = useState(false);

  const loadPlan = useCallback(async (uid: string, signal: { active: boolean }) => {
    setLoading(true);
    setError(false);
    try {
      const next = await getWorkoutPlan(uid);
      if (signal.active) setPlan(next);
    } catch {
      if (signal.active) setError(true);
    } finally {
      if (signal.active) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!userId) {
        setLoading(false);
        return;
      }
      const signal = { active: true };
      void loadPlan(userId, signal);
      return () => {
        signal.active = false;
      };
    }, [userId, loadPlan]),
  );

  if (!userId || loading) return null;
  if (error) {
    return (
      <Card style={styles.workoutCard}>
        <Pressable
          onPress={() => {
            if (userId) void loadPlan(userId, { active: true });
          }}
          testID="home-routine-retry"
        >
          <Text variant="meta" color="danger">
            {`${t('homeRefresh.routineError')} · ${t('common.retry')}`}
          </Text>
        </Pressable>
      </Card>
    );
  }
  if (!plan || (!plan.id && !plan.needs_initial)) return null;
  const day = plan.days.find((item) => item.day === weeklyPlanDayIndex(localDate));
  if (day && !day.exercises.length) return null;

  return (
    <>
      <Card style={styles.workoutCard} testID="home-scheduled-workout">
        <View style={styles.mealTile44}>
          <DumbbellIcon size={20} color={colors.textMid} />
        </View>
        <View style={styles.flexOne}>
          <Text variant="micro" color="textLo" style={styles.workoutEyebrow}>
            {t('homeV1.todaysWorkout')}
          </Text>
          <Text variant="rowTitle" color="textHi">
            {day?.title ?? t('homeRefresh.scheduledRoutine')}
          </Text>
          {day ? (
            <Text variant="meta" color="textLo" tabular>
              {t('homeV1.workoutMeta', {
                minutes: day.minutes,
                count: day.exercises.length,
              })}
            </Text>
          ) : null}
        </View>

        {day || plan.full_access ? (
          <PrimaryButton
            compact
            title={t(hasWorkout ? 'homeV1.workoutLogged' : 'homeV1.workoutStart')}
            onPress={() => setLoggerOpen(true)}
            testID="home-start-scheduled-workout"
          />
        ) : (
          <PrimaryButton
            compact
            title={t('squadDesign.unlock')}
            onPress={() => router.push('/paywall')}
            testID="home-scheduled-workout-upgrade"
          />
        )}
      </Card>

      {loggerOpen ? (
        <WorkoutHubModal
          visible
          defaultDate={localDate}
          onClose={() => setLoggerOpen(false)}
          onSaved={() => {
            setLoggerOpen(false);
            onSaved();
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
  },
  boldInline: {
    fontFamily: fonts.bold,
  },
  pressedTile: {
    backgroundColor: colors.s3,
  },
  headerBlock: {
    gap: space.xs,
    marginBottom: space.lg,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  upgradePill: {
    borderWidth: borders.width,
    borderColor: colors.hairlineLit,
    backgroundColor: colors.s1,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 1,
  },
  proBadgeTrigger: {
    borderRadius: radius.full,
  },
  pressedOpacity: {
    opacity: 0.78,
  },
  upgradeText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  greetingText: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minHeight: 38,
  },
  coinDot: {
    width: 14,
    height: 14,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinInnerDot: {
    width: 4,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.apricot,
  },
  coinText: {
    fontSize: 13,
  },
  profileButton: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePressed: {
    backgroundColor: colors.apricotPressed,
  },
  heroCard: {
    gap: space.lg,
    marginBottom: space.lg,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pencilCircle: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryTouch: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
  },
  heroSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  ringValue: {
    fontSize: 32,
    lineHeight: 34,
  },
  macroCol: {
    flex: 1,
    gap: space.md,
  },
  macroItem: {
    gap: space.xs + 2,
  },
  macroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.xs,
  },
  linearTrack: {
    height: 5,
    borderRadius: radius.bar,
    backgroundColor: colors.s3,
    overflow: 'hidden',
  },
  linearFill: {
    height: '100%',
    borderRadius: radius.bar,
  },
  miniTilesRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  miniTile: {
    flex: 1,
    gap: space.sm,
  },
  innerTileCard: {
    backgroundColor: colors.s2,
    borderRadius: radius.chip,
    paddingVertical: space.md,
    paddingHorizontal: space.optical14,
  },
  miniValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  waterTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  waterQuickAdd: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squadCard: {
    gap: space.md,
    marginBottom: space.xl,
  },
  squadTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  squadTitleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
  },
  squadName: {
    flexShrink: 1,
  },
  squadRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  squadSwitchers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  squadRingsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingVertical: space.xs,
  },
  memberCol: {
    alignItems: 'center',
    gap: space.xs + 2,
  },
  memberPct: {
    fontSize: 12,
  },
  inviteCol: {
    alignItems: 'center',
    gap: space.xs + 2,
  },
  inviteDashedCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.hairlineLit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squadDivider: {
    height: borders.width,
    backgroundColor: colors.s2,
  },
  squadFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 24,
  },
  activityInitial: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.textHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingX,
    paddingVertical: space.md,
    backgroundColor: colors.bg0,
    borderBottomWidth: borders.width,
    borderBottomColor: colors.s2,
  },
  stickyDateCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  stickyArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyDateLabel: {
    paddingHorizontal: space.xs,
    minHeight: 32,
    justifyContent: 'center',
  },
  kcalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
  },
  kcalDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
    backgroundColor: colors.apricot,
  },
  mealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.optical14,
    paddingHorizontal: space.lg,
  },
  mealTile44: {
    width: 44,
    height: 44,
    borderRadius: radius.iconTile,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealBody: {
    flex: 1,
    gap: 2,
  },
  mealKcalWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  snackCircleIcon: {
    width: 14,
    height: 14,
    borderRadius: radius.full,
    borderWidth: 1.8,
    borderColor: colors.textMid,
  },
  fastingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
  },
  fastActionPill: {
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairlineLit,
    borderRadius: radius.full,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    minHeight: 38,
    justifyContent: 'center',
  },
  confirmScrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'center',
    paddingHorizontal: layout.screenPaddingX,
  },
  confirmDialog: {
    gap: space.md,
  },
  confirmActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space.md,
    marginTop: space.sm,
  },
  confirmSecondary: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  workoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
  },
  workoutEyebrow: {
    letterSpacing: 1.2,
  },
  coachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.optical14,
    paddingHorizontal: space.lg,
  },
  coachIconTile: {
    width: 40,
    height: 40,
    borderRadius: radius.iconTile,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export interface TodayCoachCardV1Props {
  isPro: boolean;
  onPress: () => void;
}

export function TodayCoachCardV1({ isPro, onPress }: TodayCoachCardV1Props): React.JSX.Element {
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={t('homeV1.askCoachTitle')}
      style={styles.coachCard}
      testID="today-coach-card"
    >
      <View style={styles.coachIconTile}>
        <ChatBubbleIcon size={18} color={colors.apricot} />
      </View>

      <View style={styles.flexOne}>
        <Text variant="rowTitle" color="textHi">
          {t('homeV1.askCoachTitle')}
        </Text>
        <Text variant="meta" color="textLo">
          {t('homeV1.askCoachSubtitle')}
        </Text>
      </View>

      {isPro ? (
        <ChevronRightIcon size={18} color={colors.textLo} />
      ) : (
        <Badge variant="pro" label={t('onboardingV1.paywallColPro')} />
      )}
    </Card>
  );
}
