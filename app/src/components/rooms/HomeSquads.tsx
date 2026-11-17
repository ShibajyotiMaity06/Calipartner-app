import { Button } from '@calipartner/ui';
import { useTheme as useAppearance } from '@calipartner/ui/theme';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  Animated,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { homeLayout, radius, space, Text, motion } from '@calipartner/ui';
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
  const { colors: dark, reduceMotion } = useAppearance();
  const styles = createStyles(dark);

  const router = useRouter();
  const { width, fontScale } = useWindowDimensions();
  const cardWidth =
    rooms.length === 0
      ? undefined
      : Math.min(homeLayout.cardWidth * Math.min(fontScale, 1.5), width - space[7]);
  const [selected, setSelected] = useState(0);
  const carousel = useRef<View>(null);
  const offset = useRef(new Animated.Value(0)).current;
  const selectedRef = useRef(0);
  const gestureStart = useRef(0);
  const step = cardWidth ? cardWidth + space[3] : 1;
  const moveTo = useCallback(
    (index: number) => {
      const next = Math.max(0, Math.min(rooms.length, index));
      selectedRef.current = next;
      setSelected(next);
      Animated.timing(offset, {
        toValue: -next * step,
        duration: reduceMotion ? 0 : motion.base.duration,
        useNativeDriver: true,
      }).start();
    },
    [rooms.length, offset, reduceMotion, step],
  );
  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > space[2] && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderGrant: () => {
      offset.stopAnimation();
      gestureStart.current = selectedRef.current;
    },
    onPanResponderMove: (_, g) => {
      const from = gestureStart.current;
      const delta = Math.max(
        from === rooms.length ? 0 : -step,
        Math.min(from === 0 ? 0 : step, g.dx),
      );
      offset.setValue(-from * step + delta);
    },
    onPanResponderRelease: (_, g) =>
      moveTo(
        gestureStart.current +
          (Math.abs(g.dx) > step / 4 || Math.abs(g.vx) > 0.5 ? (g.dx < 0 ? 1 : -1) : 0),
      ),
    onPanResponderTerminate: () => moveTo(gestureStart.current),
  });
  useEffect(() => {
    const next = Math.min(selectedRef.current, rooms.length);
    selectedRef.current = next;
    setSelected(next);
    offset.setValue(-next * step);
  }, [step, rooms.length, offset]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    type Wheel = { deltaX: number; deltaY: number; preventDefault: () => void };
    const node = carousel.current as unknown as {
      addEventListener?: (
        name: string,
        fn: (event: Wheel) => void,
        options: { passive: boolean },
      ) => void;
      removeEventListener?: (name: string, fn: (event: Wheel) => void) => void;
    } | null;
    let active = false;
    let timer: ReturnType<typeof setTimeout>;
    const wheel = (event: Wheel) => {
      if (!event.deltaX || Math.abs(event.deltaY) > Math.abs(event.deltaX)) return;
      event.preventDefault();
      if (!active) {
        moveTo(selectedRef.current + Math.sign(event.deltaX));
        active = true;
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        active = false;
      }, motion.base.duration);
    };
    node?.addEventListener?.('wheel', wheel, { passive: false });
    return () => {
      clearTimeout(timer);
      node?.removeEventListener?.('wheel', wheel);
    };
  }, [moveTo]);
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
        <Button
          variant="tertiary"
          fullWidth={false}
          label={t('socialUpdate.addFriends')}
          iconOnly
          icon={
            <Ionicons name="person-add-outline" size={homeLayout.iconSize} color={dark.textMid} />
          }
          onPress={() => router.push('/friends' as Href)}
          style={styles.smallAction}
          accessibilityRole="button"
          accessibilityLabel={t('socialUpdate.addFriends')}
          testID="home-open-friends"
        />
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
      <View
        ref={carousel}
        {...pan.panHandlers}
        style={{ overflow: 'hidden', height: cardHeight }}
        testID="home-squad-carousel"
        accessibilityRole="adjustable"
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) =>
          moveTo(selectedRef.current + (event.nativeEvent.actionName === 'increment' ? 1 : -1))
        }
      >
        <Animated.View
          style={[styles.cards, { flexDirection: 'row', transform: [{ translateX: offset }] }]}
        >
          {rooms.map((room, index) => (
            <Pressable
              key={room.id}
              onPress={() => router.push({ pathname: '/(tabs)/room', params: { room: room.id } })}
              accessibilityRole="button"
              accessibilityLabel={t('homeRefresh.openSquad', { name: room.name })}
              accessibilityElementsHidden={selected !== index}
              importantForAccessibility={selected === index ? 'auto' : 'no-hide-descendants'}
              style={[styles.room, { width: cardWidth, flexShrink: 0 }]}
              onLayout={(event) => measureCard(room.id, event)}
              testID={`home-squad-card-${room.id}`}
            >
              <View style={styles.header}>
                <View style={styles.nameGroup}>
                  <Text variant="heading" testID={`home-open-title-${room.id}`} style={styles.name}>
                    {room.name}
                  </Text>
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
                <Text>
                  {room.state === 'dormant'
                    ? t('repairs.squadEmpty')
                    : t('homeRefresh.openSquad', { name: room.name })}
                </Text>
              )}
            </Pressable>
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
        </Animated.View>
      </View>
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
