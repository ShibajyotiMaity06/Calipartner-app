import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@calipartner/ui';
import { Ionicons } from '@expo/vector-icons';
import type { ChatAttachment, ChatMessage } from '@/types/chat';
import { useRoomChat, type UseRoomChatOptions } from '@/hooks/useRoomChat';
import { useSubscription } from '@/hooks/useSubscription';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { generateClientUuid } from '@/services/foodService';
import {
  requestUploadPresignedUrl,
  uploadImageToR2,
  getSignedImageUrl,
} from '@/services/chatImageService';
import { getSupabase } from '@/lib/supabase';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { useChatTyping } from '@/hooks/useChatTyping';
import { ChatComposer } from './ChatComposer';
import { ChatEmptyState } from './ChatEmptyState';
import { ChatImageViewerModal } from './ChatImageViewerModal';
import { type SelectedMediaItem } from './ChatMediaPickerModal';
import { ChatMessageBubble } from './ChatMessageBubble';
import { ChatMessageMenuModal } from './ChatMessageMenuModal';
import { ChatReportModal } from './ChatReportModal';
import { ChatTermsModal } from './ChatTermsModal';

export interface ChatViewProps {
  roomId: string | null;
  isVisible?: boolean;
  options?: UseRoomChatOptions;
  isLocked?: boolean;
  testID?: string;
}

