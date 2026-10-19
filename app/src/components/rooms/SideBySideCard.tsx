import React, { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MealSection, RoomMemberSnapshot, RoomReactionType } from '@calipartner/core';
import {
  Avatar,
  dark,
  PairedCard,
  radius,
  space,
  Text,
  VisibilityEye,
  type IdentityHue,
  type MealStatus,
  type MealType,
  type RoomMemberSummary,
  type SeamState,
  type FinishedPerson,
} from '@calipartner/ui';
import { WhatTheyCanSeeSheet } from './WhatTheyCanSeeSheet';
import { PartnerMealSheet } from './PartnerMealSheet';

export interface FeedEvent {
  id: string;
  userName: string;
  avatarUrl?: string | null;
  identityHue: IdentityHue;
  actionText: string;
  timeAgo: string;
  isShared: boolean;
  itemType?: 'meal' | 'steps' | 'water' | 'workout' | 'general';
}

export interface SideBySideCardProps {
  me: RoomMemberSnapshot;
  partner: RoomMemberSnapshot | null;
  allMembers: RoomMemberSnapshot[];
  selectedPartnerId: string | null;
  onSelectPartner: (partnerId: string) => void;
  onNudge: (targetMember: RoomMemberSnapshot) => void;
  onReact: (targetMember: RoomMemberSnapshot) => void;
  onOpenChat?: () => void;
  onOpenProgress?: () => void;
  onOpenPrivacy?: () => void;
  onLogSharedMeal?: () => void;
  onSendPhoto?: () => void;
  onInviteFriend?: () => void;
  onFindPartner?: () => void;
}

/**
 * J01 & J02 · Room Today Hero Paired View (RV-1 to RV-8, STR-2)
 * Renders the state sentence, signature PairedCard (PairRing 184, Seam, PersonColumns, NudgeButton),
 * quick action text pills, and hairline feed rows with 14px visibility eye glyphs.
 */
