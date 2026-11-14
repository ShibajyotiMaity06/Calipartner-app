import { useTheme as useAppearance } from '@calipartner/ui/theme';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Avatar, Button, homeLayout, Sheet, Text, SegmentedControl, space } from '@calipartner/ui';
import { Ionicons } from '@expo/vector-icons';
import { setStringAsync } from 'expo-clipboard';
import { closeBrowserModalsThen, useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { t } from '@/i18n';
import type { RoomSummary } from '@/types/rooms';
import { useSquadStyles } from './SquadViews';
import { EditSquadName } from './EditSquadName';
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
  onBack?: () => void;
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
  onBack,
  onSwitchRoom,
  onCreateOrJoin,
}: RoomHeaderProps) {
  const styles = useSquadStyles();

  const { colors: dark } = useAppearance();

  const [panel, setPanel] = useState<'rooms' | 'actions' | null>(null),
    [copied, setCopied] = useState(false),
    [error, setError] = useState(false);
  useBrowserModalBack(panel !== null, () => setPanel(null));
  useEffect(() => {
    setCopied(false);
    setError(false);
    setPanel(null);
  }, [currentRoom?.id]);
  const closeThen = (action: () => void, switchingRoom = false) => {
    setPanel(null);
    if (switchingRoom) closeBrowserModalsThen(action);
    else action();
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
  if (activeSegment === 'chat')
    return (
      <View style={[styles.row, { padding: homeLayout.iconSize }]} testID="squad-chat-header">
        {onBack && (
          <Button
            variant="tertiary"
            label={t('friends.back')}
            onPress={onBack}
            testID="squad-chat-back"
            fullWidth={false}
          />
        )}
        <Text variant="title2" style={styles.flex}>
          {currentRoom?.name ?? t('tabs.room')}
        </Text>
        <Pressable
          onPress={onOpenSettings}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel={t('rooms.settingsModal.title')}
          testID="btn-room-settings"
        >
          <Ionicons name="settings-outline" size={homeLayout.iconSize} color={dark.textHi} />
        </Pressable>
      </View>
    );
  return (
    <View style={[styles.stack, { padding: homeLayout.iconSize }]}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space[2],
        }}
      >
        <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[1],
            }}
          >
            <Pressable
              onPress={() => setPanel('rooms')}
              accessibilityRole="button"
              accessibilityLabel={currentRoom?.name ?? t('tabs.room')}
              testID="btn-room-title-switcher"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[1],
                flexShrink: 1,
                minHeight: homeLayout.touchSize,
              }}
            >
              <Text variant="title1" numberOfLines={1} style={{ flexShrink: 1 }}>
                {currentRoom?.name ?? t('tabs.room')}
              </Text>
              <Ionicons name="chevron-down" size={18} color={dark.textMid} />
            </Pressable>
            {currentRoom && activeSegment === 'today' && (
              <EditSquadName room={currentRoom} location="squad" />
            )}
          </View>
          {currentRoom && (
            <Text variant="micro" tabular color={dark.textMid} style={{ marginTop: -space[1] }}>
              {currentRoom.member_cap
                ? t('homeRefresh.members', {
                    count: currentRoom.member_count,
                    cap: currentRoom.member_cap,
                  })
                : t('squadDesign.members', { count: currentRoom.member_count })}
            </Text>
          )}
        </View>
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
        <SegmentedControl
          options={[
            { value: 'today', label: t('squadDesign.overview') },
            { value: 'progress', label: t('squadDesign.leaderboard') },
            {
              value: 'chat',
              label: t('squadDesign.chat'),
              badge: chatUnreadCount > 0 ? chatUnreadCount : undefined,
            },
          ]}
          value={activeSegment}
          onChange={onSelectSegment}
          testID="room-tab"
        />
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
                  onPress={() => closeThen(() => onSwitchRoom?.(room), true)}
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
