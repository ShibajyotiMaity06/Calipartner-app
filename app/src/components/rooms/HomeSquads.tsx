import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { dark, homeLayout, radius, space, Text } from '@calipartner/ui';
import { SquadDayPanel, SquadCheckInFeed } from './SquadDayPanel';
import type { RoomSummary } from '@/types/rooms';
import { t } from '@/i18n';

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
  const cardWidth = Math.min(homeLayout.cardWidth * Math.min(fontScale, 1.5), width - space[7]);
  const [selected, setSelected] = useState(0);
  const create = () => router.push({ pathname: '/(tabs)/room', params: { action: 'create' } });
  return (
    <View style={styles.stack} testID="home-squads">
      <View style={styles.header}>
        <Text variant="bodyS" color={dark.textMid}>
          {t('homeRefresh.squads')}
        </Text>
        <Pressable
          onPress={create}
          style={styles.smallAction}
          accessibilityRole="button"
          accessibilityLabel={t('homeRefresh.create')}
          testID="home-create-squad-top"
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
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + space[3]}
        decelerationRate="fast"
        onScroll={(event) =>
          setSelected(Math.round(event.nativeEvent.contentOffset.x / (cardWidth + space[3])))
        }
        scrollEventThrottle={100}
        contentContainerStyle={styles.cards}
        testID="home-squad-carousel"
      >
        {rooms.map((room, index) => (
          <View
            key={room.id}
            style={[styles.room, { width: cardWidth }]}
            testID={`home-squad-card-${room.id}`}
          >
            <Pressable
              onPress={() => router.push({ pathname: '/(tabs)/room', params: { room: room.id } })}
              accessibilityRole="button"
              accessibilityLabel={t('homeRefresh.openSquad', { name: room.name })}
              testID={`home-open-title-${room.id}`}
              style={styles.retry}
            >
              <Text variant="title1">{room.name}</Text>
            </Pressable>
            <Text variant="micro" color={dark.textMid}>
              {room.member_cap
                ? t('homeRefresh.members', { count: room.member_count, cap: room.member_cap })
                : t('repairs.squadMembers', { count: room.member_count })}
            </Text>
            {room.state === 'active' && room.member_count >= 2 ? (
              <SquadDayPanel
                roomId={room.id}
                name={room.name}
                memberCount={room.member_count}
                visible={visible && selected === index}
                showFeed={false}
                onOpen={() => router.push({ pathname: '/(tabs)/room', params: { room: room.id } })}
                onNudge={() =>
                  router.push({
                    pathname: '/(tabs)/room',
                    params: { room: room.id, action: 'nudge' },
                  })
                }
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
          style={[styles.createCard, { width: cardWidth }]}
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
      {rooms[selected]?.state === 'active' && (
        <SquadCheckInFeed
          roomId={rooms[selected]!.id}
          name={rooms[selected]!.name}
          visible={visible}
          onOpen={() =>
            router.push({ pathname: '/(tabs)/room', params: { room: rooms[selected]!.id } })
          }
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  stack: { gap: space[2] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  smallAction: {
    minWidth: homeLayout.touchSize,
    minHeight: homeLayout.touchSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cards: { gap: space[3], alignItems: 'flex-start' },
  room: { gap: space[2] },
  createCard: {
    padding: space[5],
    gap: space[3],
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: dark.hairlineLit,
    borderRadius: radius.card,
    minHeight: homeLayout.ringSize * 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: dark.s1,
  },
  retry: { minHeight: homeLayout.touchSize, justifyContent: 'center' },
});
