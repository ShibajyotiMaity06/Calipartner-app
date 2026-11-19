import { HeaderActions } from '@/components/HeaderActions';
import { useTheme as useAppearance } from '@calipartner/ui/theme';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  homeLayout,
  radius,
  Sheet,
  Text,
  SegmentedControl,
  space,
} from '@calipartner/ui';
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
    [roomsDropdownOpen, setRoomsDropdownOpen] = useState(false),
    [copied, setCopied] = useState(false),
    [error, setError] = useState(false);
  useBrowserModalBack(panel !== null || roomsDropdownOpen, () => {
    setPanel(null);
    setRoomsDropdownOpen(false);
  });
  useEffect(() => {
    setCopied(false);
    setError(false);
    setPanel(null);
    setRoomsDropdownOpen(false);
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
        <Button
          variant="tertiary"
          fullWidth={false}
          label={t('rooms.settingsModal.title')}
          iconOnly
          icon={<Ionicons name="settings-outline" size={homeLayout.iconSize} color={dark.textHi} />}
          onPress={onOpenSettings}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel={t('rooms.settingsModal.title')}
          testID="btn-room-settings"
        />
      </View>
    );
  return (
    <View
      style={[styles.stack, { padding: homeLayout.iconSize, position: 'relative', zIndex: 1000 }]}
    >
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
              onPress={() => setRoomsDropdownOpen((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={currentRoom?.name ?? t('tabs.room')}
              accessibilityState={{ expanded: roomsDropdownOpen }}
              testID="btn-room-title-switcher"
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[1],
                flexShrink: 1,
                minHeight: homeLayout.touchSize,
                paddingVertical: space[1],
                paddingHorizontal: space[1],
                borderRadius: radius.control,
                backgroundColor: pressed ? dark.s2 : 'transparent',
              })}
            >
              <Text
                variant="title2"
                numberOfLines={1}
                color={dark.textHi}
                style={{ flexShrink: 1 }}
              >
                {currentRoom?.name ?? t('tabs.room')}
              </Text>
              <Ionicons
                name={roomsDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={dark.textMid}
              />
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
        <HeaderActions />
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
      {roomsDropdownOpen && (
        <View
          testID="room-switcher-dropdown"
          style={{
            position: 'absolute',
            top: homeLayout.iconSize + homeLayout.touchSize + space[2],
            left: homeLayout.iconSize,
            right: homeLayout.iconSize,
            zIndex: 1000,
            backgroundColor: dark.s2,
            borderColor: dark.hairline,
            borderWidth: StyleSheet.hairlineWidth,
            borderRadius: radius.control,
            overflow: 'hidden',
            maxHeight: homeLayout.touchSize * 6,
          }}
        >
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {allRooms.map((r) => {
              const isCurrent = r.id === currentRoom?.id;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => {
                    setRoomsDropdownOpen(false);
                    onSwitchRoom?.(r);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isCurrent }}
                  accessibilityLabel={r.name}
                  testID={'btn-switch-room-' + r.id}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: space[2],
                    paddingHorizontal: space[3],
                    gap: space[2],
                    backgroundColor: pressed || isCurrent ? dark.s2 : 'transparent',
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: dark.hairline,
                  })}
                >
                  <Avatar name={r.name} size="sm" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="heading" numberOfLines={1}>
                      {r.name}
                    </Text>
                    <Text variant="micro" color={dark.textMid}>
                      {t('squadDesign.members', { count: r.member_count })}
                    </Text>
                  </View>
                  {isCurrent && <Ionicons name="checkmark" size={18} color={dark.copper} />}
                </Pressable>
              );
            })}
            {onCreateOrJoin && (
              <Pressable
                onPress={() => {
                  setRoomsDropdownOpen(false);
                  onCreateOrJoin();
                }}
                accessibilityRole="button"
                accessibilityLabel={t('homeRefresh.create')}
                testID="btn-switcher-create-room"
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: space[2],
                  paddingHorizontal: space[3],
                  gap: space[2],
                  backgroundColor: pressed ? dark.s2 : 'transparent',
                })}
              >
                <Ionicons name="add-circle-outline" size={20} color={dark.copper} />
                <Text variant="body" color={dark.copper}>
                  {t('homeRefresh.create')}
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      )}
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
