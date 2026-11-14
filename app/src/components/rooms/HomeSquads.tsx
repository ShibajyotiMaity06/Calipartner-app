import { useTheme as useAppearance } from '@calipartner/ui/theme';
import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { homeLayout, radius, space, Text } from '@calipartner/ui';
import { HomeSquadLeaderboard } from './HomeSquadLeaderboard';
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
  const { colors: dark } = useAppearance();
  const styles = createStyles(dark);

  const router = useRouter();
  const { width, fontScale } = useWindowDimensions();
  const cardWidth =
    rooms.length === 0
      ? undefined
      : Math.min(homeLayout.cardWidth * Math.min(fontScale, 1.5), width - space[7]);
  const [selected, setSelected] = useState(0);
  const carousel = useRef<ScrollView>(null);
  const gestureStart = useRef(0);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const step = cardWidth ? cardWidth + space[3] : 1;
  const settle = (x: number) => {
    const next = Math.max(
      0,
      Math.min(
        rooms.length,
        Math.max(
          gestureStart.current - 1,
          Math.min(gestureStart.current + 1, Math.round(x / step)),
        ),
      ),
    );
    setSelected(next);
    carousel.current?.scrollTo({ x: next * step, animated: false });
  };
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    type Wheel = { deltaX: number; deltaY: number; preventDefault: () => void };
    const node = carousel.current?.getScrollableNode() as
      | {
          addEventListener?: (
            name: string,
            handler: (event: Wheel) => void,
            options: { passive: boolean },
          ) => void;
          removeEventListener?: (name: string, handler: (event: Wheel) => void) => void;
        }
      | undefined;
    let active = false;
    let timer: ReturnType<typeof setTimeout>;
    const wheel = (event: Wheel) => {
      if (!event.deltaX || Math.abs(event.deltaY) > Math.abs(event.deltaX)) return;
      event.preventDefault();
      if (!active) {
        gestureStart.current = selectedRef.current;
        active = true;
      }
      const next = Math.max(
        0,
        Math.min(rooms.length, gestureStart.current + Math.sign(event.deltaX)),
      );
      setSelected(next);
      carousel.current?.scrollTo({ x: next * step, animated: false });
      clearTimeout(timer);
      timer = setTimeout(() => {
        active = false;
      }, 250);
    };
    node?.addEventListener?.('wheel', wheel, { passive: false });
    return () => {
      clearTimeout(timer);
      node?.removeEventListener?.('wheel', wheel);
    };
  }, [step, rooms.length]);
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
        ref={carousel}
        disableIntervalMomentum
        onTouchStart={() => {
          gestureStart.current = selected;
        }}
        onScrollBeginDrag={() => {
          gestureStart.current = selected;
        }}
        onScrollEndDrag={(event) => settle(event.nativeEvent.contentOffset.x)}
        onMomentumScrollEnd={(event) => settle(event.nativeEvent.contentOffset.x)}
        style={rooms.length ? { height: cardHeight } : undefined}
        horizontal={rooms.length > 0}
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth ? cardWidth + space[3] : undefined}
        decelerationRate="fast"
        onScroll={(event) => {
          const x = event.nativeEvent.contentOffset.x;
          const lower = Math.max(0, gestureStart.current - 1) * step;
          const upper = Math.min(rooms.length, gestureStart.current + 1) * step;
          const clamped = Math.max(lower, Math.min(upper, x));
          if (x !== clamped) carousel.current?.scrollTo({ x: clamped, animated: false });
          setSelected(Math.round(clamped / step));
        }}
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
const createStyles = (dark: ReturnType<typeof useAppearance>['colors']) =>
  StyleSheet.create({
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
