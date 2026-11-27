import React, { useState } from 'react';
import { Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { setStringAsync } from 'expo-clipboard';
import type { RankedSquadMember, SquadActivityItem, SquadToday } from '@calipartner/core';
import {
  AvatarRing,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  DropletIcon,
  DumbbellIcon,
  IconButton,
  LockIcon,
  PlusIcon,
  PrimaryButton,
  ProgressBar,
  PulseIcon,
  SecondaryButton,
  Sheet,
  SwapIcon,
  Text,
  UsersIcon,
  UtensilsIcon,
  borders,
  colors,
  fonts,
  layout,
  radius,
  space,
} from '@calipartner/ui/v1';
import { useSquadDetails } from '@/hooks/useSquad';
import { t } from '@/i18n';
import type { RoomSummary } from '@/types/rooms';
import {
  AvatarCluster,
  formatActivityAgo,
  sponsorLabelForRoom,
  squadMemberName,
} from './SquadUiHelpers';

export { AvatarCluster, formatActivityAgo, sponsorLabelForRoom, squadMemberName };

export function SquadChatCardV1({
  latestMessage,
  unreadCount,
  onPress,
}: {
  latestMessage?: SquadToday['latest_message'];
  unreadCount: number;
  onPress: () => void;
}): React.JSX.Element {
  const previewText = latestMessage?.text
    ? latestMessage.sender_name
      ? `${latestMessage.sender_name}: ${latestMessage.text}`
      : latestMessage.text
    : t('squadV1.sayHello');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t('squadV1.chatTitle')}. ${previewText}`}
      style={({ pressed }) => [
        styles.cardBox,
        styles.chatCard,
        pressed ? styles.pressedCard : null,
      ]}
      testID="squad-chat-card"
    >
      <AvatarCluster size={28} />
      <View style={styles.chatTextCol}>
        <Text variant="label" color="textHi" style={styles.boldLabel}>
          {t('squadV1.chatTitle')}
        </Text>
        <Text variant="meta" color="textLo">
          {previewText}
        </Text>
      </View>
      {unreadCount > 0 ? (
        <View style={styles.newPill} testID="squad-chat-unread-badge">
          <Text variant="micro" color="onBrand" style={styles.newPillText} tabular>
            {t('squadV1.newBadge', { count: unreadCount })}
          </Text>
        </View>
      ) : (
        <ChevronRightIcon size={16} color={colors.textLo} />
      )}
    </Pressable>
  );
}

export function SquadLeaderboardV1({
  members,
  limit,
  onPressMember,
}: {
  members: RankedSquadMember[];
  limit?: number;
  onPressMember: (member: RankedSquadMember) => void;
}): React.JSX.Element {
  const shown = typeof limit === 'number' ? members.slice(0, limit) : members;

  return (
    <View style={styles.sectionBlock} testID="squad-leaderboard-v1">
      <View style={styles.sectionHeaderRow}>
        <Text variant="eyebrow" color="textLo">
          {t('squadV1.leaderboardHeading')}
        </Text>
        <Text variant="meta" color="textLo">
          {t('squadV1.pctOfOwnGoal')}
        </Text>
      </View>

      <View style={styles.leaderList}>
        {shown.map((member, index) => {
          const pct =
            member.score == null ? 0 : Math.max(0, Math.min(100, Math.round(member.score)));
          const activity = member.latest_activity;
          const subtitle = activity
            ? activity.kind === 'workout'
              ? t('squadV1.finishedActivity', {
                  label: activity.label,
                  time: `${formatActivityAgo(activity.occurred_at)} ago`,
                })
              : t('squadV1.loggedMealActivity', {
                  label: activity.label,
                  time: `${formatActivityAgo(activity.occurred_at)} ago`,
                })
            : null;
          const rankLabel = String(member.rank ?? index + 1);
          const name = squadMemberName(member);

          return (
            <Pressable
              key={member.user_id}
              onPress={() => onPressMember(member)}
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${member.score == null ? t('squadV1.sharesPctOnly') : `${pct}%`}`}
              style={({ pressed }) => [
                styles.leaderRow,
                member.is_self ? styles.leaderRowSelf : styles.leaderRowBorder,
                pressed ? styles.rowPressed : null,
              ]}
              testID={`squad-member-${member.user_id}`}
            >
              <Text variant="meta" color="textLo" tabular style={styles.rankCol}>
                {rankLabel}
              </Text>

              <AvatarRing
                initial={name.slice(0, 1).toUpperCase()}
                size={40}
                progress={member.score == null ? 0 : pct / 100}
                isSelf={member.is_self}
              />

              <View style={styles.leaderInfo}>
                <View style={styles.leaderNameRow}>
                  <Text variant="label" color="textHi" style={styles.boldLabel}>
                    {name}
                  </Text>
                  {member.is_self ? (
                    <Text variant="meta" color="textLo">
                      {` · ${t('squadV1.youTag')}`}
                    </Text>
                  ) : null}
                </View>

                {subtitle ? (
                  <Text variant="meta" color="textLo">
                    {subtitle}
                  </Text>
                ) : (
                  <View style={styles.lockSubRow}>
                    <LockIcon size={11} color={colors.textLo} />
                    <Text variant="meta" color="textLo">
                      {t('squadV1.sharesPctOnly')}
                    </Text>
                  </View>
                )}
              </View>

              <Text variant="numM" color="textHi" tabular style={styles.leaderPct}>
                {member.score == null ? '—' : `${pct}%`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function SquadCompareCardV1({
  left,
  right,
  members,
  openSide,
  onToggleSide,
  onSelectSide,
  onSwap,
  onCompare,
}: {
  left: RankedSquadMember;
  right: RankedSquadMember;
  members: RankedSquadMember[];
  openSide: 'left' | 'right' | null;
  onToggleSide: (side: 'left' | 'right') => void;
  onSelectSide: (side: 'left' | 'right', userId: string) => void;
  onSwap: () => void;
  onCompare: () => void;
}): React.JSX.Element {
  const leftName = squadMemberName(left);
  const rightName = squadMemberName(right);
  const excludedId = openSide === 'left' ? right.user_id : openSide === 'right' ? left.user_id : '';
  const selectable = members.filter((m) => m.user_id !== excludedId);

  return (
    <View style={styles.sectionBlock}>
      <Text variant="eyebrow" color="textLo">
        {t('squadV1.compareTwoMembers')}
      </Text>

      <View style={[styles.cardBox, styles.compareCard]}>
        <View style={styles.comparePickRow}>
          <Pressable
            onPress={() => onToggleSide('left')}
            accessibilityRole="button"
            accessibilityLabel={leftName}
            style={({ pressed }) => [
              styles.comparePersonBtn,
              pressed ? styles.pressedOpacity : null,
            ]}
            testID="compare-choose-left"
          >
            <AvatarRing
              initial={leftName.slice(0, 1).toUpperCase()}
              size={38}
              progress={(left.score ?? 50) / 100}
              isSelf
            />
            <Text variant="label" color="textHi" style={styles.boldLabel}>
              {leftName}
            </Text>
          </Pressable>

          <Pressable
            onPress={onSwap}
            accessibilityRole="button"
            accessibilityLabel="Swap members"
            style={({ pressed }) => [styles.swapCircle, pressed ? styles.rowPressed : null]}
            testID="compare-swap-members"
          >
            <SwapIcon size={16} color={colors.textMid} />
          </Pressable>

          <Pressable
            onPress={() => onToggleSide('right')}
            accessibilityRole="button"
            accessibilityLabel={rightName}
            style={({ pressed }) => [
              styles.comparePersonBtn,
              styles.comparePersonRight,
              pressed ? styles.pressedOpacity : null,
            ]}
            testID="compare-choose-right"
          >
            <Text variant="label" color="textHi" style={styles.boldLabel}>
              {rightName}
            </Text>
            <AvatarRing
              initial={rightName.slice(0, 1).toUpperCase()}
              size={38}
              progress={(right.score ?? 50) / 100}
              isSelf={false}
            />
          </Pressable>
        </View>

        {openSide ? (
          <View style={styles.pickerChipsWrap} testID={`compare-members-${openSide}`}>
            {selectable.map((m) => {
              const selected = m.user_id === (openSide === 'left' ? left.user_id : right.user_id);
              return (
                <Pressable
                  key={m.user_id}
                  onPress={() => onSelectSide(openSide, m.user_id)}
                  accessibilityRole="button"
                  accessibilityLabel={squadMemberName(m)}
                  style={[styles.memberPickChip, selected ? styles.memberPickChipSelected : null]}
                  testID={`compare-member-${m.user_id}`}
                >
                  <Text variant="meta" color={selected ? 'onBrand' : 'textHi'}>
                    {squadMemberName(m)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <PrimaryButton
          title={t('squadV1.compareCta')}
          onPress={onCompare}
          testID="open-two-person-compare"
        />
      </View>
    </View>
  );
}

export function SquadActivitySectionV1({
  items,
  loading,
  members,
  onPressMember,
}: {
  items: SquadActivityItem[];
  loading: boolean;
  members: RankedSquadMember[];
  onPressMember: (member: RankedSquadMember) => void;
}): React.JSX.Element {
  return (
    <View style={styles.sectionBlock} testID="squad-activity-section">
      <Text variant="eyebrow" color="textLo">
        {t('squadV1.activityHeading')}
      </Text>

      {loading && items.length === 0 ? null : items.length === 0 ? (
        <View style={styles.cardBox}>
          <Text variant="meta" color="textLo">
            {t('squadV1.activityEmpty')}
          </Text>
        </View>
      ) : (
        <View style={styles.activityList}>
          {items.map((item, idx) => {
            const matched = members.find((m) => m.user_id === item.user_id);
            const iconNode =
              item.kind === 'workout' ? (
                <DumbbellIcon size={16} color={colors.textMid} />
              ) : item.kind === 'water_goal' ? (
                <DropletIcon size={16} color={colors.textMid} />
              ) : item.kind === 'meal_logged' ? (
                <UtensilsIcon size={16} color={colors.textMid} />
              ) : (
                <UsersIcon size={16} color={colors.textMid} />
              );

            const summaryText =
              item.kind === 'workout'
                ? t('squadV1.activityWorkout', { name: item.nickname, label: item.label })
                : item.kind === 'water_goal'
                  ? t('squadV1.activityWaterGoal', { name: item.nickname })
                  : t('squadV1.activityJoined', { name: item.nickname });

            const namePrefix = item.nickname;
            const tail = summaryText.startsWith(namePrefix)
              ? summaryText.slice(namePrefix.length)
              : ` ${summaryText}`;

            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  if (matched) onPressMember(matched);
                }}
                style={[styles.activityRow, idx < items.length - 1 ? styles.leaderRowBorder : null]}
                testID={`squad-activity-${item.id}`}
              >
                <View style={styles.activityIconTile}>{iconNode}</View>
                <Text variant="body" color="textMid" style={styles.activityText}>
                  <Text variant="label" color="textHi" style={styles.boldLabel}>
                    {namePrefix}
                  </Text>
                  {tail}
                </Text>
                <Text variant="meta" color="textLo" tabular>
                  {formatActivityAgo(item.occurred_at)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function SquadInviteCardV1({
  room,
  currentUserId,
  onInviteModal,
}: {
  room: RoomSummary;
  currentUserId?: string | null;
  onInviteModal?: () => void;
}): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleInvite = async () => {
    try {
      await setStringAsync(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback cleanly
    }
    try {
      await Share.share({
        message: `Join my ${room.name} squad on CaliPartner with code ${room.code}`,
      });
    } catch {
      onInviteModal?.();
    }
  };

  const isSponsor = room.plan_holder_id && currentUserId && room.plan_holder_id === currentUserId;

  return (
    <View style={[styles.cardBox, styles.inviteCard]} testID="squad-invite-card">
      <View style={styles.activityIconTile}>
        <UsersIcon size={18} color={colors.textMid} />
      </View>
      <View style={styles.chatTextCol}>
        <Text variant="label" color="textHi" style={styles.boldLabel}>
          {t('squadV1.inviteTitle')}
        </Text>
        <Text variant="meta" color="textLo">
          {copied
            ? t('squadV1.inviteCopied', { code: room.code })
            : isSponsor
              ? t('squadV1.inviteSubtitle')
              : t('squadV1.switcherSummary', {
                  count: room.member_count,
                  sponsor: room.plan_holder_name || room.code,
                })}
        </Text>
      </View>
      <Pressable
        onPress={() => void handleInvite()}
        accessibilityRole="button"
        accessibilityLabel={t('squadV1.inviteBtn')}
        style={({ pressed }) => [styles.invitePillBtn, pressed ? styles.pressedApricot : null]}
        testID="btn-squad-invite-friends"
      >
        <Text variant="buttonS" color="onBrand">
          {t('squadV1.inviteBtn')}
        </Text>
      </Pressable>
    </View>
  );
}

export function SquadMemberSheetV1({
  visible,
  roomId,
  member,
  onClose,
  onCompare,
  onMessage,
}: {
  visible: boolean;
  roomId: string | null;
  member: RankedSquadMember | null;
  onClose: () => void;
  onCompare: (member: RankedSquadMember) => void;
  onMessage: (member: RankedSquadMember) => void;
}): React.JSX.Element | null {
  const details = useSquadDetails(roomId, member?.user_id ?? null, visible && Boolean(member));
  if (!visible || !member) return null;

  const name = squadMemberName(member);
  const pct = member.score == null ? 0 : Math.max(0, Math.min(100, Math.round(member.score)));
  const privacy = member.privacy ?? {};
  const shareSteps = member.is_self || privacy.share_steps !== false;
  const shareWater = member.is_self || privacy.share_water !== false;
  const shareWorkouts = member.is_self || privacy.share_workouts !== false;

  const workoutToday =
    member.workout_today ??
    (details.data?.workouts?.[0]
      ? {
          name: details.data.workouts[0].name,
          duration_minutes: details.data.workouts[0].duration_minutes,
        }
      : null);

  const stepsPct =
    member.tracking?.steps !== false && member.steps != null && (member.targets?.steps ?? 0) > 0
      ? Math.min(100, Math.round((member.steps / member.targets!.steps) * 100))
      : null;

  const waterPct =
    member.tracking?.water && member.water != null && (member.targets?.water ?? 0) > 0
      ? Math.min(100, Math.round((member.water / (member.targets!.water ?? 3000)) * 100))
      : null;

  const chips: string[] = [];
  if (member.goal === 'cut') chips.push('Cut goal');
  else if (member.goal === 'bulk') chips.push('Bulk goal');
  else if (member.goal === 'maintain') chips.push('Maintain goal');
  if (member.training_style) chips.push(member.training_style);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={name}
      testID="squad-member-sheet"
    >
      <View style={styles.memberSheetWrap}>
        <View style={styles.memberSheetCloseRow}>
          <IconButton
            icon={<CloseIcon size={18} color={colors.textHi} />}
            accessibilityLabel={t('squadDesign.close')}
            onPress={onClose}
            testID="btn-close-member-sheet"
          />
        </View>

        <View style={styles.memberIdentity}>
          <AvatarRing
            initial={name.slice(0, 1).toUpperCase()}
            size={76}
            progress={pct / 100}
            isSelf={!member.is_self}
          />
          <Text variant="titleM" color="textHi" style={styles.memberTitle}>
            {name}
          </Text>
          <Text variant="meta" color="textLo">
            @{member.username}
            {member.city ? ` · ${member.city}` : ''}
          </Text>

          {chips.length > 0 ? (
            <View style={styles.memberChipsRow}>
              {chips.map((chip) => (
                <View key={chip} style={styles.memberMetaChip}>
                  <Text variant="meta" color="textMid">
                    {chip}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.sectionBlock}>
          <Text variant="eyebrow" color="textLo">
            {t('squadV1.memberSharedHeading')}
          </Text>

          {shareWorkouts ? (
            <View style={[styles.memberStatRow, styles.leaderRowBorder]}>
              <View style={styles.activityIconTile}>
                <DumbbellIcon size={16} color={colors.textMid} />
              </View>
              <View style={styles.chatTextCol}>
                <Text variant="label" color="textHi">
                  {t('squadV1.memberWorkout')}
                </Text>
                <Text variant="meta" color="textLo">
                  {workoutToday
                    ? `${workoutToday.name}${workoutToday.duration_minutes ? ` · ${workoutToday.duration_minutes} min` : ''}`
                    : member.rest_day_today
                      ? t('compareV1.restDay')
                      : t('compareV1.nothingYet')}
                </Text>
              </View>
              {workoutToday ? (
                <View style={styles.checkApricotCircle}>
                  <CheckIcon size={13} color={colors.onBrand} strokeWidth={2.4} />
                </View>
              ) : null}
            </View>
          ) : null}

          {shareSteps && stepsPct != null ? (
            <View style={[styles.memberStatRow, styles.leaderRowBorder]}>
              <View style={styles.activityIconTile}>
                <PulseIcon size={16} color={colors.textMid} />
              </View>
              <Text variant="label" color="textHi" style={styles.memberStatLabel}>
                {t('squadV1.memberSteps')}
              </Text>
              <View style={styles.memberBarWrap}>
                <ProgressBar progress={stepsPct / 100} height={6} fillColor={colors.apricot} />
              </View>
              <Text variant="label" color="textHi" tabular style={styles.memberPctLabel}>
                {stepsPct}%
              </Text>
            </View>
          ) : null}

          {shareWater && waterPct != null ? (
            <View style={styles.memberStatRow}>
              <View style={styles.activityIconTile}>
                <DropletIcon size={16} color={colors.textMid} />
              </View>
              <Text variant="label" color="textHi" style={styles.memberStatLabel}>
                {t('squadV1.memberWater')}
              </Text>
              <View style={styles.memberBarWrap}>
                <ProgressBar progress={waterPct / 100} height={6} fillColor={colors.apricot} />
              </View>
              <Text variant="label" color="textHi" tabular style={styles.memberPctLabel}>
                {waterPct}%
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.privacyBanner}>
          <LockIcon size={14} color={colors.textLo} />
          <Text variant="meta" color="textLo" style={styles.flexOne}>
            {t('squadV1.memberHiddenNote', { name })}
          </Text>
        </View>

        <View style={styles.memberActionsRow}>
          {!member.is_self ? (
            <View style={styles.flexOne}>
              <PrimaryButton
                title={t('squadV1.memberCompareCta')}
                onPress={() => onCompare(member)}
                testID="btn-member-sheet-compare"
              />
            </View>
          ) : null}
          <View style={styles.flexOne}>
            <SecondaryButton
              title={t('squadV1.memberMessageCta')}
              onPress={() => onMessage(member)}
              testID="btn-member-sheet-message"
            />
          </View>
        </View>
      </View>
    </Sheet>
  );
}

export function SquadSwitcherSheetV1({
  visible,
  rooms,
  currentRoomId,
  currentUserId,
  onClose,
  onSelectRoom,
  onCreateSquad,
  onJoinByCode,
}: {
  visible: boolean;
  rooms: RoomSummary[];
  currentRoomId: string | null;
  currentUserId?: string | null;
  onClose: () => void;
  onSelectRoom: (room: RoomSummary) => void;
  onCreateSquad: () => void;
  onJoinByCode: (code: string) => Promise<void>;
}): React.JSX.Element | null {
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  if (!visible) return null;

  const submitCode = async () => {
    const clean = inviteCode.trim().toUpperCase();
    if (!clean) return;
    setJoining(true);
    setJoinError(null);
    try {
      await onJoinByCode(clean);
      setInviteCode('');
      onClose();
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : t('common.errorTitle'));
    } finally {
      setJoining(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={t('squadV1.switcherTitle')}
      testID="squad-switcher-sheet"
    >
      <View style={styles.switcherWrap}>
        <View style={styles.switcherTop}>
          <Text variant="titleM" color="textHi">
            {t('squadV1.switcherTitle')}
          </Text>
          <IconButton
            icon={<CloseIcon size={18} color={colors.textHi} />}
            accessibilityLabel={t('squadDesign.close')}
            onPress={onClose}
            testID="btn-close-switcher-sheet"
          />
        </View>

        <View style={styles.switcherList}>
          {rooms.map((item) => {
            const isActive = item.id === currentRoomId;
            const sponsor = sponsorLabelForRoom(item, currentUserId);
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  onSelectRoom(item);
                  onClose();
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: isActive }}
                accessibilityLabel={item.name}
                style={[styles.switcherRoomCard, isActive ? styles.switcherRoomActive : null]}
                testID={`btn-switch-room-${item.id}`}
              >
                <View style={styles.chatTextCol}>
                  <Text variant="label" color="textHi" style={styles.boldLabel}>
                    {item.name}
                  </Text>
                  <Text variant="meta" color="textLo">
                    {t('squadV1.membersCount', { count: item.member_count })} · {sponsor}
                  </Text>
                </View>

                <AvatarCluster size={24} />

                <View style={[styles.radioOuter, isActive ? styles.radioOuterActive : null]}>
                  {isActive ? <View style={styles.radioInner} /> : null}
                </View>
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => {
              onClose();
              onCreateSquad();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('squadV1.switcherCreateTitle')}
            style={({ pressed }) => [styles.createSquadCard, pressed ? styles.rowPressed : null]}
            testID="btn-switcher-create-room"
          >
            <View style={styles.activityIconTile}>
              <PlusIcon size={18} color={colors.textMid} />
            </View>
            <View style={styles.chatTextCol}>
              <Text variant="label" color="textHi" style={styles.boldLabel}>
                {t('squadV1.switcherCreateTitle')}
              </Text>
              <Text variant="meta" color="textLo">
                {t('squadV1.switcherCreateSub')}
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.codeRow}>
          <TextInput
            value={inviteCode}
            onChangeText={(next) => {
              setInviteCode(next);
              setJoinError(null);
            }}
            placeholder={t('squadV1.switcherCodePlaceholder')}
            placeholderTextColor={colors.textLo}
            autoCapitalize="characters"
            style={styles.codeInput}
            testID="input-switcher-invite-code"
          />
          <Pressable
            onPress={() => void submitCode()}
            disabled={joining || !inviteCode.trim()}
            accessibilityRole="button"
            accessibilityLabel={t('squadV1.switcherJoinBtn')}
            style={({ pressed }) => [
              styles.joinBtn,
              !inviteCode.trim() || joining ? styles.disabledBtn : null,
              pressed ? styles.rowPressed : null,
            ]}
            testID="btn-switcher-join"
          >
            <Text variant="buttonS" color="textHi">
              {t('squadV1.switcherJoinBtn')}
            </Text>
          </Pressable>
        </View>

        {joinError ? (
          <Text variant="meta" color="danger" accessibilityRole="alert">
            {joinError}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sectionBlock: {
    gap: space.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardBox: {
    borderRadius: radius.card,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    padding: space.lg,
  },
  pressedCard: {
    backgroundColor: colors.s2,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  chatTextCol: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  boldLabel: {
    fontFamily: fonts.bold,
  },
  newPill: {
    borderRadius: radius.full,
    backgroundColor: colors.apricot,
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs,
  },
  newPillText: {
    fontFamily: fonts.bold,
  },
  leaderList: {
    gap: space.xs,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    gap: space.md,
    minHeight: 62,
  },
  leaderRowSelf: {
    borderRadius: radius.chip,
    backgroundColor: colors.s2,
  },
  leaderRowBorder: {
    borderBottomWidth: borders.width,
    borderBottomColor: colors.hairline,
  },
  rowPressed: {
    opacity: 0.85,
  },
  pressedOpacity: {
    opacity: 0.78,
  },
  pressedApricot: {
    backgroundColor: colors.apricotPressed,
  },
  rankCol: {
    width: 14,
    textAlign: 'center',
  },
  leaderInfo: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  leaderNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  leaderPct: {
    fontSize: 19,
  },
  compareCard: {
    gap: space.lg,
  },
  comparePickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  comparePersonBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: layout.minTouchTarget,
  },
  comparePersonRight: {
    justifyContent: 'flex-end',
  },
  swapCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  memberPickChip: {
    borderRadius: radius.full,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
  },
  memberPickChipSelected: {
    backgroundColor: colors.apricot,
    borderColor: colors.apricot,
  },
  activityList: {
    gap: 0,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    minHeight: 54,
  },
  activityIconTile: {
    width: 36,
    height: 36,
    borderRadius: radius.chip,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityText: {
    flex: 1,
  },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  invitePillBtn: {
    borderRadius: radius.full,
    backgroundColor: colors.apricot,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberSheetWrap: {
    gap: space.lg,
  },
  memberSheetCloseRow: {
    alignItems: 'flex-end',
  },
  memberIdentity: {
    alignItems: 'center',
    gap: space.xs + 2,
    marginTop: -space.lg,
  },
  memberTitle: {
    marginTop: space.xs,
  },
  memberChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.sm,
    marginTop: space.xs,
  },
  memberMetaChip: {
    borderRadius: radius.full,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 1,
  },
  memberStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  memberStatLabel: {
    width: 62,
  },
  memberBarWrap: {
    flex: 1,
  },
  memberPctLabel: {
    minWidth: 38,
    textAlign: 'right',
  },
  checkApricotCircle: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.chip,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  flexOne: {
    flex: 1,
  },
  memberActionsRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  switcherWrap: {
    gap: space.md,
  },
  switcherTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switcherList: {
    gap: space.sm + 2,
  },
  switcherRoomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.card,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    padding: space.lg,
  },
  switcherRoomActive: {
    borderWidth: 1.5,
    borderColor: colors.apricot,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.hairlineLit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: colors.apricot,
    backgroundColor: colors.apricot,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.onBrand,
  },
  createSquadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.hairlineLit,
    padding: space.lg,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xs,
  },
  codeInput: {
    flex: 1,
    height: 46,
    borderRadius: radius.card,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    paddingHorizontal: space.lg,
    color: colors.textHi,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  joinBtn: {
    height: 46,
    paddingHorizontal: space.xl,
    borderRadius: radius.full,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: {
    opacity: 0.5,
  },
});
