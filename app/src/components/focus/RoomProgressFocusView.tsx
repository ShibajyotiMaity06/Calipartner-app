import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoomWeeklyFocusStats } from '@/hooks/useFocusStats';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { formatMinutesDisplay } from './focusUIUtils';

export interface RoomProgressFocusViewProps {
  roomId: string;
  testID?: string;
}

export function RoomProgressFocusView({
  roomId,
  testID = 'room-progress-focus-view',
}: RoomProgressFocusViewProps) {
  const { colors } = useTheme();
  const { stats, loading, error, refresh } = useRoomWeeklyFocusStats(roomId);

  if (loading && !stats) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (error && !stats) {
    return (
      <View style={styles.errorBox} testID="room-progress-focus-error">
        <Text style={[styles.errorText, { color: colors.textMuted }]}>{error.message}</Text>
        <Pressable
          style={[styles.retryBtn, { backgroundColor: colors.surfaceAlt }]}
          onPress={refresh}
        >
          <Text style={[styles.retryBtnText, { color: colors.accent }]}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  const roomTotal = stats?.room_total_minutes ?? 0;
  const members = stats?.members ?? [];

  return (
    <View
      testID={testID}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View style={[styles.iconWrapper, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name="timer" size={18} color={colors.accent} />
          </View>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('focus.roomWeeklyTotalsTitle')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {t('focus.neutralSortingNote')}
            </Text>
          </View>
        </View>

        <View
          testID="room-focus-total-minutes"
          style={[styles.totalBadge, { backgroundColor: colors.cardHighlight }]}
        >
          <Text style={[styles.totalBadgeText, { color: colors.accent }]}>
            {formatMinutesDisplay(roomTotal)}
          </Text>
        </View>
      </View>

      {/* Member rows neutrally sorted (me first, then alphabetical) */}
      <View style={styles.memberList}>
        {members.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            No focus activity recorded this week yet.
          </Text>
        ) : (
          members.map((m) => {
            return (
              <View
                key={m.user_id}
                testID="room-focus-member-row"
                style={[
                  styles.memberRow,
                  {
                    backgroundColor: m.is_me ? colors.cardHighlight : colors.surfaceAlt,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.memberLeft}>
                  <View style={[styles.avatarDot, { backgroundColor: colors.surface }]}>
                    <Ionicons
                      name="person"
                      size={14}
                      color={m.is_me ? colors.accent : colors.text}
                    />
                  </View>
                  <Text
                    style={[
                      styles.memberName,
                      {
                        color: colors.text,
                        fontWeight: m.is_me ? '700' : '500',
                      },
                    ]}
                  >
                    {m.is_me ? `${m.nickname} (You)` : m.nickname}
                  </Text>
                </View>

                <View style={styles.memberRight}>
                  {m.is_hidden ? (
                    <View style={styles.hiddenWrap}>
                      <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
                      <Text style={[styles.hiddenText, { color: colors.textMuted }]}>Hidden</Text>
                    </View>
                  ) : (
                    <Text style={[styles.minutesText, { color: colors.text, fontWeight: '700' }]}>
                      {formatMinutesDisplay(m.weekly_focus_minutes ?? 0)}
                    </Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  loadingBox: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  loadingText: {
    fontSize: fontSize.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  totalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  totalBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  memberList: {
    gap: spacing.xs,
  },
  emptyText: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarDot: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberName: {
    fontSize: fontSize.xs,
  },
  memberRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hiddenWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hiddenText: {
    fontSize: 11,
  },
  minutesText: {
    fontSize: fontSize.sm,
  },
  errorBox: {
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: {
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  retryBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
