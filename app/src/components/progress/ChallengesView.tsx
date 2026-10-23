import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, PairRing, dark, radius, space, type } from '@calipartner/ui';
import { t } from '@/i18n';
import { ChallengeDetailData, ChallengeDetailModal } from './ChallengeDetailModal';
import { ChallengeCreatedPayload, CreateChallengeModal } from './CreateChallengeModal';
import { OccasionPlanModal } from './OccasionPlanModal';
import { ChallengeResultModal } from './ChallengeResultModal';

type ChallengeSegment = 'all' | 'active' | 'seasonal' | 'occasion' | 'completed';

interface ChallengesViewProps {
  testID?: string;
}

const DEFAULT_ACTIVE_CHALLENGES: ChallengeDetailData[] = [
  {
    id: 'ch-active-1',
    title: 'Daily Steps Sprint',
    activity: 'Walking',
    icon: 'footsteps-outline',
    currentDay: 4,
    totalDays: 7,
    startDate: 'Oct 16',
    endDate: 'Oct 22',
    todaysTask: '8,000 steps today',
    userProgressPct: 75,
    partnerProgressPct: 60,
    partnerNickname: 'Priya',
    feed: [
      { id: 'f1', user: 'Priya', text: 'Reached 8,240 steps!', timeAgo: '2h ago' },
      { id: 'f2', user: 'You', text: 'Logged 6,500 steps so far', timeAgo: '4h ago' },
      { id: 'f3', user: 'Priya', text: 'Completed day 3', timeAgo: '1d ago' },
    ],
  },
  {
    id: 'ch-active-2',
    title: 'Deep Study 60',
    activity: 'Studying',
    icon: 'book-outline',
    currentDay: 2,
    totalDays: 7,
    startDate: 'Oct 18',
    endDate: 'Oct 24',
    todaysTask: '60 minutes focus session',
    userProgressPct: 50,
    partnerProgressPct: 80,
    partnerNickname: 'Rahul',
    feed: [
      { id: 'f4', user: 'Rahul', text: 'Completed 90m deep study', timeAgo: '1h ago' },
      { id: 'f5', user: 'You', text: 'Finished 45m session', timeAgo: '3h ago' },
    ],
  },
];

const SEASONAL_CHALLENGES = [
  {
    id: 'seasonal-1',
    title: 'Winter Arc Discipline',
    subtitle: '75 days of non-negotiable movement and daily hydration.',
    days: '75 days',
    participants: '1,420 joined',
    icon: 'snow-outline' as const,
    gradient: 'iris' as const,
  },
  {
    id: 'seasonal-2',
    title: 'New Year Habit Reset',
    subtitle: '30 days of consistent nutrition tracking with your partner.',
    days: '30 days',
    participants: '3,890 joined',
    icon: 'sparkles-outline' as const,
    gradient: 'apricot' as const,
  },
  {
    id: 'seasonal-3',
    title: 'Summer Consistency',
    subtitle: 'Hit your step and workout goals 5 days a week.',
    days: '60 days',
    participants: '850 joined',
    icon: 'sunny-outline' as const,
    gradient: 'teal' as const,
  },
];

const COMPLETED_CHALLENGES = [
  {
    id: 'comp-1',
    title: 'Hydration Kickstart',
    daysCompleted: 7,
    totalDays: 7,
    partner: 'Priya',
    completedDate: 'Last week',
  },
  {
    id: 'comp-2',
    title: 'Weekend Warrior',
    daysCompleted: 2,
    totalDays: 2,
    partner: 'Rahul',
    completedDate: '2 weeks ago',
  },
];

