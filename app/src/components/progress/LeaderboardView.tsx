import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface LeaderboardViewProps {
  testID?: string;
}

export function LeaderboardView({ testID = 'leaderboard-view' }: LeaderboardViewProps) {
  const { colors } = useTheme();
  const { data, loading, error, refresh, setOptOut } = useLeaderboard();

  const isOptedOut = data?.opted_out ?? false;
  const top10 = data?.top_10 ?? [];
  const myRank = data?.my_rank;

  const handleToggleOptOut = async (value: boolean) => {
    try {
      await setOptOut(!value); // switch is "Participate in leaderboards"
    } catch {
      // error handled in hook
    }
  };

  if (loading && !data) {
    return (
      <View style={styles.loadingContainer} testID={`${testID}-loading`}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface }]} testID={`${testID}-error`}>
        <Ionicons name="alert-circle-outline" size={36} color={colors.textMuted} />
        <Text style={[styles.errorText, { color: colors.text }]}>{error.message}</Text>
        <Pressable
          style={[styles.retryBtn, { backgroundColor: colors.accent }]}
          onPress={refresh}
          testID={`${testID}-retry`}
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      {/* Informative Note: Ranked by consistency, not restriction */}
      <View
        style={[
          styles.infoBanner,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        ]}
      >
        <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
        <Text style={[styles.infoBannerText, { color: colors.text }]}>
          {t('progress.leaderboard.infoNote')}
        </Text>
      </View>

      {/* Cohort & Division Header */}
      {!isOptedOut && data?.division && (
        <View style={[styles.metaCard, { backgroundColor: colors.surface }]}>
          <View style={styles.metaRow}>
            <View>
              <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
                {t('progress.leaderboard.divisionLabel')}
              </Text>
              <Text style={[styles.metaValue, { color: colors.text }]}>
                {data.division.toUpperCase()}
              </Text>
            </View>

            <View style={styles.cohortBadge}>
              <Ionicons name="people-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.cohortText, { color: colors.textMuted }]}>
                {data.total_in_cohort ?? 100} in cohort
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Opt-out Toggle Card */}
      <View style={[styles.toggleCard, { backgroundColor: colors.surface }]}>
        <View style={styles.toggleTextCol}>
          <Text style={[styles.toggleTitle, { color: colors.text }]}>
            {t('progress.leaderboard.optOutLabel')}
          </Text>
          <Text style={[styles.toggleDesc, { color: colors.textMuted }]}>
            {t('progress.leaderboard.optOutDescription')}
          </Text>
        </View>
        <Switch
          value={!isOptedOut}
          onValueChange={handleToggleOptOut}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor="#ffffff"
          testID={`${testID}-optout-toggle`}
          accessibilityLabel={t('progress.leaderboard.optOutLabel')}
        />
      </View>

      {/* Opted out state banner */}
      {isOptedOut ? (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Ionicons name="eye-off-outline" size={32} color={colors.textMuted} />
          <Text style={[styles.optedOutText, { color: colors.textMuted }]}>
            {t('progress.leaderboard.optedOutNotice')}
          </Text>
        </View>
      ) : (
        <>
          {/* My Rank Highlight Card */}
          {myRank ? (
            myRank.is_eligible ? (
              <View
                style={[
                  styles.myRankCard,
                  { backgroundColor: colors.surface, borderColor: colors.accent },
                ]}
                testID={`${testID}-my-rank`}
              >
                <View style={styles.myRankLeft}>
                  <View style={[styles.rankBadge, { backgroundColor: colors.surfaceAlt }]}>
                    <Text style={[styles.rankNumber, { color: colors.accent }]}>
                      #{myRank.rank}
                    </Text>
                  </View>
                  <View>
                    <Text style={[styles.myRankLabel, { color: colors.textMuted }]}>
                      {t('progress.leaderboard.myRank')}
                    </Text>
                    <Text style={[styles.myRankName, { color: colors.text }]}>
                      {myRank.nickname}
                    </Text>
                  </View>
                </View>

                <View style={styles.myRankScore}>
                  <Text style={[styles.scoreValue, { color: colors.text }]}>
                    {myRank.consistency_score.toFixed(1)}
                  </Text>
                  <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>
                    {t('progress.leaderboard.score')}
                  </Text>
                </View>
              </View>
            ) : (
              <View
                style={[styles.notEligibleCard, { backgroundColor: colors.surfaceAlt }]}
                testID={`${testID}-not-eligible`}
              >
                <Ionicons name="time-outline" size={20} color={colors.textMuted} />
                <Text style={[styles.notEligibleText, { color: colors.textMuted }]}>
                  {t('progress.leaderboard.notEligibleNotice')}
                </Text>
              </View>
            )
          ) : null}

          {/* Top 10 Leaders List */}
          <View style={[styles.top10Card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.top10Title, { color: colors.text }]}>
              {t('progress.leaderboard.top10')}
            </Text>

            {top10.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {t('progress.leaderboard.emptyCohort')}
              </Text>
            ) : (
              <View style={styles.leadersList}>
                {top10.map((user) => (
                  <View
                    key={user.rank}
                    style={[
                      styles.leaderRow,
                      { borderBottomColor: colors.border },
                      user.is_me && [styles.meLeaderRow, { backgroundColor: colors.surfaceAlt }],
                    ]}
                  >
                    <View style={styles.leaderLeft}>
                      <Text style={[styles.leaderRank, { color: colors.textMuted }]}>
                        #{user.rank}
                      </Text>
                      <Text
                        style={[
                          styles.leaderName,
                          { color: colors.text },
                          user.is_me && { fontWeight: '700' },
                        ]}
                      >
                        {user.nickname} {user.is_me ? '(You)' : ''}
                      </Text>
                    </View>

                    <Text style={[styles.leaderScore, { color: colors.text }]}>
                      {user.consistency_score.toFixed(1)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.xl,
  },
  loadingContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  infoBannerText: {
    flex: 1,
    fontSize: fontSize.xs,
    fontWeight: '500',
    lineHeight: 18,
  },
  metaCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: fontSize.xs,
  },
  metaValue: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginTop: 2,
  },
  cohortBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cohortText: {
    fontSize: fontSize.xs,
  },
  toggleCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  toggleTextCol: {
    flex: 1,
    paddingRight: spacing.md,
  },
  toggleTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  toggleDesc: {
    fontSize: fontSize.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  optedOutText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  myRankCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  myRankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rankBadge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  rankNumber: {
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  myRankLabel: {
    fontSize: fontSize.xs,
  },
  myRankName: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  myRankScore: {
    alignItems: 'flex-end',
  },
  scoreValue: {
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  scoreLabel: {
    fontSize: 10,
  },
  notEligibleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  notEligibleText: {
    flex: 1,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  top10Card: {
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  top10Title: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyText: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  leadersList: {},
  leaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  meLeaderRow: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
  },
  leaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  leaderRank: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    width: 28,
  },
  leaderName: {
    fontSize: fontSize.sm,
  },
  leaderScore: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  errorText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
