import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Sheet, Text, space } from '@calipartner/ui';
import {
  Checkbox,
  CloseIcon,
  IconButton,
  InfoCircleIcon,
  LinkButton,
  PrimaryButton,
  Sheet as V1Sheet,
  Text as V1Text,
  borders,
  colors,
  radius,
  space as v1Space,
} from '@calipartner/ui/v1';
import { addDaysToDateString, type DiaryDaySummary, type MealSection } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { t } from '@/i18n';
import { diaryEvents } from '@/services/diaryEvents';
import { getDiaryDaySummary } from '@/services/foodService';
import { repeatPreviousMeal } from '@/services/weeklyPlanService';
import { RepeatPreviousMeal } from './RepeatPreviousMeal';

const meals = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
type RepeatSection = (typeof meals)[number];

function formatWeekday(localDate: string): string {
  try {
    const dt = new Date(`${localDate}T12:00:00Z`);
    if (Number.isNaN(dt.getTime())) return localDate;
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(dt);
  } catch {
    return localDate;
  }
}

export function RepeatYesterdayMeals({
  localDate,
  variant = 'default',
  remainingCalories,
}: {
  localDate: string;
  variant?: 'default' | 'v1';
  remainingCalories?: number | null;
}) {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [yesterdaySummary, setYesterdaySummary] = useState<DiaryDaySummary | null>(null);
  const [todaySummary, setTodaySummary] = useState<DiaryDaySummary | null>(null);
  const [selected, setSelected] = useState<Record<RepeatSection, boolean>>({
    breakfast: false,
    lunch: false,
    dinner: false,
    snacks: false,
  });
  const saveLock = useRef(false);

  useBrowserModalBack(visible, () => {
    if (!saveLock.current) setVisible(false);
  });

  useEffect(() => {
    if (variant !== 'v1' || !visible || !user?.id) return;
    let active = true;
    const yesterday = addDaysToDateString(localDate, -1);
    setLoading(true);
    setLoadError(false);
    setSaveError(false);
    void (async () => {
      try {
        const db = await getDb();
        const [ySum, tSum] = await Promise.all([
          getDiaryDaySummary(db, user.id, yesterday),
          getDiaryDaySummary(db, user.id, localDate),
        ]);
        if (!active) return;
        setYesterdaySummary(ySum);
        setTodaySummary(tSum);
        const initial: Record<RepeatSection, boolean> = {
          breakfast: false,
          lunch: false,
          dinner: false,
          snacks: false,
        };
        for (const sec of meals) {
          initial[sec] =
            ySum.sections[sec].entries.length > 0 && tSum.sections[sec].entries.length === 0;
        }
        setSelected(initial);
      } catch {
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [variant, visible, user?.id, localDate]);

  if (!user) return null;

  if (variant !== 'v1') {
    return (
      <>
        <Button
          variant="secondary"
          label={t('homeRefresh.repeatYesterday')}
          onPress={() => setVisible(true)}
          testID="home-repeat-yesterday"
        />
        <Sheet
          visible={visible}
          onClose={() => setVisible(false)}
          snapPoint="tall"
          accessibilityLabel={t('homeRefresh.repeatYesterday')}
          testID="repeat-yesterday-meals"
        >
          <ScrollView contentContainerStyle={styles.content}>
            <Text variant="title2">{t('homeRefresh.repeatYesterday')}</Text>
            <Text>{t('homeRefresh.choosePreviousMeal')}</Text>
            {meals.map((section) => (
              <RepeatPreviousMeal
                key={`${localDate}-${section}`}
                localDate={localDate}
                section={section}
                labelMode="meal"
              />
            ))}
            <Button
              variant="tertiary"
              label={t('homeRefresh.close')}
              onPress={() => setVisible(false)}
              testID="repeat-yesterday-close"
            />
          </ScrollView>
        </Sheet>
      </>
    );
  }

  const yesterdayDate = addDaysToDateString(localDate, -1);
  const yesterdayWeekday = formatWeekday(yesterdayDate);
  const yesterdayTotalKcal = Math.round(yesterdaySummary?.totals.calories ?? 0);

  const selectedSections = meals.filter((sec) => {
    const hasYesterday = (yesterdaySummary?.sections[sec].entries.length ?? 0) > 0;
    const alreadyToday = (todaySummary?.sections[sec].entries.length ?? 0) > 0;
    return hasYesterday && !alreadyToday && selected[sec];
  });

  const selectedCalories = Math.round(
    selectedSections.reduce((sum, sec) => sum + (yesterdaySummary?.sections[sec].calories ?? 0), 0),
  );

  const leavesDelta =
    remainingCalories != null ? Math.round(remainingCalories - selectedCalories) : null;

  const handleAddToToday = async () => {
    if (saveLock.current || selectedSections.length === 0) return;
    saveLock.current = true;
    setSaving(true);
    setSaveError(false);
    try {
      for (const sec of selectedSections) {
        await repeatPreviousMeal(user.id, localDate, sec as MealSection);
      }
      diaryEvents.emitChange();
      setVisible(false);
    } catch {
      setSaveError(true);
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  return (
    <>
      <View style={styles.v1Trigger}>
        <LinkButton
          title={t('homeRefresh.repeatYesterday')}
          variant="accent"
          onPress={() => setVisible(true)}
          testID="home-repeat-yesterday"
        />
      </View>

      <V1Sheet
        visible={visible}
        onClose={() => {
          if (!saveLock.current) setVisible(false);
        }}
        accessibilityLabel={t('repeatV1.title')}
        testID="repeat-yesterday-meals"
      >
        <ScrollView
          contentContainerStyle={styles.v1Content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.v1HeaderRow}>
            <View style={styles.v1HeaderCopy}>
              <V1Text variant="titleM" color="textHi">
                {t('repeatV1.title')}
              </V1Text>
              <V1Text variant="meta" color="textLo" tabular>
                {yesterdayTotalKcal > 0
                  ? t('repeatV1.yesterdayTotalSummary', {
                      weekday: yesterdayWeekday,
                      calories: yesterdayTotalKcal.toLocaleString('en-US'),
                    })
                  : t('repeatV1.yesterdayEmptySummary', { weekday: yesterdayWeekday })}
              </V1Text>
            </View>
            <IconButton
              icon={<CloseIcon size={16} color={colors.textHi} />}
              size={36}
              inSheet
              onPress={() => {
                if (!saveLock.current) setVisible(false);
              }}
              accessibilityLabel={t('homeRefresh.close')}
              testID="repeat-yesterday-close"
            />
          </View>

          {loading ? (
            <View style={styles.v1Loading}>
              <ActivityIndicator color={colors.apricot} />
            </View>
          ) : loadError ? (
            <V1Text variant="meta" color="danger" accessibilityRole="alert">
              {t('common.errorBody')}
            </V1Text>
          ) : (
            <View>
              {meals.map((section, idx) => {
                const ySec = yesterdaySummary?.sections[section];
                const tSec = todaySummary?.sections[section];
                const yEntries = ySec?.entries ?? [];
                const tEntries = tSec?.entries ?? [];
                const hasYesterday = yEntries.length > 0;
                const alreadyToday = tEntries.length > 0;
                const canSelect = hasYesterday && !alreadyToday;
                const checked = canSelect && Boolean(selected[section]);
                const mealKcal = Math.round(ySec?.calories ?? 0);
                const itemsText = yEntries
                  .map((entry) => entry.food_name)
                  .filter(Boolean)
                  .slice(0, 3)
                  .join(', ');

                const toggleRow = () => {
                  if (!canSelect || saving) return;
                  setSelected((prev) => ({ ...prev, [section]: !prev[section] }));
                };

                return (
                  <View key={section}>
                    <Pressable
                      onPress={toggleRow}
                      disabled={!canSelect || saving}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked, disabled: !canSelect || saving }}
                      accessibilityLabel={t(`diary.sections.${section}`)}
                      style={styles.v1MealRow}
                      testID={`repeat-row-${section}`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={!canSelect || saving}
                        onChange={(next) => {
                          if (!canSelect || saving) return;
                          setSelected((prev) => ({ ...prev, [section]: next }));
                        }}
                        accessibilityLabel={t(`diary.sections.${section}`)}
                        testID={`repeat-checkbox-${section}`}
                      />
                      <View style={styles.v1MealBody}>
                        <V1Text variant="rowTitle" color={canSelect ? 'textHi' : 'textOff'}>
                          {t(`diary.sections.${section}`)}
                        </V1Text>
                        <V1Text variant="meta" color={canSelect ? 'textLo' : 'textOff'}>
                          {alreadyToday
                            ? t('repeatV1.alreadyLoggedToday')
                            : hasYesterday
                              ? itemsText
                              : t('homeV1.nothingYet')}
                        </V1Text>
                      </View>
                      <View style={styles.v1MealKcal}>
                        <V1Text variant="rowTitle" color={canSelect ? 'textHi' : 'textLo'} tabular>
                          {String(mealKcal)}
                        </V1Text>
                        <V1Text variant="meta" color="textLo">
                          {' kcal'}
                        </V1Text>
                      </View>
                    </Pressable>
                    {idx < meals.length - 1 ? <View style={styles.v1Divider} /> : null}
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.v1InfoBanner}>
            <InfoCircleIcon size={18} color={colors.textLo} />
            <V1Text variant="meta" color="textLo" style={styles.v1InfoText}>
              {t('repeatV1.infoNotice')}
            </V1Text>
          </View>

          <View style={styles.v1SummaryRow}>
            <V1Text variant="rowTitle" color="textHi" tabular testID="repeat-summary-total">
              {selectedSections.length === 1
                ? t('repeatV1.mealSelectedSingle', {
                    calories: selectedCalories.toLocaleString('en-US'),
                  })
                : t('repeatV1.mealsSelectedSummary', {
                    count: selectedSections.length,
                    calories: selectedCalories.toLocaleString('en-US'),
                  })}
            </V1Text>
            {leavesDelta != null ? (
              <V1Text variant="meta" color="textLo" tabular>
                {leavesDelta >= 0
                  ? t('repeatV1.leavesKcalToday', {
                      calories: leavesDelta.toLocaleString('en-US'),
                    })
                  : t('repeatV1.overKcalToday', {
                      calories: Math.abs(leavesDelta).toLocaleString('en-US'),
                    })}
              </V1Text>
            ) : null}
          </View>

          {saveError ? (
            <V1Text variant="meta" color="danger" accessibilityRole="alert">
              {t('fixNovember.saveFailed')}
            </V1Text>
          ) : null}

          <PrimaryButton
            title={saving ? t('common.saving') : t('repeatV1.addToToday')}
            showArrow
            disabled={loading || saving || selectedSections.length === 0}
            loading={saving}
            onPress={() => void handleAddToToday()}
            testID="repeat-add-to-today"
          />
        </ScrollView>
      </V1Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: space[3], gap: space[3] },
  v1Trigger: { alignItems: 'center', justifyContent: 'center' },
  v1Content: {
    gap: v1Space.md,
    paddingBottom: v1Space.sm,
  },
  v1HeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: v1Space.md,
  },
  v1HeaderCopy: {
    flex: 1,
    gap: v1Space.xs,
  },
  v1Loading: {
    paddingVertical: v1Space.xl,
    alignItems: 'center',
  },
  v1MealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: v1Space.md,
    paddingVertical: v1Space.md,
    minHeight: 52,
  },
  v1MealBody: {
    flex: 1,
    gap: 2,
  },
  v1MealKcal: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  v1Divider: {
    height: borders.width,
    backgroundColor: colors.s2,
  },
  v1InfoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: v1Space.sm,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.banner,
    padding: v1Space.md,
  },
  v1InfoText: {
    flex: 1,
  },
  v1SummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: v1Space.sm,
    paddingTop: v1Space.xs,
  },
});
