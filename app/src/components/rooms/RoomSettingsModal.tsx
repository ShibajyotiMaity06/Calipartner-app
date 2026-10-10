import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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

interface RoomSettingsModalProps {
  visible: boolean;
  room: RoomSummary;
  members: RoomMemberSnapshot[];
  currentUserId: string;
  onClose: () => void;
  onSetWhoCanInvite: (whoCanInvite: 'host_only' | 'any_member') => Promise<unknown>;
  onRemoveMember: (userId: string) => Promise<unknown>;
  onTransferHost: (userId: string) => Promise<unknown>;
  onLeaveRoom: () => Promise<unknown>;
  onReportUser: (user: RoomMemberSnapshot) => void;
  onBlockUser: (user: RoomMemberSnapshot) => void;
}

export function RoomSettingsModal({
  visible,
  room,
  members,
  currentUserId,
  onClose,
  onSetWhoCanInvite,
  onRemoveMember,
  onTransferHost,
  onLeaveRoom,
  onReportUser,
  onBlockUser,
}: RoomSettingsModalProps) {
  const { colors } = useTheme();
  const isHost = room.role === 'host';
  const [whoCanInvite, setWhoCanInvite] = useState<'host_only' | 'any_member'>(
    room.who_can_invite ?? 'host_only',
  );
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleToggleWhoCanInvite = async (val: 'host_only' | 'any_member') => {
    if (!isHost) return;
    setWhoCanInvite(val);
    try {
      await onSetWhoCanInvite(val);
    } catch {
      // Revert if failed
      setWhoCanInvite(room.who_can_invite ?? 'host_only');
    }
  };

  const handleRemove = (member: RoomMemberSnapshot) => {
    Alert.alert(
      t('rooms.settingsModal.removeBtn'),
      t('rooms.settingsModal.removeConfirm', { name: member.nickname }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: async () => {
            setLoadingAction(`remove-${member.user_id}`);
            try {
              await onRemoveMember(member.user_id);
            } finally {
              setLoadingAction(null);
            }
          },
        },
      ],
    );
  };

  const handleTransfer = (member: RoomMemberSnapshot) => {
    Alert.alert(
      t('rooms.settingsModal.transferHostBtn'),
      t('rooms.settingsModal.transferConfirm', { name: member.nickname }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            setLoadingAction(`transfer-${member.user_id}`);
            try {
              await onTransferHost(member.user_id);
            } finally {
              setLoadingAction(null);
            }
          },
        },
      ],
    );
  };

  const handleLeave = () => {
    Alert.alert(
      t('rooms.settingsModal.leaveRoomBtn'),
      t('rooms.settingsModal.leaveConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: async () => {
            setLoadingAction('leave');
            try {
              await onLeaveRoom();
              onClose();
            } finally {
              setLoadingAction(null);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('rooms.settingsModal.title')}
            </Text>
            <Pressable
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel="Close room settings"
              testID="btn-close-room-settings"
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Room Info Box */}
            <View style={[styles.infoBox, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.roomNameTitle, { color: colors.text }]}>{room.name}</Text>
              <Text style={[styles.roomCodeSub, { color: colors.textMuted }]}>
                {t('rooms.roomCode', { code: room.code })}
              </Text>
            </View>

            {/* Who Can Invite (Host Only Control) */}
            {isHost && (
              <View style={[styles.settingSection, { borderColor: colors.border }]}>
                <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
                  {t('rooms.settingsModal.whoCanInviteLabel')}
                </Text>
                <View style={styles.whoCanInviteRow}>
                  <Pressable
                    onPress={() => handleToggleWhoCanInvite('host_only')}
                    style={[
                      styles.choicePill,
                      whoCanInvite === 'host_only' && {
                        backgroundColor: colors.cardHighlight,
                        borderColor: colors.accent,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: whoCanInvite === 'host_only' }}
                    testID="radio-host-only-invite"
                  >
                    <Ionicons
                      name={whoCanInvite === 'host_only' ? 'radio-button-on' : 'radio-button-off'}
                      size={16}
                      color={whoCanInvite === 'host_only' ? colors.accent : colors.textMuted}
                    />
                    <Text style={[styles.choiceText, { color: colors.text }]}>
                      {t('rooms.settingsModal.hostOnly')}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleToggleWhoCanInvite('any_member')}
                    style={[
                      styles.choicePill,
                      whoCanInvite === 'any_member' && {
                        backgroundColor: colors.cardHighlight,
                        borderColor: colors.accent,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: whoCanInvite === 'any_member' }}
                    testID="radio-any-member-invite"
                  >
                    <Ionicons
                      name={whoCanInvite === 'any_member' ? 'radio-button-on' : 'radio-button-off'}
                      size={16}
                      color={whoCanInvite === 'any_member' ? colors.accent : colors.textMuted}
                    />
                    <Text style={[styles.choiceText, { color: colors.text }]}>
                      {t('rooms.settingsModal.anyMember')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Members Roster & Management */}
            <View style={styles.membersSection}>
              <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
                {t('rooms.settingsModal.membersListTitle', { count: members.length })}
              </Text>

              {members.map((m) => {
                const isMe = m.user_id === currentUserId;
                const isMemberHost = m.role === 'host';
                const isActionLoading = loadingAction?.includes(m.user_id);

                return (
                  <View key={m.user_id} style={[styles.memberCard, { backgroundColor: colors.surfaceAlt }]}>
                    <View style={styles.memberInfoRow}>
                      <View style={[styles.avatarMini, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.avatarText, { color: colors.text }]}>
                          {m.nickname.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.memberNameBox}>
                        <View style={styles.nameRow}>
                          <Text style={[styles.nickname, { color: colors.text }]}>
                            {m.nickname} {isMe ? '(You)' : ''}
                          </Text>
                          <View
                            style={[
                              styles.roleBadge,
                              { backgroundColor: isMemberHost ? colors.cardHighlight : colors.surface },
                            ]}
                          >
                            <Text
                              style={[
                                styles.roleBadgeText,
                                { color: isMemberHost ? colors.accent : colors.textMuted },
                              ]}
                            >
                              {isMemberHost
                                ? t('rooms.settingsModal.hostBadge')
                                : t('rooms.settingsModal.memberBadge')}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.username, { color: colors.textMuted }]}>
                          @{m.username}
                        </Text>
                      </View>
                    </View>

                    {/* Member Action Buttons */}
                    {!isMe && (
                      <View style={styles.memberActionsRow}>
                        {isHost && (
                          <>
                            <Pressable
                              onPress={() => handleTransfer(m)}
                              disabled={isActionLoading}
                              style={[styles.smallBtn, { borderColor: colors.border }]}
                              accessibilityRole="button"
                              accessibilityLabel={`Make ${m.nickname} host`}
                              testID={`btn-make-host-${m.user_id}`}
                            >
                              <Text style={[styles.smallBtnText, { color: colors.text }]}>
                                {t('rooms.settingsModal.transferHostBtn')}
                              </Text>
                            </Pressable>

                            <Pressable
                              onPress={() => handleRemove(m)}
                              disabled={isActionLoading}
                              style={[styles.smallBtn, { borderColor: colors.border }]}
                              accessibilityRole="button"
                              accessibilityLabel={`Remove ${m.nickname}`}
                              testID={`btn-remove-member-${m.user_id}`}
                            >
                              <Text style={[styles.smallBtnText, { color: colors.danger }]}>
                                {t('rooms.settingsModal.removeBtn')}
                              </Text>
                            </Pressable>
                          </>
                        )}

                        <Pressable
                          onPress={() => onReportUser(m)}
                          style={[styles.smallBtn, { borderColor: colors.border }]}
                          accessibilityRole="button"
                          accessibilityLabel={`Report ${m.nickname}`}
                          testID={`btn-report-${m.user_id}`}
                        >
                          <Text style={[styles.smallBtnText, { color: colors.textMuted }]}>
                            {t('rooms.settingsModal.reportBtn')}
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() => onBlockUser(m)}
                          style={[styles.smallBtn, { borderColor: colors.border }]}
                          accessibilityRole="button"
                          accessibilityLabel={`Block ${m.nickname}`}
                          testID={`btn-block-${m.user_id}`}
                        >
                          <Text style={[styles.smallBtnText, { color: colors.danger }]}>
                            {t('rooms.settingsModal.blockBtn')}
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Leave Room Danger Action */}
            <Pressable
              onPress={handleLeave}
              disabled={loadingAction === 'leave'}
              style={[styles.leaveRoomButton, { borderColor: colors.danger }]}
              accessibilityRole="button"
              accessibilityLabel="Leave this room"
              testID="btn-leave-room-confirm"
            >
              {loadingAction === 'leave' ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <View style={styles.leaveRow}>
                  <Ionicons name="log-out-outline" size={18} color={colors.danger} />
                  <Text style={[styles.leaveButtonText, { color: colors.danger }]}>
                    {t('rooms.settingsModal.leaveRoomBtn')}
                  </Text>
                </View>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    maxHeight: '85%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.md + 2,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  infoBox: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  roomNameTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  roomCodeSub: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  settingSection: {
    marginBottom: spacing.md,
    borderBottomWidth: 0.5,
    paddingBottom: spacing.sm,
  },
  sectionHeading: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  whoCanInviteRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  choicePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 6,
  },
  choiceText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  membersSection: {
    marginBottom: spacing.lg,
  },
  memberCard: {
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  memberInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarMini: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
  },
  memberNameBox: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
    fontSize: 10,
    marginTop: 1,
  },
  memberActionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
    justifyContent: 'flex-end',
  },
  smallBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  smallBtnText: {
    fontSize: 10,
    fontWeight: '600',
  },
  leaveRoomButton: {
    paddingVertical: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leaveButtonText: {
    fontSize: fontSize.xs + 1,
    fontWeight: '700',
  },
});
