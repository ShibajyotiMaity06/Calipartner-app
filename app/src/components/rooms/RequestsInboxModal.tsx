import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { RoomRequestWithDetails } from '@/types/rooms';

interface RequestsInboxModalProps {
  visible: boolean;
  incoming: RoomRequestWithDetails[];
  outgoing: RoomRequestWithDetails[];
  onClose: () => void;
  onRespond: (requestId: string, accept: boolean) => Promise<unknown>;
  onCancel: (requestId: string) => Promise<unknown>;
  onOpenPaywall?: () => void;
}

export function RequestsInboxModal({
  visible,
  incoming,
  outgoing,
  onClose,
  onRespond,
  onCancel,
  onOpenPaywall,
}: RequestsInboxModalProps) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [actingId, setActingId] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<{
    requestId: string;
    message: string;
    showUpgrade: boolean;
  } | null>(null);

  const handleRespond = async (item: RoomRequestWithDetails, accept: boolean) => {
    setActingId(item.id);
    setErrorState(null);
    try {
      await onRespond(item.id, accept);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err);
      if (msg.includes('ROOM_FULL')) {
        const isHost = item.type === 'join_request';
        setErrorState({
          requestId: item.id,
          message: isHost ? t('rooms.roomFull.hostNotice') : t('rooms.roomFull.memberNotice'),
          showUpgrade: isHost,
        });
      } else {
        setErrorState({
          requestId: item.id,
          message: msg,
          showUpgrade: false,
        });
      }
    } finally {
      setActingId(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    setActingId(requestId);
    try {
      await onCancel(requestId);
    } finally {
      setActingId(null);
    }
  };

  const calculateDaysRemaining = (expiresAt: string) => {
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('rooms.inboxModal.title')}
            </Text>
            <Pressable
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel="Close inbox modal"
              testID="btn-close-inbox-modal"
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          {/* Segmented Control */}
          <View style={[styles.tabRow, { backgroundColor: colors.surfaceAlt }]}>
            <Pressable
              onPress={() => setActiveTab('incoming')}
              style={[
                styles.tabButton,
                activeTab === 'incoming' && [styles.tabActive, { backgroundColor: colors.surface }],
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'incoming' }}
              testID="tab-inbox-incoming"
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'incoming' ? colors.text : colors.textMuted },
                  activeTab === 'incoming' && styles.tabTextActive,
                ]}
              >
                {t('rooms.inboxModal.incomingTab')} ({incoming.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('outgoing')}
              style={[
                styles.tabButton,
                activeTab === 'outgoing' && [styles.tabActive, { backgroundColor: colors.surface }],
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'outgoing' }}
              testID="tab-inbox-outgoing"
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'outgoing' ? colors.text : colors.textMuted },
                  activeTab === 'outgoing' && styles.tabTextActive,
                ]}
              >
                {t('rooms.inboxModal.outgoingTab')} ({outgoing.length})
              </Text>
            </Pressable>
          </View>

          {/* List Content */}
          <View style={styles.listContainer}>
            {activeTab === 'incoming' ? (
              incoming.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="mail-open-outline" size={40} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    {t('rooms.inboxModal.emptyIncoming')}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={incoming}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => {
                    const days = calculateDaysRemaining(item.expires_at);
                    const isActing = actingId === item.id;
                    const fromUsername = item.sender_profile?.username ?? 'user';

                    return (
                      <View style={[styles.card, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                        <View style={styles.cardHeader}>
                          <View style={styles.cardTextGroup}>
                            <Text style={[styles.cardTitle, { color: colors.text }]}>
                              {item.type === 'invitation'
                                ? t('rooms.inboxModal.invitationCard', { room: item.room_name ?? 'Room' })
                                : t('rooms.inboxModal.joinRequestCard', { room: item.room_name ?? 'Room' })}
                            </Text>
                            <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
                              {t('rooms.inboxModal.fromUser', { username: fromUsername })}
                            </Text>
                          </View>
                          <Text style={[styles.expiryText, { color: colors.textMuted }]}>
                            {t('rooms.inboxModal.expiresIn', { days })}
                          </Text>
                        </View>

                        <View style={styles.actionRow}>
                          <Pressable
                            onPress={() => handleRespond(item, false)}
                            disabled={isActing}
                            style={[styles.actionBtn, styles.declineBtn, { backgroundColor: colors.surface }]}
                            accessibilityRole="button"
                            accessibilityLabel={`Decline request from @${fromUsername}`}
                            testID={`btn-decline-req-${item.id}`}
                          >
                            <Text style={[styles.actionBtnText, { color: colors.textMuted }]}>
                              {t('rooms.inboxModal.declineBtn')}
                            </Text>
                          </Pressable>

                          <Pressable
                            onPress={() => handleRespond(item, true)}
                            disabled={isActing}
                            style={[styles.actionBtn, styles.acceptBtn, { backgroundColor: colors.accent }]}
                            accessibilityRole="button"
                            accessibilityLabel={`Accept request from @${fromUsername}`}
                            testID={`btn-accept-req-${item.id}`}
                          >
                            {isActing ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>
                                {t('rooms.inboxModal.acceptBtn')}
                              </Text>
                            )}
                          </Pressable>
                        </View>

                        {errorState?.requestId === item.id && (
                          <View
                            style={[styles.errorBox, { backgroundColor: colors.surface, borderColor: colors.danger }]}
                            testID={`box-req-error-${item.id}`}
                          >
                            <Ionicons name="alert-circle" size={16} color={colors.danger} />
                            <Text style={[styles.errorMsgText, { color: colors.danger }]}>
                              {errorState.message}
                            </Text>
                            {errorState.showUpgrade && onOpenPaywall && (
                              <Pressable
                                onPress={onOpenPaywall}
                                style={[styles.upgradeBtnMini, { backgroundColor: colors.accent }]}
                                accessibilityRole="button"
                                accessibilityLabel={t('rooms.roomFull.upgradeBtn')}
                                testID={`btn-inbox-room-full-upgrade-${item.id}`}
                              >
                                <Text style={styles.upgradeBtnMiniText}>
                                  {t('rooms.roomFull.upgradeBtn')}
                                </Text>
                              </Pressable>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  }}
                />
              )
            ) : outgoing.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="paper-plane-outline" size={40} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  {t('rooms.inboxModal.emptyOutgoing')}
                </Text>
              </View>
            ) : (
              <FlatList
                data={outgoing}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const isActing = actingId === item.id;
                  const toUsername = item.recipient_profile?.username ?? item.room_name ?? 'partner';

                  return (
                    <View style={[styles.card, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                      <View style={styles.cardHeader}>
                        <View style={styles.cardTextGroup}>
                          <Text style={[styles.cardTitle, { color: colors.text }]}>
                            {item.type === 'invitation'
                              ? t('rooms.inboxModal.invitationCard', { room: item.room_name ?? 'Room' })
                              : t('rooms.inboxModal.joinRequestCard', { room: item.room_name ?? 'Room' })}
                          </Text>
                          <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
                            {t('rooms.inboxModal.toUser', { username: toUsername })}
                          </Text>
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: colors.surface }]}>
                          <Text style={[styles.statusPillText, { color: colors.textMuted }]}>
                            {item.status === 'pending'
                              ? t('rooms.inboxModal.statusPending')
                              : t('rooms.inboxModal.statusNotAccepted')}
                          </Text>
                        </View>
                      </View>

                      {item.status === 'pending' && (
                        <Pressable
                          onPress={() => handleCancel(item.id)}
                          disabled={isActing}
                          style={[styles.cancelBtn, { borderColor: colors.border }]}
                          accessibilityRole="button"
                          accessibilityLabel="Cancel sent request"
                          testID={`btn-cancel-req-${item.id}`}
                        >
                          {isActing ? (
                            <ActivityIndicator size="small" color={colors.textMuted} />
                          ) : (
                            <Text style={[styles.cancelBtnText, { color: colors.danger }]}>
                              {t('rooms.inboxModal.cancelBtn')}
                            </Text>
                          )}
                        </Pressable>
                      )}
                    </View>
                  );
                }}
              />
            )}
          </View>
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
    minHeight: 450,
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
  tabRow: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: 3,
    marginBottom: spacing.md,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  tabActive: {
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tabText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  listContainer: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.xs + 1,
    textAlign: 'center',
  },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  cardTextGroup: {
    flex: 1,
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  expiryText: {
    fontSize: 10,
    fontStyle: 'italic',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtn: {},
  acceptBtn: {},
  actionBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  errorBox: {
    marginTop: spacing.xs + 2,
    padding: spacing.xs + 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 4,
  },
  errorMsgText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  upgradeBtnMini: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginTop: 4,
  },
  upgradeBtnMiniText: {
    color: '#FFFFFF',
    fontSize: fontSize.xs - 1,
    fontWeight: '700',
  },
});