export function SideBySideCard({
  me,
  partner,
  allMembers,
  selectedPartnerId,
  onSelectPartner,
  onNudge,
  onReact,
  onOpenChat,
  onOpenProgress,
  onOpenPrivacy,
  onLogSharedMeal,
  onSendPhoto,
  onInviteFriend,
  onFindPartner,
}: SideBySideCardProps): React.JSX.Element {
  // Modal visibility states for J04 and J07
  const [selectedEyeEvent, setSelectedEyeEvent] = useState<FeedEvent | null>(null);
  const [partnerMealSheetVisible, setPartnerMealSheetVisible] = useState(false);
  const [activeMealSection, setActiveMealSection] = useState<MealSection>('lunch');

  // Convert raw meal checklist to Record<MealType, MealStatus>
  const parseMealChecklist = (
    checklist: Record<string, boolean> | 'locked' | undefined,
  ): Record<MealType, MealStatus> => {
    if (!checklist || checklist === 'locked') {
      return {
        breakfast: { logged: false },
        lunch: { logged: false },
        dinner: { logged: false },
        snacks: { logged: false },
      };
    }
    return {
      breakfast: { logged: Boolean(checklist.breakfast) },
      lunch: { logged: Boolean(checklist.lunch) },
      dinner: { logged: Boolean(checklist.dinner) },
      snacks: { logged: Boolean(checklist.snacks) },
    };
  };

  const userMeals = useMemo(
    () => parseMealChecklist(me.metrics.meal_checklist),
    [me.metrics.meal_checklist],
  );

  const partnerMeals = useMemo(
    () => (partner ? parseMealChecklist(partner.metrics.meal_checklist) : undefined),
    [partner?.metrics.meal_checklist],
  );

  // Completion percentages
  const userPercent =
    typeof me.metrics.goal_completion === 'number' ? me.metrics.goal_completion : 0;
  const partnerPercent =
    partner && typeof partner.metrics.goal_completion === 'number'
      ? partner.metrics.goal_completion
      : 0;

  // Over goal calculation for user column (Spec 5.2: cream second lap and "320 over")
  const userOverAmount =
    userPercent > 100 && typeof me.metrics.calories === 'number' && me.metrics.calories > 2000
      ? `${me.metrics.calories - 2000}`
      : undefined;

  // Steps
  const userSteps = typeof me.metrics.steps === 'number' ? me.metrics.steps : 0;
  const partnerSteps =
    partner && typeof partner.metrics.steps === 'number' ? partner.metrics.steps : 0;

  // Logged today determination according to PRD 7.4
  const isMeLogged = me.metrics.logged_today === true;
  const isPartnerLogged = partner ? partner.metrics.logged_today === true : false;

  // Seam state calculation (PRD 5.3)
  const seamState: SeamState = useMemo(() => {
    if (!partner) return 'broken';
    if (isMeLogged && isPartnerLogged) return 'fused';
    if (isMeLogged || isPartnerLogged) return 'half-lit';
    return 'broken';
  }, [partner, isMeLogged, isPartnerLogged]);

  const finishedPerson: FinishedPerson = isMeLogged ? 'user' : 'partner';

  // Streak days
  const streakDays = isMeLogged && isPartnerLogged ? 1 : 0;

  // State sentence above the paired card (Spec J01 #2)
  const stateSentence = useMemo(() => {
    if (!partner) {
      return 'Find a partner or invite a friend to log together.';
    }
    if (isMeLogged && isPartnerLogged) {
      return "You've both finished logging today.";
    }
    if (isMeLogged && !isPartnerLogged) {
      return `${partner.nickname} hasn't logged yet today.`;
    }
    if (!isMeLogged && isPartnerLogged) {
      return 'You haven’t finished logging today.';
    }
    return 'Neither of you has finished logging today.';
  }, [partner, isMeLogged, isPartnerLogged]);

  // Member summaries for 3+ member rooms (Spec J02)
  const memberSummaries: RoomMemberSummary[] = useMemo(() => {
    return allMembers.map((m, idx) => ({
      id: m.user_id,
      name: m.nickname,
      avatarUrl: m.avatar_url ?? undefined,
      identityHue: idx % 2 === 0 ? 'iris' : 'teal',
      percent: typeof m.metrics.goal_completion === 'number' ? m.metrics.goal_completion : 0,
      hasLoggedToday: m.metrics.logged_today === true,
    }));
  }, [allMembers]);

  // Feed items for plain feed rows (Spec J01 #6)
  const feedItems: FeedEvent[] = useMemo(() => {
    const items: FeedEvent[] = [];
    if (partner) {
      if (partner.metrics.logged_today === true) {
        items.push({
          id: `feed-${partner.user_id}-logged`,
          userName: partner.nickname,
          avatarUrl: partner.avatar_url,
          identityHue: 'teal',
          actionText: `${partner.nickname} completed today's target`,
          timeAgo: 'Just now',
          isShared: true,
          itemType: 'meal',
        });
      }
      if (partnerMeals?.lunch?.logged) {
        items.push({
          id: `feed-${partner.user_id}-lunch`,
          userName: partner.nickname,
          avatarUrl: partner.avatar_url,
          identityHue: 'teal',
          actionText: `${partner.nickname} logged lunch`,
          timeAgo: '2h ago',
          isShared: true,
          itemType: 'meal',
        });
      }
    }
    if (userMeals.breakfast.logged) {
      items.push({
        id: `feed-${me.user_id}-breakfast`,
        userName: 'You',
        avatarUrl: me.avatar_url,
        identityHue: 'iris',
        actionText: 'You logged breakfast',
        timeAgo: '4h ago',
        isShared: true,
        itemType: 'meal',
      });
    }
    return items;
  }, [me, partner, partnerMeals, userMeals]);

  return (
    <View style={styles.container} testID="side-by-side-card-wrapper">
      {/* 1. State sentence above card (Spec J01 #2) */}
      <View style={styles.stateSentenceWrap}>
        <Text variant="bodyS" color={dark.textMid} style={styles.stateSentenceText}>
          {stateSentence}
        </Text>
      </View>

      {/* 2. Signature PairedCard (Spec J01 #4) */}
      <PairedCard
        userName="You"
        userHue="iris"
        userPercent={userPercent}
        userOverAmount={userOverAmount}
        userSteps={userSteps}
        userMeals={userMeals}
        hasPartner={Boolean(partner)}
        partnerName={partner?.nickname ?? 'Partner'}
        partnerHue="teal"
        partnerPercent={partnerPercent}
        partnerSteps={partnerSteps}
        partnerMeals={partnerMeals}
        isPartnerDataHidden={partner?.metrics.goal_completion === 'locked'}
        isPartnerPaused={partner?.status === 'paused'}
        seamState={seamState}
        finishedPerson={finishedPerson}
        streakDays={streakDays}
        onNudge={() => partner && onNudge(partner)}
        onInviteFriend={onInviteFriend}
        onFindPartner={onFindPartner}
        onPressRing={onOpenProgress}
        onReactMeal={() => partner && onReact(partner)}
        onLongPressMeal={(meal) => {
          setActiveMealSection(meal);
          setPartnerMealSheetVisible(true);
        }}
        members={memberSummaries}
        selectedMemberId={selectedPartnerId ?? undefined}
        onSelectMember={onSelectPartner}
        testID="hero-paired-card"
      />

      {/* 3. Quick Actions: Three text pills (Spec J01 #5, RV-6) */}
      <View style={styles.quickActionsRow} testID="quick-actions-row">
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onLogSharedMeal}
          style={styles.quickActionPill}
          accessibilityRole="button"
          accessibilityLabel="Log a shared meal"
          testID="btn-quick-shared-meal"
        >
          <Ionicons name="restaurant-outline" size={14} color={dark.textHi} />
          <Text variant="label" color={dark.textHi}>
            Log a shared meal
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onSendPhoto || onOpenChat}
          style={styles.quickActionPill}
          accessibilityRole="button"
          accessibilityLabel="Send a photo"
          testID="btn-quick-send-photo"
        >
          <Ionicons name="camera-outline" size={14} color={dark.textHi} />
          <Text variant="label" color={dark.textHi}>
            Send a photo
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onOpenChat}
          style={styles.quickActionPill}
          accessibilityRole="button"
          accessibilityLabel="Open chat"
          testID="btn-quick-open-chat"
        >
          <Ionicons name="chatbubble-outline" size={14} color={dark.textHi} />
          <Text variant="label" color={dark.textHi}>
            Open chat
          </Text>
        </TouchableOpacity>
      </View>

      {/* 4. Plain Feed: Rows without cards separated by hairlines (Spec J01 #6, RV-7) */}
      {feedItems.length > 0 && (
        <View style={styles.feedSection} testID="room-activity-feed">
          <Text variant="micro" color={dark.textLo} style={styles.feedSectionTitle}>
            Recent activity
          </Text>
          <View style={styles.feedList}>
            {feedItems.map((item, idx) => (
              <View key={item.id}>
                {idx > 0 && <View style={styles.feedHairline} />}
                <View style={styles.feedRow} testID={`feed-row-${item.id}`}>
                  <Avatar
                    size="xs"
                    name={item.userName}
                    uri={item.avatarUrl ?? undefined}
                    identityHue={item.identityHue}
                  />
                  <Text variant="bodyS" color={dark.textHi} style={styles.feedActionText} numberOfLines={1}>
                    {item.actionText}
                  </Text>
                  <Text variant="micro" color={dark.textLo}>
                    {item.timeAgo}
                  </Text>
                  {item.isShared && (
                    <VisibilityEye
                      audience="Room members"
                      description={`${item.userName} shared this update with members of this room.`}
                      onOpenPrivacySettings={onOpenPrivacy}
                      testID={`btn-eye-${item.id}`}
                    />
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* J04 "Who sees this" Visibility Sheet */}
      <WhatTheyCanSeeSheet
        visible={Boolean(selectedEyeEvent)}
        onClose={() => setSelectedEyeEvent(null)}
        onOpenPrivacy={onOpenPrivacy}
        partnerName={partner?.nickname ?? 'Your partner'}
        itemType={selectedEyeEvent?.itemType ?? 'meal'}
      />

      {/* J07 Partner's Meal Viewer Sheet */}
      {partner && (
        <PartnerMealSheet
          visible={partnerMealSheetVisible}
          onClose={() => setPartnerMealSheetVisible(false)}
          partnerName={partner.nickname}
          mealSection={activeMealSection}
          isLogged={Boolean(
            activeMealSection !== 'extra' &&
              partnerMeals?.[activeMealSection as MealType]?.logged,
          )}
          isDataHidden={partner.metrics.meal_checklist === 'locked'}
          onSendReaction={(reaction: RoomReactionType) => {
            onReact(partner);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: space[3],
    gap: space[3],
  },
  stateSentenceWrap: {
    paddingHorizontal: space[2],
    paddingTop: space[1],
  },
  stateSentenceText: {
    fontSize: 13,
    lineHeight: 18,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: space[2],
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space[1],
  },
  quickActionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: space[2],
    borderRadius: radius.control,
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    minHeight: 44,
  },
  feedSection: {
    marginTop: space[3],
    gap: space[2],
  },
  feedSectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: space[2],
  },
  feedList: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
    paddingVertical: space[2] + 2,
    minHeight: 44,
  },
  feedHairline: {
    height: 1,
    backgroundColor: dark.hairline,
    marginLeft: space[8],
  },
  feedActionText: {
    flex: 1,
  },
  eyeTouchArea: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
