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
import type { RoomSummary } from '@/types/rooms';

interface MembersTabProps {
  room: RoomSummary;
  members: RoomMemberSnapshot[];
  currentUserId: string;
  onInvite: () => void;
  onOpenSettings: () => void;
  onSelectMember: (userId: string) => void;
}

export function MembersTab({
  room,
  members,
  currentUserId,
  onInvite,
  onOpenSettings,
  onSelectMember,
}: MembersTabProps) {
  const { colors } = useTheme();

  const memberCap = room.member_cap ?? 5;
  const isRoomFull = members.length >= memberCap;
  const isHost = room.role === 'host';

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      {/* Top Banner */}
      <View style={[styles.topBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.bannerInfo}>
          <Text style={[styles.bannerTitle, { color: colors.text }]}>{room.name}</Text>
          <Text style={[styles.bannerSub, { color: colors.textMuted }]} testID="text-members-capacity">
            {t('rooms.capacityIndicator', { count: members.length, cap: memberCap })}
          </Text>
        </View>

        {!isRoomFull ? (
          <Pressable
            onPress={onInvite}
            style={[styles.inviteBtn, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Invite member"
            testID="btn-members-tab-invite"
          >
            <Ionicons name="person-add" size={14} color="#FFFFFF" />
            <Text style={styles.inviteBtnText}>{t('rooms.inviteModal.sendInviteBtn')}</Text>
          </Pressable>
        ) : (
          <View
            style={[styles.fullBadge, { backgroundColor: colors.surfaceAlt }]}
            testID="badge-members-room-full"
          >
            <Text style={[styles.fullBadgeText, { color: colors.textMuted }]}>
              {isHost ? t('rooms.roomFull.upgradeBtn') : t('rooms.roomFull.memberNotice')}
            </Text>
          </View>
        )}
      </View>

      {/* Room Full Host Notice Card */}
      {isRoomFull && isHost && (
        <View
          style={[styles.fullNoticeCard, { backgroundColor: colors.cardHighlight, borderColor: colors.accent }]}
          testID="card-members-room-full-host"
        >
          <Ionicons name="alert-circle-outline" size={18} color={colors.accent} />
          <Text style={[styles.fullNoticeText, { color: colors.text }]}>
            {t('rooms.roomFull.hostNotice')}
          </Text>
        </View>
      )}

      {/* Members Roster */}
      <View style={styles.rosterContainer}>
        {members.map((m) => {
          const isMe = m.user_id === currentUserId;
          const isHost = m.role === 'host';

          return (
            <Pressable
              key={m.user_id}
              onPress={() => onSelectMember(m.user_id)}
              style={[styles.memberRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={`View member ${m.nickname}`}
              testID={`member-row-${m.user_id}`}
            >
              {m.avatar_url ? (
                <Image source={{ uri: m.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={[styles.avatarInitial, { color: colors.text }]}>
                    {m.nickname.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.memberDetails}>
                <View style={styles.nameRow}>
                  <Text style={[styles.nickname, { color: colors.text }]}>
                    {m.nickname} {isMe ? '(You)' : ''}
                  </Text>
                  <View
                    style={[
                      styles.roleBadge,
                      { backgroundColor: isHost ? colors.cardHighlight : colors.surfaceAlt },
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleBadgeText,
                        { color: isHost ? colors.accent : colors.textMuted },
                      ]}
                    >
                      {isHost
                        ? t('rooms.settingsModal.hostBadge')
                        : t('rooms.settingsModal.memberBadge')}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.username, { color: colors.textMuted }]}>
                  @{m.username}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          );
        })}
      </View>

      {/* Manage Settings shortcut */}
      <Pressable
        onPress={onOpenSettings}
        style={[styles.manageButton, { backgroundColor: colors.surfaceAlt }]}
        accessibilityRole="button"
        accessibilityLabel="Room settings"
        testID="btn-members-open-settings"
      >
        <Ionicons name="settings-outline" size={18} color={colors.text} />
        <Text style={[styles.manageButtonText, { color: colors.text }]}>
          {t('rooms.settingsModal.title')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  topBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bannerInfo: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  bannerSub: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    gap: 4,
  },
  inviteBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  rosterContainer: {
    gap: spacing.xs + 2,
    marginBottom: spacing.lg,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm + 2,
    gap: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  memberDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nickname: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  username: {
    fontSize: fontSize.xs,
    marginTop: 1,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.pill,
    gap: 6,
  },
  manageButtonText: {
    fontSize: fontSize.xs + 1,
    fontWeight: '600',
  },
  fullBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  fullBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  fullNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  fullNoticeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    flex: 1,
  },
});