export function ChallengesView({ testID = 'challenges-view' }: ChallengesViewProps) {
  const [activeSegment, setActiveSegment] = useState<ChallengeSegment>('all');
  const [activeChallenges, setActiveChallenges] =
    useState<ChallengeDetailData[]>(DEFAULT_ACTIVE_CHALLENGES);
  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeDetailData | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showOccasionModal, setShowOccasionModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [completedResultTitle, setCompletedResultTitle] = useState('Hydration Kickstart');

  const handleCreateSubmit = (payload: ChallengeCreatedPayload) => {
    const newChallenge: ChallengeDetailData = {
      id: `ch-user-${Date.now()}`,
      title:
        payload.customName ||
        `${payload.activity.charAt(0).toUpperCase() + payload.activity.slice(1)} Challenge`,
      activity: payload.activity,
      icon:
        payload.activity === 'walking'
          ? 'footsteps-outline'
          : payload.activity === 'running'
            ? 'walk-outline'
            : payload.activity === 'studying'
              ? 'book-outline'
              : payload.activity === 'gym'
                ? 'barbell-outline'
                : payload.activity === 'cycling'
                  ? 'bicycle-outline'
                  : 'sparkles-outline',
      currentDay: 1,
      totalDays: payload.durationDays,
      startDate: 'Today',
      endDate: `${payload.durationDays} days`,
      todaysTask: `${payload.goalValue.toLocaleString()} ${payload.unit} today`,
      userProgressPct: 0,
      partnerProgressPct: 0,
      partnerNickname: payload.partnerNickname ?? 'Partner',
      feed: [{ id: 'f-init', user: 'You', text: 'Started this challenge', timeAgo: 'Just now' }],
    };

    setActiveChallenges((prev) => [newChallenge, ...prev]);
  };

  const handleLeaveChallenge = (id: string) => {
    setActiveChallenges((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <View style={styles.container} testID={testID}>
      {/* Top Header Row with Create Challenge CTA */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.headerTitle}>{t('progress.challenges.title')}</Text>
          <Text style={styles.headerSub}>Streaks, seasons and partner plans</Text>
        </View>

        <Pressable
          style={styles.createBtn}
          onPress={() => setShowCreateModal(true)}
          accessibilityRole="button"
          accessibilityLabel={t('progress.challenges.createChallenge')}
          testID={`${testID}-create-btn`}
        >
          <Ionicons name="add" size={18} color={dark.onBrand} />
          <Text style={styles.createBtnText}>{t('progress.challenges.createChallenge')}</Text>
        </Pressable>
      </View>

      {/* Segment Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'active', label: 'Active' },
            { id: 'seasonal', label: 'Seasonal' },
            { id: 'occasion', label: 'Occasion' },
            { id: 'completed', label: 'Completed' },
          ] as { id: ChallengeSegment; label: string }[]
        ).map((seg) => {
          const isSelected = activeSegment === seg.id;
          return (
            <Pressable
              key={seg.id}
              style={[styles.filterChip, isSelected && styles.filterChipSelected]}
              onPress={() => setActiveSegment(seg.id)}
              accessibilityRole="tab"
              accessibilityLabel={`Filter by ${seg.label}`}
              accessibilityState={{ selected: isSelected }}
              testID={`${testID}-tab-${seg.id}`}
            >
              <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                {seg.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* 1. Active Challenges Section */}
      {(activeSegment === 'all' || activeSegment === 'active') && (
        <View style={styles.section} testID={`${testID}-active-section`}>
          <Text style={styles.sectionHeader}>Active Challenges</Text>

          {activeChallenges.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="ribbon-outline" size={32} color={dark.textLo} />
              <Text style={styles.emptyText}>{t('progress.challenges.noActive')}</Text>
            </View>
          ) : (
            <View style={styles.challengesGrid}>
              {activeChallenges.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.challengeCard}
                  onPress={() => setSelectedChallenge(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}, Day ${item.currentDay} of ${item.totalDays}`}
                  testID={`${testID}-card-${item.id}`}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.cardIconBox}>
                      <Ionicons name={item.icon} size={20} color={dark.apricot} />
                    </View>
                    <View style={styles.dayPill}>
                      <Text style={styles.dayPillText}>
                        Day {item.currentDay} of {item.totalDays}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardTask}>{item.todaysTask}</Text>

                  {/* Paired progress display */}
                  <View style={styles.cardProgressRow}>
                    <PairRing
                      userPercent={item.userProgressPct}
                      partnerPercent={item.partnerProgressPct}
                      size={64}
                      userHue="iris"
                      partnerHue="teal"
                    />
                    <View style={styles.progressTextCol}>
                      <Text style={styles.progressLabel}>
                        You: {Math.round(item.userProgressPct)}%
                      </Text>
                      <Text style={styles.progressLabel}>
                        {item.partnerNickname}: {Math.round(item.partnerProgressPct)}%
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {/* 2. Seasonal Challenges Section (M13) */}
      {(activeSegment === 'all' || activeSegment === 'seasonal') && (
        <View style={styles.section} testID={`${testID}-seasonal-section`}>
          <Text style={styles.sectionHeader}>Seasonal Challenges</Text>
          <View style={styles.seasonalStack}>
            {SEASONAL_CHALLENGES.map((season) => (
              <View
                key={season.id}
                style={styles.seasonalCard}
                testID={`${testID}-seasonal-${season.id}`}
              >
                <View style={styles.seasonalHeader}>
                  <View style={styles.seasonalIconBox}>
                    <Ionicons name={season.icon} size={22} color={dark.apricot} />
                  </View>
                  <View style={styles.seasonalMetaPill}>
                    <Text style={styles.seasonalMetaText}>{season.days}</Text>
                  </View>
                </View>

                <Text style={styles.seasonalTitle}>{season.title}</Text>
                <Text style={styles.seasonalSub}>{season.subtitle}</Text>

                <View style={styles.seasonalFooter}>
                  <Text style={styles.participantText}>{season.participants}</Text>
                  <Pressable
                    style={styles.joinBtn}
                    onPress={() => {
                      handleCreateSubmit({
                        activity: 'walking',
                        goalValue: 8000,
                        unit: 'steps a day',
                        durationDays: 30,
                        isWholeRoom: true,
                      });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Join ${season.title}`}
                  >
                    <Text style={styles.joinBtnText}>Join challenge</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 3. Occasion Plans Section (M16) */}
      {(activeSegment === 'all' || activeSegment === 'occasion') && (
        <View style={styles.section} testID={`${testID}-occasion-section`}>
          <Text style={styles.sectionHeader}>Occasion Plans</Text>
          <Pressable
            style={styles.occasionBanner}
            onPress={() => setShowOccasionModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Plan for an event"
            testID={`${testID}-open-occasion-btn`}
          >
            <View style={styles.occasionContent}>
              <View style={styles.occasionTagRow}>
                <Ionicons name="calendar-outline" size={16} color={dark.apricot} />
                <Text style={styles.occasionTag}>Partner Event Planning</Text>
              </View>
              <Text style={styles.occasionTitle}>Plan for an event</Text>
              <Text style={styles.occasionSub}>
                Build a safe, realistic timeline with your partner before a wedding, birthday, or
                vacation.
              </Text>
            </View>
            <View style={styles.occasionAction}>
              <Text style={styles.occasionActionText}>Start plan →</Text>
            </View>
          </Pressable>
        </View>
      )}

      {/* 4. Completed Challenges Section (M17) */}
      {(activeSegment === 'all' || activeSegment === 'completed') && (
        <View style={styles.section} testID={`${testID}-completed-section`}>
          <Text style={styles.sectionHeader}>Completed Challenges</Text>
          <View style={styles.completedList}>
            {COMPLETED_CHALLENGES.map((comp) => (
              <Pressable
                key={comp.id}
                style={styles.completedRow}
                onPress={() => {
                  setCompletedResultTitle(comp.title);
                  setShowResultModal(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${comp.title}, completed`}
                testID={`${testID}-comp-${comp.id}`}
              >
                <View style={styles.checkIconBox}>
                  <Ionicons name="checkmark" size={16} color={dark.cream} />
                </View>
                <View style={styles.completedInfo}>
                  <Text style={styles.completedTitle}>{comp.title}</Text>
                  <Text style={styles.completedSub}>
                    {comp.daysCompleted} of {comp.totalDays} days with {comp.partner} •{' '}
                    {comp.completedDate}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={dark.textLo} />
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Modals */}
      <CreateChallengeModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateSubmit}
        partnerNickname="Priya"
        testID={`${testID}-create-modal`}
      />

      <ChallengeDetailModal
        visible={Boolean(selectedChallenge)}
        challenge={selectedChallenge}
        onClose={() => setSelectedChallenge(null)}
        onLeave={handleLeaveChallenge}
        testID={`${testID}-detail-modal`}
      />

      <OccasionPlanModal
        visible={showOccasionModal}
        onClose={() => setShowOccasionModal(false)}
        onMakeRoomChallenge={(plan) => {
          handleCreateSubmit({
            activity: 'walking',
            customName: `${plan.event.toUpperCase()} Target Sprint`,
            goalValue: 8000,
            unit: 'steps a day',
            durationDays: 30,
            isWholeRoom: true,
          });
        }}
        testID={`${testID}-occasion-modal`}
      />

      <ChallengeResultModal
        visible={showResultModal}
        challengeTitle={completedResultTitle}
        completedDays={7}
        totalDays={7}
        onClose={() => setShowResultModal(false)}
        onShareToChat={() => setShowResultModal(false)}
        onStartAnother={() => {
          setShowResultModal(false);
          setShowCreateModal(true);
        }}
        testID={`${testID}-result-modal`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: space[8],
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingTop: space[3],
    paddingBottom: space[2],
  },
  headerTitle: {
    ...type.title1,
    color: dark.textHi,
  },
  headerSub: {
    ...type.bodyS,
    color: dark.textLo,
    marginTop: 2,
  },
  createBtn: {
    height: 44,
    paddingHorizontal: space[3],
    borderRadius: radius.button,
    backgroundColor: dark.apricot,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  createBtnText: {
    ...type.label,
    color: dark.onBrand,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    gap: space[2],
    paddingHorizontal: space[4],
    marginVertical: space[2],
  },
  filterChip: {
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipSelected: {
    backgroundColor: 'rgba(244, 182, 125, 0.16)',
    borderColor: dark.apricot,
  },
  filterChipText: {
    ...type.label,
    color: dark.textMid,
  },
  filterChipTextSelected: {
    color: dark.apricot,
    fontWeight: '700',
  },
  section: {
    marginTop: space[3],
    paddingHorizontal: space[4],
  },
  sectionHeader: {
    ...type.label,
    color: dark.textLo,
    marginBottom: space[2],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  challengesGrid: {
    gap: space[3],
  },
  challengeCard: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[4],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space[2],
  },
  cardIconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.control,
    backgroundColor: dark.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPill: {
    backgroundColor: dark.s2,
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  dayPillText: {
    ...type.label,
    color: dark.textMid,
    fontSize: 11,
  },
  cardTitle: {
    ...type.heading,
    color: dark.textHi,
  },
  cardTask: {
    ...type.bodyS,
    color: dark.apricot,
    marginTop: 2,
    fontWeight: '600',
  },
  cardProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    marginTop: space[3],
  },
  progressTextCol: {
    flex: 1,
    gap: 4,
  },
  progressLabel: {
    ...type.label,
    color: dark.textMid,
  },
  emptyCard: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[5],
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  emptyText: {
    ...type.bodyS,
    color: dark.textLo,
    textAlign: 'center',
    lineHeight: 20,
  },
  seasonalStack: {
    gap: space[3],
  },
  seasonalCard: {
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[4],
    borderWidth: 1,
    borderColor: dark.hairlineLit,
  },
  seasonalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space[2],
  },
  seasonalIconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
    backgroundColor: dark.s3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seasonalMetaPill: {
    backgroundColor: dark.s3,
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  seasonalMetaText: {
    ...type.label,
    color: dark.textMid,
  },
  seasonalTitle: {
    ...type.title2,
    color: dark.textHi,
  },
  seasonalSub: {
    ...type.bodyS,
    color: dark.textMid,
    marginTop: 4,
    lineHeight: 20,
  },
  seasonalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space[3],
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: dark.hairline,
  },
  participantText: {
    ...type.label,
    color: dark.textLo,
  },
  joinBtn: {
    height: 38,
    paddingHorizontal: space[3],
    borderRadius: radius.button,
    backgroundColor: dark.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtnText: {
    ...type.label,
    color: dark.onBrand,
    fontWeight: '700',
  },
  occasionBanner: {
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[4],
    borderWidth: 1,
    borderColor: dark.hairlineLit,
  },
  occasionContent: {
    marginBottom: space[3],
  },
  occasionTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    marginBottom: 4,
  },
  occasionTag: {
    ...type.label,
    color: dark.apricot,
    fontWeight: '600',
  },
  occasionTitle: {
    ...type.title2,
    color: dark.textHi,
  },
  occasionSub: {
    ...type.bodyS,
    color: dark.textMid,
    marginTop: 4,
    lineHeight: 20,
  },
  occasionAction: {
    alignSelf: 'flex-start',
  },
  occasionActionText: {
    ...type.heading,
    color: dark.apricot,
  },
  completedList: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    paddingHorizontal: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.hairline,
    gap: space[3],
  },
  checkIconBox: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: dark.s3,
    borderWidth: 1,
    borderColor: dark.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedInfo: {
    flex: 1,
  },
  completedTitle: {
    ...type.heading,
    color: dark.textHi,
  },
  completedSub: {
    ...type.label,
    color: dark.textLo,
    marginTop: 2,
  },
});
