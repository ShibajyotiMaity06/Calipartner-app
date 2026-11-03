import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Button, dark, homeLayout, Text } from '@calipartner/ui';
import { useSquadToday, useSquadDetails } from '@/hooks/useSquad';
import { useSubscription } from '@/hooks/useSubscription';
import { t } from '@/i18n';
import {
  goalName,
  memberName,
  MemberDetailsContent,
  MemberMetrics,
  numberText,
  PlusDetailsCard,
  squadStyles as styles,
} from '@/components/rooms/SquadViews';

export default function SquadPersonScreen() {
  const params = useLocalSearchParams<{ room: string; member: string }>(),
    router = useRouter();
  const [visible, setVisible] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setVisible(true);
      return () => setVisible(false);
    }, []),
  );
  const { hasActiveAccess, loading: checkingPlan } = useSubscription();
  const squad = useSquadToday(params.room ?? null, visible);
  const person = squad.data?.members.find((member) => member.user_id === params.member);
  const details = useSquadDetails(
    params.room ?? null,
    person?.user_id ?? null,
    visible && hasActiveAccess,
  );
  const own = squad.data?.members.find((member) => member.is_self);
  const other = person?.is_self ? squad.data?.members.find((member) => !member.is_self) : own;
  const back = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/(tabs)/room', params: { room: params.room } });
  const refresh = () => {
    void squad.refresh();
    if (hasActiveAccess) void details.refresh();
  };
  return (
    <SafeAreaView style={styles.screen} testID="screen-squad-person">
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
            testID="person-back"
          >
            <Ionicons name="chevron-back" size={homeLayout.iconSize} color={dark.textHi} />
          </Pressable>
          <View style={styles.flex}>
            <Text variant="bodyS">{t('tabs.room')}</Text>
            <Text variant="title1">{person ? memberName(person) : t('common.loading')}</Text>
          </View>
        </View>
        {squad.error ? (
          <View style={styles.card}>
            <Text accessibilityRole="alert">{t('common.errorBody')}</Text>
            <Button
              variant="secondary"
              label={t('common.retry')}
              onPress={refresh}
              testID="person-retry"
            />
          </View>
        ) : squad.loading && !person ? (
          <Text>{t('common.loading')}</Text>
        ) : !person ? (
          <Text>{t('common.unavailable')}</Text>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.row}>
                <Avatar
                  name={memberName(person)}
                  uri={person.avatar_url ?? undefined}
                  size="lg"
                  identityHue={person.is_self ? 'iris' : 'teal'}
                />
                <View style={styles.flex}>
                  <Text variant="title1">{memberName(person)}</Text>
                  <Text>{goalName(person)}</Text>
                  <Text variant="bodyS">{person.local_date}</Text>
                </View>
              </View>
              {other && (
                <Button
                  variant={hasActiveAccess ? 'primary' : 'secondary'}
                  label={t(person.is_self ? 'squadDesign.compare' : 'squadDesign.compareYou')}
                  onPress={() =>
                    router.push(
                      ('/squad/compare?room=' +
                        encodeURIComponent(params.room) +
                        '&left=' +
                        encodeURIComponent(own?.user_id ?? other.user_id) +
                        '&right=' +
                        encodeURIComponent(
                          person.is_self ? other.user_id : person.user_id,
                        )) as Href,
                    )
                  }
                  testID="person-compare"
                />
              )}
            </View>
            <MemberMetrics member={person} />
            {checkingPlan ? (
              <Text>{t('common.loading')}</Text>
            ) : !hasActiveAccess ? (
              <PlusDetailsCard onUpgrade={() => router.push('/paywall')} />
            ) : details.error ? (
              <View style={styles.card}>
                <Text accessibilityRole="alert">{t('common.errorBody')}</Text>
                <Button
                  variant="secondary"
                  label={t('common.retry')}
                  onPress={() => void details.refresh()}
                  testID="person-details-retry"
                />
              </View>
            ) : details.loading && !details.data ? (
              <Text>{t('common.loading')}</Text>
            ) : details.data ? (
              <MemberDetailsContent details={details.data} />
            ) : null}
            <View style={styles.card}>
              <View style={styles.row}>
                {person.height_cm == null && (
                  <Ionicons
                    name="lock-closed-outline"
                    size={homeLayout.iconSize}
                    color={dark.textMid}
                  />
                )}
                <Text>
                  {person.height_cm == null
                    ? t('squadDesign.hiddenHeight')
                    : t('squadDesign.height', { value: numberText(person.height_cm) })}
                </Text>
              </View>
              <View style={styles.row}>
                {person.weight_kg == null && (
                  <Ionicons
                    name="lock-closed-outline"
                    size={homeLayout.iconSize}
                    color={dark.textMid}
                  />
                )}
                <Text>
                  {person.weight_kg == null
                    ? t('squadDesign.hiddenWeight')
                    : t('squadDesign.weight', { value: numberText(person.weight_kg) })}
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
