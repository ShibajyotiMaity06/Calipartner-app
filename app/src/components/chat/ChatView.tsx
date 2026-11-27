import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { homeLayout } from '@calipartner/ui';
import {
  ChevronDownIcon,
  CloseIcon,
  IconButton,
  PinIcon,
  PrimaryButton,
  SecondaryButton,
  Sheet,
  Text as V1Text,
  borders,
  colors as v1Colors,
  fonts,
  radius as v1Radius,
  space as v1Space,
} from '@calipartner/ui/v1';
import { visualPrimitives } from '@calipartner/ui/tokens';
import type { ChatAttachment, ChatMessage } from '@/types/chat';
import { useRoomChat, type UseRoomChatOptions } from '@/hooks/useRoomChat';
import { useSubscription } from '@/hooks/useSubscription';
import { useChatTyping } from '@/hooks/useChatTyping';
import { generateClientUuid } from '@/services/foodService';
import {
  requestUploadPresignedUrl,
  uploadImageToR2,
  getSignedImageUrl,
} from '@/services/chatImageService';
import { getSupabase } from '@/lib/supabase';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import {
  getChatReactions,
  markSquadMentionSeen,
  setRoomPinnedGoal,
  toggleChatReaction,
  type ChatReactionState,
} from '@/services/squadService';
import { ChatComposer } from './ChatComposer';
import { ChatImageViewerModal } from './ChatImageViewerModal';
import { type SelectedMediaItem } from './ChatMediaPickerModal';
import { ChatMessageBubble } from './ChatMessageBubble';
import { ChatMessageMenuModal } from './ChatMessageMenuModal';
import { ChatReportModal } from './ChatReportModal';
import { ChatTermsModal } from './ChatTermsModal';

export interface ChatViewProps {
  focusedMentionId?: string;
  mentionMembers?: { user_id: string; username: string; nickname: string }[];
  roomId: string | null;
  roomName?: string | null;
  pinnedGoal?: string | null;
  prefillText?: string | null;
  onPrefillConsumed?: () => void;
  onTypingSummaryChange?: (summary: string | null) => void;
  isVisible?: boolean;
  options?: UseRoomChatOptions;
  isLocked?: boolean;
  testID?: string;
}

