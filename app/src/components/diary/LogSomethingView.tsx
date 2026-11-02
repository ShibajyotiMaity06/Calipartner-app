import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dark, homeLayout, radius, space, Text } from '@calipartner/ui';
import { useRooms } from '@/hooks/useRooms';
import { useSquadDay } from '@/hooks/useSquadDay';
import { CheckInModal } from '@/components/rooms/SquadDayPanel';
import { t } from '@/i18n';
import type { homeRefresh } from '@/i18n/homeRefresh';

export type LogFlow =
  'food' | 'scan' | 'workout' | 'water' | 'weight' | 'fast' | 'photo' | 'recipe' | 'describe';
export function LogSomethingView({
  onFlow,
  onClose,
}: {
  onFlow: (flow: LogFlow) => void;
  onClose: () => void;
}) {
  const { rooms, loading, error, refresh } = useRooms();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const room =
    rooms.find((item) => item.id === roomId) ?? rooms.find((item) => item.state === 'active');
  const day = useSquadDay(room?.id ?? null);
  const entries: {
    flow: LogFlow;
    label: keyof typeof homeRefresh;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { flow: 'food', label: 'food', icon: 'restaurant-outline' },
    { flow: 'scan', label: 'barcode', icon: 'barcode-outline' },
    { flow: 'workout', label: 'workout', icon: 'barbell-outline' },
    { flow: 'water', label: 'water', icon: 'water-outline' },
    { flow: 'weight', label: 'weight', icon: 'scale-outline' },
    { flow: 'fast', label: 'fasting', icon: 'timer-outline' },
    { flow: 'recipe', label: 'recipes', icon: 'book-outline' },
  ];
  return (
    <ScrollView contentContainerStyle={styles.content} testID="log-hub-view">
      <View style={styles.header}>
        <Text variant="title1">{t('homeRefresh.activity')}</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('homeRefresh.close')}
          style={styles.iconButton}
          testID="log-hub-close"
        >
          <Ionicons name="close" size={homeLayout.iconSize} color={dark.textMid} />
        </Pressable>
      </View>
      <Text variant="bodyS" color={dark.textMid}>
        {t('homeRefresh.activityHint')}
      </Text>
      {loading && <Text variant="bodyS">{t('common.loading')}</Text>}
      {error && (
        <Pressable
          onPress={() => void refresh()}
          accessibilityRole="button"
          testID="log-squads-retry"
          style={styles.iconButton}
        >
          <Text>{t('common.retry')}</Text>
        </Pressable>
      )}
      {rooms.some((item) => item.state === 'active') && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.choices}
        >
          {rooms
            .filter((item) => item.state === 'active')
            .map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setRoomId(item.id)}
                style={styles.choice}
                accessibilityRole="radio"
                accessibilityState={{ selected: room?.id === item.id }}
                testID={`log-squad-${item.id}`}
              >
                <Text color={room?.id === item.id ? dark.textHi : dark.textMid}>{item.name}</Text>
              </Pressable>
            ))}
        </ScrollView>
      )}
      {room && room.state === 'active' && (
        <Pressable
          style={styles.checkIn}
          onPress={() => setChecking(true)}
          disabled={day.members.some((member) => member.is_self && member.checked_in)}
          accessibilityRole="button"
          accessibilityLabel={t('homeRefresh.checkInFor', { name: room.name })}
          testID="log-quick-check-in"
        >
          <Text color={dark.onBrand} variant="heading">
            {t(
              day.members.some((member) => member.is_self && member.checked_in)
                ? 'homeRefresh.checkedToday'
                : 'homeRefresh.checkIn',
            )}
          </Text>
          <Text color={dark.onBrand} variant="bodyS">
            {t('homeRefresh.checkInFor', { name: room.name })}
          </Text>
        </Pressable>
      )}
      <View style={styles.grid}>
        {entries.map(({ flow, label, icon }) => (
          <Pressable
            key={flow}
            onPress={() => onFlow(flow)}
            style={styles.tile}
            accessibilityRole="button"
            accessibilityLabel={t(`homeRefresh.${label}`)}
            testID={`log-tile-${flow}`}
          >
            <View style={styles.tileIcon}>
              <Ionicons name={icon} size={homeLayout.iconSize} color={dark.copper} />
            </View>
            <Text variant="bodyS">{t(`homeRefresh.${label}`)}</Text>
          </Pressable>
        ))}
      </View>
      <Text variant="bodyS" color={dark.textMid}>
        {t('homeRefresh.aiShortcuts')}
      </Text>
      <View style={styles.shortcuts}>
        {(['photo', 'describe'] as const).map((flow) => (
          <Pressable
            key={flow}
            onPress={() => onFlow(flow)}
            style={styles.shortcut}
            accessibilityRole="button"
            accessibilityLabel={t(flow === 'photo' ? 'homeRefresh.snap' : 'homeRefresh.describe')}
            testID={`log-${flow}`}
          >
            <Ionicons
              name={flow === 'photo' ? 'camera-outline' : 'chatbubble-outline'}
              size={homeLayout.iconSize}
              color={dark.copper}
            />
            <Text variant="bodyS">
              {t(flow === 'photo' ? 'homeRefresh.snap' : 'homeRefresh.describe')}
            </Text>
          </Pressable>
        ))}
      </View>
      {checking && room && (
        <CheckInModal
          roomId={room.id}
          name={room.name}
          count={
            day.error || !day.members.length
              ? undefined
              : day.members.filter((member) => member.checked_in).length
          }
          total={room.member_count}
          onClose={() => setChecking(false)}
          onSaved={() => {
            setChecking(false);
            void day.refresh();
          }}
        />
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  content: { gap: space[3], padding: space[3], paddingBottom: space[7] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  iconButton: {
    minWidth: homeLayout.touchSize,
    minHeight: homeLayout.touchSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choices: { gap: space[2] },
  choice: {
    padding: space[3],
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    minHeight: homeLayout.touchSize,
  },
  checkIn: {
    backgroundColor: dark.apricot,
    borderRadius: radius.button,
    padding: space[4],
    gap: space[1],
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  tile: {
    width: '21%',
    minWidth: space[9],
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[3],
  },
  tileIcon: {
    width: homeLayout.touchSize,
    height: homeLayout.touchSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: dark.s2,
  },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  shortcut: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[2],
    padding: space[3],
    minHeight: homeLayout.touchSize,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.button,
  },
});
