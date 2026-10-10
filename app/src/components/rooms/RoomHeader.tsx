import React from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { RoomSummary } from '@/types/rooms';

export type RoomSegment = 'today' | 'focus' | 'chat' | 'progress' | 'members';

interface RoomHeaderProps {
  currentRoom: RoomSummary | null;
  allRooms: RoomSummary[];
  pendingRequestsCount: number;
  streakDays: number;
  activeSegment: RoomSegment;
  onSelectSegment: (segment: RoomSegment) => void;
  onOpenInbox: () => void;
  onOpenSettings: () => void;
  onOpenPrivacy: () => void;
  onSwitchRoom?: (room: RoomSummary) => void;
  onCreateOrJoin?: () => void;
}

export function RoomHeader({
  currentRoom,
  allRooms,
  pendingRequestsCount,
  streakDays,
  activeSegment,
  onSelectSegment,
  onOpenInbox,
  onOpenSettings,
  onOpenPrivacy,
  onSwitchRoom,
  onCreateOrJoin,
}: RoomHeaderProps) {
  const { colors } = useTheme();
  const [copiedToast, setCopiedToast] = React.useState(false);
  const [showRoomSwitcher, setShowRoomSwitcher] = React.useState(false);

  const handleCopyCode = async () => {
    if (!currentRoom?.code) return;
    try {
      const nav = typeof navigator !== 'undefined' ? (navigator as unknown as { clipboard?: { writeText: (text: string) => Promise<void> } }) : undefined;
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(currentRoom.code);
      } else {
        await Share.share({ message: currentRoom.code });
      }
    } catch {
      // Ignore
    }
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
  };

  const segments: { key: RoomSegment; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'today', label: t('rooms.segments.today'), icon: 'calendar-outline' },
    { key: 'focus', label: t('rooms.segments.focus'), icon: 'timer-outline' },
    { key: 'chat', label: t('rooms.segments.chat'), icon: 'chatbubbles-outline' },
    { key: 'progress', label: t('rooms.segments.progress'), icon: 'trending-up-outline' },
    { key: 'members', label: t('rooms.segments.members'), icon: 'people-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      {/* Top Bar: Room Title & Action Buttons */}
      <View style={styles.topRow}>
        <View style={styles.titleContainer}>
          {currentRoom ? (
            <Pressable
              onPress={() => allRooms.length > 1 && setShowRoomSwitcher(!showRoomSwitcher)}
              style={styles.titlePressable}
              accessibilityRole="button"
              accessibilityLabel={`Current room: ${currentRoom.name}`}
              testID="btn-room-title-switcher"
            >
              <Text style={[styles.roomTitle, { color: colors.text }]} numberOfLines={1}>
                {currentRoom.name}
              </Text>
              {allRooms.length > 1 && (
                <Ionicons
                  name={showRoomSwitcher ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textMuted}
                  style={styles.dropdownIcon}
                />
              )}
            </Pressable>
          ) : (
            <Text style={[styles.roomTitle, { color: colors.text }]}>{t('rooms.title')}</Text>
          )}

          {currentRoom && (
            <View style={styles.badgeRow}>
              {/* Tap-to-copy room code badge */}
              <Pressable
                onPress={handleCopyCode}
                style={[styles.codeBadge, { backgroundColor: colors.surfaceAlt }]}
                accessibilityRole="button"
                accessibilityLabel={`Room code: ${currentRoom.code}. Tap to copy.`}
                testID="btn-copy-room-code"
              >
                <Ionicons name="key-outline" size={12} color={colors.textMuted} />
                <Text style={[styles.codeText, { color: colors.text }]}>{currentRoom.code}</Text>
                <Ionicons
                  name={copiedToast ? 'checkmark-circle' : 'copy-outline'}
                  size={12}
                  color={copiedToast ? colors.syncSynced : colors.textMuted}
                />
              </Pressable>

              {/* Room Streak badge */}
              {streakDays > 0 && (
                <View style={[styles.streakBadge, { backgroundColor: colors.cardHighlight }]}>
                  <Text style={styles.streakFire}>🔥</Text>
                  <Text style={[styles.streakText, { color: colors.accent }]}>
                    {t('rooms.streakDays', { count: streakDays })}
                  </Text>
                </View>
              )}

              {/* Capacity indicator ("3 of 5 people") */}
              <View
                style={[styles.capacityBadge, { backgroundColor: colors.surfaceAlt }]}
                accessibilityLabel={`Capacity: ${t('rooms.capacityIndicator', {
                  count: currentRoom.member_count,
                  cap: currentRoom.member_cap ?? 5,
                })}`}
                testID="badge-room-capacity"
              >
                <Ionicons name="people-outline" size={12} color={colors.textMuted} />
                <Text style={[styles.capacityText, { color: colors.text }]}>
                  {t('rooms.capacityIndicator', {
                    count: currentRoom.member_count,
                    cap: currentRoom.member_cap ?? 5,
                  })}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Right side icons */}
        <View style={styles.actionButtonsRow}>
          {/* Requests Inbox button with badge */}
          <Pressable
            onPress={onOpenInbox}
            style={[styles.iconButton, { backgroundColor: colors.surfaceAlt }]}
            accessibilityRole="button"
            accessibilityLabel={`Requests inbox. ${pendingRequestsCount} pending requests.`}
            testID="btn-room-inbox"
          >
            <Ionicons name="mail-outline" size={20} color={colors.text} />
            {pendingRequestsCount > 0 && (
              <View style={[styles.inboxBadge, { backgroundColor: colors.danger }]}>
                <Text style={styles.inboxBadgeText}>{pendingRequestsCount}</Text>
              </View>
            )}
          </Pressable>

          {/* Privacy settings */}
          {currentRoom && (
            <Pressable
              onPress={onOpenPrivacy}
              style={[styles.iconButton, { backgroundColor: colors.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel="Room privacy settings"
              testID="btn-room-privacy"
            >
              <Ionicons name="eye-outline" size={20} color={colors.text} />
            </Pressable>
          )}

          {/* Room Settings */}
          {currentRoom && (
            <Pressable
              onPress={onOpenSettings}
              style={[styles.iconButton, { backgroundColor: colors.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel="Room settings"
              testID="btn-room-settings"
            >
              <Ionicons name="settings-outline" size={20} color={colors.text} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Multiple Rooms Switcher Dropdown */}
      {showRoomSwitcher && allRooms.length > 1 && (
        <View style={[styles.switcherDropdown, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <Text style={[styles.switcherHeader, { color: colors.textMuted }]}>{t('rooms.manageRooms')}</Text>
          {allRooms.map((r) => {
            const isSelected = r.id === currentRoom?.id;
            return (
              <Pressable
                key={r.id}
                onPress={() => {
                  setShowRoomSwitcher(false);
                  onSwitchRoom?.(r);
                }}
                style={[
                  styles.switcherRow,
                  isSelected && { backgroundColor: colors.cardHighlight },
                ]}
                accessibilityRole="button"
                testID={`btn-switch-room-${r.id}`}
              >
                <View style={styles.switcherRowContent}>
                  <Text style={[styles.switcherRowName, { color: colors.text }]}>{r.name}</Text>
                  <Text style={[styles.switcherRowRole, { color: colors.textMuted }]}>
                    {r.role === 'host' ? t('rooms.settingsModal.hostBadge') : t('rooms.settingsModal.memberBadge')} • {r.member_count} members
                  </Text>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}
              </Pressable>
            );
          })}
          {onCreateOrJoin && allRooms.length < 3 && (
            <Pressable
              onPress={() => {
                setShowRoomSwitcher(false);
                onCreateOrJoin();
              }}
              style={[styles.switcherRow, { borderTopWidth: 0.5, borderTopColor: colors.border }]}
              accessibilityRole="button"
              testID="btn-switcher-create-room"
            >
              <Ionicons name="add-circle-outline" size={16} color={colors.accent} />
              <Text style={[styles.switcherRowName, { color: colors.accent, marginLeft: 6 }]}>
                {t('rooms.createRoomBtn')}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Segmented control navigation */}
      {currentRoom && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.segmentedScroll}
          contentContainerStyle={[styles.segmentedRow, { backgroundColor: colors.surfaceAlt }]}
        >
          {segments.map((seg) => {
            const isActive = activeSegment === seg.key;
            return (
              <Pressable
                key={seg.key}
                onPress={() => onSelectSegment(seg.key)}
                style={[
                  styles.segmentButton,
                  isActive && [styles.segmentActive, { backgroundColor: colors.surface }],
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={seg.label}
                testID={`room-tab-${seg.key}`}
              >
                <Ionicons
                  name={seg.icon}
                  size={15}
                  color={isActive ? colors.accent : colors.textMuted}
                />
                <Text
                  style={[
                    styles.segmentText,
                    { color: isActive ? colors.text : colors.textMuted },
                    isActive && styles.segmentTextActive,
                  ]}
                >
                  {seg.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  titleContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  titlePressable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roomTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  dropdownIcon: {
    marginLeft: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    gap: 4,
  },
  codeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    gap: 4,
  },
  streakFire: {
    fontSize: 12,
  },
  streakText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  inboxBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  inboxBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  switcherDropdown: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.xs,
  },
  switcherHeader: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  switcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  switcherRowContent: {
    flex: 1,
  },
  switcherRowName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  switcherRowRole: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  capacityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    gap: 4,
  },
  capacityText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  segmentedScroll: {
    marginTop: spacing.sm,
  },
  segmentedRow: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: 3,
    gap: 2,
  },
  segmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 4,
    borderRadius: radius.pill,
    gap: 4,
  },
  segmentActive: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  segmentTextActive: {
    fontWeight: '700',
  },
});