export function ChatView({
  focusedMentionId,
  mentionMembers = [],
  roomId,
  roomName,
  pinnedGoal: initialPinnedGoal,
  prefillText,
  onPrefillConsumed,
  onTypingSummaryChange,
  isVisible = true,
  options = {},
  isLocked: isLockedProp,
  testID = 'room-chat-view',
}: ChatViewProps) {
  const { hasActiveAccess, currentTier } = useSubscription();

  const {
    messages,
    loading,
    loadingMore,
    hasMore,
    unreadCount,
    isLocked: isLockedFromHook,
    isDormant,
    termsAccepted,
    error,
    refresh,
    loadMore,
    sendMessage,
    deleteMessage,
    reportMessage,
    muteMember,
    blockMember,
    acceptTerms,
  } = useRoomChat(roomId, isVisible, options);

  const { typingPeople, notifyTyping } = useChatTyping(
    roomId,
    options.userId,
    isVisible && termsAccepted,
  );
  const effectiveIsLocked = Boolean(isLockedProp || isLockedFromHook);
  const mentionAccessDenied =
    effectiveIsLocked ||
    ['PLUS_REQUIRED', 'NOT_ROOM_MEMBER', 'NOT_AUTHORIZED'].includes(error?.code ?? '');

  const [mediaReadError, setMediaReadError] = useState(false);
  const [activeImageAttachment, setActiveImageAttachment] = useState<ChatAttachment | null>(null);
  const [activeMenuMessage, setActiveMenuMessage] = useState<ChatMessage | null>(null);
  const [reportTargetMessageId, setReportTargetMessageId] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [focusedMention, setFocusedMention] = useState<ChatMessage | null>(null);
  const [mentionError, setMentionError] = useState(false);
  const [mentionRetry, setMentionRetry] = useState(0);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

  const [pinnedGoal, setPinnedGoal] = useState<string | null>(initialPinnedGoal ?? null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(initialPinnedGoal ?? '');
  const [savingGoal, setSavingGoal] = useState(false);
  const [reactions, setReactions] = useState<Record<string, ChatReactionState>>({});

  useEffect(() => {
    setPinnedGoal(initialPinnedGoal ?? null);
    setGoalDraft(initialPinnedGoal ?? '');
  }, [initialPinnedGoal, roomId]);

  useEffect(() => {
    const names = typingPeople.map((p) => p.nickname).filter(Boolean);
    onTypingSummaryChange?.(names.length > 0 ? names[0]! : null);
  }, [onTypingSummaryChange, typingPeople]);

  useEffect(() => {
    setReplyTo(null);
  }, [roomId, options.userId]);

  useEffect(() => {
    if (replyTo && messages.some((message) => message.id === replyTo.id && message.deleted_at))
      setReplyTo(null);
  }, [messages, replyTo]);

  useEffect(() => {
    let active = true;
    const ids = messages.filter((m) => m.message_type === 'system').map((m) => m.id);
    if (!roomId || !isVisible || ids.length === 0) return;
    void getChatReactions(roomId, ids)
      .then((res) => {
        if (active) setReactions(res);
      })
      .catch(() => {
        // Ignore gracefully offline or under test mocks
      });
    return () => {
      active = false;
    };
  }, [roomId, isVisible, messages]);

  useEffect(() => {
    let current = true;
    setFocusedMention(null);
    setMentionError(false);
    if (!roomId || !isVisible || !focusedMentionId || mentionAccessDenied) return;
    void (async () => {
      try {
        const result = await getSupabase().rpc('get_squad_mention_context', {
          p_room_id: roomId,
          p_message_id: focusedMentionId,
        });
        if (result.error) throw result.error;
        const message = (result.data as ChatMessage[] | null)?.find(
          (item) => item.id === focusedMentionId,
        );
        if (!message) throw new Error('MESSAGE_NOT_FOUND');
        if (!current) return;
        setFocusedMention({ ...message, delivery_status: 'sent', sync_state: 'synced' });
        await markSquadMentionSeen(roomId, focusedMentionId);
      } catch {
        if (current) setMentionError(true);
      }
    })();
    return () => {
      current = false;
    };
  }, [roomId, isVisible, focusedMentionId, mentionRetry, mentionAccessDenied]);

  const handleToggleReaction = useCallback(async (messageId: string) => {
    try {
      const updated = await toggleChatReaction(messageId, 'heart');
      setReactions((prev) => ({
        ...prev,
        [messageId]: {
          count: updated.count,
          viewer_liked: updated.viewer_liked,
        },
      }));
    } catch {
      // Ignore offline/network error cleanly
    }
  }, []);

  const openAttachment = (att: ChatAttachment) => {
    if (att.signed_url) {
      setActiveImageAttachment(att);
      return;
    }
    if (roomId)
      void getSignedImageUrl(getSupabase(), roomId, att.storage_key)
        .then((signed_url) => setActiveImageAttachment({ ...att, signed_url }))
        .catch(() => setMediaReadError(true));
  };

  const pending = useRef<{ signature: string; id: string } | null>(null);
  const handleSend = async (text?: string | null, selectedMedia?: SelectedMediaItem[]) => {
    if (!roomId) return;
    const signature = JSON.stringify([roomId, text, selectedMedia?.map((m) => m.uri), replyTo?.id]);
    if (pending.current?.signature !== signature)
      pending.current = { signature, id: generateClientUuid() };
    const clientId = pending.current.id;
    const attachments = [];
    for (const [index, m] of (selectedMedia ?? []).entries()) {
      const signed = await requestUploadPresignedUrl(getSupabase(), {
        room_id: roomId,
        client_id: clientId,
        filename: m.name,
        mime_type: m.mimeType,
        size: m.size,
        width: m.width,
        height: m.height,
        attachmentIndex: index,
      });
      await uploadImageToR2(signed.upload_url, m.buffer, m.mimeType);
      attachments.push({
        storage_key: signed.storage_key,
        size: m.size,
        mime_type: m.mimeType,
        width: m.width,
        height: m.height,
        local_uri: m.uri,
      });
    }
    notifyTyping(false);
    await sendMessage(text, attachments.length ? attachments : undefined, clientId, replyTo?.id);
    for (const attachment of attachments) {
      const result = await getSupabase().functions.invoke('chat-image-moderation', {
        body: { action: 'finalize', storage_key: attachment.storage_key },
      });
      if (result.error || result.data?.status !== 'ok') setMediaReadError(true);
    }
    await refresh();
    setReplyTo(null);
    pending.current = null;
  };

  const handleRetry = async (failedMessage: ChatMessage) => {
    setMediaReadError(false);
    try {
      const retryAttachments = failedMessage.attachments?.map((att) => ({
        storage_key: att.storage_key,
        size: att.size,
        mime_type: att.mime_type,
        width: att.width ?? undefined,
        height: att.height ?? undefined,
        local_uri: att.local_uri ?? undefined,
      }));
      await sendMessage(
        failedMessage.text,
        retryAttachments,
        failedMessage.client_id,
        failedMessage.reply_to_id,
      );
      for (const attachment of retryAttachments ?? [])
        await getSupabase().functions.invoke('chat-image-moderation', {
          body: { action: 'finalize', storage_key: attachment.storage_key },
        });
      await refresh();
    } catch {
      setMediaReadError(true);
    }
  };

  const isCurrentUserId = (senderId: string | null | undefined) => {
    if (!senderId || !options.userId) return false;
    return senderId === options.userId;
  };

  const isMessageSeenByAll = (item: ChatMessage) => {
    if (!item) return false;
    if (item.delivery_status === 'failed' || item.delivery_status === 'sending') return false;
    if ((item as unknown as { is_seen_by_all?: boolean }).is_seen_by_all) return true;
    if ((item as unknown as { seen_by_all?: boolean }).seen_by_all) return true;
    if ((item as unknown as { delivery_status?: string }).delivery_status === 'read') return true;

    if (!item.created_at) return false;
    const msgTime = new Date(item.created_at).getTime();
    if (isNaN(msgTime)) return false;

    return messages.some((m) => {
      if (!m.sender_id || m.sender_id === options.userId) return false;
      if (!m.created_at) return false;
      const peerTime = new Date(m.created_at).getTime();
      return peerTime >= msgTime;
    });
  };

  const savePinnedGoal = async (nextGoal: string | null) => {
    if (!roomId) return;
    setSavingGoal(true);
    try {
      const saved = await setRoomPinnedGoal(roomId, nextGoal);
      setPinnedGoal(saved);
      setEditingGoal(false);
    } catch {
      // keep dialog open cleanly if offline
    } finally {
      setSavingGoal(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={styles.container}
      testID={testID}
    >
      {mediaReadError ? (
        <V1Text variant="meta" color="danger" accessibilityRole="alert" style={styles.errorLine}>
          {t('chatAudit.actionError')}
        </V1Text>
      ) : null}

      {effectiveIsLocked ? (
        <View
          style={[styles.bannerStrip, { backgroundColor: v1Colors.danger }]}
          testID="banner-chat-locked"
          accessibilityLabel="Room paused banner"
        >
          <Ionicons name="lock-closed" size={16} color={visualPrimitives.colors.white} />
          <V1Text variant="meta" color="textHi" style={styles.bannerStripText}>
            {t('chat.pausedTitle')} — {t('chat.pausedSubtitle')}
          </V1Text>
        </View>
      ) : null}

      {isDormant && !effectiveIsLocked ? (
        <View
          style={styles.dormantStrip}
          testID="banner-chat-dormant"
          accessibilityLabel="Dormant room notice"
        >
          <Ionicons name="information-circle-outline" size={16} color={v1Colors.apricot} />
          <V1Text variant="meta" color="textMid" style={styles.bannerStripText}>
            {t('chat.dormantBanner')}
          </V1Text>
        </View>
      ) : null}

      {roomId && !effectiveIsLocked ? (
        <View style={styles.pinnedBarOuter}>
          <Pressable
            onPress={() => {
              setGoalDraft(pinnedGoal ?? '');
              setEditingGoal(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={pinnedGoal ?? t('squadV1.pinnedDefault')}
            style={({ pressed }) => [styles.pinnedBar, pressed ? styles.pressedRow : null]}
            testID="btn-pinned-squad-goal"
          >
            <PinIcon size={14} color={v1Colors.apricot} />
            <V1Text variant="meta" color="textMid" style={styles.pinnedText}>
              {pinnedGoal ? `${t('squadV1.pinnedPrefix')} ` : ''}
              <V1Text
                variant="meta"
                color={pinnedGoal ? 'textHi' : 'textLo'}
                style={pinnedGoal ? styles.boldText : undefined}
              >
                {pinnedGoal || t('squadV1.pinnedDefault')}
              </V1Text>
            </V1Text>
            <ChevronDownIcon size={14} color={v1Colors.textLo} />
          </Pressable>
        </View>
      ) : null}

      {!mentionAccessDenied && focusedMentionId ? (
        <View style={{ padding: spacing.sm }} testID="focused-chat-mention">
          {mentionError ? (
            <Pressable
              onPress={() => setMentionRetry((value) => value + 1)}
              accessibilityRole="button"
              accessibilityLabel={t('common.retry')}
              testID="retry-focused-mention"
            >
              <V1Text variant="meta" color="danger" accessibilityRole="alert">
                {t(
                  focusedMention
                    ? 'squadDesign.mentionReadError'
                    : 'squadDesign.mentionUnavailable',
                )}{' '}
                · {t('common.retry')}
              </V1Text>
            </Pressable>
          ) : null}
          {focusedMention ? (
            <ScrollView style={{ maxHeight: homeLayout.touchSize * 4 }}>
              <ChatMessageBubble
                message={focusedMention}
                isMine={false}
                onLongPress={setActiveMenuMessage}
                onReply={setReplyTo}
                onPressImage={openAttachment}
                testID={`focused-mention-${focusedMention.id}`}
              />
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      {loading && messages.length === 0 ? (
        <View style={styles.centeredLoading}>
          <ActivityIndicator size="large" color={v1Colors.apricot} />
          <V1Text variant="meta" color="textLo">
            {t('common.loading')}
          </V1Text>
        </View>
      ) : error && messages.length === 0 ? (
        <View style={styles.centeredLoading} testID="chat-error-state">
          <Ionicons name="alert-circle-outline" size={40} color={v1Colors.danger} />
          <V1Text variant="meta" color="textHi" style={styles.centerText}>
            {error.message || t('common.errorTitle')}
          </V1Text>
        </View>
      ) : (
        <FlatList
          data={[...messages].filter((message) => message.id !== focusedMention?.id).reverse()}
          keyExtractor={(item) => item.client_id || item.id}
          inverted
          onEndReached={() => {
            if (hasMore && !loadingMore) {
              loadMore();
            }
          }}
          onEndReachedThreshold={0.2}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadingMoreWrap}>
                <ActivityIndicator size="small" color={v1Colors.apricot} />
              </View>
            ) : messages.length > 0 ? (
              <View style={styles.todayDividerWrap}>
                <V1Text variant="meta" color="textLo">
                  {t('homeV1.todayLabel')}
                </V1Text>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => {
            const isMine = isCurrentUserId(item.sender_id);
            const showNewMessagesDivider =
              unreadCount > 0 && index === unreadCount - 1 && index < messages.length - 1;

            return (
              <View>
                <ChatMessageBubble
                  message={item}
                  isMine={isMine}
                  isSeenByAll={isMine && isMessageSeenByAll(item)}
                  reaction={reactions[item.id]}
                  onToggleReaction={(id) => void handleToggleReaction(id)}
                  onRetry={handleRetry}
                  onPressImage={openAttachment}
                  onLongPress={(msg) => setActiveMenuMessage(msg)}
                  onReply={setReplyTo}
                  testID={`bubble-${item.id}`}
                />

                {showNewMessagesDivider ? (
                  <View style={styles.dividerWrap} testID="divider-new-messages">
                    <View style={styles.dividerLine} />
                    <View style={styles.dividerBadge}>
                      <V1Text variant="micro" color="apricot" style={styles.dividerBadgeText}>
                        {t('chat.newMessagesDivider')}
                      </V1Text>
                    </View>
                    <View style={styles.dividerLine} />
                  </View>
                ) : null}
              </View>
            );
          }}
          ListEmptyComponent={
            focusedMention ? null : (
              <View style={styles.emptyWrap}>
                <V1Text variant="body" color="textLo">
                  {t('squadDesign.noChat')}
                </V1Text>
              </View>
            )
          }
          testID="list-chat-messages"
        />
      )}

      {typingPeople.length ? (
        <View
          style={styles.typingRow}
          testID="chat-typing-indicator"
          accessibilityLiveRegion="polite"
        >
          <View style={styles.typingDots}>
            <View style={[styles.typingDot, styles.typingDotDim]} />
            <View style={styles.typingDot} />
            <View style={[styles.typingDot, styles.typingDotDim]} />
          </View>
          <V1Text variant="meta" color="textLo">
            {t(
              typingPeople.length === 1
                ? 'chatAudit.typingOne'
                : typingPeople.length <= 3
                  ? 'chatAudit.typingMany'
                  : typingPeople.length === 4
                    ? 'chatAudit.typingOneMore'
                    : 'chatAudit.typingMore',
              {
                names: typingPeople
                  .slice(0, 3)
                  .map((person) => person.nickname)
                  .join(', '),
                count: typingPeople.length - 3,
              },
            )}
          </V1Text>
        </View>
      ) : null}

      <ChatComposer
        key={`${roomId}:${options.userId}`}
        reply={
          replyTo
            ? {
                name: replyTo.sender_nickname || replyTo.sender_username || t('repairs.you'),
                text: replyTo.text,
              }
            : null
        }
        onCancelReply={() => setReplyTo(null)}
        mentionMembers={mentionMembers.filter((member) => member.user_id !== options.userId)}
        onSend={handleSend}
        onTyping={notifyTyping}
        placeholder={roomName ? t('squadV1.chatPlaceholder', { name: roomName }) : undefined}
        prefillText={prefillText}
        onPrefillConsumed={onPrefillConsumed}
        disabled={effectiveIsLocked || isDormant}
        disabledReason={
          effectiveIsLocked
            ? t('chat.pausedTitle')
            : isDormant
              ? t('chat.dormantBanner')
              : undefined
        }
        allowMedia={hasActiveAccess && currentTier === 'pro'}
        termsAccepted={termsAccepted}
        onRequireTerms={() => setShowTermsModal(true)}
      />

      {editingGoal ? (
        <Sheet
          visible={editingGoal}
          onClose={() => setEditingGoal(false)}
          accessibilityLabel={t('squadV1.pinnedSheetTitle')}
          testID="sheet-pinned-goal"
        >
          <View style={styles.goalSheetWrap}>
            <View style={styles.goalSheetTop}>
              <V1Text variant="titleM" color="textHi">
                {t('squadV1.pinnedSheetTitle')}
              </V1Text>
              <IconButton
                icon={<CloseIcon size={18} color={v1Colors.textHi} />}
                accessibilityLabel={t('squadDesign.close')}
                onPress={() => setEditingGoal(false)}
              />
            </View>
            <TextInput
              value={goalDraft}
              onChangeText={setGoalDraft}
              placeholder={t('squadV1.pinnedPlaceholder')}
              placeholderTextColor={v1Colors.textLo}
              maxLength={120}
              style={styles.goalInput}
              testID="input-pinned-goal"
            />
            <PrimaryButton
              title={t('squadV1.saveGoal')}
              loading={savingGoal}
              onPress={() => void savePinnedGoal(goalDraft.trim() || null)}
              testID="btn-save-pinned-goal"
            />
            {pinnedGoal ? (
              <SecondaryButton
                title={t('squadV1.clearGoal')}
                disabled={savingGoal}
                onPress={() => void savePinnedGoal(null)}
                testID="btn-clear-pinned-goal"
              />
            ) : null}
          </View>
        </Sheet>
      ) : null}

      <ChatImageViewerModal
        visible={Boolean(activeImageAttachment)}
        attachment={activeImageAttachment}
        onClose={() => setActiveImageAttachment(null)}
      />

      <ChatMessageMenuModal
        visible={Boolean(activeMenuMessage)}
        message={activeMenuMessage}
        isMine={isCurrentUserId(activeMenuMessage?.sender_id)}
        onClose={() => setActiveMenuMessage(null)}
        onDeleteMessage={deleteMessage}
        onReply={setReplyTo}
        onReportMessage={(msgId) => {
          setActiveMenuMessage(null);
          setReportTargetMessageId(msgId);
        }}
        onMuteMember={muteMember}
        onBlockMember={async (id) => {
          await blockMember(id);
          if (replyTo?.sender_id === id) setReplyTo(null);
        }}
      />

      <ChatReportModal
        visible={Boolean(reportTargetMessageId)}
        messageId={reportTargetMessageId}
        onClose={() => setReportTargetMessageId(null)}
        onSubmitReport={reportMessage}
      />

      <ChatTermsModal
        visible={showTermsModal}
        onAccept={acceptTerms}
        onClose={() => setShowTermsModal(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: v1Colors.bg0,
  },
  errorLine: {
    paddingHorizontal: v1Space.lg,
    paddingVertical: v1Space.xs,
  },
  bannerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    gap: 6,
  },
  dormantStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: v1Space.sm,
    paddingHorizontal: v1Space.lg,
    gap: 6,
    backgroundColor: v1Colors.s1,
  },
  bannerStripText: {
    textAlign: 'center',
  },
  pinnedBarOuter: {
    paddingHorizontal: v1Space.lg,
    paddingTop: v1Space.sm,
    paddingBottom: v1Space.xs,
  },
  pinnedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: v1Space.sm,
    borderRadius: v1Radius.chip,
    backgroundColor: v1Colors.s1,
    borderWidth: borders.width,
    borderColor: v1Colors.hairline,
    paddingHorizontal: v1Space.md,
    paddingVertical: v1Space.sm + 2,
  },
  pressedRow: {
    backgroundColor: v1Colors.s2,
  },
  pinnedText: {
    flex: 1,
  },
  boldText: {
    fontFamily: fonts.bold,
  },
  todayDividerWrap: {
    alignItems: 'center',
    paddingVertical: v1Space.md,
  },
  centeredLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  centerText: {
    textAlign: 'center',
  },
  listContent: {
    paddingVertical: v1Space.sm,
  },
  emptyWrap: {
    padding: v1Space.lg,
    alignItems: 'center',
  },
  loadingMoreWrap: {
    paddingVertical: v1Space.sm,
    alignItems: 'center',
    transform: [{ scaleY: -1 }],
  },
  dividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: v1Space.md,
    paddingHorizontal: v1Space.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: v1Colors.hairline,
  },
  dividerBadge: {
    paddingHorizontal: v1Space.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: v1Colors.s2,
    marginHorizontal: v1Space.sm,
  },
  dividerBadgeText: {
    letterSpacing: 0.5,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: v1Space.sm,
    paddingHorizontal: v1Space.lg,
    paddingVertical: v1Space.xs + 2,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  typingDot: {
    width: 4,
    height: 4,
    borderRadius: v1Radius.full,
    backgroundColor: v1Colors.textLo,
  },
  typingDotDim: {
    opacity: 0.5,
  },
  goalSheetWrap: {
    gap: v1Space.md,
  },
  goalSheetTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalInput: {
    height: 46,
    borderRadius: v1Radius.chip,
    backgroundColor: v1Colors.s1,
    borderWidth: borders.width,
    borderColor: v1Colors.hairline,
    paddingHorizontal: v1Space.lg,
    color: v1Colors.textHi,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
  },
});