export function ChatView({
  roomId,
  isVisible = true,
  options = {},
  isLocked: isLockedProp,
  testID = 'room-chat-view',
}: ChatViewProps) {
  const { colors } = useTheme();
  const { isOnline } = useNetworkStatus();
  const { hasActiveAccess, currentTier } = useSubscription();

  // Core Chat Hook
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
    isVisible && hasActiveAccess && termsAccepted,
  );
  const effectiveIsLocked = Boolean(isLockedProp || isLockedFromHook);

  const [mediaReadError, setMediaReadError] = useState(false);
  // Active interaction modals state
  const [activeImageAttachment, setActiveImageAttachment] = useState<ChatAttachment | null>(null);
  const [activeMenuMessage, setActiveMenuMessage] = useState<ChatMessage | null>(null);
  const [reportTargetMessageId, setReportTargetMessageId] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const pending = useRef<{ signature: string; id: string } | null>(null);
  const handleSend = async (text?: string | null, selectedMedia?: SelectedMediaItem[]) => {
    if (!roomId) return;
    const signature = JSON.stringify([roomId, text, selectedMedia?.map((m) => m.uri)]);
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
    await sendMessage(text, attachments.length ? attachments : undefined, clientId);
    for (const attachment of attachments) {
      const result = await getSupabase().functions.invoke('chat-image-moderation', {
        body: { action: 'finalize', storage_key: attachment.storage_key },
      });
      if (result.error || result.data?.status !== 'ok') setMediaReadError(true);
    }
    await refresh();
    pending.current = null;
  };

  // Handle retry
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
      await sendMessage(failedMessage.text, retryAttachments, failedMessage.client_id);
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={[styles.container, { backgroundColor: colors.background }]}
      testID={testID}
    >
      {mediaReadError ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger, padding: spacing.sm }}>
          {t('chatAudit.actionError')}
        </Text>
      ) : null}
      {/* 1. Offline Banner */}
      {isOnline === false && (
        <View
          style={[styles.bannerStrip, { backgroundColor: colors.syncPending }]}
          testID="banner-chat-offline"
          accessibilityLabel="Offline banner"
        >
          <Ionicons name="cloud-offline-outline" size={16} color="#FFFFFF" />
          <Text style={styles.bannerStripText}>{t('chat.offlineBanner')}</Text>
        </View>
      )}

      {/* 2. Locked Room Notice ("This room is paused") */}
      {effectiveIsLocked && (
        <View
          style={[styles.bannerStrip, { backgroundColor: colors.danger }]}
          testID="banner-chat-locked"
          accessibilityLabel="Room paused banner"
        >
          <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
          <Text style={styles.bannerStripText}>
            {t('chat.pausedTitle')} — {t('chat.pausedSubtitle')}
          </Text>
        </View>
      )}

      {/* 3. Dormant Room Notice */}
      {isDormant && !effectiveIsLocked && (
        <View
          style={[styles.bannerStrip, { backgroundColor: colors.cardHighlight }]}
          testID="banner-chat-dormant"
          accessibilityLabel="Dormant room notice"
        >
          <Ionicons name="information-circle-outline" size={16} color={colors.accent} />
          <Text style={[styles.bannerStripText, { color: colors.text }]}>
            {t('chat.dormantBanner')}
          </Text>
        </View>
      )}

      {/* 4. Messages Area */}
      {loading && messages.length === 0 ? (
        <View style={styles.centeredLoading}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingLabel, { color: colors.textMuted }]}>
            {t('common.loading')}
          </Text>
        </View>
      ) : error && messages.length === 0 ? (
        <View style={styles.centeredLoading} testID="chat-error-state">
          <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
          <Text style={[styles.loadingLabel, { color: colors.text, textAlign: 'center' }]}>
            {error.message || t('common.errorTitle')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={[...messages].reverse()}
          keyExtractor={(item) => item.client_id || item.id}
          inverted
          onEndReached={() => {
            if (hasMore && !loadingMore) {
              loadMore();
            }
          }}
          onEndReachedThreshold={0.2}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => {
            const isMine = isCurrentUserId(item.sender_id);

            // Determine if "New Messages" divider belongs above this message
            // In inverted list, index 0 is newest. If unreadCount is 3, items at index 0,1,2 are unread.
            // Divider goes between index 2 and 3.
            const showNewMessagesDivider =
              unreadCount > 0 && index === unreadCount - 1 && index < messages.length - 1;

            return (
              <View>
                <ChatMessageBubble
                  message={item}
                  isMine={isMine}
                  onRetry={handleRetry}
                  onPressImage={(att) => {
                    if (att.signed_url) {
                      setActiveImageAttachment(att);
                      return;
                    }
                    if (roomId)
                      void getSignedImageUrl(getSupabase(), roomId, att.storage_key)
                        .then((signed_url) => setActiveImageAttachment({ ...att, signed_url }))
                        .catch(() => setMediaReadError(true));
                  }}
                  onLongPress={(msg) => setActiveMenuMessage(msg)}
                  testID={`bubble-${item.id}`}
                />

                {showNewMessagesDivider && (
                  <View style={styles.dividerWrap} testID="divider-new-messages">
                    <View style={[styles.dividerLine, { backgroundColor: colors.accent }]} />
                    <View style={[styles.dividerBadge, { backgroundColor: colors.cardHighlight }]}>
                      <Text style={[styles.dividerBadgeText, { color: colors.accent }]}>
                        {t('chat.newMessagesDivider')}
                      </Text>
                    </View>
                    <View style={[styles.dividerLine, { backgroundColor: colors.accent }]} />
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <ChatEmptyState
              disabled={effectiveIsLocked || isDormant || !hasActiveAccess}
              onSelectStarter={(prompt) => handleSend(prompt)}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadingMoreWrap}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : null
          }
          testID="list-chat-messages"
        />
      )}

      {typingPeople.length ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.textMuted, padding: spacing.sm }}
          testID="chat-typing-indicator"
        >
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
        </Text>
      ) : null}
      {/* 5. Message Composer */}
      <ChatComposer
        onSend={handleSend}
        onTyping={notifyTyping}
        disabled={effectiveIsLocked || isDormant || !hasActiveAccess}
        disabledReason={
          !hasActiveAccess
            ? t('setup.chatPlus')
            : effectiveIsLocked
              ? t('chat.pausedTitle')
              : isDormant
                ? t('chat.dormantBanner')
                : undefined
        }
        allowMedia={hasActiveAccess && currentTier === 'pro'}
        termsAccepted={termsAccepted}
        onRequireTerms={() => setShowTermsModal(true)}
      />

      {/* 6. Modals */}

      {/* Full-screen Image Viewer */}
      <ChatImageViewerModal
        visible={Boolean(activeImageAttachment)}
        attachment={activeImageAttachment}
        onClose={() => setActiveImageAttachment(null)}
      />

      {/* Long-press Action Sheet Menu */}
      <ChatMessageMenuModal
        visible={Boolean(activeMenuMessage)}
        message={activeMenuMessage}
        isMine={isCurrentUserId(activeMenuMessage?.sender_id)}
        onClose={() => setActiveMenuMessage(null)}
        onDeleteMessage={deleteMessage}
        onReportMessage={(msgId) => {
          setActiveMenuMessage(null);
          setReportTargetMessageId(msgId);
        }}
        onMuteMember={muteMember}
        onBlockMember={blockMember}
      />

      {/* Report Modal */}
      <ChatReportModal
        visible={Boolean(reportTargetMessageId)}
        messageId={reportTargetMessageId}
        onClose={() => setReportTargetMessageId(null)}
        onSubmitReport={reportMessage}
      />

      {/* Terms Acceptance Sheet */}
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
  },
  bannerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    gap: 6,
  },
  bannerStripText: {
    color: '#FFFFFF',
    fontSize: fontSize.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  centeredLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  loadingLabel: {
    fontSize: fontSize.xs,
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  loadingMoreWrap: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    transform: [{ scaleY: -1 }],
  },
  // New messages divider
  dividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    opacity: 0.35,
  },
  dividerBadge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginHorizontal: spacing.sm,
  },
  dividerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
