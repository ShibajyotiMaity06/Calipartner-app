import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ChatAttachment, ChatMessage } from '@/types/chat';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface ChatMessageBubbleProps {
  message: ChatMessage;
  isMine: boolean;
  onRetry?: (message: ChatMessage) => void;
  onPressImage?: (attachment: ChatAttachment) => void;
  onLongPress?: (message: ChatMessage) => void;
  testID?: string;
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function ChatMessageBubble({
  message,
  isMine,
  onRetry,
  onPressImage,
  onLongPress,
  testID,
}: ChatMessageBubbleProps) {
  const { colors } = useTheme();

  // 1. System Message Render
  if (message.message_type === 'system') {
    let iconName: keyof typeof Ionicons.glyphMap = 'information-circle-outline';
    if (message.system_event_type === 'member_joined') iconName = 'person-add-outline';
    if (message.system_event_type === 'member_left') iconName = 'person-remove-outline';
    if (message.system_event_type === 'room_created') iconName = 'information-circle-outline';
    if (message.system_event_type === 'streak_milestone') iconName = 'flame-outline';

    return (
      <View
        style={styles.systemContainer}
        testID={testID ?? `chat-system-message-${message.id}`}
        accessibilityLabel={`System notification: ${message.text || ''}`}
      >
        <View style={[styles.systemPill, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name={iconName} size={14} color={colors.accent} style={styles.systemIcon} />
          <Text style={[styles.systemText, { color: colors.textMuted }]}>{message.text}</Text>
        </View>
      </View>
    );
  }

  // 2. Regular User Message Render
  const isDeleted = Boolean(message.deleted_at);
  const timeFormatted = formatTime(message.created_at);
  const isFailed = message.delivery_status === 'failed';
  const isSending = message.delivery_status === 'sending';
  const isSent = message.delivery_status === 'sent';

  const senderInitial = (message.sender_nickname || message.sender_username || '?')
    .charAt(0)
    .toUpperCase();

  return (
    <View
      style={[styles.rowContainer, isMine ? styles.rowMine : styles.rowOther]}
      testID={testID ?? `chat-message-${message.id}`}
    >
      {/* Sender Avatar for incoming messages */}
      {!isMine && (
        <View style={[styles.avatarCircle, { backgroundColor: colors.cardHighlight }]}>
          {message.sender_avatar_url ? (
            <Image
              source={{ uri: message.sender_avatar_url }}
              style={styles.avatarImage}
              accessibilityLabel={`${message.sender_nickname || 'Member'} avatar`}
            />
          ) : (
            <Text style={[styles.avatarInitial, { color: colors.accent }]}>{senderInitial}</Text>
          )}
        </View>
      )}

      {/* Bubble Container */}
      <View
        style={[
          styles.bubbleWrapper,
          isMine ? styles.bubbleWrapperMine : styles.bubbleWrapperOther,
        ]}
      >
        {/* Sender name for incoming messages */}
        {!isMine && (
          <Text style={[styles.senderNickname, { color: colors.textMuted }]} numberOfLines={1}>
            {message.sender_nickname || message.sender_username || 'Partner'}
          </Text>
        )}

        {/* Interactive Bubble */}
        <Pressable
          onLongPress={() => onLongPress?.(message)}
          delayLongPress={350}
          style={[
            styles.bubbleBox,
            isMine
              ? [styles.bubbleBoxMine, { backgroundColor: colors.accent }]
              : [styles.bubbleBoxOther, { backgroundColor: colors.surfaceAlt }],
            isFailed && { borderColor: colors.danger, borderWidth: 1 },
          ]}
          accessibilityRole="text"
          accessibilityLabel={`${isMine ? 'You said' : `${message.sender_nickname || 'Partner'} said`}: ${
            isDeleted ? t('chat.deletedMessage') : message.text || ''
          }. Sent at ${timeFormatted}`}
          testID={`bubble-content-${message.id}`}
        >
          {/* Message Text */}
          {isDeleted ? (
            <Text
              style={[styles.deletedText, { color: isMine ? colors.onAccent : colors.textMuted }]}
            >
              {t('chat.deletedMessage')}
            </Text>
          ) : (
            Boolean(message.text) && (
              <Text style={[styles.messageText, { color: isMine ? colors.onAccent : colors.text }]}>
                {message.text}
              </Text>
            )
          )}

          {/* Attachments Grid (if not deleted) */}
          {!isDeleted && message.attachments && message.attachments.length > 0 && (
            <View style={styles.attachmentsContainer}>
              {message.attachments.map((att, idx) => {
                const isBlocked = att.moderation_status === 'blocked';
                const imageUri = att.signed_url || att.local_uri;

                if (isBlocked) {
                  return (
                    <View
                      key={att.id || idx}
                      style={[styles.blockedImageContainer, { backgroundColor: colors.background }]}
                    >
                      <Ionicons name="shield-outline" size={16} color={colors.danger} />
                      <Text style={[styles.blockedImageText, { color: colors.danger }]}>
                        {t('chat.blockedImage')}
                      </Text>
                    </View>
                  );
                }

                return (
                  <Pressable
                    key={att.id || idx}
                    onPress={() => onPressImage?.(att)}
                    style={styles.attachmentPressable}
                    accessibilityRole="image"
                    accessibilityLabel="Chat photo attachment. Tap to view full screen."
                    testID={`att-image-${att.id || idx}`}
                  >
                    {att.mime_type.startsWith('video/') ? (
                      <Ionicons
                        name="play-circle-outline"
                        size={32}
                        color={colors.text}
                        accessibilityLabel={t('setup.playVideo')}
                      />
                    ) : imageUri ? (
                      <Image
                        source={{ uri: imageUri }}
                        style={styles.attachmentThumbnail}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.attachmentThumbnail, styles.attachmentFallback]}>
                        <ActivityIndicator size="small" color={colors.accent} />
                      </View>
                    )}

                    {att.upload_status === 'uploading' && (
                      <View style={styles.uploadOverlay}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Footer inside bubble: timestamp & delivery status */}
          <View style={styles.footerRow}>
            <Text
              style={[
                styles.timeText,
                { color: isMine ? 'rgba(255,255,255,0.75)' : colors.textMuted },
              ]}
            >
              {timeFormatted}
            </Text>

            {isMine && (
              <View style={styles.statusIconWrap}>
                {isSending && (
                  <ActivityIndicator size={10} color="#FFFFFF" style={styles.sendingSpinner} />
                )}
                {isSent && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                {isFailed && <Ionicons name="alert-circle" size={14} color="#FCA5A5" />}
              </View>
            )}
          </View>
        </Pressable>

        {/* Failed state: Retry button */}
        {isMine && isFailed && (
          <Pressable
            onPress={() => onRetry?.(message)}
            style={[styles.retryRow]}
            accessibilityRole="button"
            accessibilityLabel="Retry sending failed message"
            testID={`btn-retry-message-${message.id}`}
          >
            <Ionicons name="refresh-outline" size={14} color={colors.danger} />
            <Text style={[styles.retryText, { color: colors.danger }]}>{t('chat.retryBtn')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // System Message Styles
  systemContainer: {
    alignItems: 'center',
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  systemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  systemIcon: {
    marginRight: 6,
  },
  systemText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    textAlign: 'center',
  },

  // User Message Row Styles
  rowContainer: {
    flexDirection: 'row',
    marginVertical: 3,
    paddingHorizontal: spacing.sm,
    alignItems: 'flex-end',
  },
  rowMine: {
    justifyContent: 'flex-end',
  },
  rowOther: {
    justifyContent: 'flex-start',
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    marginBottom: 2,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 32,
    height: 32,
  },
  avatarInitial: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },

  // Bubble Wrapper
  bubbleWrapper: {
    maxWidth: '78%',
  },
  bubbleWrapperMine: {
    alignItems: 'flex-end',
  },
  bubbleWrapperOther: {
    alignItems: 'flex-start',
  },
  senderNickname: {
    fontSize: fontSize.xs - 1,
    fontWeight: '600',
    marginBottom: 2,
    marginLeft: 4,
  },

  // Bubble Box
  bubbleBox: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.lg,
  },
  bubbleBoxMine: {
    borderBottomRightRadius: 4,
  },
  bubbleBoxOther: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  deletedText: {
    fontSize: fontSize.xs,
    fontStyle: 'italic',
  },

  // Attachments
  attachmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: spacing.xs,
  },
  attachmentPressable: {
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  attachmentThumbnail: {
    width: 140,
    height: 140,
    borderRadius: radius.md,
  },
  attachmentFallback: {
    backgroundColor: '#00000010',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedImageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs,
    borderRadius: radius.sm,
    gap: 4,
  },
  blockedImageText: {
    fontSize: fontSize.xs - 1,
    fontWeight: '600',
  },

  // Bubble Footer
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 3,
    gap: 4,
  },
  timeText: {
    fontSize: 10,
    fontWeight: '400',
  },
  statusIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendingSpinner: {
    marginRight: 2,
  },

  // Retry Button Row
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
    paddingVertical: 2,
  },
  retryText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
