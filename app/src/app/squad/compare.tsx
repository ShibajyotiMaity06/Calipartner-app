import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, dark, homeLayout, Text } from '@calipartner/ui';
import { useSquadToday, useSquadDetails } from '@/hooks/useSquad';
import { useSubscription } from '@/hooks/useSubscription';
import { SquadMemberPicker } from '@/components/rooms/SquadMemberPicker';
import {
  MealContent,
  mealSections,
  memberName,
  MetricValue,
  PeopleSelector,
  PlusDetailsCard,
  ProgressTrack,
  WorkoutContent,
  squadStyles as styles,
} from '@/components/rooms/SquadViews';
import { t } from '@/i18n';

export default function SquadCompareScreen() {
  const params = useLocalSearchParams<{ room: string; left?: string; right?: string }>(),
    router = useRouter();
  const [visible, setVisible] = useState(false),
    [picker, setPicker] = useState<'left' | 'right' | null>(null),
    [leftId, setLeftId] = useState(params.left),
    [rightId, setRightId] = useState(params.right);
  useFocusEffect(
    useCallback(() => {
      setVisible(true);
      return () => setVisible(false);
    }, []),
  );
  const { hasActiveAccess, loading: checkingPlan } = useSubscription();
  const squad = useSquadToday(params.room ?? null, visible),
    members = squad.data?.members ?? [];
  const left =
    members.find((member) => member.user_id === leftId) ??
    members.find((member) => member.is_self) ??
    members[0];
  const right =
    members.find((member) => member.user_id === rightId && member.user_id !== left?.user_id) ??
    members.find((member) => member.user_id !== left?.user_id);
  const first = useSquadDetails(
      params.room ?? null,
      left?.user_id ?? null,
      visible && hasActiveAccess,
    ),
    second = useSquadDetails(
      params.room ?? null,
      right?.user_id ?? null,
      visible && hasActiveAccess,
    );
  const back = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/(tabs)/room', params: { room: params.room } });
  const refresh = () => {
    void squad.refresh();
    if (hasActiveAccess) {
      void first.refresh();
      void second.refresh();
    }
  };
  return (
    <SafeAreaView style={styles.screen} testID="screen-squad-compare">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={squad.loading} onRefresh={refresh} />}
      >
        <View style={styles.row}>
          <Pressable
            onPress={back}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel={t('squadDesign.back')}
            testID="compare-back"
          >
            <Ionicons name="chevron-back" size={homeLayout.iconSize} color={dark.textHi} />
          </Pressable>
          <View style={styles.flex}>
            <Text variant="bodyS">{t('tabs.room')}</Text>
            <Text variant="title1">{t('squadDesign.compare')}</Text>
          </View>
        </View>
        {squad.error ? (
          <View style={styles.card}>
            <Text accessibilityRole="alert">{t('common.errorBody')}</Text>
            <Button
              variant="secondary"
              label={t('common.retry')}
              onPress={refresh}
              testID="compare-retry"
            />
          </View>
        ) : squad.loading && !squad.data ? (
          <Text>{t('common.loading')}</Text>
        ) : !left || !right ? (
          <Text>{t('common.unavailable')}</Text>
        ) : (
          <>
            <PeopleSelector
              left={left}
              right={right}
              onChoose={(side) => {
                setLeftId(left.user_id);
                setRightId(right.user_id);
                setPicker(side);
              }}
            />
            <Text variant="bodyS">{t('squadDesign.ownGoals')}</Text>
            <View style={[styles.card, styles.columns]}>
              {[left, right].map((member, index) => (
                <View
                  key={member.user_id}
                  style={styles.column}
                  accessible
                  accessibilityLabel={
                    member.score == null
                      ? memberName(member) + ', ' + t('squadDesign.noGoals')
                      : t('squadDesign.scoreSummary', {
                          name: memberName(member),
                          score: member.score,
                        })
                  }
                >
                  <Text>{memberName(member)}</Text>
                  <Text variant="numeralL" tabular>
                    {member.score == null ? '—' : t('squadDesign.percent', { value: member.score })}
                  </Text>
                  <ProgressTrack
                    percent={member.score}
                    color={index === 0 ? dark.iris : dark.teal}
                  />
                </View>
              ))}
            </View>
            <View style={styles.card}>
              <Text variant="heading">{t('squadDesign.macros')}</Text>
              {(['calories', 'protein', 'carbs', 'fat'] as const).map((metric) => (
                <View key={metric} style={styles.metricGroup}>
                  <Text>{t(`squadDesign.${metric}`)}</Text>
                  <View style={styles.columns}>
                    <View style={styles.column}>
                      <MetricValue member={left} metric={metric} color={dark.iris} />
                    </View>
                    <View style={styles.column}>
                      <MetricValue member={right} metric={metric} color={dark.teal} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.card}>
              <Text variant="heading">{t('squadDesign.steps')}</Text>
              <View style={styles.columns}>
                <View style={styles.column}>
                  <MetricValue member={left} metric="steps" color={dark.iris} />
                </View>
                <View style={styles.column}>
                  <MetricValue member={right} metric="steps" color={dark.teal} />
                </View>
              </View>
            </View>
            {checkingPlan ? (
              <Text>{t('common.loading')}</Text>
            ) : !hasActiveAccess ? (
              <PlusDetailsCard onUpgrade={() => router.push('/paywall')} />
            ) : first.error || second.error ? (
              <View style={styles.card}>
                <Text accessibilityRole="alert">{t('common.errorBody')}</Text>
                <Button
                  variant="secondary"
                  label={t('common.retry')}
                  onPress={refresh}
                  testID="compare-details-retry"
                />
              </View>
            ) : (first.loading && !first.data) || (second.loading && !second.data) ? (
              <Text>{t('common.loading')}</Text>
            ) : first.data && second.data ? (
              <>
                <View style={styles.card}>
                  <Text variant="heading">{t('squadDesign.meals')}</Text>
                  {mealSections.map((section) => (
                    <View key={section} style={styles.metricGroup}>
                      <Text>{t(`diary.sections.${section}`)}</Text>
                      <View style={styles.columns}>
                        <View style={styles.column}>
                          <Text variant="label">{memberName(left)}</Text>
                          <MealContent
                            roomId={params.room}
                            memberId={left.is_self ? undefined : left.user_id}
                            meal={first.data!.meals.find((meal) => meal.section === section)}
                          />
                        </View>
                        <View style={styles.column}>
                          <Text variant="label">{memberName(right)}</Text>
                          <MealContent
                            roomId={params.room}
                            memberId={right.is_self ? undefined : right.user_id}
                            meal={second.data!.meals.find((meal) => meal.section === section)}
                          />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
                <View style={styles.card}>
                  <Text variant="heading">{t('squadDesign.workouts')}</Text>
                  <View style={styles.columns}>
                    <View style={styles.column}>
                      <Text variant="label">{memberName(left)}</Text>
                      <WorkoutContent workouts={first.data.workouts} />
                    </View>
                    <View style={styles.column}>
                      <Text variant="label">{memberName(right)}</Text>
                      <WorkoutContent workouts={second.data.workouts} />
                    </View>
                  </View>
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
      {picker && left && right && (
        <SquadMemberPicker
          visible
          members={members}
          excludedId={picker === 'left' ? right.user_id : left.user_id}
          selectedId={picker === 'left' ? left.user_id : right.user_id}
          onSelect={(id) => {
            if (picker === 'left') setLeftId(id);
            else setRightId(id);
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </SafeAreaView>
  );
}
