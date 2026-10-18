import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { dark, type IdentityHue, getIdentityColor } from '../tokens/colors';
import { space } from '../tokens/space';
import { Card } from './Card';
import { Text } from './Text';
import { Button } from './Button';
import { PairRing } from './PairRing';
import { Seam, SeamCaption, type SeamState, type FinishedPerson } from './Seam';
import { PersonColumn, type MealStatus, type MealType } from './PersonColumn';
import { NudgeButton } from './NudgeButton';
import { Avatar } from './Avatar';

export interface RoomMemberSummary {
  id: string;
  name: string;
  avatarUrl?: string;
  identityHue: IdentityHue;
  percent: number;
  hasLoggedToday: boolean;
}

export interface PairedCardProps {
  /** User name (default "You") */
  userName?: string;
  /** User identity hue (default 'iris') */
  userHue?: IdentityHue;
  /** User completion percent */
  userPercent: number;
  /** Calories over user goal if > 100% (e.g. "320 over") */
  userOverAmount?: string | number;
  /** Calories remaining */
  userRemainingAmount?: string | number;
  /** User steps */
  userSteps?: number;
  /** User steps goal */
  userStepsGoal?: number;
  /** User meals status */
  userMeals?: Record<MealType, MealStatus>;

  /** Whether a partner is connected in this room (Spec J01: No partner yet) */
  hasPartner?: boolean;
  /** Partner name (default "Priya") */
  partnerName?: string;
  /** Partner identity hue (default 'teal') */
  partnerHue?: IdentityHue;
  /** Partner completion percent */
  partnerPercent?: number;
  /** Partner steps */
  partnerSteps?: number;
  /** Partner meals status */
  partnerMeals?: Record<MealType, MealStatus>;
  /** Whether partner hides data (Spec CMP-25) */
  isPartnerDataHidden?: boolean;
  /** Whether partner is paused */
  isPartnerPaused?: boolean;
  /** Partner paused until date */
  partnerPauseUntilDate?: string;

  /** Seam state: 'broken' | 'half-lit' | 'fused' */
  seamState?: SeamState;
  /** Finished person when half-lit */
  finishedPerson?: FinishedPerson;
  /** Streak days for fused caption */
  streakDays?: number;

  /** Nudge count sent today */
  nudgesSentToday?: number;
  /** Nudge callback */
  onNudge?: () => void;
  /** Nudge limit message callback */
  onNudgeLimit?: (message: string) => void;

  /** Callbacks for "No partner yet" state */
  onInviteFriend?: () => void;
  onFindPartner?: () => void;

  /** Optional list of 3+ room members for avatar comparison selector (Spec J02) */
  members?: RoomMemberSummary[];
  /** Selected partner ID when members > 2 */
  selectedMemberId?: string;
  /** Callback when switching partner in 3+ member room */
  onSelectMember?: (memberId: string) => void;

  /** Force reflow mode for testing or high text scale */
  forceReflow?: boolean;
  /** Accessibility role for card */
  accessibilityRole?: 'summary' | 'button' | 'none';
  accessibilityLabel?: string;
  /** Custom test ID */
  testID?: string;
}

