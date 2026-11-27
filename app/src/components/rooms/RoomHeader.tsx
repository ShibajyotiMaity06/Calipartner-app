import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { setStringAsync } from 'expo-clipboard';
import { Avatar, Button, Sheet, Text, homeLayout } from '@calipartner/ui';
import {
  BellIcon,
  ChatBubbleIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  CloseIcon,
  IconButton,
  InfoCircleIcon,
  Segmented as V1Segmented,
  SlidersIcon,
  Text as V1Text,
  borders,
  colors,
  fonts,
  layout,
  radius,
  space,
} from '@calipartner/ui/v1';
import { closeBrowserModalsThen, useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { t } from '@/i18n';
import type { RoomSummary } from '@/types/rooms';
import { EditSquadName } from './EditSquadName';
import { AvatarCluster, sponsorLabelForRoom } from './SquadUiHelpers';
import { useSquadStyles } from './SquadViews';

export type RoomSegment = 'today' | 'chat' | 'progress' | 'members';

export interface RoomHeaderProps {
  currentRoom: RoomSummary | null;
  allRooms: RoomSummary[];
  currentUserId?: string | null;
  pendingRequestsCount: number;
  streakDays?: number;
  activeSegment: RoomSegment;
  chatUnreadCount?: number;
  typingText?: string | null;
  collapsed?: boolean;
  showMembers?: boolean;
  isWaiting?: boolean;
  onSelectSegment: (segment: RoomSegment) => void;
  onOpenInbox: () => void;
  onOpenSettings: () => void;
  onOpenPrivacy: () => void;
  onOpenSwitcher?: () => void;
  onBack?: () => void;
  onSwitchRoom?: (room: RoomSummary) => void;
  onCreateOrJoin?: () => void;
}

export function RoomHeader({
  currentRoom,
  allRooms,
  currentUserId,
  pendingRequestsCount,
  activeSegment,
  chatUnreadCount = 0,
  typingText,
  collapsed = false,
  onSelectSegment,
  onOpenInbox,
  onOpenSettings,
  onOpenPrivacy,
  onOpenSwitcher,
  onBack,
  onSwitchRoom,
  onCreateOrJoin,
}: RoomHeaderProps) {
  const styles = useSquadStyles();
  const [panel, setPanel] = useState<'rooms' | 'actions' | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

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

  if (activeSegment === 'chat') {
    const subLine = typingText
      ? t('squadV1.chatTitleSubTyping', {
          count: currentRoom?.member_count ?? 1,
          name: typingText,
        })
      : t('squadV1.membersCount', { count: currentRoom?.member_count ?? 1 });

    return (
      <View style={localStyles.chatHeader} testID="squad-chat-header">
        {onBack ? (
          <IconButton
            icon={<ChevronLeftIcon size={18} color={colors.textHi} />}
            accessibilityLabel={t('friends.back')}
            onPress={onBack}
            testID="squad-chat-back"
          />
        ) : null}

        <AvatarCluster size={24} />

        <View style={localStyles.chatTitleCol}>
          <V1Text variant="titleS" color="textHi" numberOfLines={1} style={localStyles.boldText}>
            {currentRoom?.name ?? t('tabs.room')}
          </V1Text>
          <V1Text variant="meta" color="textLo" numberOfLines={1}>
            {subLine}
          </V1Text>
        </View>

        <IconButton
          icon={<InfoCircleIcon size={18} color={colors.textHi} />}
          accessibilityLabel={t('rooms.settingsModal.title')}
          onPress={onOpenSettings}
          testID="btn-room-settings"
        />
      </View>
    );
  }

  const sponsorText = sponsorLabelForRoom(currentRoom, currentUserId);
  const segmentOptions = [
    { value: 'today' as RoomSegment, label: t('squadV1.todayTab') },
    { value: 'progress' as RoomSegment, label: t('squadV1.progressTab') },
  ];

  const handleOpenSwitcher = () => {
    if (onOpenSwitcher) {
      onOpenSwitcher();
    } else {
      setPanel('rooms');
    }
  };

  return (
    <View style={[localStyles.headerWrap, collapsed ? localStyles.headerStickyBar : null]}>
      {collapsed && currentRoom ? (
        <View style={localStyles.stickyRow}>
          <Pressable
            onPress={handleOpenSwitcher}
            accessibilityRole="button"
            accessibilityLabel={currentRoom.name}
            style={localStyles.stickyTitleBtn}
            testID="btn-room-title-switcher"
          >
            <V1Text variant="titleM" color="textHi" numberOfLines={1}>
              {currentRoom.name}
            </V1Text>
          </Pressable>

          <View style={localStyles.stickySegmentedWrap}>
            <V1Segmented
              compact
              options={segmentOptions}
              value={activeSegment === 'progress' ? 'progress' : 'today'}
              onChange={(val) => onSelectSegment(val)}
              testID="room-tab"
            />
          </View>
        </View>
      ) : (
        <>
          <View style={localStyles.topRow}>
            <View style={localStyles.titleCol}>
              <View style={localStyles.titleActionRow}>
                <Pressable
                  onPress={handleOpenSwitcher}
                  accessibilityRole="button"
                  accessibilityLabel={currentRoom?.name ?? t('tabs.room')}
                  style={({ pressed }) => [
                    localStyles.switcherBtn,
                    pressed ? localStyles.pressedOpacity : null,
                  ]}
                  testID="btn-room-title-switcher"
                >
                  <V1Text
                    variant="titleM"
                    color="textHi"
                    numberOfLines={1}
                    style={localStyles.flexShrink}
                  >
                    {currentRoom?.name ?? t('tabs.room')}
                  </V1Text>
                  <ChevronDownIcon size={18} color={colors.textMid} />
                </Pressable>
                {currentRoom && activeSegment === 'today' ? (
                  <EditSquadName room={currentRoom} location="squad" />
                ) : null}
              </View>

              {currentRoom ? (
                <View style={localStyles.subMetaRow}>
                  <V1Text
                    variant="meta"
                    color="textLo"
                    numberOfLines={1}
                    style={localStyles.flexShrink}
                  >
                    {t('squadV1.membersCount', { count: currentRoom.member_count })} · {sponsorText}
                  </V1Text>
                  <Pressable
                    onPress={() => void copy()}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t('squadDesign.code', { code: currentRoom.code })}
                    testID="btn-copy-room-code"
                  >
                    <V1Text variant="meta" color={copied ? 'apricot' : 'textLo'}>
                      {` · ${currentRoom.code}${copied ? ' ✓' : ''}`}
                    </V1Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <View style={localStyles.iconGroup}>
              <View style={localStyles.badgeAnchor}>
                <IconButton
                  icon={<ChatBubbleIcon size={18} color={colors.textHi} />}
                  accessibilityLabel={t('squadDesign.chat')}
                  onPress={() => onSelectSegment('chat')}
                  testID="btn-room-open-chat"
                />
                {chatUnreadCount > 0 ? <View style={localStyles.dotBadge} /> : null}
              </View>

              <View style={localStyles.badgeAnchor}>
                <IconButton
                  icon={<BellIcon size={18} color={colors.textHi} />}
                  accessibilityLabel={t('rooms.inboxModal.title')}
                  onPress={onOpenInbox}
                  testID="btn-room-inbox-quick"
                />
                {pendingRequestsCount > 0 ? <View style={localStyles.dotBadge} /> : null}
              </View>

              <IconButton
                icon={<SlidersIcon size={18} color={colors.textHi} />}
                accessibilityLabel={t('squadDesign.actions')}
                onPress={() => setPanel('actions')}
                testID="btn-room-options"
              />
            </View>
          </View>

          {error ? (
            <V1Text variant="meta" color="danger" accessibilityRole="alert">
              {t('roomAudit.actionError')}
            </V1Text>
          ) : null}

          {currentRoom ? (
            <V1Segmented
              options={segmentOptions}
              value={activeSegment === 'progress' ? 'progress' : 'today'}
              onChange={(val) => onSelectSegment(val)}
              testID="room-tab"
            />
          ) : null}
        </>
      )}

      {panel ? (
        <Sheet
          visible
          onClose={() => setPanel(null)}
          snapPoint="tall"
          accessibilityLabel={t('squadDesign.actions')}
          testID="room-options-sheet"
        >
          <ScrollView contentContainerStyle={styles.content}>
            <View style={localStyles.sheetTopRow}>
              <V1Text variant="titleM" color="textHi">
                {panel === 'rooms' ? t('squadV1.switcherTitle') : t('squadDesign.actions')}
              </V1Text>
              <IconButton
                icon={<CloseIcon size={18} color={colors.textHi} />}
                accessibilityLabel={t('squadDesign.close')}
                onPress={() => setPanel(null)}
              />
            </View>
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
                  label={`${t('rooms.inboxModal.title')} (${pendingRequestsCount})`}
                  onPress={() => closeThen(onOpenInbox)}
                  testID="btn-room-inbox"
                />
                {currentRoom ? (
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
                ) : null}
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
      ) : null}
    </View>
  );
}

// Keep imports clean; RoomHeader supports Today, Progress, and Chat segments.

const localStyles = StyleSheet.create({
  headerWrap: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space.xs,
    paddingBottom: space.md,
    gap: space.md,
    backgroundColor: colors.bg0,
  },
  headerStickyBar: {
    paddingBottom: space.sm,
    borderBottomWidth: borders.width,
    borderBottomColor: colors.hairline,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titleActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    maxWidth: '100%',
  },
  switcherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    flexShrink: 1,
    maxWidth: '100%',
  },
  flexShrink: {
    flexShrink: 1,
  },
  subMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  iconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
  },
  badgeAnchor: {
    position: 'relative',
  },
  dotBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.apricot,
    borderWidth: 1.5,
    borderColor: colors.bg0,
  },
  pressedOpacity: {
    opacity: 0.78,
  },
  stickyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  stickyTitleBtn: {
    flex: 1,
    minHeight: homeLayout.touchSize,
    justifyContent: 'center',
  },
  stickySegmentedWrap: {
    width: 190,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenPaddingX,
    paddingVertical: space.sm,
    gap: space.sm + 2,
    backgroundColor: colors.bg0,
    borderBottomWidth: borders.width,
    borderBottomColor: colors.hairline,
  },
  chatTitleCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  boldText: {
    fontFamily: fonts.bold,
  },
  sheetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
