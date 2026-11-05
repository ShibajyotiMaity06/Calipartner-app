import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Avatar, Button, dark, homeLayout, radius, space, Sheet, Text } from '@calipartner/ui';
import { Ionicons } from '@expo/vector-icons';
import { setStringAsync } from 'expo-clipboard';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { t } from '@/i18n';
import type { RoomSummary } from '@/types/rooms';
import { squadStyles as styles } from './SquadViews';
export type RoomSegment = 'today' | 'chat' | 'progress' | 'members';
export interface RoomHeaderProps {
  currentRoom: RoomSummary | null;
  allRooms: RoomSummary[];
  pendingRequestsCount: number;
  streakDays?: number;
  activeSegment: RoomSegment;
  chatUnreadCount?: number;
  showMembers?: boolean;
  isWaiting?: boolean;
  onSelectSegment: (segment: RoomSegment) => void;
  onOpenInbox: () => void;
  onOpenSettings: () => void;
  onOpenPrivacy: () => void;
  onSwitchRoom?: (room: RoomSummary) => void;
  onCreateOrJoin?: () => void;
}
export function RoomHeader({
  currentRoom,
  allRooms,
  pendingRequestsCount,
  activeSegment,
  chatUnreadCount = 0,
  onSelectSegment,
  onOpenInbox,
  onOpenSettings,
  onOpenPrivacy,
  onSwitchRoom,
  onCreateOrJoin,
}: RoomHeaderProps) {
  const [panel, setPanel] = useState<'rooms' | 'actions' | null>(null),
    [copied, setCopied] = useState(false),
    [error, setError] = useState(false);
  useBrowserModalBack(panel !== null, () => setPanel(null));
  useEffect(() => {
    setCopied(false);
    setError(false);
    setPanel(null);
  }, [currentRoom?.id]);
  const closeThen = (action: () => void) => {
    setPanel(null);
    action();
  };
  const copy = async () => {
    if (!currentRoom) return;
    try {
      setError(false);
      if (!(await setStringAsync(currentRoom.code))) throw new Error();
      setCopied(true);
    } catch {
      setError(true);
    }
  };
  return (
    <View style={[styles.stack, { padding: homeLayout.iconSize }]}>
      <View style={styles.spread}>
        <Pressable
          onPress={() => setPanel('rooms')}
          accessibilityRole="button"
          accessibilityLabel={currentRoom?.name ?? t('tabs.room')}
          testID="btn-room-title-switcher"
          style={[styles.flex, styles.touch]}
        >
          <Text variant="title1">
            {currentRoom?.name ?? t('tabs.room')}{' '}
            <Ionicons name="chevron-down" size={homeLayout.iconSize} color={dark.textMid} />
          </Text>
        </Pressable>
        {currentRoom && (
          <Text variant="micro" tabular style={{ flexShrink: 1, textAlign: 'right' }}>
            {currentRoom.member_cap
              ? t('homeRefresh.members', {
                  count: currentRoom.member_count,
                  cap: currentRoom.member_cap,
                })
              : t('squadDesign.members', { count: currentRoom.member_count })}
          </Text>
        )}
        <Pressable
          onPress={() => setPanel('actions')}
          accessibilityRole="button"
          accessibilityLabel={t('squadDesign.actions')}
          style={styles.back}
          testID="btn-room-options"
        >
          <Ionicons name="options-outline" size={homeLayout.iconSize} color={dark.textHi} />
          {pendingRequestsCount > 0 && (
            <Text variant="micro" tabular>
              {pendingRequestsCount}
            </Text>
          )}
        </Pressable>
      </View>
      {currentRoom && (
        <View style={styles.row}>
          <Pressable
            onPress={() => void copy()}
            accessibilityRole="button"
            accessibilityLabel={t('squadDesign.code', { code: currentRoom.code })}
            style={styles.touch}
            testID="btn-copy-room-code"
          >
            <Text variant="bodyS">
              {t('squadDesign.code', { code: currentRoom.code })}
              {copied ? ' \u2713' : ''}
            </Text>
          </Pressable>
        </View>
      )}
      {error && <Text accessibilityRole="alert">{t('roomAudit.actionError')}</Text>}
      {currentRoom && (
        <View
          style={[
            styles.row,
            { backgroundColor: dark.s2, borderRadius: radius.control, padding: space[1] },
          ]}
          accessibilityRole="tablist"
        >
          {(
            [
              ['today', 'squadDesign.overview'],
              ['progress', 'squadDesign.leaderboard'],
              ['chat', 'squadDesign.chat'],
            ] as const
          ).map(([segment, label]) => (
            <Pressable
              key={segment}
              onPress={() => onSelectSegment(segment)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeSegment === segment }}
              aria-selected={activeSegment === segment}
              testID={'room-tab-' + segment}
              style={{
                flex: 1,
                minHeight: homeLayout.touchSize,
                borderRadius: radius.full,
                padding: space[2],
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: activeSegment === segment ? dark.s3 : 'transparent',
              }}
            >
              <Text
                variant="bodyS"
                color={activeSegment === segment ? dark.selection : dark.textMid}
              >
                {t(label) +
                  (segment === 'chat' && chatUnreadCount > 0 ? ' (' + chatUnreadCount + ')' : '')}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <Sheet
        visible={panel !== null}
        onClose={() => setPanel(null)}
        snapPoint="tall"
        accessibilityLabel={t('squadDesign.actions')}
        testID="room-options-sheet"
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Button
            variant="secondary"
            size="sm"
            fullWidth={false}
            label={t('squadDesign.close')}
            onPress={() => setPanel(null)}
          />
          {panel === 'rooms' ? (
            <>
              {allRooms.map((room) => (
                <Pressable
                  key={room.id}
                  onPress={() => closeThen(() => onSwitchRoom?.(room))}
                  style={styles.leader}
                  accessibilityRole="button"
                  accessibilityLabel={room.name}
                  testID={'btn-switch-room-' + room.id}
                >
                  <Avatar name={room.name} size="sm" />
                  <View style={styles.flex}>
                    <Text variant="heading">{room.name}</Text>
                    <Text>{t('squadDesign.members', { count: room.member_count })}</Text>
                  </View>
                </Pressable>
              ))}
              <Button
                variant="secondary"
                label={t('homeRefresh.create')}
                onPress={() => closeThen(() => onCreateOrJoin?.())}
                testID="btn-switcher-create-room"
              />
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                label={t('rooms.inboxModal.title') + ' (' + pendingRequestsCount + ')'}
                onPress={() => closeThen(onOpenInbox)}
                testID="btn-room-inbox"
              />
              {currentRoom && (
                <>
                  <Button
                    variant="secondary"
                    label={t('rooms.settingsModal.title')}
                    onPress={() => closeThen(onOpenSettings)}
                    testID="btn-room-settings"
                  />
                  <Button
                    variant="secondary"
                    label={t('rooms.privacyModal.title')}
                    onPress={() => closeThen(onOpenPrivacy)}
                    testID="btn-room-privacy"
                  />
                </>
              )}
              <Button
                variant="secondary"
                label={t('homeRefresh.create')}
                onPress={() => closeThen(() => onCreateOrJoin?.())}
                testID="btn-room-create"
              />
            </>
          )}
        </ScrollView>
      </Sheet>
    </View>
  );
}