export function PairedCard({
  userName = 'You',
  userHue = 'iris',
  userPercent,
  userOverAmount,
  userRemainingAmount,
  userSteps = 0,
  userStepsGoal = 10000,
  userMeals,
  hasPartner = true,
  partnerName = 'Priya',
  partnerHue = 'teal',
  partnerPercent = 0,
  partnerSteps = 0,
  partnerMeals,
  isPartnerDataHidden = false,
  isPartnerPaused = false,
  partnerPauseUntilDate,
  seamState = 'broken',
  finishedPerson = 'user',
  streakDays = 1,
  nudgesSentToday = 0,
  onNudge,
  onNudgeLimit,
  onInviteFriend,
  onFindPartner,
  members,
  selectedMemberId,
  onSelectMember,
  forceReflow = false,
  accessibilityRole = 'summary',
  accessibilityLabel,
  testID = 'paired-card',
}: PairedCardProps): React.JSX.Element {
  const { width } = useWindowDimensions();

  // Reflow to stacked columns when screen is narrower than 340dp or forced (Spec 5.4)
  const isReflow = forceReflow || width < 340;

  const a11ySummary = hasPartner
    ? `Paired room summary with ${partnerName}. Your goal: ${Math.round(userPercent)}% complete. ${partnerName}'s goal: ${Math.round(partnerPercent)}% complete.`
    : `Room summary. Your goal: ${Math.round(userPercent)}% complete. Partner slot is open.`;

  return (
    <Card
      elevation="s1"
      style={styles.card}
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel || a11ySummary}
    >
      {/* 3+ Members Avatar Strip Selector (Spec J02) */}
      {members && members.length > 2 && (
        <View style={styles.membersStrip}>
          <Text variant="micro" color={dark.textMid} style={styles.stripTitle}>
            Compare with partner:
          </Text>
          <View style={styles.avatarRow}>
            {members.map((m) => {
              const isSelected = m.id === selectedMemberId;
              const memberColor = getIdentityColor(m.identityHue);
              return (
                <TouchableOpacity
                  key={m.id}
                  activeOpacity={0.7}
                  onPress={() => onSelectMember?.(m.id)}
                  style={styles.memberAvatarWrapper}
                >
                  <Avatar
                    size="sm"
                    name={m.name}
                    uri={m.avatarUrl}
                    identityHue={m.identityHue}
                    presence={m.hasLoggedToday}
                  />
                  {isSelected && <View style={[styles.activeDot, { backgroundColor: memberColor }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Hero PairRing centered */}
      <View style={styles.ringSection}>
        <PairRing
          size={isReflow ? 120 : 184}
          userPercent={userPercent}
          partnerPercent={partnerPercent}
          partnerName={partnerName}
          userHue={userHue}
          partnerHue={partnerHue}
          hasPartner={hasPartner}
          remainingAmount={userRemainingAmount}
          overAmount={userOverAmount}
        />
      </View>

      {/* Main Paired Columns View */}
      {isReflow ? (
        // Stacked Layout (Spec 5.4 reflow for large text or narrow screens)
        <View style={styles.stackedLayout}>
          {/* User Column */}
          <PersonColumn
            side="left"
            name={userName}
            identityHue={userHue}
            percent={userPercent}
            overAmount={userOverAmount}
            steps={userSteps}
            stepsGoal={userStepsGoal}
            meals={userMeals}
          />

          {/* Horizontal Seam */}
          <View style={styles.horizontalSeamWrapper}>
            <Seam
              state={seamState}
              finishedPerson={finishedPerson}
              userHue={userHue}
              partnerHue={partnerHue}
              partnerName={partnerName}
              orientation="horizontal"
              length={280}
            />
          </View>

          {/* Partner Column or Placeholder */}
          {hasPartner ? (
            <PersonColumn
              side="right"
              name={partnerName}
              identityHue={partnerHue}
              percent={partnerPercent}
              steps={partnerSteps}
              meals={partnerMeals}
              isDataHidden={isPartnerDataHidden}
              isPaused={isPartnerPaused}
              pauseUntilDate={partnerPauseUntilDate}
            />
          ) : (
            <View style={styles.emptyPartnerBox}>
              <Text variant="heading" color={dark.textHi}>
                Invite a friend
              </Text>
              <Text variant="bodyS" color={dark.textMid} style={styles.emptySubtitle}>
                Sync daily meals, water, and streaks together.
              </Text>
              <View style={styles.emptyButtonRow}>
                <Button
                  variant="primary"
                  size="sm"
                  label="Invite friend"
                  onPress={onInviteFriend}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  label="Find partner"
                  onPress={onFindPartner}
                />
              </View>
            </View>
          )}
        </View>
      ) : (
        // Standard Side-by-Side Layout (Spec J01)
        <View style={styles.columnsWrapper}>
          {/* Left: You */}
          <View style={styles.columnHalf}>
            <PersonColumn
              side="left"
              name={userName}
              identityHue={userHue}
              percent={userPercent}
              overAmount={userOverAmount}
              steps={userSteps}
              stepsGoal={userStepsGoal}
              meals={userMeals}
            />
          </View>

          {/* Center Seam + Centered Nudge Button */}
          <View style={styles.seamCenterContainer}>
            <Seam
              state={seamState}
              finishedPerson={finishedPerson}
              userHue={userHue}
              partnerHue={partnerHue}
              partnerName={partnerName}
              length={210}
            />
            {hasPartner && (
              <View style={styles.nudgeAbsolute}>
                <NudgeButton
                  partnerName={partnerName}
                  partnerHue={partnerHue}
                  nudgesSentToday={nudgesSentToday}
                  onNudge={onNudge}
                  onLimitReached={onNudgeLimit}
                />
              </View>
            )}
          </View>

          {/* Right: Partner or Dashed Placeholder */}
          <View style={styles.columnHalf}>
            {hasPartner ? (
              <PersonColumn
                side="right"
                name={partnerName}
                identityHue={partnerHue}
                percent={partnerPercent}
                steps={partnerSteps}
                meals={partnerMeals}
                isDataHidden={isPartnerDataHidden}
                isPaused={isPartnerPaused}
                pauseUntilDate={partnerPauseUntilDate}
              />
            ) : (
              <View style={styles.emptyPartnerDashed}>
                <Text variant="label" color={dark.apricot}>
                  Partner spot open
                </Text>
                <Text variant="micro" color={dark.textMid} style={styles.emptyDashedText}>
                  Hit your daily calorie targets together.
                </Text>
                <Button
                  variant="primary"
                  size="sm"
                  label="Invite a friend"
                  onPress={onInviteFriend}
                  style={styles.dashedActionBtn}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  label="Find a partner"
                  onPress={onFindPartner}
                />
              </View>
            )}
          </View>
        </View>
      )}

      {/* Seam Caption under Card (Spec 5.3) */}
      <SeamCaption
        state={seamState}
        finishedPerson={finishedPerson}
        partnerName={partnerName}
        streakDays={streakDays}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space[4],
    width: '100%',
  },
  ringSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[4],
  },
  columnsWrapper: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    minHeight: 210,
    position: 'relative',
  },
  columnHalf: {
    flex: 1,
  },
  seamCenterContainer: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  nudgeAbsolute: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -22 }, { translateY: -22 }],
    zIndex: 10,
  },
  emptyPartnerDashed: {
    flex: 1,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: dark.hairlineLit,
    borderRadius: 16,
    padding: space[3],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dark.s2,
    gap: space[2],
  },
  emptyDashedText: {
    textAlign: 'center',
    marginVertical: 4,
  },
  dashedActionBtn: {
    width: '100%',
  },
  stackedLayout: {
    gap: space[4],
  },
  horizontalSeamWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: space[2],
  },
  emptyPartnerBox: {
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    borderRadius: 16,
    padding: space[4],
    backgroundColor: dark.s2,
    alignItems: 'center',
    gap: space[2],
  },
  emptySubtitle: {
    textAlign: 'center',
  },
  emptyButtonRow: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[2],
  },
  membersStrip: {
    marginBottom: space[4],
    gap: space[2],
  },
  stripTitle: {
    fontSize: 11,
  },
  avatarRow: {
    flexDirection: 'row',
    gap: space[3],
    alignItems: 'center',
  },
  memberAvatarWrapper: {
    alignItems: 'center',
    position: 'relative',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
});
