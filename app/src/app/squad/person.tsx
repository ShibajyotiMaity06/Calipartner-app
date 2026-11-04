import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, dark, homeLayout, Text } from '@calipartner/ui';
import { useSquadToday } from '@/hooks/useSquad';
import { SquadPersonPanel } from '@/components/rooms/SquadPersonPanel';
import { t } from '@/i18n';
import { memberName, squadStyles as styles } from '@/components/rooms/SquadViews';

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
  const squad = useSquadToday(params.room ?? null, visible);
  const person = squad.data?.members.find((member) => member.user_id === params.member);
  const back = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/(tabs)/room', params: { room: params.room } });
  const refresh = () => {
    void squad.refresh();
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
            <SquadPersonPanel
              roomId={params.room}
              person={person}
              members={squad.data?.members ?? []}
              visible={visible}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
