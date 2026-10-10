import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RoomMemberSnapshot } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const LARGE_ROOM_THRESHOLD = 12;
const PAGE_SIZE = 8;

interface RoomOverviewRowProps {
  members: RoomMemberSnapshot[];
  onSelectMember: (memberId: string) => void;
  selectedMemberId?: string | null;
  currentUserId?: string;
  roomAverageGoal?: number | null;
}

export function RoomOverviewRow({
  members,
  onSelectMember,
  selectedMemberId,
  currentUserId,
  roomAverageGoal,
}: RoomOverviewRowProps) {
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Compute room average goal completion from numeric members if not explicitly provided
  const computedAverage = useMemo(() => {
    if (typeof roomAverageGoal === 'number') return roomAverageGoal;
    const numericCompletions = members
      .map((m) => m.metrics.goal_completion)
      .filter((v): v is number => typeof v === 'number');
    if (numericCompletions.length === 0) return null;
    const sum = numericCompletions.reduce((acc, curr) => acc + curr, 0);
    return Math.round(sum / numericCompletions.length);
  }, [members, roomAverageGoal]);

  // Sorted members for large room list: "me first, then alphabetically" (PRD 6.9 RV-10)
  const sortedMembers = useMemo(() => {
    const list = [...members];
    return list.sort((a, b) => {
      const aIsMe = currentUserId ? a.user_id === currentUserId : false;
      const bIsMe = currentUserId ? b.user_id === currentUserId : false;
      if (aIsMe && !bIsMe) return -1;
      if (!aIsMe && bIsMe) return 1;
      return a.nickname.localeCompare(b.nickname, undefined, { sensitivity: 'base' });
    });
  }, [members, currentUserId]);

  // Filtered members based on search
  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sortedMembers;
    return sortedMembers.filter(
      (m) =>
        m.nickname.toLowerCase().includes(query) ||
        (m.username && m.username.toLowerCase().includes(query)),
    );
  }, [sortedMembers, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredMembers.slice(start, start + PAGE_SIZE);
  }, [filteredMembers, currentPage]);

  if (members.length < 3) return null;

  const isLargeRoom = members.length > LARGE_ROOM_THRESHOLD;

  // Render a single member card
  const renderMemberCard = (m: RoomMemberSnapshot) => {
    const isSelected = selectedMemberId === m.user_id;
    const isLocked = m.metrics.goal_completion === 'locked';
    const goalPct =
      typeof m.metrics.goal_completion === 'number'
        ? m.metrics.goal_completion
        : null;

    const mealsCount =
      typeof m.metrics.meal_checklist === 'object' && m.metrics.meal_checklist !== null
        ? Object.values(m.metrics.meal_checklist).filter(Boolean).length
        : 0;

    return (
      <Pressable
        key={m.user_id}
        onPress={() => onSelectMember(m.user_id)}
        style={[
          styles.memberCard,
          {
            backgroundColor: isSelected ? colors.cardHighlight : colors.surface,
            borderColor: isSelected ? colors.accent : colors.border,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${m.nickname}: ${goalPct !== null ? `${goalPct}% goal` : 'private'}`}
        testID={`overview-card-${m.user_id}`}
      >
        {/* Avatar */}
        {m.avatar_url ? (
          <Image source={{ uri: m.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.avatarInitial, { color: colors.text }]}>
              {m.nickname.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        {/* Name */}
        <Text style={[styles.nickname, { color: colors.text }]} numberOfLines={1}>
          {m.nickname}
        </Text>

        {/* Goal Completion */}
        <View style={[styles.goalPill, { backgroundColor: colors.surfaceAlt }]}>
          {isLocked ? (
            <Ionicons name="lock-closed" size={11} color={colors.textMuted} />
          ) : (
            <Text style={[styles.goalText, { color: colors.text }]}>
              {goalPct !== null ? `${goalPct}%` : '—'}
            </Text>
          )}
        </View>

        {/* Meals summary or status */}
        <View style={styles.mealsPill}>
          {m.status === 'paused' ? (
            <Text style={[styles.statusText, { color: colors.textMuted }]}>
              Paused
            </Text>
          ) : (
            <Text style={[styles.mealsCountText, { color: colors.textMuted }]}>
              {mealsCount}/4 meals
            </Text>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container} testID="room-overview-section">
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
          {t('rooms.today.overview')}
        </Text>
        {isLargeRoom && (
          <Text style={[styles.countBadge, { color: colors.textMuted }]}>
            {members.length} members
          </Text>
        )}
      </View>

      {/* Large room mode: Search + Room Average + Paged List (PRD 6.9 RV-4, RV-10) */}
      {isLargeRoom ? (
        <View style={styles.largeRoomContainer}>
          {/* Search bar */}
          <View style={[styles.searchRow, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              value={searchQuery}
              onChangeText={(txt) => {
                setSearchQuery(txt);
                setPage(1);
              }}
              placeholder={t('rooms.today.overviewSearchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={[styles.searchInput, { color: colors.text }]}
              autoCapitalize="none"
              autoCorrect={false}
              testID="input-search-overview"
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => {
                  setSearchQuery('');
                  setPage(1);
                }}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                testID="btn-clear-overview-search"
              >
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Room Average Card */}
          {computedAverage !== null && (
            <View
              style={[
                styles.averageCard,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
              testID="card-room-average"
            >
              <View style={styles.averageLeft}>
                <Ionicons name="pie-chart-outline" size={16} color={colors.accent} />
                <Text style={[styles.averageLabel, { color: colors.text }]}>
                  {t('rooms.today.overviewRoomAverage')}
                </Text>
              </View>
              <View style={[styles.goalPill, { backgroundColor: colors.cardHighlight }]}>
                <Text style={[styles.goalText, { color: colors.accent }]}>
                  {computedAverage}%
                </Text>
              </View>
            </View>
          )}

          {/* Members Grid / List */}
          {paginatedMembers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]} testID="text-overview-no-results">
                {t('rooms.today.overviewNoMatches')}
              </Text>
            </View>
          ) : (
            <View style={styles.pagedGrid} testID="overview-paged-grid">
              {paginatedMembers.map(renderMemberCard)}
            </View>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <View style={styles.paginationRow}>
              <Pressable
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                style={[
                  styles.pageBtn,
                  { backgroundColor: colors.surfaceAlt },
                  currentPage <= 1 && styles.pageBtnDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Previous page"
                testID="btn-overview-prev-page"
              >
                <Ionicons
                  name="chevron-back"
                  size={16}
                  color={currentPage <= 1 ? colors.textMuted : colors.text}
                />
                <Text
                  style={[
                    styles.pageBtnText,
                    { color: currentPage <= 1 ? colors.textMuted : colors.text },
                  ]}
                >
                  {t('rooms.today.overviewPrev')}
                </Text>
              </Pressable>

              <Text
                style={[styles.pageIndicatorText, { color: colors.textMuted }]}
                testID="text-overview-page-indicator"
              >
                {t('rooms.today.overviewPage', { page: currentPage, totalPages })}
              </Text>

              <Pressable
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                style={[
                  styles.pageBtn,
                  { backgroundColor: colors.surfaceAlt },
                  currentPage >= totalPages && styles.pageBtnDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Next page"
                testID="btn-overview-next-page"
              >
                <Text
                  style={[
                    styles.pageBtnText,
                    { color: currentPage >= totalPages ? colors.textMuted : colors.text },
                  ]}
                >
                  {t('rooms.today.overviewNext')}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={currentPage >= totalPages ? colors.textMuted : colors.text}
                />
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        /* Standard small room: Horizontal ScrollView */
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollList}
        >
          {members.map(renderMemberCard)}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countBadge: {
    fontSize: 10,
    fontWeight: '500',
  },
  scrollList: {
    gap: spacing.xs + 2,
    paddingBottom: 2,
  },
  largeRoomContainer: {
    gap: spacing.xs + 2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.xs,
    paddingVertical: 0,
  },
  averageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  averageLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  averageLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  pagedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  memberCard: {
    width: 82,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.xs + 2,
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: 4,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarInitial: {
    fontSize: 12,
    fontWeight: '700',
  },
  nickname: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  goalPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginBottom: 3,
    minHeight: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalText: {
    fontSize: 10,
    fontWeight: '700',
  },
  mealsPill: {
    minHeight: 14,
    alignItems: 'center',
  },
  mealsCountText: {
    fontSize: 9,
    fontWeight: '500',
  },
  statusText: {
    fontSize: 8,
    fontStyle: 'italic',
  },
  emptyContainer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: fontSize.xs,
    fontStyle: 'italic',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingTop: 4,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.sm,
    gap: 4,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: fontSize.xs - 1,
    fontWeight: '600',
  },
  pageIndicatorText: {
    fontSize: fontSize.xs - 1,
    fontWeight: '500',
  },
});
