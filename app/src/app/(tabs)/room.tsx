import React, { useCallback, useMemo, useState } from 'react';
import {
  BackHandler,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@calipartner/ui';
import { useLocalSearchParams, useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text as AppText } from '@calipartner/ui';
import { withLocalRoomDiary } from '@calipartner/core';
import { MemberComparison } from '@/components/rooms/MemberComparison';
import { useDiary } from '@/hooks/useDiary';
import { useTargets } from '@/hooks/useTargets';
import { useCurrentLocalDate } from '@/hooks/useCurrentLocalDate';
import { LoadingState } from '@/components/LoadingState';
import type { RoomMemberSnapshot } from '@calipartner/core';
import {
  BlockUserModal,
  DormantWaitingState,
  InviteUserModal,
  JoinByCodeModal,
  LockedRoomPausedState,
  MembersTab,
  NudgeModal,
  OverCapacityBanner,
  PaywallModal,
  PrivacySettingsModal,
  ReactionModal,
  ReportModal,
  RequestsInboxModal,
  RoomFullNotice,
  RoomHeader,
  RoomOverviewRow,
  RoomProgressView,
  RoomSettingsModal,
  SharedMealCard,
  SideBySideCard,
  SquadConnectFlow,
  TrialBanner,
  type PendingSharedMeal,
  type RoomSegment,
} from '@/components/rooms';

import { BasicRoomCard } from '@/components/rooms/BasicRoomCard';
import { ShareLoggedMealModal } from '@/components/rooms/ShareLoggedMealModal';
import { getSupabase } from '@/lib/supabase';
import { RoomExtras } from '@/components/rooms/RoomExtras';
import { RoomAccessNotice } from '@/components/rooms/RoomAccessNotice';
import { ChatView } from '@/components/chat';
import { useRoomActions } from '@/hooks/useRoomActions';
import { useRoomChat } from '@/hooks/useRoomChat';
import { useRoomRequests } from '@/hooks/useRoomRequests';
import { useRoomSnapshot } from '@/hooks/useRoomSnapshot';
import { useFriends } from '@/hooks/useFriends';
import { useRooms } from '@/hooks/useRooms';
import { useSubscription } from '@/hooks/useSubscription';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import type { RoomSummary } from '@/types/rooms';

export default function RoomScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  // Screen focus tracking for visibility-aware realtime subscription
  const [isVisible, setIsVisible] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setIsVisible(true);
      return () => setIsVisible(false);
    }, []),
  );

  // Core Room Hooks
  const {
    rooms,
    loading: roomsLoading,
    error: roomsError,
    refresh: refreshRooms,
    createRoom,
    joinByCode,
    leaveRoom,
  } = useRooms();
  const {
    incoming,
    outgoing,
    refresh: refreshRequests,
    sendInvitation,
    respondToRequest,
    cancelRequest,
    searchUsers,
  } = useRoomRequests();
  const {
    isTrial,
    trialBanner,
    currentTier,
    hasActiveAccess,
    loading: subscriptionLoading,
  } = useSubscription();
  const isPlusOrPro = hasActiveAccess;
  const friends = useFriends();

  // Selected Room
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const roomParams = useLocalSearchParams<{ room?: string }>();
  React.useEffect(() => {
    if (roomParams.room && rooms.some((r) => r.id === roomParams.room))
      setSelectedRoomId(roomParams.room);
  }, [roomParams.room, rooms]);
  const currentRoom: RoomSummary | null = useMemo(() => {
    if (rooms.length === 0) return null;
    return rooms.find((r) => r.id === selectedRoomId) ?? rooms[0] ?? null;
  }, [rooms, selectedRoomId]);

  const activeRoomId = currentRoom?.id ?? null;

  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [comparisonIds, setComparisonIds] = useState<string[] | null>(null);
  React.useEffect(() => {
    setComparisonIds(null);
    setSelectedPartnerId(null);
  }, [activeRoomId]);
  const { localDate } = useCurrentLocalDate();
  const diary = useDiary(localDate);
  const { currentGoalProfile } = useTargets();

  // Realtime Snapshot Hook (Subscribes ONLY while room screen is visible)
  const {
    snapshot,
    loading: snapshotLoading,
    error: snapshotError,
    refresh: refreshSnapshot,
  } = useRoomSnapshot(activeRoomId, isVisible, { selectedUserId: selectedPartnerId ?? undefined });

  // Room Actions Hook
  const {
    sendNudge,
    sendReaction,
    respondSharedMeal,
    getPrivacy,
    updatePrivacy,
    setWhoCanInvite,
    removeMember,
    transferHost,
    blockUser,
    reportTarget,
  } = useRoomActions(activeRoomId);

  // UI Navigation Segments
  const [activeSegment, setActiveSegment] = useState<RoomSegment>('today');
  const segmentHistory = React.useRef<RoomSegment[]>([]);
  const selectSegment = (segment: RoomSegment) => {
    if (segment === activeSegment) return;
    segmentHistory.current.push(activeSegment);
    setActiveSegment(segment);
  };
  React.useEffect(() => {
    segmentHistory.current = [];
    setActiveSegment('today');
  }, [activeRoomId]);
  useBrowserModalBack(
    isVisible && segmentHistory.current.length > 0,
    () => {
      const first = segmentHistory.current[0] ?? 'today';
      segmentHistory.current = [];
      setActiveSegment(first);
    },
    {
      depth: Math.max(0, segmentHistory.current.length - 1),
      onDepthChange: (depth) => {
        let previous = activeSegment;
        while (segmentHistory.current.length > depth + 1)
          previous = segmentHistory.current.pop() ?? 'today';
        setActiveSegment(previous);
      },
    },
  );
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        const previous = segmentHistory.current.pop();
        if (!previous) return false;
        setActiveSegment(previous);
        return true;
      });
      return () => subscription.remove();
    }, []),
  );

  // Modals visibility states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showInboxModal, setShowInboxModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);

  // Target member action modals
  const [nudgeTarget, setNudgeTarget] = useState<RoomMemberSnapshot | null>(null);
  const [reactionTarget, setReactionTarget] = useState<RoomMemberSnapshot | null>(null);
  const [reportTargetUser, setReportTargetUser] = useState<RoomMemberSnapshot | null>(null);
  const [blockTargetUser, setBlockTargetUser] = useState<RoomMemberSnapshot | null>(null);

  // Shared meals state (sample pending item if present)
  const [pendingSharedMeal, setPendingSharedMeal] = useState<PendingSharedMeal | null>(null);
  const [showShareMeal, setShowShareMeal] = useState(false);
  const [mealRefresh, setMealRefresh] = useState(0);
  const [mealError, setMealError] = useState(false);

  // Current User & Partner in snapshot
  const members = useMemo(() => snapshot?.members ?? [], [snapshot?.members]);
  const callerId = snapshot?.caller_id ?? '';

  const meMember: RoomMemberSnapshot | null = useMemo(() => {
    const member = members.find((m) => m.user_id === callerId);
    if (!member) return null;
    return !diary.loading &&
      !diary.error &&
      diary.daySummary.local_date === localDate &&
      currentGoalProfile?.user_id === callerId
      ? withLocalRoomDiary(
          member,
          callerId,
          diary.daySummary,
          currentGoalProfile.daily_calorie_target,
        )
      : member;
  }, [
    members,
    callerId,
    diary.loading,
    diary.error,
    diary.daySummary,
    currentGoalProfile,
    localDate,
  ]);

  const partnerMember: RoomMemberSnapshot | null = useMemo(() => {
    const otherMembers = members.filter((m) => m.user_id !== meMember?.user_id);
    if (otherMembers.length === 0) return null;
    return otherMembers.find((m) => m.user_id === selectedPartnerId) ?? otherMembers[0] ?? null;
  }, [members, meMember, selectedPartnerId]);

  React.useEffect(() => {
    if (!members.length) return;
    if (
      !members.some((member) => member.user_id === selectedPartnerId && member.user_id !== callerId)
    ) {
      setSelectedPartnerId(members.find((member) => member.user_id !== callerId)?.user_id ?? null);
    }
  }, [members, callerId, selectedPartnerId]);

  const effectiveComparisonIds = comparisonIds ?? (partnerMember ? [partnerMember.user_id] : []);
  const comparisonMembers = members
    .map((member) => (member.user_id === callerId && meMember ? meMember : member))
    .filter(
      (member) => member.user_id === callerId || effectiveComparisonIds.includes(member.user_id),
    );
  const selectComparison = (uid: string) => {
    if (uid === callerId) return;
    const next = effectiveComparisonIds.includes(uid)
      ? effectiveComparisonIds.filter((id) => id !== uid)
      : [...effectiveComparisonIds, uid];
    setComparisonIds(next);
    setSelectedPartnerId(next[0] ?? null);
  };

  // Streak days (active when all active members logged today)
  const streakDays = useMemo(() => {
    const activeMembers = members.filter((m) => m.status === 'active');
    if (activeMembers.length >= 2 && activeMembers.every((m) => m.metrics?.logged_today === true)) {
      return 1;
    }
    return 0;
  }, [members]);

  // Refresh all data
  const handleRefresh = async () => {
    await Promise.all([refreshRooms(), refreshRequests(), refreshSnapshot(), diary.refresh()]);
  };

  // Paywall / Access check (PRD 6.8 ROOM-7: Locked room shows "This room is paused" screen)
  const roomState = snapshot?.room.id === activeRoomId ? snapshot.room.state : currentRoom?.state;
  const isRoomLocked =
    roomsError?.code === 'PLAN_REQUIRED' ||
    snapshotError?.code === 'ROOM_LOCKED' ||
    roomState === 'locked';

  // Room dormant check (fewer than 2 active members)
  const currentMembers =
    snapshot?.room.id === activeRoomId
      ? members.filter((member) => ['active', 'paused', 'locked'].includes(member.status)).length
      : (currentRoom?.member_count ?? 0);
  const isRoomDormant = roomState === 'dormant' || currentMembers < 2;
  const showMembers = hasActiveAccess && currentMembers > 2;
  const displaySegment = activeSegment === 'members' && !showMembers ? 'today' : activeSegment;
  const canOpenChat = hasActiveAccess && !isRoomDormant && !isRoomLocked;

  React.useEffect(() => {
    let current = true;
    setPendingSharedMeal(null);
    setMealError(false);
    if (!activeRoomId || isRoomDormant || isRoomLocked) return;
    void getSupabase()
      .rpc('get_pending_room_meals', { p_room_id: activeRoomId })
      .then(({ data, error }) => {
        if (!current) return;
        if (error) setMealError(true);
        else setPendingSharedMeal((data as PendingSharedMeal[] | null)?.[0] ?? null);
      });
    return () => {
      current = false;
    };
  }, [activeRoomId, isRoomDormant, isRoomLocked, snapshot, mealRefresh]);

  React.useEffect(() => {
    if (!activeRoomId || !isVisible || !isRoomDormant || isRoomLocked) return;
    // Keep acceptance visible even when the realtime connection misses an event.
    const timer = setInterval(() => void refreshSnapshot(), 5000);
    return () => clearInterval(timer);
  }, [activeRoomId, isVisible, isRoomDormant, isRoomLocked, refreshSnapshot]);

  // Hook Room Chat for unread badge and realtime chat notifications
  const navigation = useNavigation();
  const watchUnread = canOpenChat && displaySegment !== 'chat';
  const { unreadCount } = useRoomChat(watchUnread ? activeRoomId : null, isVisible && watchUnread, {
    userId: watchUnread ? callerId || undefined : undefined,
    markRead: false,
  });
  const chatUnreadCount = watchUnread ? unreadCount : 0;

  React.useEffect(() => {
    const nav = navigation as unknown as {
      setOptions?: (options: { tabBarBadge?: number }) => void;
    };
    nav.setOptions?.({
      tabBarBadge: chatUnreadCount > 0 ? chatUnreadCount : undefined,
    });
  }, [navigation, chatUnreadCount]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      testID="screen-room"
    >
      {/* Room Header */}
      <RoomHeader
        currentRoom={currentRoom ? { ...currentRoom, member_count: currentMembers } : null}
        allRooms={rooms}
        pendingRequestsCount={incoming.length + (friends.inbox?.incoming.length ?? 0)}
        streakDays={streakDays}
        activeSegment={displaySegment}
        showMembers={showMembers}
        isWaiting={isRoomDormant}
        chatUnreadCount={chatUnreadCount}
        onSelectSegment={selectSegment}
        onOpenInbox={() => setShowInboxModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenPrivacy={() => setShowPrivacyModal(true)}
        onSwitchRoom={(r) => {
          setSelectedRoomId(r.id);
          setSelectedPartnerId(null);
          setActiveSegment('today');
        }}
        onCreateOrJoin={() => setShowCreateModal(true)}
      />

      {/* Content Area */}
      {roomsLoading && rooms.length === 0 ? (
        <View style={styles.loadingContainer}>
          <LoadingState />
        </View>
      ) : roomsError && roomsError.code !== 'PLAN_REQUIRED' && rooms.length === 0 ? (
        /* Error State (Network, Auth, or DB Error) */
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={roomsLoading}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
            />
          }
          contentContainerStyle={styles.scrollContainer}
        >
          <View
            style={[
              styles.emptyContainer,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.cardHighlight }]}>
              <Ionicons
                name={
                  roomsError.code === 'UNAUTHENTICATED' ? 'log-in-outline' : 'alert-circle-outline'
                }
                size={44}
                color={colors.accent}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {roomsError.code === 'UNAUTHENTICATED' ? t('auth.title') : t('common.errorTitle')}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              {roomsError.code === 'UNAUTHENTICATED'
                ? 'Sign in to view your rooms, track goals, and chat with partners.'
                : roomsError.code === 'HOSTED_ROOM_LIMIT'
                  ? t('setup.hostRoomLimit')
                  : roomsError.message || t('common.errorBody')}
            </Text>

            <View style={styles.emptyButtonsRow}>
              {roomsError.code === 'UNAUTHENTICATED' ? (
                <Pressable
                  onPress={() => router.push('/auth/sign-in')}
                  style={[styles.primaryButton, { backgroundColor: colors.accent }]}
                  accessibilityRole="button"
                  testID="btn-error-signin"
                >
                  <Ionicons name="log-in-outline" size={18} color={colors.onAccent} />
                  <Text style={[styles.primaryButtonText, { color: colors.onAccent }]}>
                    {t('auth.title')}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleRefresh}
                  style={[styles.primaryButton, { backgroundColor: colors.accent }]}
                  accessibilityRole="button"
                  testID="btn-error-retry"
                >
                  <Ionicons name="refresh-outline" size={18} color={colors.onAccent} />
                  <Text style={[styles.primaryButtonText, { color: colors.onAccent }]}>
                    {t('common.retry')}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </ScrollView>
      ) : rooms.length === 0 ? (
        /* Find a Partner / Squad Connect Flow (Screenshot 1: 1-on-1, Squad, Join) */
        <SquadConnectFlow
          isPlusOrPro={isPlusOrPro}
          memberCap={currentTier === 'pro' && hasActiveAccess ? 20 : isPlusOrPro ? 5 : 2}
          friends={friends.inbox?.friends ?? []}
          loading={friends.loading}
          error={Boolean(friends.error)}
          onRetry={() => void friends.refresh()}
          onFindFriend={() => router.push('/friends' as never)}
          onOpenPaywall={() => setShowPaywallModal(true)}
          onCreateSquad={async (name, ids) => {
            const res = await createRoom(name, ids);
            if (res && typeof res === 'object' && 'room_id' in res && res.room_id) {
              setSelectedRoomId(String(res.room_id));
            }
            await refreshRooms();
            return res as any;
          }}
          onJoinSquad={() => setShowJoinModal(true)}
          onSquadCreatedAndReady={async (roomId) => {
            setSelectedRoomId(roomId);
            await refreshRooms();
          }}
        />
      ) : displaySegment === 'chat' && currentRoom ? (
        /* Segment: Chat (Phase 8 View) */
        <View style={styles.chatWrapper}>
          {subscriptionLoading ? (
            <LoadingState />
          ) : !hasActiveAccess ? (
            <RoomAccessNotice
              message={t('rooms.access.chatUpgrade')}
              onUpgrade={() => setShowPaywallModal(true)}
            />
          ) : isRoomDormant ? (
            <RoomAccessNotice message={t('rooms.access.chatWaiting')} />
          ) : (
            <ChatView
              roomId={currentRoom.id}
              isVisible={isVisible && activeSegment === 'chat'}
              options={{
                userId: callerId || undefined,
                userNickname: meMember?.nickname,
                avatarUrl: meMember?.avatar_url ?? undefined,
              }}
              isLocked={isRoomLocked}
              testID="room-chat-segment"
            />
          )}
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={roomsLoading || snapshotLoading}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
            />
          }
          contentContainerStyle={styles.scrollContainer}
        >
          {isRoomLocked ? (
            /* Locked Room Paused State (PRD 6.8 ROOM-7, 7.6) */
            <LockedRoomPausedState
              onKeepRoomGoing={() => setShowPaywallModal(true)}
              onLeaveRoom={async () => {
                if (currentRoom) {
                  await leaveRoom(currentRoom.id);
                  await refreshRooms();
                }
              }}
            />
          ) : isRoomDormant && currentRoom ? (
            displaySegment === 'progress' ? (
              <RoomAccessNotice message={t('rooms.access.progressWaiting')} />
            ) : (
              <DormantWaitingState key={currentRoom.id} roomCode={currentRoom.code} />
            )
          ) : (
            <>
              {/* Trial Banner for Host (PRD 6.18 SUB-9) */}
              {currentRoom && currentRoom.role === 'host' && (isTrial || trialBanner !== null) && (
                <TrialBanner
                  daysLeft={trialBanner?.daysRemaining}
                  dayNumber={trialBanner ? Math.max(1, 4 - trialBanner.daysRemaining) : 1}
                  isHost={true}
                  onViewPlans={() => setShowPaywallModal(true)}
                />
              )}

              {/* Over capacity banner for the host (PRD 7.6) */}
              {currentRoom && currentRoom.state === 'over_capacity' && (
                <OverCapacityBanner
                  room={currentRoom}
                  onUpgrade={() => setShowPaywallModal(true)}
                  onManageMembers={() => setShowSettingsModal(true)}
                />
              )}

              {/* Room full notice (Host upgrade sheet & Member notice) (PRD 6.8 ROOM-12, SUB-6) */}
              {currentRoom &&
                currentRoom.state !== 'over_capacity' &&
                currentMembers >= (currentRoom.member_cap ?? 5) && (
                  <RoomFullNotice
                    memberCount={currentMembers}
                    memberCap={currentRoom.member_cap ?? 5}
                    isHost={currentRoom.role === 'host'}
                    onUpgrade={() => setShowPaywallModal(true)}
                  />
                )}

              {/* Segment: Today (Side by side comparison) */}
              {displaySegment === 'today' && (
                <>
                  {/* Pending Shared Meal Card (if any) */}
                  {mealError ? (
                    <Button
                      variant="secondary"
                      label={t('common.retry')}
                      onPress={() => setMealRefresh((v) => v + 1)}
                      testID="retry-pending-room-meals"
                    />
                  ) : null}
                  {pendingSharedMeal && (
                    <SharedMealCard
                      meal={pendingSharedMeal}
                      onAccept={async (id, qty, sec) => {
                        await respondSharedMeal(id, true, qty, sec);
                        setPendingSharedMeal(null);
                        setMealRefresh((v) => v + 1);
                      }}
                      onDecline={async (id) => {
                        await respondSharedMeal(id, false);
                        setPendingSharedMeal(null);
                        setMealRefresh((v) => v + 1);
                      }}
                    />
                  )}

                  {/* Overview Row for 3+ Members (paged & searchable above 12 members) */}
                  {members.length >= 3 && hasActiveAccess ? (
                    <View style={styles.comparisonControls}>
                      <AppText variant="heading">{t('repairs.compare')}</AppText>
                      <AppText variant="bodyS">{t('repairs.compareHint')}</AppText>
                      <AppText tabular>
                        {t('repairs.selected', { count: effectiveComparisonIds.length })}
                      </AppText>
                      <Button
                        variant="secondary"
                        label={t('repairs.selectAll')}
                        onPress={() =>
                          setComparisonIds(
                            members
                              .filter((member) => member.user_id !== callerId)
                              .map((member) => member.user_id),
                          )
                        }
                        testID="compare-select-all"
                      />
                      <Button
                        variant="tertiary"
                        label={t('repairs.clear')}
                        onPress={() => setComparisonIds([])}
                        testID="compare-clear"
                      />
                    </View>
                  ) : null}
                  {members.length >= 3 && hasActiveAccess && (
                    <RoomOverviewRow
                      members={members.map((member) =>
                        member.user_id === callerId && meMember ? meMember : member,
                      )}
                      selectedMemberIds={effectiveComparisonIds}
                      selectedMemberId={partnerMember?.user_id}
                      currentUserId={callerId}
                      onSelectMember={selectComparison}
                    />
                  )}

                  {/* Core Side-by-Side Card */}
                  {meMember && hasActiveAccess && effectiveComparisonIds.length > 1 ? (
                    <>
                      <MemberComparison
                        members={comparisonMembers}
                        callerId={callerId}
                        onNudge={setNudgeTarget}
                      />
                      <Button
                        variant="secondary"
                        label={t('repairs.mealTitle')}
                        onPress={() => setShowShareMeal(true)}
                        testID="btn-multi-shared-meal"
                      />
                    </>
                  ) : null}
                  {hasActiveAccess && effectiveComparisonIds.length === 0 ? (
                    <AppText>{t('repairs.noSelection')}</AppText>
                  ) : null}
                  {meMember && hasActiveAccess && effectiveComparisonIds.length <= 1 && (
                    <SideBySideCard
                      me={meMember}
                      partner={effectiveComparisonIds.length ? partnerMember : null}
                      allMembers={members}
                      selectedPartnerId={partnerMember?.user_id ?? null}
                      onSelectPartner={(uid) => setSelectedPartnerId(uid)}
                      onNudge={(target) => setNudgeTarget(target)}
                      onReact={(target) => setReactionTarget(target)}
                      onOpenChat={() => selectSegment('chat')}
                      onOpenProgress={() => selectSegment('progress')}
                      onOpenPrivacy={() => setShowPrivacyModal(true)}
                      onInviteFriend={() => setShowInviteModal(true)}
                      onFindPartner={() => router.push('/friends' as never)}
                      onLogSharedMeal={() => setShowShareMeal(true)}
                      onSendPhoto={() => selectSegment('chat')}
                    />
                  )}
                  {!hasActiveAccess ? (
                    <BasicRoomCard
                      members={[meMember, partnerMember].filter(
                        (member): member is RoomMemberSnapshot => Boolean(member),
                      )}
                    />
                  ) : null}
                  {currentRoom ? (
                    <RoomExtras
                      key={currentRoom.id}
                      roomId={currentRoom.id}
                      userId={callerId ?? ''}
                      partnerId={partnerMember?.user_id ?? null}
                      refreshToken={snapshot}
                      canSend={hasActiveAccess}
                    />
                  ) : null}
                </>
              )}

              {/* Segment: Progress */}
              {displaySegment === 'progress' &&
                currentRoom &&
                (hasActiveAccess ? (
                  <RoomProgressView
                    key={currentRoom.id}
                    roomId={currentRoom.id}
                    testID="room-progress-segment"
                  />
                ) : (
                  <RoomAccessNotice
                    message={t('setup.progressPlus')}
                    onUpgrade={() => setShowPaywallModal(true)}
                    actionTestID="upgrade-room-progress"
                  />
                ))}

              {/* Segment: Members Roster */}
              {displaySegment === 'members' && showMembers && currentRoom && (
                <MembersTab
                  room={currentRoom}
                  members={members}
                  currentUserId={callerId}
                  onInvite={() => setShowInviteModal(true)}
                  onOpenSettings={() => setShowSettingsModal(true)}
                  onSelectMember={(uid) => {
                    setSelectedPartnerId(uid);
                    setActiveSegment('today');
                  }}
                />
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* MODALS */}
      {currentRoom && hasActiveAccess ? (
        <ShareLoggedMealModal
          visible={showShareMeal}
          onPrivacy={() => {
            setShowShareMeal(false);
            setShowPrivacyModal(true);
          }}
          key={currentRoom.id}
          roomId={currentRoom.id}
          userId={callerId}
          members={members}
          onClose={() => setShowShareMeal(false)}
          onShared={() => {
            setMealRefresh((v) => v + 1);
            void refreshSnapshot();
          }}
        />
      ) : null}

      {/* Create Room Modal */}
      {showCreateModal ? (
        <Modal visible animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
          <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <Pressable
              onPress={() => setShowCreateModal(false)}
              accessibilityRole="button"
              accessibilityLabel={t('friends.close')}
              style={styles.primaryButton}
              testID="close-create-squad"
            >
              <Text style={{ color: colors.text }}>{t('friends.close')}</Text>
            </Pressable>
            <SquadConnectFlow
              isPlusOrPro={isPlusOrPro}
              memberCap={currentTier === 'pro' && hasActiveAccess ? 20 : isPlusOrPro ? 5 : 2}
              friends={friends.inbox?.friends ?? []}
              loading={friends.loading}
              error={Boolean(friends.error)}
              onRetry={() => void friends.refresh()}
              onFindFriend={() => {
                setShowCreateModal(false);
                router.push('/friends' as never);
              }}
              onOpenPaywall={() => setShowPaywallModal(true)}
              onCreateSquad={async (name, ids) => {
                const result = await createRoom(name, ids);
                setSelectedRoomId(result.room_id);
                setShowCreateModal(false);
                return result;
              }}
              onJoinSquad={() => {
                setShowCreateModal(false);
                setShowJoinModal(true);
              }}
            />
          </SafeAreaView>
        </Modal>
      ) : null}

      {/* Join by Code Modal */}
      <JoinByCodeModal
        visible={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoinByCode={async (code) => {
          const res = await joinByCode(code);
          if (res?.room_id) setSelectedRoomId(res.room_id);
          await refreshRooms();
        }}
      />

      {/* Invite User by Username Modal */}
      {currentRoom && (
        <InviteUserModal
          visible={showInviteModal}
          roomId={currentRoom.id}
          onClose={() => setShowInviteModal(false)}
          onSearchUsers={searchUsers}
          onSendInvitation={sendInvitation}
        />
      )}

      {/* Requests Inbox Modal */}
      <RequestsInboxModal
        visible={showInboxModal}
        incoming={incoming}
        outgoing={outgoing}
        onClose={() => setShowInboxModal(false)}
        onRespond={async (reqId, accept) => {
          await respondToRequest(reqId, accept);
          await Promise.all([refreshRequests(), refreshRooms()]);
        }}
        onCancel={async (reqId) => {
          await cancelRequest(reqId);
          await refreshRequests();
        }}
        onOpenPaywall={() => {
          setShowInboxModal(false);
          setShowPaywallModal(true);
        }}
      />

      {/* Room Settings Modal */}
      {currentRoom && (
        <RoomSettingsModal
          key={currentRoom.id}
          visible={showSettingsModal}
          room={currentRoom}
          members={members}
          currentUserId={callerId}
          onClose={() => setShowSettingsModal(false)}
          onSetWhoCanInvite={setWhoCanInvite}
          onRemoveMember={async (uid) => {
            await removeMember(uid);
            await Promise.all([refreshRooms(), refreshSnapshot()]);
          }}
          onTransferHost={async (newHostId) => {
            await transferHost(newHostId);
            await Promise.all([refreshRooms(), refreshSnapshot()]);
          }}
          onLeaveRoom={async () => {
            await leaveRoom(currentRoom.id);
            setSelectedRoomId(null);
            await refreshRooms();
          }}
          onReportUser={(m) => {
            setShowSettingsModal(false);
            setReportTargetUser(m);
          }}
          onBlockUser={(m) => {
            setShowSettingsModal(false);
            setBlockTargetUser(m);
          }}
        />
      )}

      {/* Privacy Settings Modal */}
      <PrivacySettingsModal
        roomId={currentRoom?.id}
        rooms={rooms}
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        onGetPrivacy={getPrivacy}
        onUpdatePrivacy={async (settings) => {
          const res = await updatePrivacy(settings);
          await refreshSnapshot();
          return res;
        }}
      />

      {/* Paywall Modal */}
      <PaywallModal
        visible={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        context={isRoomLocked ? 'keep_going' : 'room'}
        sponsorRoomId={isRoomLocked ? currentRoom?.id : undefined}
        onSuccess={() => {
          setShowPaywallModal(false);
          void handleRefresh();
        }}
        roomName={currentRoom?.name ?? 'Accountability Squad'}
      />

      {/* Nudge Modal */}
      <NudgeModal
        visible={nudgeTarget !== null}
        targetMember={nudgeTarget}
        members={members.filter(
          (member) => member.user_id !== callerId && member.status === 'active',
        )}
        onClose={() => setNudgeTarget(null)}
        onSendNudge={sendNudge}
      />

      {/* Reaction Modal */}
      <ReactionModal
        visible={reactionTarget !== null}
        targetMember={reactionTarget}
        onClose={() => setReactionTarget(null)}
        onSendReaction={async (reaction) => {
          if (reactionTarget) await sendReaction(reactionTarget.user_id, reaction);
        }}
      />

      {/* Report Modal */}
      <ReportModal
        visible={reportTargetUser !== null}
        targetType="user"
        targetId={reportTargetUser?.user_id ?? ''}
        targetName={reportTargetUser?.nickname}
        onClose={() => setReportTargetUser(null)}
        onSubmitReport={reportTarget}
      />

      {/* Block User Modal */}
      <BlockUserModal
        visible={blockTargetUser !== null}
        targetMember={blockTargetUser}
        onClose={() => setBlockTargetUser(null)}
        onConfirmBlock={async (uid) => {
          await blockUser(uid);
          await refreshSnapshot();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  comparisonControls: { paddingHorizontal: spacing.md, gap: spacing.sm },
  safeArea: {
    flex: 1,
  },
  chatWrapper: {
    flex: 1,
    paddingBottom: 78,
  },
  scrollContainer: {
    paddingBottom: 80,
  },
  loadingContainer: {
    paddingVertical: spacing.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: fontSize.sm,
  },
  emptyContainer: {
    margin: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    textAlign: 'center',
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.md + 2,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: fontSize.xs + 1,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  emptyButtonsRow: {
    width: '100%',
    gap: spacing.sm,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.pill,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.pill,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  inboxNoticeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  inboxNoticeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  fullHostBanner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  bannerTitleText: {
    fontSize: fontSize.xs + 1,
    fontWeight: '600',
    flex: 1,
  },
  bannerUpgradeBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
});
