import React, { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { type CompareRange, type TrackingPreferences } from '@calipartner/core';
import {
  ChevronLeftIcon,
  InfoCircleIcon,
  PrimaryButton,
  Segmented,
  ShareUploadIcon,
  Text,
  colors,
  fonts,
  layout,
  radius,
  space,
} from '@calipartner/ui/v1';
import { TrackingPreferencesSheet } from '@/components/rooms/TrackingPreferencesSheet';
import {
  CompareDaysTogetherCard,
  CompareHeadToHeadCard,
  CompareMacrosCard,
  CompareMealsProCard,
  CompareOverviewHeroCard,
  CompareProLockedCard,
  CompareRulesSheetV1,
  CompareScrolledContextBar,
  CompareTodayView,
  CompareWorkoutsProCard,
  rangeDisplayLabel,
} from '@/components/rooms/CompareV1Components';
import { useSquadCompare } from '@/hooks/useSquad';
import { useTrackingPreferences } from '@/hooks/useTrackingPreferences';
import { t } from '@/i18n';

const RANGES: CompareRange[] = ['today', '7d', '30d'];
const SCROLLED_BAR_Y = 140;

export default function CompareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ room?: string; left?: string; right?: string }>();
  const roomId = typeof params.room === 'string' ? params.room : null;
  const leftId = typeof params.left === 'string' ? params.left : null;
  const rightId = typeof params.right === 'string' ? params.right : null;

  const [visible, setVisible] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setVisible(true);
      return () => setVisible(false);
    }, []),
  );

  const [range, setRange] = useState<CompareRange>('7d');
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [editingTracking, setEditingTracking] = useState(false);

  const tracking = useTrackingPreferences();
  const compare = useSquadCompare(roomId, leftId, rightId, range, visible);

  const rangeOptions = [
    { value: 'today' as CompareRange, label: t('compareV1.rangeToday') },
    { value: '7d' as CompareRange, label: t('compareV1.range7d') },
    { value: '30d' as CompareRange, label: t('compareV1.range30d') },
  ];

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/room' as Href);
    }
  };

  const handleShare = async () => {
    const payload = compare.data;
    if (!payload) return;
    try {
      await Share.share({
        message: `${payload.left.name} vs ${payload.right.name} (${rangeDisplayLabel(range)}): ${payload.left.overall_pct}% vs ${payload.right.overall_pct}% — ${payload.in_sync_pct}% in sync on CaliPartner`,
      });
    } catch {
      // Cancelled share dialog
    }
  };

  const cycleRange = () => {
    const idx = RANGES.indexOf(range);
    const next = RANGES[(idx + 1) % RANGES.length] ?? '7d';
    setRange(next);
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrolledPastHero(event.nativeEvent.contentOffset.y > SCROLLED_BAR_Y);
  };

  const data = compare.data;

  return (
    <View style={styles.root} testID="screen-compare">
      <View style={[styles.topBar, { paddingTop: Math.max(space.sm, insets.top + 6) }]}>
        <Pressable
          onPress={handleBack}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('squadDesign.back')}
          style={({ pressed }) => [styles.circleBtn, pressed ? styles.pressedBtn : null]}
          testID="compare-back"
        >
          <ChevronLeftIcon size={18} color={colors.textHi} />
        </Pressable>

        <Text variant="titleS" color="textHi" accessibilityRole="header" style={styles.headerTitle}>
          {t('compareV1.title')}
        </Text>

        <Pressable
          onPress={() => void handleShare()}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('progressV1.shareLabel')}
          style={({ pressed }) => [styles.circleBtn, pressed ? styles.pressedBtn : null]}
          testID="compare-share"
        >
          <ShareUploadIcon size={18} color={colors.textHi} />
        </Pressable>
      </View>

      {data && scrolledPastHero && range !== 'today' ? (
        <CompareScrolledContextBar
          leftName={data.left.name}
          rightName={data.right.name}
          rangeLabel={rangeDisplayLabel(range)}
          progressPct={data.left.overall_pct}
          onCycleRange={cycleRange}
        />
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(space.xl, insets.bottom + space.lg) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={compare.loading}
            onRefresh={() => void compare.refresh()}
            tintColor={colors.apricot}
          />
        }
      >
        <View style={styles.innerWrap}>
          {!roomId || !leftId || !rightId ? (
            <View style={styles.stateBox}>
              <Text variant="body" color="textMid" accessibilityRole="alert">
                {t('common.errorBody')}
              </Text>
              <PrimaryButton title={t('squadDesign.back')} onPress={handleBack} />
            </View>
          ) : compare.error && !data ? (
            <View style={styles.stateBox} testID="compare-error-state">
              <Text variant="body" color="textMid" accessibilityRole="alert">
                {t('common.errorBody')}
              </Text>
              <PrimaryButton
                title={t('common.retry')}
                onPress={() => void compare.refresh()}
                testID="retry-compare"
              />
            </View>
          ) : compare.loading && !data ? (
            <View style={styles.stateBox} testID="compare-loading-state">
              <Text variant="body" color="textLo">
                {t('common.loading')}
              </Text>
            </View>
          ) : data ? (
            range === 'today' ? (
              <>
                <Segmented
                  options={rangeOptions}
                  value={range}
                  onChange={(next) => {
                    setScrolledPastHero(false);
                    setRange(next);
                  }}
                  testID="compare-range-segmented"
                />

                <CompareTodayView
                  data={data}
                  onOpenCustomizeTrackers={() => setEditingTracking(true)}
                />
              </>
            ) : (
              <>
                <CompareOverviewHeroCard data={data} />

                <Segmented
                  options={rangeOptions}
                  value={range}
                  onChange={(next) => {
                    setScrolledPastHero(false);
                    setRange(next);
                  }}
                  testID="compare-range-segmented"
                />

                <CompareDaysTogetherCard data={data} />

                <CompareHeadToHeadCard items={data.head_to_head} />

                <Pressable
                  onPress={() => setShowRules(true)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={t('compareV1.howCalculated')}
                  style={styles.howRow}
                  testID="btn-how-compare-works"
                >
                  <InfoCircleIcon size={15} color={colors.apricot} />
                  <Text variant="meta" color="apricot" style={styles.howText}>
                    {t('compareV1.howCalculated')}
                  </Text>
                </Pressable>

                <CompareMacrosCard macros={data.macros} />

                {data.locked ? (
                  <CompareProLockedCard
                    partnerName={data.right.name}
                    onUnlock={() => router.push('/paywall' as Href)}
                  />
                ) : (
                  <>
                    <CompareWorkoutsProCard data={data} />
                    <CompareMealsProCard data={data} />
                  </>
                )}
              </>
            )
          ) : null}
        </View>
      </ScrollView>

      <CompareRulesSheetV1
        visible={showRules}
        partnerName={data?.right.name ?? t('compareV1.you')}
        onClose={() => setShowRules(false)}
      />

      {editingTracking ? (
        <TrackingPreferencesSheet
          enabled={tracking.enabled}
          onClose={() => setEditingTracking(false)}
          onSave={async (next: TrackingPreferences) => {
            await tracking.save(next);
            await compare.refresh();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: space.sm,
    backgroundColor: colors.bg0,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.s1,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedBtn: {
    backgroundColor: colors.s2,
  },
  headerTitle: {
    fontFamily: fonts.semibold,
    fontSize: 17,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space.sm,
  },
  innerWrap: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: space.lg,
  },
  stateBox: {
    paddingVertical: space.xl,
    gap: space.md,
  },
  howRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs,
  },
  howText: {
    fontFamily: fonts.semibold,
  },
});
