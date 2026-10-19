import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, dark, radius, space, type } from '@calipartner/ui';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { t } from '@/i18n';
import { MondayRecapModal } from './MondayRecapModal';

interface LeaderboardViewProps {
  testID?: string;
}

type DivisionType = 'cutting' | 'bulking' | 'maintain' | 'beginner';

const DIVISIONS: { id: DivisionType; label: string }[] = [
  { id: 'cutting', label: 'Cutting' },
  { id: 'bulking', label: 'Bulking' },
  { id: 'maintain', label: 'Maintain' },
  { id: 'beginner', label: 'Beginner' },
];

export function LeaderboardView({ testID = 'leaderboard-view' }: LeaderboardViewProps) {
  const { data, loading, error, refresh, setOptOut } = useLeaderboard();
  const [selectedDivision, setSelectedDivision] = useState<DivisionType>('cutting');
  const [showRecapModal, setShowRecapModal] = useState(false);
  const [inspectUser, setInspectUser] = useState<{ nickname: string; avatarUrl?: string } | null>(
    null,
  );

  const isOptedOut = data?.opted_out ?? false;
  const top10 = data?.top_10 ?? [];
  const myRank = data?.my_rank;

  const handleToggleOptOut = async (value: boolean) => {
    try {
      await setOptOut(!value);
    } catch {
      // error handled in hook
    }
  };

  if (loading && !data) {
    return (
      <View style={styles.loadingContainer} testID={`${testID}-loading`}>
        <ActivityIndicator size="large" color={dark.apricot} />
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.card} testID={`${testID}-error`}>
        <Ionicons name="alert-circle-outline" size={36} color={dark.textLo} />
        <Text style={styles.errorText}>{error.message}</Text>
        <Pressable style={styles.retryBtn} onPress={refresh} testID={`${testID}-retry`}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      {/* 1. M11: Persistent single line above the list (not behind an info icon) */}
      <View style={styles.ruleBanner} testID={`${testID}-rule-banner`}>
        <Text style={styles.ruleBannerText}>
          Ranked on consistency and how close you get to your own goal. Not on eating least.
        </Text>
      </View>

      {/* 2. M11: Division chips: Cutting · Bulking · Maintain · Beginner */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.divisionChipsRow}
        testID={`${testID}-division-chips`}
      >
        {DIVISIONS.map((div) => {
          const isSelected = selectedDivision === div.id;
          return (
            <Pressable
              key={div.id}
              style={[styles.divisionChip, isSelected && styles.divisionChipSelected]}
              onPress={() => setSelectedDivision(div.id)}
              accessibilityRole="tab"
              accessibilityLabel={`Filter by ${div.label} division`}
              accessibilityState={{ selected: isSelected }}
              testID={`${testID}-chip-${div.id}`}
            >
              <Text
                style={[styles.divisionChipText, isSelected && styles.divisionChipTextSelected]}
              >
                {div.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Opted out state banner */}
      {isOptedOut ? (
        <View style={styles.optedOutCard} testID={`${testID}-opted-out`}>
          <Ionicons name="eye-off-outline" size={32} color={dark.textLo} />
          <Text style={styles.optedOutTitle}>You're hidden</Text>
          <Text style={styles.optedOutText}>{t('progress.leaderboard.optedOutNotice')}</Text>
          <Pressable
            style={styles.optInButton}
            onPress={() => handleToggleOptOut(true)}
            accessibilityRole="button"
            accessibilityLabel="Participate in leaderboard"
            testID={`${testID}-opt-in-btn`}
          >
            <Text style={styles.optInButtonText}>Turn on leaderboard participation</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.leaderboardBody}>
          {/* Top 10 List Card */}
          <View style={styles.top10Card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.top10Title}>{t('progress.leaderboard.top10')}</Text>
              <Pressable
                style={styles.recapBtn}
                onPress={() => setShowRecapModal(true)}
                accessibilityRole="button"
                accessibilityLabel="View Monday recap"
                testID={`${testID}-btn-monday-recap`}
              >
                <Ionicons name="calendar-outline" size={14} color={dark.apricot} />
                <Text style={styles.recapBtnText}>Monday recap</Text>
              </Pressable>
            </View>

            {top10.length === 0 ? (
              <View style={styles.emptyContainer} testID={`${testID}-empty-cohort`}>
                <Ionicons name="people-outline" size={32} color={dark.textLo} />
                <Text style={styles.emptyText}>
                  {t('progress.leaderboard.emptyCohort') ||
                    'Your first ranking arrives on Monday.'}
                </Text>
              </View>
            ) : (
              <View style={styles.leadersList}>
                {top10.map((user) => {
                  return (
                    <Pressable
                      key={user.rank}
                      style={[styles.leaderRow, user.is_me && styles.meRowInList]}
                      onPress={() =>
                        setInspectUser({
                          nickname: user.nickname,
                          avatarUrl: user.avatar_url ?? undefined,
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Rank ${user.rank}, ${user.nickname}, consistency score ${user.consistency_score.toFixed(1)}`}
                      testID={`${testID}-row-${user.rank}`}
                    >
                      <View style={styles.leaderLeft}>
                        {/* Rank in numeral-m: NO medals, no trophies, rank is a number */}
                        <Text style={styles.leaderRank}>#{user.rank}</Text>
                        <Avatar
                          name={user.nickname}
                          uri={user.avatar_url}
                          size="sm"
                          identityHue={user.is_me ? 'apricot' : 'iris'}
                        />
                        <Text style={[styles.leaderName, user.is_me && styles.leaderNameMe]}>
                          {user.nickname} {user.is_me ? '(You)' : ''}
                        </Text>
                      </View>

                      {/* Consistency score only: NO weights, no calories */}
                      <Text style={styles.leaderScore}>{user.consistency_score.toFixed(1)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* 4. M11: Your row pinned at the bottom with hairlineLit edge and s2 fill */}
          {myRank ? (
            myRank.is_eligible ? (
              <View style={styles.pinnedMyRow} testID={`${testID}-pinned-my-row`}>
                <View style={styles.pinnedLeft}>
                  <Text style={styles.pinnedRank}>#{myRank.rank}</Text>
                  <Avatar
                    name={myRank.nickname}
                    uri={myRank.avatar_url}
                    size="md"
                    identityHue="apricot"
                  />
                  <View>
                    <Text style={styles.pinnedName}>
                      {myRank.nickname} <Text style={styles.pinnedYouTag}>(You)</Text>
                    </Text>
                    <Text style={styles.pinnedCaption}>
                      {myRank.rank <= 10 ? 'Ranked in Top 10' : 'In your cohort'}
                    </Text>
                  </View>
                </View>

                <View style={styles.pinnedRight}>
                  <Text style={styles.pinnedScore}>{myRank.consistency_score.toFixed(1)}</Text>
                  <Text style={styles.pinnedScoreLabel}>Score</Text>
                </View>
              </View>
            ) : (
              <View style={styles.notEligibleCard} testID={`${testID}-not-eligible`}>
                <Ionicons name="time-outline" size={18} color={dark.textLo} />
                <Text style={styles.notEligibleText}>
                  {t('progress.leaderboard.notEligibleNotice')}
                </Text>
              </View>
            )
          ) : null}

          {/* 5. M11: Footer with weekly reset note & link to hide from leaderboards */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Weekly reset on Monday.</Text>
            <Pressable
              onPress={() => handleToggleOptOut(false)}
              accessibilityRole="button"
              accessibilityLabel="Hide me from leaderboards"
              testID={`${testID}-optout-link`}
            >
              <Text style={styles.optOutLinkText}>Hide me from leaderboards</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* M11: Lightweight user inspector modal (shows nickname and avatar only) */}
      <Modal
        visible={Boolean(inspectUser)}
        transparent
        animationType="fade"
        onRequestClose={() => setInspectUser(null)}
      >
        <Pressable style={styles.inspectBackdrop} onPress={() => setInspectUser(null)}>
          <View style={styles.inspectCard}>
            <Avatar
              name={inspectUser?.nickname ?? ''}
              uri={inspectUser?.avatarUrl}
              size="lg"
              identityHue="iris"
            />
            <Text style={styles.inspectNickname}>{inspectUser?.nickname}</Text>
            <Text style={styles.inspectSub}>Cohort Member</Text>
            <Pressable
              style={styles.inspectCloseBtn}
              onPress={() => setInspectUser(null)}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.inspectCloseText}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* M12 Monday Recap Modal */}
      <MondayRecapModal
        visible={showRecapModal}
        score={myRank?.consistency_score ?? 84.5}
        onClose={() => setShowRecapModal(false)}
        onSeeLeaderboard={() => setShowRecapModal(false)}
        testID={`${testID}-recap-modal`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: space[8],
  },
  loadingContainer: {
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    marginHorizontal: space[4],
    marginTop: space[3],
    padding: space[5],
    borderRadius: radius.card,
    backgroundColor: dark.s2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  errorText: {
    ...type.bodyS,
    color: dark.textHi,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: radius.control,
    backgroundColor: dark.apricot,
  },
  retryBtnText: {
    ...type.label,
    color: dark.onBrand,
    fontWeight: '700',
  },
  ruleBanner: {
    marginHorizontal: space[4],
    marginTop: space[3],
    marginBottom: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.control,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  ruleBannerText: {
    ...type.label,
    color: dark.textHi,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  divisionChipsRow: {
    flexDirection: 'row',
    paddingHorizontal: space[4],
    gap: space[2],
    marginVertical: space[2],
  },
  divisionChip: {
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divisionChipSelected: {
    backgroundColor: 'rgba(244, 182, 125, 0.16)',
    borderColor: dark.apricot,
  },
  divisionChipText: {
    ...type.label,
    color: dark.textMid,
  },
  divisionChipTextSelected: {
    color: dark.apricot,
    fontWeight: '700',
  },
  leaderboardBody: {
    paddingHorizontal: space[4],
  },
  top10Card: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[4],
    borderWidth: 1,
    borderColor: dark.hairline,
    marginTop: space[2],
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space[3],
  },
  top10Title: {
    ...type.heading,
    color: dark.textHi,
  },
  recapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radius.control,
    backgroundColor: dark.s2,
  },
  recapBtnText: {
    ...type.label,
    color: dark.apricot,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: space[6],
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  emptyText: {
    ...type.bodyS,
    color: dark.textLo,
    textAlign: 'center',
  },
  leadersList: {
    gap: space[2],
  },
  leaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.hairline,
    minHeight: 48,
  },
  meRowInList: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.control,
    paddingHorizontal: space[2],
  },
  leaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    flex: 1,
  },
  leaderRank: {
    ...type.numeralM,
    fontVariant: ['tabular-nums'] as any,
    color: dark.textLo,
    width: 32,
    textAlign: 'center',
  },
  leaderName: {
    ...type.body,
    color: dark.textHi,
  },
  leaderNameMe: {
    fontWeight: '700',
    color: dark.apricot,
  },
  leaderScore: {
    ...type.numeralM,
    fontVariant: ['tabular-nums'] as any,
    color: dark.textHi,
  },
  pinnedMyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space[3],
    padding: space[4],
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
  },
  pinnedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    flex: 1,
  },
  pinnedRank: {
    ...type.numeralM,
    fontVariant: ['tabular-nums'] as any,
    color: dark.apricot,
    width: 36,
    textAlign: 'center',
  },
  pinnedName: {
    ...type.heading,
    color: dark.textHi,
  },
  pinnedYouTag: {
    ...type.label,
    color: dark.textLo,
  },
  pinnedCaption: {
    ...type.label,
    color: dark.textLo,
    marginTop: 2,
  },
  pinnedRight: {
    alignItems: 'flex-end',
  },
  pinnedScore: {
    ...type.numeralL,
    fontVariant: ['tabular-nums'] as any,
    color: dark.apricot,
  },
  pinnedScoreLabel: {
    ...type.label,
    color: dark.textLo,
  },
  notEligibleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    padding: space[3],
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    marginTop: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  notEligibleText: {
    ...type.bodyS,
    color: dark.textLo,
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space[4],
    paddingHorizontal: space[2],
  },
  footerText: {
    ...type.label,
    color: dark.textLo,
  },
  optOutLinkText: {
    ...type.label,
    color: dark.apricot,
    fontWeight: '600',
  },
  optedOutCard: {
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    marginHorizontal: space[4],
    marginTop: space[3],
    padding: space[6],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: dark.hairline,
    gap: space[2],
  },
  optedOutTitle: {
    ...type.title2,
    color: dark.textHi,
  },
  optedOutText: {
    ...type.bodyS,
    color: dark.textLo,
    textAlign: 'center',
    lineHeight: 20,
  },
  optInButton: {
    marginTop: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: radius.button,
    backgroundColor: dark.apricot,
  },
  optInButtonText: {
    ...type.heading,
    color: dark.onBrand,
    fontWeight: '700',
  },
  inspectBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inspectCard: {
    width: 280,
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[5],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    gap: space[2],
  },
  inspectNickname: {
    ...type.title2,
    color: dark.textHi,
    marginTop: space[2],
  },
  inspectSub: {
    ...type.label,
    color: dark.textLo,
  },
  inspectCloseBtn: {
    marginTop: space[3],
    height: 44,
    paddingHorizontal: space[5],
    borderRadius: radius.control,
    backgroundColor: dark.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inspectCloseText: {
    ...type.label,
    color: dark.textMid,
    fontWeight: '600',
  },
});
