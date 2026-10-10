import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RoomMemberSnapshot } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface SideBySideCardProps {
  me: RoomMemberSnapshot;
  partner: RoomMemberSnapshot | null;
  allMembers: RoomMemberSnapshot[];
  selectedPartnerId: string | null;
  onSelectPartner: (partnerId: string) => void;
  onNudge: (targetMember: RoomMemberSnapshot) => void;
  onReact: (targetMember: RoomMemberSnapshot) => void;
}

export function SideBySideCard({
  me,
  partner,
  allMembers,
  selectedPartnerId,
  onSelectPartner,
  onNudge,
  onReact,
}: SideBySideCardProps) {
  const { colors } = useTheme();

  // Filter other members (excluding 'me')
  const otherMembers = allMembers.filter((m) => m.user_id !== me.user_id);

  // Helper to render metric item (number, text or neutral lock)
  const renderMetric = (
    label: string,
    value: string | number | null | undefined,
    isLocked: boolean,
    icon: keyof typeof Ionicons.glyphMap,
  ) => {
    return (
      <View style={[styles.metricRow, { backgroundColor: colors.surfaceAlt }]}>
        <View style={styles.metricLabelRow}>
          <Ionicons name={icon} size={14} color={colors.textMuted} />
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
        </View>

        {isLocked ? (
          <View style={styles.lockedContainer}>
            <Ionicons name="lock-closed" size={13} color={colors.textMuted} />
            <Text style={[styles.lockedText, { color: colors.textMuted }]}>
              {t('rooms.today.lockedItem')}
            </Text>
          </View>
        ) : (
          <Text style={[styles.metricValue, { color: colors.text }]} numberOfLines={1}>
            {value ?? '—'}
          </Text>
        )}
      </View>
    );
  };

  // Helper to render meal checklist (Breakfast, Lunch, Dinner, Snacks)
  // PRD requirement: Extra is optional and never shown as missing!
  const renderMealChecklist = (
    mealsLogged: Record<string, boolean> | undefined,
    isLocked: boolean,
  ) => {
    if (isLocked) {
      return (
        <View style={[styles.mealLockedRow, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="lock-closed" size={13} color={colors.textMuted} />
          <Text style={[styles.lockedText, { color: colors.textMuted }]}>
            {t('rooms.today.lockedItem')}
          </Text>
        </View>
      );
    }

    const sections: { key: 'breakfast' | 'lunch' | 'dinner' | 'snacks'; label: string }[] = [
      { key: 'breakfast', label: t('rooms.today.breakfast') },
      { key: 'lunch', label: t('rooms.today.lunch') },
      { key: 'dinner', label: t('rooms.today.dinner') },
      { key: 'snacks', label: t('rooms.today.snacks') },
    ];

    return (
      <View style={styles.mealsContainer}>
        {sections.map((s) => {
          const logged = Boolean(mealsLogged?.[s.key]);
          return (
            <View
              key={s.key}
              style={[
                styles.mealChip,
                {
                  backgroundColor: logged ? colors.cardHighlight : colors.surfaceAlt,
                  borderColor: logged ? colors.accent : colors.border,
                },
              ]}
            >
              <Ionicons
                name={logged ? 'checkmark-circle' : 'ellipse-outline'}
                size={12}
                color={logged ? colors.accent : colors.textMuted}
              />
              <Text
                style={[
                  styles.mealChipText,
                  { color: logged ? colors.text : colors.textMuted },
                ]}
              >
                {s.label}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  // Helper for Member Column
  const renderMemberColumn = (
    member: RoomMemberSnapshot,
    isMe: boolean,
  ) => {
    const metrics = member.metrics;
    const isLockedCal = metrics.goal_completion === 'locked' || metrics.calories === 'locked';
    const isLockedSteps = metrics.steps === 'locked';
    const isLockedWater = metrics.water_ml === 'locked';
    const isLockedWorkout = metrics.workout_status === 'locked';
    const isLockedWeight = metrics.weight_progress === 'locked' && metrics.weight_kg === 'locked';
    const isLockedMeals = metrics.meal_checklist === 'locked';

    // Goal %
    const goalPct = typeof metrics.goal_completion === 'number' ? metrics.goal_completion : null;

    // Steps
    const stepsVal = typeof metrics.steps === 'number' ? metrics.steps.toLocaleString() : null;

    // Water
    const waterVal = typeof metrics.water_ml === 'number' ? `${metrics.water_ml} ml` : null;

    // Workout
    const workoutVal =
      metrics.workout_status !== 'locked' && typeof metrics.workout_status === 'object'
        ? metrics.workout_status.worked_out
          ? `Workout • ${metrics.workout_status.duration_minutes}m`
          : t('rooms.today.noWorkout')
        : null;

    // Weight progress
    const weightVal =
      typeof metrics.weight_progress === 'number'
        ? `${metrics.weight_progress > 0 ? '+' : ''}${metrics.weight_progress}%`
        : typeof metrics.weight_kg === 'number'
          ? `${metrics.weight_kg} kg`
          : null;

    return (
      <View style={[styles.column, { backgroundColor: colors.surface }]}>
        {/* Avatar & Profile */}
        <View style={styles.profileHeader}>
          {member.avatar_url ? (
            <Image source={{ uri: member.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: isMe ? colors.accent : colors.cardHighlight }]}>
              <Text style={[styles.avatarInitial, { color: isMe ? '#FFFFFF' : colors.text }]}>
                {member.nickname.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.nameBlock}>
            <Text style={[styles.nickname, { color: colors.text }]} numberOfLines={1}>
              {member.nickname} {isMe ? `(${t('rooms.today.me')})` : ''}
            </Text>
            <Text style={[styles.username, { color: colors.textMuted }]} numberOfLines={1}>
              @{member.username}
            </Text>
          </View>
        </View>

        {/* Goal completion ring indicator */}
        <View style={[styles.goalRingBox, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.goalRingLabel, { color: colors.textMuted }]}>
            {t('rooms.today.goalRing')}
          </Text>
          {isLockedCal ? (
            <View style={styles.lockedContainer}>
              <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
              <Text style={[styles.lockedText, { color: colors.textMuted }]}>
                {t('rooms.today.lockedItem')}
              </Text>
            </View>
          ) : (
            <Text style={[styles.goalRingValue, { color: colors.text }]}>
              {goalPct !== null ? `${goalPct}%` : '—'}
            </Text>
          )}
        </View>

        {/* Metrics Rows */}
        <View style={styles.metricsList}>
          {renderMetric(t('rooms.today.steps'), stepsVal, isLockedSteps, 'footsteps-outline')}
          {renderMetric(t('rooms.today.water'), waterVal, isLockedWater, 'water-outline')}
          {renderMetric(t('rooms.today.workout'), workoutVal, isLockedWorkout, 'barbell-outline')}
          {metrics.weight_progress !== undefined &&
            renderMetric(
              t('rooms.today.weight'),
              weightVal,
              isLockedWeight,
              'scale-outline',
            )}
        </View>

        {/* Meals logged checklist */}
        <View style={styles.mealsSection}>
          <Text style={[styles.mealsSectionTitle, { color: colors.textMuted }]}>
            {t('rooms.today.mealsTitle')}
          </Text>
          {renderMealChecklist(
            metrics.meal_checklist === 'locked' ? undefined : metrics.meal_checklist,
            isLockedMeals,
          )}
        </View>

        {/* Quick action buttons (under partner only) */}
        {!isMe && (
          <View style={styles.partnerActionsRow}>
            <Pressable
              onPress={() => onNudge(member)}
              style={[styles.partnerActionButton, { backgroundColor: colors.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel={`Send a nudge to ${member.nickname}`}
              testID="btn-nudge-partner"
            >
              <Text style={styles.actionEmoji}>👋</Text>
              <Text style={[styles.partnerActionText, { color: colors.text }]}>
                {t('rooms.today.nudgeBtn')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => onReact(member)}
              style={[styles.partnerActionButton, { backgroundColor: colors.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel={`Send reaction to ${member.nickname}`}
              testID="btn-react-partner"
            >
              <Text style={styles.actionEmoji}>🔥</Text>
              <Text style={[styles.partnerActionText, { color: colors.text }]}>
                {t('rooms.today.reactBtn')}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.wrapper}>
      {/* 3+ Members Avatar Switcher Row */}
      {otherMembers.length > 1 && (
        <View style={styles.avatarSelectorWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.avatarSelectorScroll}
          >
            {otherMembers.map((m) => {
              const isSelected = (partner?.user_id ?? selectedPartnerId) === m.user_id;
              return (
                <Pressable
                  key={m.user_id}
                  onPress={() => onSelectPartner(m.user_id)}
                  style={[
                    styles.avatarChip,
                    {
                      backgroundColor: isSelected ? colors.cardHighlight : colors.surface,
                      borderColor: isSelected ? colors.accent : colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Compare with ${m.nickname}`}
                  testID={`chip-partner-${m.user_id}`}
                >
                  <View style={[styles.chipAvatarMini, { backgroundColor: colors.surfaceAlt }]}>
                    <Text style={[styles.chipAvatarText, { color: colors.text }]}>
                      {m.nickname.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.avatarChipLabel,
                      { color: isSelected ? colors.text : colors.textMuted },
                      isSelected && styles.avatarChipLabelActive,
                    ]}
                    numberOfLines={1}
                  >
                    {m.nickname}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Main Side-by-Side 2-Column Card */}
      <View style={[styles.cardContainer, { backgroundColor: colors.border }]}>
        {/* Left Column: Me */}
        {renderMemberColumn(me, true)}

        {/* Divider */}
        <View style={[styles.columnDivider, { backgroundColor: colors.border }]} />

        {/* Right Column: Partner (or waiting state) */}
        {partner ? (
          renderMemberColumn(partner, false)
        ) : (
          <View style={[styles.column, styles.emptyPartnerColumn, { backgroundColor: colors.surface }]}>
            <Ionicons name="person-add-outline" size={32} color={colors.textMuted} />
            <Text style={[styles.emptyPartnerTitle, { color: colors.text }]}>
              {t('rooms.dormant.badge')}
            </Text>
            <Text style={[styles.emptyPartnerSubtitle, { color: colors.textMuted }]}>
              {t('rooms.dormant.subtitle')}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  avatarSelectorWrapper: {
    marginBottom: spacing.sm,
  },
  avatarSelectorScroll: {
    gap: spacing.xs,
  },
  avatarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: 6,
  },
  chipAvatarMini: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAvatarText: {
    fontSize: 10,
    fontWeight: '700',
  },
  avatarChipLabel: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  avatarChipLabelActive: {
    fontWeight: '700',
  },
  cardContainer: {
    flexDirection: 'row',
    borderRadius: radius.md,
    overflow: 'hidden',
    padding: 1, // subtle outer border effect
    gap: 1,
  },
  column: {
    flex: 1,
    padding: spacing.sm + 2,
  },
  columnDivider: {
    width: 1,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    minHeight: 38,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: spacing.xs + 2,
  },
  avatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs + 2,
  },
  avatarInitial: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  nameBlock: {
    flex: 1,
  },
  nickname: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  username: {
    fontSize: 11,
    marginTop: 1,
  },
  goalRingBox: {
    borderRadius: radius.sm,
    padding: spacing.xs + 2,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  goalRingLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  goalRingValue: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    marginTop: 2,
  },
  metricsList: {
    gap: 4,
    marginBottom: spacing.sm,
  },
  metricRow: {
    flexDirection: 'column',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs + 4,
    paddingVertical: 5,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: fontSize.xs + 1,
    fontWeight: '700',
  },
  lockedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  lockedText: {
    fontSize: 11,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  mealsSection: {
    marginBottom: spacing.xs,
  },
  mealsSectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  mealsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  mealChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 3,
  },
  mealChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  mealLockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 4,
  },
  partnerActionsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: spacing.xs,
  },
  partnerActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: radius.pill,
    gap: 3,
  },
  actionEmoji: {
    fontSize: 12,
  },
  partnerActionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyPartnerColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    textAlign: 'center',
  },
  emptyPartnerTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptyPartnerSubtitle: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    lineHeight: 16,
  },
});
