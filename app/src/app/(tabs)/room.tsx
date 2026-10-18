import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { RoomMemberSnapshot } from '@calipartner/core';
import {
  BlockUserModal,
  CreateRoomModal,
  DormantWaitingState,
  InviteUserModal,
  JoinByCodeModal,
  LockedRoomPausedState,
  MembersTab,
  NudgeModal,
  OverCapacityBanner,
  PlaceholderPaywallModal,
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
  TrialBanner,
  type PendingSharedMeal,
  type RoomSegment,
} from '@/components/rooms';
import { FocusingNowStrip, RoomFocusSegment } from '@/components/focus';
import { ChatView } from '@/components/chat';
import { useRoomActions } from '@/hooks/useRoomActions';
import { useRoomChat } from '@/hooks/useRoomChat';
import { useRoomRequests } from '@/hooks/useRoomRequests';
import { useRoomSnapshot } from '@/hooks/useRoomSnapshot';
import { useRooms } from '@/hooks/useRooms';
import { useSubscription } from '@/hooks/useSubscription';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
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
  const { isTrial, trialBanner } = useSubscription();

  // Selected Room
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const currentRoom: RoomSummary | null = useMemo(() => {
    if (rooms.length === 0) return null;
    return rooms.find((r) => r.id === selectedRoomId) ?? rooms[0] ?? null;
  }, [rooms, selectedRoomId]);

  const activeRoomId = currentRoom?.id ?? null;

  // Realtime Snapshot Hook (Subscribes ONLY while room screen is visible)
  const {
    snapshot,
    loading: snapshotLoading,
    error: snapshotError,
    refresh: refreshSnapshot,
  } = useRoomSnapshot(activeRoomId, isVisible);

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
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);

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

  // Current User & Partner in snapshot
  const members = useMemo(() => snapshot?.members ?? [], [snapshot?.members]);
  const callerId = snapshot?.caller_id ?? '';

  const meMember: RoomMemberSnapshot | null = useMemo(() => {
    return members.find((m) => m.user_id === callerId) ?? members[0] ?? null;
  }, [members, callerId]);

  const partnerMember: RoomMemberSnapshot | null = useMemo(() => {
    const otherMembers = members.filter((m) => m.user_id !== meMember?.user_id);
    if (otherMembers.length === 0) return null;
    return otherMembers.find((m) => m.user_id === selectedPartnerId) ?? otherMembers[0] ?? null;
  }, [members, meMember, selectedPartnerId]);

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
    await Promise.all([refreshRooms(), refreshRequests(), refreshSnapshot()]);
  };

  // Paywall / Access check (PRD 6.8 ROOM-7: Locked room shows "This room is paused" screen)
  const isRoomLocked =
    roomsError?.code === 'PLAN_REQUIRED' ||
    snapshotError?.code === 'ROOM_LOCKED' ||
    currentRoom?.state === 'locked';

  // Room dormant check (fewer than 2 active members)
  const isRoomDormant = currentRoom?.state === 'dormant' || members.length < 2;

  // Hook Room Chat for unread badge and realtime chat notifications
  const navigation = useNavigation();
  const { unreadCount } = useRoomChat(activeRoomId, isVisible, {
    userId: callerId || undefined,
  });

  React.useEffect(() => {
    const nav = navigation as unknown as {
      setOptions?: (options: { tabBarBadge?: number }) => void;
    };
    nav.setOptions?.({
      tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
    });
  }, [navigation, unreadCount]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      testID="screen-room"
    >
      {/* Room Header */}
      <RoomHeader
        currentRoom={currentRoom}
        allRooms={rooms}
        pendingRequestsCount={incoming.length}
        streakDays={streakDays}
        activeSegment={activeSegment}
        chatUnreadCount={unreadCount}
        onSelectSegment={setActiveSegment}
        onOpenInbox={() => setShowInboxModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenPrivacy={() => setShowPrivacyModal(true)}
        onSwitchRoom={(r) => setSelectedRoomId(r.id)}
        onCreateOrJoin={() => setShowCreateModal(true)}
      />

      {/* Content Area */}
      {roomsLoading && rooms.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            {t('common.loading')}
          </Text>
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
                  <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>{t('auth.title')}</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleRefresh}
                  style={[styles.primaryButton, { backgroundColor: colors.accent }]}
                  accessibilityRole="button"
                  testID="btn-error-retry"
                >
                  <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>{t('common.retry')}</Text>
                </Pressable>
              )}
            </View>
          </View>
        </ScrollView>
      ) : rooms.length === 0 ? (
        /* No Active Rooms / Empty State */
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
              <Ionicons name="people-outline" size={44} color={colors.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('rooms.emptyTitle')}</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              {t('rooms.emptySubtitle')}
            </Text>

            <View style={styles.emptyButtonsRow}>
              <Pressable
                onPress={() => setShowCreateModal(true)}
                style={[styles.primaryButton, { backgroundColor: colors.accent }]}
                accessibilityRole="button"
                accessibilityLabel="Create a new room"
                testID="btn-empty-create-room"
              >
                <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>{t('rooms.createRoomBtn')}</Text>
              </Pressable>

              <Pressable
                onPress={() => setShowJoinModal(true)}
                style={[styles.secondaryButton, { backgroundColor: colors.surfaceAlt }]}
                accessibilityRole="button"
                accessibilityLabel="Join room with code"
                testID="btn-empty-join-code"
              >
                <Ionicons name="key-outline" size={18} color={colors.text} />
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                  {t('rooms.joinByCodeBtn')}
                </Text>
              </Pressable>
            </View>

            {incoming.length > 0 && (
              <Pressable
                onPress={() => setShowInboxModal(true)}
                style={styles.inboxNoticeLink}
                accessibilityRole="button"
                testID="btn-empty-check-inbox"
              >
                <Ionicons name="mail-unread-outline" size={16} color={colors.accent} />
                <Text style={[styles.inboxNoticeText, { color: colors.accent }]}>
                  {incoming.length} pending invitations in inbox
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      ) : activeSegment === 'chat' && currentRoom ? (
        /* Segment: Chat (Phase 8 View) */
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
            <LockedRoomPausedState onKeepRoomGoing={() => setShowPaywallModal(true)} />
          ) : (
            /* Active Room View */
            <>
              {/* Dormant state / Waiting for Partner banner */}
              {isRoomDormant && currentRoom && (
                <DormantWaitingState
                  roomName={currentRoom.name}
                  roomCode={currentRoom.code}
                  onInviteByUsername={() => setShowInviteModal(true)}
                />
              )}

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
                currentRoom.member_count >= (currentRoom.member_cap ?? 5) && (
                  <RoomFullNotice
                    memberCount={currentRoom.member_count}
                    memberCap={currentRoom.member_cap ?? 5}
                    isHost={currentRoom.role === 'host'}
                    onUpgrade={() => setShowPaywallModal(true)}
                  />
                )}

              {/* Segment: Today (Side by side comparison) */}
              {activeSegment === 'today' && (
                <>
                  {/* Pending Shared Meal Card (if any) */}
                  {pendingSharedMeal && (
                    <SharedMealCard
                      meal={pendingSharedMeal}
                      onAccept={async (id, qty, sec) => {
                        await respondSharedMeal(id, true, qty, sec);
                        setPendingSharedMeal(null);
                      }}
                      onDecline={async (id) => {
                        await respondSharedMeal(id, false);
                        setPendingSharedMeal(null);
                      }}
                    />
                  )}

                  {/* Focusing Now Strip on Room > Today (PRD RV-11) */}
                  <FocusingNowStrip
                    roomId={activeRoomId}
                    isVisible={isVisible && activeSegment === 'today'}
                    userId={callerId}
                    onOpenFocusSegment={() => setActiveSegment('focus')}
                  />

                  {/* Overview Row for 3+ Members (paged & searchable above 12 members) */}
                  {members.length >= 3 && (
                    <RoomOverviewRow
                      members={members}
                      selectedMemberId={partnerMember?.user_id}
                      currentUserId={callerId}
                      onSelectMember={(uid) => setSelectedPartnerId(uid)}
                    />
                  )}

                  {/* Core Side-by-Side Card */}
                  {meMember && (
                    <SideBySideCard
                      me={meMember}
                      partner={partnerMember}
                      allMembers={members}
                      selectedPartnerId={partnerMember?.user_id ?? null}
                      onSelectPartner={(uid) => setSelectedPartnerId(uid)}
                      onNudge={(target) => setNudgeTarget(target)}
                      onReact={(target) => setReactionTarget(target)}
                    />
                  )}
                </>
              )}

              {/* Segment: Focus (PRD 6.25, RV-1) */}
              {activeSegment === 'focus' && currentRoom && (
                <RoomFocusSegment
                  roomId={currentRoom.id}
                  roomName={currentRoom.name}
                  userId={callerId}
                  isVisible={isVisible && activeSegment === 'focus'}
                  isLocked={isRoomLocked}
                />
              )}

              {/* Segment: Progress */}
              {activeSegment === 'progress' && currentRoom && (
                <RoomProgressView roomId={currentRoom.id} testID="room-progress-segment" />
              )}

              {/* Segment: Members Roster */}
              {activeSegment === 'members' && currentRoom && (
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

      {/* Create Room Modal */}
      <CreateRoomModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateRoom={async (name) => {
          const res = await createRoom(name);
          if (res?.room_id) setSelectedRoomId(res.room_id);
          await refreshRooms();
        }}
      />

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
          visible={showSettingsModal}
          room={currentRoom}
          members={members}
          currentUserId={callerId}
          onClose={() => setShowSettingsModal(false)}
          onSetWhoCanInvite={setWhoCanInvite}
          onRemoveMember={async (uid) => {
            await removeMember(uid);
            await refreshSnapshot();
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
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        onGetPrivacy={getPrivacy}
        onUpdatePrivacy={async (settings) => {
          const res = await updatePrivacy(settings);
          await refreshSnapshot();
          return res;
        }}
      />

      {/* Placeholder Paywall Modal */}
      <PlaceholderPaywallModal
        visible={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
      />

      {/* Nudge Modal */}
      <NudgeModal
        visible={nudgeTarget !== null}
        targetMember={nudgeTarget}
        onClose={() => setNudgeTarget(null)}
        onSendNudge={sendNudge}
      />

      {/* Reaction Modal */}
      <ReactionModal
        visible={reactionTarget !== null}
        targetMember={reactionTarget}
        onClose={() => setReactionTarget(null)}
        onSendReaction={async (reaction) => {
          await sendReaction('room-event-latest', reaction);
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
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: 48,
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
    color: '#FFFFFF',
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
  bannerUpgradeBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
});
