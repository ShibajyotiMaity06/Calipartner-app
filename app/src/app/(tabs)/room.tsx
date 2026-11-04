import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, RefreshControl, SafeAreaView, ScrollView, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Button, Text } from '@calipartner/ui';
import type { RoomMemberSnapshot } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { useRooms } from '@/hooks/useRooms';
import { useRoomSnapshot } from '@/hooks/useRoomSnapshot';
import { useRoomActions } from '@/hooks/useRoomActions';
import { useRoomRequests } from '@/hooks/useRoomRequests';
import { useFriends } from '@/hooks/useFriends';
import { useSubscription } from '@/hooks/useSubscription';
import { useRoomChat } from '@/hooks/useRoomChat';
import { useSquadToday } from '@/hooks/useSquad';
import { closeBrowserModalsThen, useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { ChatView } from '@/components/chat';
import {
  DormantWaitingState,
  InviteUserModal,
  JoinByCodeModal,
  LockedRoomPausedState,
  PaywallModal,
  RequestsInboxModal,
  RoomHeader,
  RoomSettingsModal,
  BlockUserModal,
  ReportModal,
  type RoomSegment,
} from '@/components/rooms';
import { SquadConnectModal } from '@/components/rooms/SquadConnectModal';
import { SquadMemberPicker } from '@/components/rooms/SquadMemberPicker';
import { SquadPersonPanel } from '@/components/rooms/SquadPersonPanel';
import { SquadVisibilityModal } from '@/components/rooms/SquadVisibilityModal';
import {
  PeopleSelector,
  SquadLeaderboard,
  memberName,
  squadStyles as styles,
} from '@/components/rooms/SquadViews';
import { t } from '@/i18n';

type ModalName =
  'connect' | 'join' | 'settings' | 'privacy' | 'invite' | 'inbox' | 'paywall' | null;
export default function RoomScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const roomsHook = useRooms(),
    requests = useRoomRequests(),
    friends = useFriends();
  const { hasActiveAccess, currentTier } = useSubscription();
  const params = useLocalSearchParams<{
    room?: string;
    action?: string;
    tab?: string;
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
  const {
    snapshot,
    error: snapshotError,
    refresh: refreshSnapshot,
  } = useRoomSnapshot(roomId, visible, { pageSize: 20 });
  const squad = useSquadToday(roomId, visible);
  const actions = useRoomActions(roomId);
  const [segment, setSegment] = useState<RoomSegment>('today'),
    [modal, setModal] = useState<ModalName>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [picker, setPicker] = useState<'left' | 'right' | 'person' | null>(null),
    [leftId, setLeftId] = useState<string | null>(null),
    [rightId, setRightId] = useState<string | null>(null);
  const [report, setReport] = useState<RoomMemberSnapshot | null>(null),
    [block, setBlock] = useState<RoomMemberSnapshot | null>(null);
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
    router.setParams({ chat: visible && segment === 'chat' ? 'open' : undefined });
  }, [router, visible, segment]);
  const selectSegment = (next: RoomSegment) => {
    if (next === segment) return;
    segments.current.push(segment);
    setSegment(next);
  };
  useEffect(() => {
    setSegment('today');
    segments.current = [];
    setLeftId(null);
    setRightId(null);
    setPicker(null);
    setPersonId(null);
  }, [roomId]);
  useEffect(() => {
    if (params.action === 'create') {
      entryFromHome.current = params.returnTo === 'home';
      setModal('connect');
      router.setParams({ action: undefined });
    }
  }, [params.action, params.returnTo, router]);
  useEffect(() => {
    if (params.room && params.room !== roomId) return;
    if (params.tab === 'chat' || params.tab === 'progress' || params.tab === 'today') {
      if (params.tab !== segment) segments.current.push(segment);
      setSegment(params.tab);
      router.setParams({ tab: undefined });
    }
  }, [params.tab, params.room, roomId, router, segment]);
  useBrowserModalBack(
    modal === 'join' ||
      modal === 'settings' ||
      modal === 'inbox' ||
      modal === 'invite' ||
      Boolean(report || block),
    () => {
      if (modal === 'join') closeEntry();
      else setModal(null);
      setReport(null);
      setBlock(null);
    },
  );
  useBrowserModalBack(visible && segments.current.length > 0, () => {
    setSegment(segments.current.pop() ?? 'today');
  });
  useFocusEffect(
    useCallback(() => {
      const listener = BackHandler.addEventListener('hardwareBackPress', () => {
        const previous = segments.current.pop();
        if (previous) {
          setSegment(previous);
          return true;
        }
        // Let the navigator return to the actual previous route or visited tab.
        return false;
      });
      return () => listener.remove();
    }, []),
  );
  const refreshRooms = roomsHook.refresh,
    refreshSquad = squad.refresh,
    refreshRequests = requests.refresh;
  const refresh = useCallback(async () => {
    await Promise.all([refreshRooms(), refreshSnapshot(), refreshSquad(), refreshRequests()]);
  }, [refreshRooms, refreshSnapshot, refreshSquad, refreshRequests]);
  const waiting = Boolean(room && (room.state === 'dormant' || room.member_count < 2));
  useEffect(() => {
    void refreshSquad();
  }, [room?.member_count, refreshSquad]);
  const locked =
    room?.state === 'locked' || room?.state === 'archived' || snapshotError?.code === 'ROOM_LOCKED';
  useEffect(() => {
    if (!visible || !waiting || !roomId) return;
    const timer = setInterval(() => {
      void refreshSnapshot();
      void refreshRooms();
    }, 5000);
    return () => clearInterval(timer);
  }, [visible, waiting, roomId, refreshSnapshot, refreshRooms]);
  const canChat = !waiting && !locked;
  const preview = useRoomChat(
    canChat && segment !== 'chat' ? roomId : null,
    visible && canChat && segment !== 'chat',
    { userId: user?.id, markRead: false },
  );
  const members = squad.data?.members ?? [];
  const selectedPerson =
    members.find((member) => member.user_id === personId) ??
    members.find((member) => !member.is_self) ??
    members[0];
  const left =
    members.find((member) => member.user_id === leftId) ??
    members.find((member) => member.is_self) ??
    members[0];
  const right =
    members.find((member) => member.user_id === rightId && member.user_id !== left?.user_id) ??
    members.find((member) => member.user_id !== left?.user_id);
  const managementMembers = useMemo(() => snapshot?.members ?? [], [snapshot?.members]);
  const openPerson = (memberId: string) => {
    if (roomId)
      router.push(
        ('/squad/person?room=' +
          encodeURIComponent(roomId) +
          '&member=' +
          encodeURIComponent(memberId)) as Href,
      );
  };
  return (
    <SafeAreaView style={styles.screen} testID="screen-room">
      {segment === 'chat' && (
        <Button
          variant="tertiary"
          fullWidth={false}
          label={t('friends.back')}
          onPress={() => setSegment(segments.current.pop() ?? 'today')}
          testID="squad-chat-back"
        />
      )}
      <RoomHeader
        currentRoom={room}
        allRooms={roomsHook.rooms}
        pendingRequestsCount={requests.incoming.length + (friends.inbox?.incoming.length ?? 0)}
        activeSegment={segment}
        chatUnreadCount={canChat ? preview.unreadCount : 0}
        isWaiting={waiting}
        onSelectSegment={selectSegment}
        onOpenInbox={() => setModal('inbox')}
        onOpenSettings={() => setModal('settings')}
        onOpenPrivacy={() => setModal('privacy')}
        onSwitchRoom={(item) => {
          router.setParams({ room: item.id, mention: undefined });
        }}
        onCreateOrJoin={() => setModal('connect')}
      />
      {segment === 'chat' && room ? (
        <View style={styles.flex}>
          {!canChat ? (
            <View style={styles.content}>
              <Text>{t(waiting ? 'rooms.dormant.subtitle' : 'chat.pausedTitle')}</Text>
            </View>
          ) : (
            <ChatView
              key={room.id}
              roomId={room.id}
              isVisible={visible}
              options={{
                userId: user?.id,
                userNickname: profile?.nickname,
                username: profile?.username,
              }}
              focusedMentionId={params.mention}
              mentionMembers={members.map((member) => ({
                user_id: member.user_id,
                username: member.username,
                nickname: member.nickname,
              }))}
            />
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={roomsHook.loading || squad.loading}
              onRefresh={() => void refresh()}
            />
          }
        >
          {roomsHook.loading && !room ? (
            <Text>{t('common.loading')}</Text>
          ) : roomsHook.error && !room ? (
            <View style={styles.card}>
              <Text accessibilityRole="alert">{t('common.errorBody')}</Text>
              <Button
                variant="secondary"
                label={t('common.retry')}
                onPress={() => void refresh()}
                testID="retry-room-list"
              />
            </View>
          ) : !room ? (
            <View style={styles.card}>
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
          ) : (
            <>
              {squad.error ? (
                <View style={styles.card}>
                  <Text accessibilityRole="alert">{t('common.errorBody')}</Text>
                  <Button
                    variant="secondary"
                    label={t('common.retry')}
                    onPress={() => void squad.refresh()}
                    testID="retry-squad-today"
                  />
                </View>
              ) : squad.loading && !squad.data ? (
                <Text>{t('common.loading')}</Text>
              ) : (
                <>
                  <View style={styles.stack}>
                    <View style={styles.spread}>
                      <Text variant="heading">
                        {t(segment === 'progress' ? 'squadDesign.today' : 'squadDesign.leaders')}
                      </Text>
                      {segment === 'today' && (
                        <Button
                          variant="tertiary"
                          size="sm"
                          fullWidth={false}
                          label={t('squadDesign.full')}
                          onPress={() => selectSegment('progress')}
                          testID="open-full-leaderboard"
                        />
                      )}
                    </View>
                    <Text variant="bodyS">{t('squadDesign.ownGoals')}</Text>
                    <SquadLeaderboard
                      members={members}
                      limit={segment === 'progress' ? undefined : members.length === 2 ? 2 : 3}
                      onMember={(member) => openPerson(member.user_id)}
                    />
                  </View>
                  {segment === 'today' && left && right && (
                    <View style={styles.card}>
                      <Text variant="heading">{t('squadDesign.compareTwo')}</Text>
                      <Text variant="bodyS">{t('squadDesign.compareHint')}</Text>
                      <PeopleSelector
                        left={left}
                        right={right}
                        onChoose={(side) => {
                          setLeftId(left.user_id);
                          setRightId(right.user_id);
                          setPicker(side);
                        }}
                      />
                      <Button
                        label={t('squadDesign.compareNames', {
                          left: memberName(left),
                          right: memberName(right),
                        })}
                        onPress={() =>
                          router.push(
                            ('/squad/compare?room=' +
                              encodeURIComponent(room.id) +
                              '&left=' +
                              encodeURIComponent(left.user_id) +
                              '&right=' +
                              encodeURIComponent(right.user_id)) as Href,
                          )
                        }
                        testID="open-two-person-compare"
                      />
                    </View>
                  )}
                  {segment === 'today' && selectedPerson && roomId && (
                    <View style={styles.stack} testID="squad-person-inline">
                      <Text variant="heading">{t('fixNovember.person')}</Text>
                      <Text variant="bodyS">{t('fixNovember.personHint')}</Text>
                      <Button
                        variant="secondary"
                        label={memberName(selectedPerson)}
                        onPress={() => setPicker('person')}
                        testID="squad-choose-person"
                      />
                      <SquadPersonPanel
                        roomId={roomId}
                        person={selectedPerson}
                        members={members}
                        visible={visible}
                      />
                    </View>
                  )}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}
      {modal === 'connect' && (
        <SquadConnectModal
          visible
          onClose={closeEntry}
          isPlusOrPro={hasActiveAccess}
          memberCap={hasActiveAccess ? (currentTier === 'pro' ? 20 : 5) : 2}
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
      {picker && left && right && (
        <SquadMemberPicker
          visible
          members={members}
          excludedId={picker === 'person' ? '' : picker === 'left' ? right.user_id : left.user_id}
          selectedId={
            picker === 'person'
              ? (selectedPerson?.user_id ?? '')
              : picker === 'left'
                ? left.user_id
                : right.user_id
          }
          onSelect={(id) =>
            picker === 'person'
              ? setPersonId(id)
              : picker === 'left'
                ? setLeftId(id)
                : setRightId(id)
          }
          onClose={() => setPicker(null)}
        />
      )}
    </SafeAreaView>
  );
}
