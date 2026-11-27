import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Button, Text, getTabBarHeight } from '@calipartner/ui';
import {
  Text as V1Text,
  colors as v1Colors,
  layout as v1Layout,
  space as v1Space,
} from '@calipartner/ui/v1';
import { roomCap, type RankedSquadMember, type RoomMemberSnapshot } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { useRooms } from '@/hooks/useRooms';
import { useRoomSnapshot } from '@/hooks/useRoomSnapshot';
import { useRoomActions } from '@/hooks/useRoomActions';
import { useRoomRequests } from '@/hooks/useRoomRequests';
import { useFriends } from '@/hooks/useFriends';
import { useSubscription } from '@/hooks/useSubscription';
import { useRoomChat } from '@/hooks/useRoomChat';
import { useSquadActivity, useSquadToday } from '@/hooks/useSquad';
import { closeBrowserModalsThen, useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { ChatView } from '@/components/chat';
import {
  BlockUserModal,
  DormantWaitingState,
  InviteUserModal,
  JoinByCodeModal,
  LockedRoomPausedState,
  PaywallModal,
  ReportModal,
  RequestsInboxModal,
  RoomHeader,
  RoomProgressView,
  RoomSettingsModal,
  type RoomSegment,
} from '@/components/rooms';
import { SquadConnectModal } from '@/components/rooms/SquadConnectModal';
import { SquadVisibilityModal } from '@/components/rooms/SquadVisibilityModal';
import {
  SquadActivitySectionV1,
  SquadChatCardV1,
  SquadCompareCardV1,
  SquadInviteCardV1,
  SquadLeaderboardV1,
  SquadMemberSheetV1,
  SquadSwitcherSheetV1,
} from '@/components/rooms/SquadV1Components';
import { t } from '@/i18n';

type ModalName =
  'connect' | 'join' | 'settings' | 'privacy' | 'invite' | 'inbox' | 'paywall' | 'switcher' | null;

const STICKY_HEADER_SCROLL_Y = 72;

export default function RoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { user, profile } = useAuth();
  const roomsHook = useRooms();
  const requests = useRoomRequests();
  const friends = useFriends();
  const { hasActiveAccess, currentTier } = useSubscription();

  const params = useLocalSearchParams<{
    room?: string;
    action?: string;
    tab?: string;
    chat?: string;
    mention?: string;
    returnTo?: string;
  }>();

  const [visible, setVisible] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setVisible(true);
      return () => setVisible(false);
    }, []),
  );

  const room = params.room
    ? (roomsHook.rooms.find((item) => item.id === params.room) ?? null)
    : (roomsHook.rooms[0] ?? null);
  const roomId = room?.id ?? null;

  const { snapshot, refresh: refreshSnapshot } = useRoomSnapshot(roomId, visible, { pageSize: 20 });
  const squad = useSquadToday(roomId, visible);
  const activity = useSquadActivity(roomId, visible);
  const actions = useRoomActions(roomId);

  const [segment, setSegment] = useState<RoomSegment>('today');
  const [modal, setModal] = useState<ModalName>(null);
  const [picker, setPicker] = useState<'left' | 'right' | null>(null);
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);
  const [activeMemberSheet, setActiveMemberSheet] = useState<RankedSquadMember | null>(null);
  const [chatPrefill, setChatPrefill] = useState<string | null>(null);
  const [chatTypingName, setChatTypingName] = useState<string | null>(null);
  const [scrolledHeader, setScrolledHeader] = useState(false);
  const [report, setReport] = useState<RoomMemberSnapshot | null>(null);
  const [block, setBlock] = useState<RoomMemberSnapshot | null>(null);

  const segments = useRef<RoomSegment[]>([]);
  const entryFromHome = useRef(false);

  const closeEntry = () => {
    const returnHome = entryFromHome.current;
    entryFromHome.current = false;
    setModal(null);
    router.setParams({ returnTo: undefined });
    if (returnHome) closeBrowserModalsThen(() => router.navigate('/(tabs)/today'));
  };

  useEffect(() => {
    const nextChat = visible && segment === 'chat' ? 'open' : undefined;
    if (params.chat !== nextChat) {
      router.setParams({ chat: nextChat });
    }
  }, [router, visible, segment, params.chat]);

  const selectSegment = (next: RoomSegment) => {
    if (next === segment) return;
    segments.current.push(segment);
    setScrolledHeader(false);
    setSegment(next);
  };

  useEffect(() => {
    setSegment('today');
    segments.current = [];
    setLeftId(null);
    setRightId(null);
    setPicker(null);
    setActiveMemberSheet(null);
    setScrolledHeader(false);
  }, [roomId]);

  useEffect(() => {
    if (params.action === 'create') {
      entryFromHome.current = params.returnTo === 'home';
      setModal('connect');
      router.setParams({ action: undefined });
    } else if (params.action === 'join') {
      entryFromHome.current = params.returnTo === 'home';
      setModal('join');
      router.setParams({ action: undefined });
    }
  }, [params.action, params.returnTo, router]);

  useEffect(() => {
    if (params.tab === 'chat' && roomId) {
      setSegment('chat');
      router.setParams({ tab: undefined });
    }
  }, [params.tab, roomId, router]);

  useBrowserModalBack(
    modal !== null || report !== null || block !== null || activeMemberSheet !== null,
    () => {
      if (activeMemberSheet) setActiveMemberSheet(null);
      else if (modal === 'connect' || modal === 'join') closeEntry();
      else {
        setModal(null);
        setReport(null);
        setBlock(null);
      }
    },
  );

  useEffect(() => {
    if (!visible || segment === 'today') return;
    return BackHandler.addEventListener('hardwareBackPress', () => {
      if (params.returnTo === 'chat') {
        router.setParams({ returnTo: undefined, chat: undefined });
        router.navigate('/(tabs)/chat' as Href);
        return true;
      }
      setSegment(segments.current.pop() ?? 'today');
      return true;
    }).remove;
  }, [visible, segment, params.returnTo, router]);

  const waiting = room?.state === 'dormant' || (room ? room.member_count < 2 : false);
  const locked = room?.state === 'locked';
  const canChat = Boolean(roomId && room?.state === 'active' && !waiting && !locked);
  const chatPreviewOptions = useMemo(
    () => ({
      userId: user?.id,
      markRead: false,
    }),
    [user?.id],
  );
  const preview = useRoomChat(roomId, visible && canChat && segment !== 'chat', chatPreviewOptions);

  const refresh = useCallback(async () => {
    await Promise.all([
      roomsHook.refresh(),
      refreshSnapshot(),
      squad.refresh(),
      activity.refresh(),
      requests.refresh(),
      friends.refresh(),
    ]);
  }, [activity, friends, refreshSnapshot, requests, roomsHook, squad]);

  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [waiting, refresh]);

  const rawMembers = squad.data?.members;
  const members = useMemo(() => rawMembers ?? [], [rawMembers]);
  const chatViewOptions = useMemo(
    () => ({
      userId: user?.id,
      userNickname: profile?.nickname,
      username: profile?.username,
    }),
    [user?.id, profile?.nickname, profile?.username],
  );
  const chatMentionMembers = useMemo(
    () =>
      members.map((member) => ({
        user_id: member.user_id,
        username: member.username,
        nickname: member.nickname,
      })),
    [members],
  );
  const left =
    members.find((member) => member.user_id === leftId) ??
    members.find((member) => member.is_self) ??
    members[0];
  const right =
    members.find((member) => member.user_id === rightId && member.user_id !== left?.user_id) ??
    members.find((member) => member.user_id !== left?.user_id);
  const managementMembers = useMemo(() => snapshot?.members ?? [], [snapshot?.members]);

  const openPerson = (memberId: string) => {
    if (roomId) {
      router.push(
        ('/squad/person?room=' +
          encodeURIComponent(roomId) +
          '&member=' +
          encodeURIComponent(memberId)) as Href,
      );
    }
  };

  const openComparePair = (targetLeftId: string, targetRightId: string) => {
    if (!room) return;
    router.push(
      ('/squad/compare?room=' +
        encodeURIComponent(room.id) +
        '&left=' +
        encodeURIComponent(targetLeftId) +
        '&right=' +
        encodeURIComponent(targetRightId)) as Href,
    );
  };

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const y = contentOffset.y;
    const scrollableDistance = contentSize.height - layoutMeasurement.height;
    setScrolledHeader((prev) => {
      if (prev) return y > 16;
      return y > STICKY_HEADER_SCROLL_Y && scrollableDistance > 220;
    });
  }, []);

  const bottomSpacer = getTabBarHeight(fontScale) + insets.bottom + v1Space.lg;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={localStyles.screen} testID="screen-room">
      <RoomHeader
        onBack={() => {
          if (params.returnTo === 'chat') {
            router.setParams({ returnTo: undefined, chat: undefined });
            router.navigate('/(tabs)/chat' as Href);
          } else {
            setSegment(segments.current.pop() ?? 'today');
          }
        }}
        currentRoom={room}
        allRooms={roomsHook.rooms}
        currentUserId={user?.id}
        pendingRequestsCount={requests.incoming.length + (friends.inbox?.incoming.length ?? 0)}
        activeSegment={segment}
        chatUnreadCount={canChat ? preview.unreadCount : 0}
        typingText={segment === 'chat' ? chatTypingName : null}
        collapsed={segment !== 'chat' && scrolledHeader && !waiting && !locked && Boolean(room)}
        isWaiting={waiting}
        onSelectSegment={selectSegment}
        onOpenInbox={() => setModal('inbox')}
        onOpenSettings={() => setModal('settings')}
        onOpenPrivacy={() => setModal('privacy')}
        onOpenSwitcher={() => setModal('switcher')}
        onSwitchRoom={(item) => {
          router.setParams({ room: item.id, mention: undefined });
        }}
        onCreateOrJoin={() => setModal('connect')}
      />

      {segment === 'chat' && room ? (
        <View style={localStyles.flex}>
          {!canChat ? (
            <View style={localStyles.emptyStateCard}>
              <V1Text variant="body" color="textMid">
                {t(waiting ? 'rooms.dormant.subtitle' : 'chat.pausedTitle')}
              </V1Text>
            </View>
          ) : (
            <ChatView
              key={room.id}
              roomId={room.id}
              roomName={room.name}
              pinnedGoal={squad.data?.pinned_goal ?? room.pinned_goal}
              prefillText={chatPrefill}
              onPrefillConsumed={() => setChatPrefill(null)}
              onTypingSummaryChange={setChatTypingName}
              isVisible={visible}
              options={chatViewOptions}
              focusedMentionId={params.mention}
              mentionMembers={chatMentionMembers}
            />
          )}
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={handleScroll}
          contentContainerStyle={[localStyles.scrollContent, { paddingBottom: bottomSpacer }]}
          refreshControl={
            <RefreshControl
              refreshing={roomsHook.loading || squad.loading}
              onRefresh={() => void refresh()}
              tintColor={v1Colors.apricot}
            />
          }
        >
          {roomsHook.loading && !room ? (
            <V1Text variant="body" color="textLo">
              {t('common.loading')}
            </V1Text>
          ) : roomsHook.error && !room ? (
            <View style={localStyles.emptyStateCard}>
              <Text accessibilityRole="alert">{t('common.errorBody')}</Text>
              <Button
                variant="secondary"
                label={t('common.retry')}
                onPress={() => void refresh()}
                testID="retry-room-list"
              />
            </View>
          ) : !room ? (
            <View style={localStyles.emptyStateCard}>
              <Text variant="title1">{t('socialUpdate.connect')}</Text>
              <Text>{t('socialUpdate.choose')}</Text>
              <Button
                label={t('homeRefresh.create')}
                onPress={() => setModal('connect')}
                testID="open-squad-connect-modal"
              />
            </View>
          ) : locked ? (
            <LockedRoomPausedState onKeepRoomGoing={() => setModal('paywall')} />
          ) : waiting ? (
            <DormantWaitingState roomCode={room.code} />
          ) : squad.error ? (
            <View style={localStyles.emptyStateCard}>
              <Text accessibilityRole="alert">{t('common.errorBody')}</Text>
              <Button
                variant="secondary"
                label={t('common.retry')}
                onPress={() => void squad.refresh()}
                testID="retry-squad-today"
              />
            </View>
          ) : squad.loading && !squad.data ? (
            <V1Text variant="body" color="textLo">
              {t('common.loading')}
            </V1Text>
          ) : segment === 'progress' ? (
            <View style={localStyles.stack}>
              <SquadLeaderboardV1
                members={members}
                onPressMember={(member) => openPerson(member.user_id)}
              />
              <RoomProgressView roomId={room.id} />
            </View>
          ) : (
            <View style={localStyles.stack}>
              <SquadChatCardV1
                latestMessage={squad.data?.latest_message}
                unreadCount={canChat ? preview.unreadCount : 0}
                onPress={() => selectSegment('chat')}
              />

              <SquadLeaderboardV1
                members={members}
                limit={members.length <= 5 ? undefined : 3}
                onPressMember={(member) => setActiveMemberSheet(member)}
              />

              {left && right ? (
                <SquadCompareCardV1
                  left={left}
                  right={right}
                  members={members}
                  openSide={picker}
                  onToggleSide={(side) => setPicker((curr) => (curr === side ? null : side))}
                  onSelectSide={(side, id) => {
                    setLeftId(side === 'left' ? id : left.user_id);
                    setRightId(side === 'right' ? id : right.user_id);
                    setPicker(null);
                  }}
                  onSwap={() => {
                    const prevLeft = left.user_id;
                    const prevRight = right.user_id;
                    setLeftId(prevRight);
                    setRightId(prevLeft);
                  }}
                  onCompare={() => openComparePair(left.user_id, right.user_id)}
                />
              ) : null}

              <SquadActivitySectionV1
                items={activity.data ?? []}
                loading={activity.loading}
                members={members}
                onPressMember={(member) => setActiveMemberSheet(member)}
              />

              <SquadInviteCardV1
                room={room}
                currentUserId={user?.id}
                onInviteModal={() => setModal('invite')}
              />
            </View>
          )}
        </ScrollView>
      )}

      <SquadMemberSheetV1
        visible={Boolean(activeMemberSheet)}
        roomId={roomId}
        member={activeMemberSheet}
        onClose={() => setActiveMemberSheet(null)}
        onCompare={(member) => {
          setActiveMemberSheet(null);
          const selfOrOther =
            members.find((m) => m.is_self && m.user_id !== member.user_id) ??
            members.find((m) => m.user_id !== member.user_id);
          if (selfOrOther) {
            openComparePair(selfOrOther.user_id, member.user_id);
          }
        }}
        onMessage={(member) => {
          setActiveMemberSheet(null);
          setChatPrefill(`@${member.username} `);
          selectSegment('chat');
        }}
      />

      <SquadSwitcherSheetV1
        visible={modal === 'switcher'}
        rooms={roomsHook.rooms}
        currentRoomId={roomId}
        currentUserId={user?.id}
        onClose={() => setModal(null)}
        onSelectRoom={(item) => router.setParams({ room: item.id, mention: undefined })}
        onCreateSquad={() => setModal('connect')}
        onJoinByCode={async (code) => {
          const result = await roomsHook.joinByCode(code);
          if (result?.room_id) {
            router.setParams({ room: result.room_id, mention: undefined, returnTo: undefined });
          }
        }}
      />

      {modal === 'connect' && (
        <SquadConnectModal
          visible
          onClose={closeEntry}
          isPlusOrPro={hasActiveAccess}
          memberCap={roomCap(hasActiveAccess ? currentTier : 'free')}
          friends={friends.inbox?.friends ?? []}
          loading={friends.loading}
          error={Boolean(friends.error)}
          onRetry={() => void friends.refresh()}
          onFindFriend={() => {
            entryFromHome.current = false;
            router.setParams({ returnTo: undefined });
            setModal(null);
            router.push('/friends' as Href);
          }}
          onOpenPaywall={() => setModal('paywall')}
          onCreateSquad={async (name, ids) => {
            const result = await roomsHook.createRoom(name, ids);
            entryFromHome.current = false;
            router.setParams({ room: result.room_id, mention: undefined, returnTo: undefined });
            setModal(null);
            return result;
          }}
          onJoinSquad={() => setModal('join')}
        />
      )}
      {modal === 'join' && (
        <JoinByCodeModal
          visible
          onClose={closeEntry}
          onJoinByCode={async (code) => {
            const result = await roomsHook.joinByCode(code);
            if (result?.room_id) {
              entryFromHome.current = false;
              router.setParams({ room: result.room_id, mention: undefined, returnTo: undefined });
            }
          }}
        />
      )}
      {modal === 'inbox' && (
        <RequestsInboxModal
          visible
          incoming={requests.incoming}
          outgoing={requests.outgoing}
          onClose={() => setModal(null)}
          onRespond={async (id, accept) => {
            await requests.respondToRequest(id, accept);
            await refresh();
          }}
          onCancel={requests.cancelRequest}
          onOpenPaywall={() => setModal('paywall')}
        />
      )}
      {modal === 'privacy' && roomId && (
        <SquadVisibilityModal visible roomId={roomId} onClose={() => setModal(null)} />
      )}
      {modal === 'settings' && room && (
        <RoomSettingsModal
          visible
          room={room}
          members={managementMembers}
          currentUserId={user?.id ?? ''}
          onClose={() => setModal(null)}
          onSetWhoCanInvite={actions.setWhoCanInvite}
          onRemoveMember={async (id) => {
            await actions.removeMember(id);
            await refresh();
          }}
          onTransferHost={async (id) => {
            await actions.transferHost(id);
            await refresh();
          }}
          onLeaveRoom={async () => {
            await roomsHook.leaveRoom(room.id);
            setModal(null);
            router.setParams({ room: undefined, mention: undefined });
          }}
          onReportUser={(member) => {
            setModal(null);
            setReport(member);
          }}
          onBlockUser={(member) => {
            setModal(null);
            setBlock(member);
          }}
        />
      )}
      {modal === 'invite' && room && (
        <InviteUserModal
          visible
          roomId={room.id}
          onClose={() => setModal(null)}
          onSearchUsers={requests.searchUsers}
          onSendInvitation={requests.sendInvitation}
        />
      )}
      {modal === 'paywall' && (
        <PaywallModal
          visible
          context={locked ? 'keep_going' : 'room'}
          sponsorRoomId={locked ? (roomId ?? undefined) : undefined}
          onClose={() => setModal(null)}
          onSuccess={() => {
            setModal(null);
            void refresh();
          }}
        />
      )}
      {report && (
        <ReportModal
          visible
          targetType="user"
          targetId={report.user_id}
          targetName={report.nickname}
          onClose={() => setReport(null)}
          onSubmitReport={actions.reportTarget}
        />
      )}
      {block && (
        <BlockUserModal
          visible
          targetMember={block}
          onClose={() => setBlock(null)}
          onConfirmBlock={async (id) => {
            await actions.blockUser(id);
            await refresh();
          }}
        />
      )}
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: v1Colors.bg0,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: v1Layout.screenPaddingX,
    paddingTop: v1Space.xs,
  },
  stack: {
    gap: v1Space.lg,
  },
  emptyStateCard: {
    padding: v1Space.lg,
    gap: v1Space.md,
  },
});
