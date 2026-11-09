import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { dark, homeLayout, radius, space, Text } from '@calipartner/ui';
import { HomeSquadLeaderboard } from './HomeSquadLeaderboard';
import type { RoomSummary } from '@/types/rooms';
import { t } from '@/i18n';
import { EditSquadName } from './EditSquadName';

export function HomeSquads({
  rooms,
  loading,
  error,
  onRetry,
  visible,
}: {
  rooms: RoomSummary[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  visible: boolean;
}) {
  const router = useRouter();
  const { width, fontScale } = useWindowDimensions();
  const cardWidth =
    rooms.length === 0
      ? undefined
      : Math.min(homeLayout.cardWidth * Math.min(fontScale, 1.5), width - space[7]);
  const [selected, setSelected] = useState(0);
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({});
  const selectedKey = rooms[selected]?.id ?? 'create';
  const cardHeight = cardHeights[selectedKey] ?? homeLayout.ringSize * 2;
  useEffect(() => setCardHeights({}), [width, fontScale]);
  const measureCard = (key: string, event: { nativeEvent: { layout: { height: number } } }) => {
    const height = Math.ceil(event.nativeEvent.layout.height);
    setCardHeights((previous) =>
      previous[key] === height ? previous : { ...previous, [key]: height },
    );
  };
  const create = () =>
    router.push({ pathname: '/(tabs)/room', params: { action: 'create', returnTo: 'home' } });
  return (
    <View style={styles.stack} testID="home-squads">
      <View style={styles.header}>
        <Text variant="bodyS" color={dark.textMid}>
          {t('homeRefresh.squads')}
        </Text>
        <Pressable
          onPress={() => router.push('/friends' as Href)}
          style={styles.smallAction}
          accessibilityRole="button"
          accessibilityLabel={t('socialUpdate.addFriends')}
          testID="home-open-friends"
        >
          <Ionicons name="person-add-outline" size={homeLayout.iconSize} color={dark.textMid} />
        </Pressable>
      </View>
      {loading && !rooms.length ? <Text>{t('common.loading')}</Text> : null}
      {error ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          testID="home-squad-retry"
          style={styles.retry}
        >
          <Text>
            {t('repairs.squadError')} · {t('common.retry')}
          </Text>
        </Pressable>
      ) : null}
      <ScrollView
        style={rooms.length ? { height: cardHeight } : undefined}
        horizontal={rooms.length > 0}
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth ? cardWidth + space[3] : undefined}
        decelerationRate="fast"
        onScroll={(event) =>
          setSelected(
            cardWidth ? Math.round(event.nativeEvent.contentOffset.x / (cardWidth + space[3])) : 0,
          )
        }
        scrollEventThrottle={100}
        contentContainerStyle={styles.cards}
        testID="home-squad-carousel"
      >
        {rooms.map((room, index) => (
          <View
            key={room.id}
            style={[styles.room, { width: cardWidth }]}
            onLayout={(event) => measureCard(room.id, event)}
            testID={`home-squad-card-${room.id}`}
          >
            <View style={styles.header}>
              <View style={styles.nameGroup}>
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/(tabs)/room', params: { room: room.id } })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t('homeRefresh.openSquad', { name: room.name })}
                  testID={`home-open-title-${room.id}`}
                  style={[styles.retry, styles.name]}
                >
                  <Text variant="title2">{room.name}</Text>
                </Pressable>
                <EditSquadName room={room} location="home" />
              </View>
              <Text variant="micro" color={dark.textMid} style={styles.count} tabular>
                {room.member_cap
                  ? t('homeRefresh.members', { count: room.member_count, cap: room.member_cap })
                  : t('repairs.squadMembers', { count: room.member_count })}
              </Text>
            </View>
            {room.state === 'active' && room.member_count >= 2 ? (
              <HomeSquadLeaderboard
                roomId={room.id}
                memberCount={room.member_count}
                visible={visible && selected === index}
              />
            ) : (
              <Pressable
                onPress={() => router.push({ pathname: '/(tabs)/room', params: { room: room.id } })}
                style={styles.retry}
                accessibilityRole="button"
                accessibilityLabel={t('homeRefresh.openSquad', { name: room.name })}
              >
                <Text color={dark.textMid}>
                  {room.state === 'dormant'
                    ? t('repairs.squadEmpty')
                    : t('homeRefresh.openSquad', { name: room.name })}
                </Text>
              </Pressable>
            )}
          </View>
        ))}
        <Pressable
          onPress={create}
          style={[styles.createCard, { width: cardWidth ?? '100%', minHeight: cardHeight }]}
          onLayout={(event) => measureCard('create', event)}
          accessibilityRole="button"
          accessibilityLabel={t('homeRefresh.create')}
          testID="home-create-squad-end"
        >
          <Ionicons name="add-circle-outline" size={space[8]} color={dark.textMid} />
          <Text variant="heading">{t('homeRefresh.create')}</Text>
          <Text variant="bodyS" color={dark.textMid}>
            {t('homeRefresh.createHint')}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  stack: { gap: space[2], marginBottom: space[5] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nameGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: space[2],
  },
  name: { flexShrink: 1, minWidth: 0 },
  count: { flexShrink: 1, textAlign: 'right' },
  smallAction: {
    minWidth: homeLayout.touchSize,
    minHeight: homeLayout.touchSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cards: { gap: space[3], alignItems: 'flex-start' },
  room: {
    gap: space[1],
    padding: space[3],
    backgroundColor: dark.s1,
    borderWidth: 2,
    borderColor: dark.copper,
    borderRadius: radius.card,
  },
  createCard: {
    padding: space[5],
    gap: space[3],
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: dark.copper,
    borderRadius: radius.card,
    minHeight: homeLayout.ringSize * 2,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: dark.s1,
  },
  retry: { minHeight: homeLayout.touchSize, justifyContent: 'center' },
});
