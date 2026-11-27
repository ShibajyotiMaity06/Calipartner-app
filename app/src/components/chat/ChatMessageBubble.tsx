import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, onboardingLayout as layout, space } from '@calipartner/ui';
import { useTheme as useAppearance } from '@calipartner/ui/theme';
import {
  DumbbellIcon,
  HeartIcon,
  Text as V1Text,
  borders,
  colors as v1Colors,
  fonts,
  radius as v1Radius,
  space as v1Space,
} from '@calipartner/ui/v1';
import { visualPrimitives } from '@calipartner/ui/tokens';
import type { ChatAttachment, ChatMessage } from '@/types/chat';
import { t } from '@/i18n';
import type { ChatReactionState } from '@/services/squadService';
import { useTheme } from '@/theme/useTheme';
import { ChatAttachmentPreview } from './ChatAttachmentPreview';
import { MentionText } from './MentionText';

export interface ChatMessageBubbleProps {
  message: ChatMessage;
  isMine: boolean;
  isSeenByAll?: boolean;
  reaction?: ChatReactionState;
  onToggleReaction?: (messageId: string) => void;
  onRetry?: (message: ChatMessage) => void;
  onPressImage?: (attachment: ChatAttachment) => void;
  onLongPress?: (message: ChatMessage) => void;
  onReply?: (message: ChatMessage) => void;
  testID?: string;
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

interface ParsedActivityCard {
  title: string;
  subtitle?: string;
}

function parseWorkoutShareCard(message: ChatMessage): ParsedActivityCard | null {
  if (message.message_type !== 'system' || !message.text) return null;
  if (message.system_event_type === 'streak_milestone' || /finished/i.test(message.text)) {
    const parts = message.text.split(' · ');
    return {
      title: parts[0] ?? message.text,
      subtitle: parts.slice(1).join(' · ') || undefined,
    };
  }
  return null;
}

export function ChatMessageBubble({
  message,
  isMine,
  isSeenByAll,
  reaction,
  onToggleReaction,
  onRetry,
  onPressImage,
  onLongPress,
  onReply,
  testID,
}: ChatMessageBubbleProps) {
  const { colors: dark } = useAppearance();
  const { colors } = useTheme();
  const drag = useRef(new Animated.Value(0)).current;
  const replyHandler = useRef(onReply);
  const currentMessage = useRef(message);
  replyHandler.current = onReply;
  currentMessage.current = message;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Boolean(replyHandler.current) &&
        !currentMessage.current.deleted_at &&
        currentMessage.current.message_type === 'user' &&
        gesture.dx > layout.touch / 3 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
      onPanResponderMove: (_, gesture) =>
        drag.setValue(Math.max(0, Math.min(layout.touch * 2, gesture.dx))),
      onPanResponderRelease: (_, gesture) => {
        drag.setValue(0);
        if (gesture.dx >= layout.touch && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2)
          replyHandler.current?.(currentMessage.current);
      },
      onPanResponderTerminate: () => drag.setValue(0),
    }),
  ).current;

  if (message.message_type === 'system') {
    const workoutCard = parseWorkoutShareCard(message);
    if (workoutCard) {
      const count = reaction?.count ?? 0;
      const liked = Boolean(reaction?.viewer_liked);
      return (
        <View
          style={styles.activityCardOuter}
          testID={testID ?? `chat-system-message-${message.id}`}
        >
          <View style={styles.activityCard}>
            <View style={styles.activityIconTile}>
              <DumbbellIcon size={16} color={v1Colors.textMid} />
            </View>
            <View style={styles.activityCardBody}>
              <V1Text variant="label" color="textHi" style={styles.boldText}>
                {workoutCard.title}
              </V1Text>
              {workoutCard.subtitle ? (
                <V1Text variant="meta" color="textLo">
                  {workoutCard.subtitle}
                </V1Text>
              ) : null}
            </View>
            {onToggleReaction ? (
              <Pressable
                onPress={() => onToggleReaction(message.id)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`React to workout, ${count} likes`}
                style={[styles.reactionPill, liked ? styles.reactionPillActive : null]}
                testID={`chat-reaction-${message.id}`}
              >
                <HeartIcon
                  size={13}
                  color={liked ? v1Colors.apricot : v1Colors.textMid}
                  filled={liked}
                />
                <V1Text variant="meta" color={liked ? 'apricot' : 'textHi'} tabular>
                  {count}
                </V1Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      );
    }

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
        <View style={styles.systemPill}>
          <Ionicons name={iconName} size={13} color={v1Colors.apricot} style={styles.systemIcon} />
          <V1Text variant="meta" color="textLo" style={styles.systemText}>
            {message.text}
          </V1Text>
        </View>
      </View>
    );
  }

  const isDeleted = Boolean(message.deleted_at);
  const timeFormatted = formatTime(message.created_at);
  const isFailed = message.delivery_status === 'failed';
  const isSending = message.delivery_status === 'sending';
  const isSent = message.delivery_status === 'sent';

  const senderName = message.sender_nickname || message.sender_username || 'Partner';
  const senderInitial = senderName.charAt(0).toUpperCase();

  return (
    <Animated.View
      {...pan.panHandlers}
      style={[styles.rowContainer, isMine ? styles.rowMine : styles.rowOther]}
      testID={testID ?? `chat-message-${message.id}`}
    >
      {!isMine ? (
        <View style={styles.avatarCircle}>
          {message.sender_avatar_url ? (
            <Image
              source={{ uri: message.sender_avatar_url }}
              style={styles.avatarImage}
              accessibilityLabel={`${senderName} avatar`}
            />
          ) : (
            <V1Text variant="meta" color="textHi" style={styles.boldText}>
              {senderInitial}
            </V1Text>
          )}
        </View>
      ) : null}

      <Animated.View
        style={[
          styles.bubbleWrapper,
          isMine ? styles.bubbleWrapperMine : styles.bubbleWrapperOther,
          { transform: [{ translateX: drag }] },
        ]}
      >
        {!isMine ? (
          <V1Text variant="meta" color="textLo" style={styles.senderMetaLine}>
            {`${senderName}${timeFormatted ? ` · ${timeFormatted}` : ''}`}
          </V1Text>
        ) : null}

        <Pressable
          onLongPress={() => onLongPress?.(message)}
          delayLongPress={350}
          style={[
            styles.bubbleBox,
            isMine ? styles.bubbleBoxMine : styles.bubbleBoxOther,
            isFailed ? styles.bubbleFailed : null,
          ]}
          accessibilityRole="text"
          accessibilityLabel={`${isMine ? 'You said' : `${senderName} said`}: ${
            isDeleted ? t('chat.deletedMessage') : message.text || ''
          }. Sent at ${timeFormatted}`}
          testID={`bubble-content-${message.id}`}
          accessibilityActions={
            !isDeleted && onReply
              ? [
                  { name: 'reply', label: t('aha.reply') },
                  { name: 'activate', label: t('chat.longPressTitle') },
                ]
              : undefined
          }
          onAccessibilityAction={(event) =>
            event.nativeEvent.actionName === 'reply' ? onReply?.(message) : onLongPress?.(message)
          }
        >
          {!isDeleted && message.reply_to_id ? (
            <View
              style={[
                styles.replyQuoteBox,
                { borderLeftColor: isMine ? v1Colors.onBrand : v1Colors.apricot },
              ]}
              testID={`reply-quote-${message.id}`}
            >
              <V1Text variant="meta" color={isMine ? 'onBrand' : 'textLo'}>
                {message.reply ? message.reply.name : t('aha.replyUnavailable')}
              </V1Text>
              {message.reply ? (
                <V1Text variant="meta" color={isMine ? 'onBrand' : 'textHi'}>
                  {message.reply.text || t('aha.attachment')}
                </V1Text>
              ) : null}
            </View>
          ) : null}

          {isDeleted ? (
            <V1Text variant="meta" color={isMine ? 'onBrand' : 'textLo'} style={styles.deletedText}>
              {t('chat.deletedMessage')}
            </V1Text>
          ) : (
            Boolean(message.text) && (
              <V1Text
                variant="body"
                color={isMine ? 'onBrand' : 'textHi'}
                style={styles.messageText}
              >
                <MentionText text={message.text!} />
              </V1Text>
            )
          )}

          {!isDeleted && message.attachments && message.attachments.length > 0 ? (
            <View style={styles.attachmentsContainer}>
              {message.attachments.map((att, idx) => {
                const isBlocked = att.moderation_status === 'blocked';
                if (att.moderation_status === 'pending') {
                  return (
                    <View key={att.id || idx} style={styles.blockedImageContainer}>
                      <Ionicons
                        name="time-outline"
                        size={16}
                        color={isMine ? v1Colors.onBrand : v1Colors.textLo}
                      />
                      <V1Text variant="meta" color={isMine ? 'onBrand' : 'textLo'}>
                        {t('chatAudit.checking')}
                      </V1Text>
                      {isMine ? (
                        <Button
                          variant="secondary"
                          fullWidth={false}
                          label={t('chatAudit.retryCheck')}
                          accessibilityRole="button"
                          accessibilityLabel={t('chatAudit.retryCheck')}
                          onPress={() => onRetry?.(message)}
                          style={styles.mediaRetry}
                          testID={`retry-media-${att.id}`}
                        />
                      ) : null}
                    </View>
                  );
                }

                if (isBlocked) {
                  return (
                    <View key={att.id || idx} style={styles.blockedImageContainer}>
                      <Ionicons name="shield-outline" size={16} color={v1Colors.danger} />
                      <V1Text variant="meta" color="danger">
                        {t('chat.blockedImage')}
                      </V1Text>
                    </View>
                  );
                }

                return (
                  <ChatAttachmentPreview
                    key={att.id || idx}
                    roomId={message.room_id}
                    attachment={att}
                    onOpen={onPressImage}
                  />
                );
              })}
            </View>
          ) : null}
        </Pressable>

        {isMine ? (
          <View style={styles.footerRow}>
            <V1Text variant="micro" color="textLo" tabular>
              {timeFormatted}
            </V1Text>

            <View style={styles.statusIconWrap}>
              {isSending ? (
                <ActivityIndicator
                  size={10}
                  color={v1Colors.textLo}
                  style={styles.sendingSpinner}
                />
              ) : null}
              {isSent ? (
                isSeenByAll ? (
                  <Ionicons
                    name="checkmark-done"
                    size={13}
                    color={v1Colors.apricot || dark.sky}
                    testID={`tick-seen-${message.id}`}
                    accessibilityLabel="Seen by everyone"
                  />
                ) : (
                  <Ionicons
                    name="checkmark"
                    size={12}
                    color={v1Colors.textLo}
                    testID={`tick-sent-${message.id}`}
                    accessibilityLabel="Sent"
                  />
                )
              ) : null}
              {isFailed ? <Ionicons name="alert-circle" size={13} color={v1Colors.danger} /> : null}
            </View>
          </View>
        ) : null}

        {isMine && isFailed ? (
          <Button
            variant="destructive"
            fullWidth={false}
            label={t('chat.retryBtn')}
            icon={<Ionicons name="refresh-outline" size={14} color={colors.danger} />}
            onPress={() => onRetry?.(message)}
            style={styles.retryRow}
            accessibilityRole="button"
            accessibilityLabel="Retry sending failed message"
            testID={`btn-retry-message-${message.id}`}
          />
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  systemContainer: {
    alignItems: 'center',
    marginVertical: v1Space.xs,
    paddingHorizontal: v1Space.lg,
  },
  systemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: v1Space.md,
    paddingVertical: v1Space.xs,
    borderRadius: v1Radius.full,
    backgroundColor: v1Colors.s1,
    borderWidth: borders.width,
    borderColor: v1Colors.hairline,
  },
  systemIcon: {
    marginRight: 6,
  },
  systemText: {
    textAlign: 'center',
  },
  activityCardOuter: {
    paddingHorizontal: v1Space.lg,
    marginVertical: v1Space.xs,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: v1Space.md,
    borderRadius: v1Radius.card,
    backgroundColor: v1Colors.s1,
    borderWidth: borders.width,
    borderColor: v1Colors.hairline,
    paddingVertical: v1Space.md,
    paddingHorizontal: v1Space.optical14,
  },
  activityIconTile: {
    width: 34,
    height: 34,
    borderRadius: v1Radius.chip,
    backgroundColor: v1Colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCardBody: {
    flex: 1,
    gap: 2,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: v1Radius.full,
    backgroundColor: v1Colors.s2,
    borderWidth: borders.width,
    borderColor: v1Colors.hairline,
    paddingHorizontal: v1Space.sm + 2,
    paddingVertical: v1Space.xs + 1,
  },
  reactionPillActive: {
    borderColor: v1Colors.apricot,
  },
  rowContainer: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: v1Space.lg,
    alignItems: 'flex-end',
  },
  rowMine: {
    justifyContent: 'flex-end',
  },
  rowOther: {
    justifyContent: 'flex-start',
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: v1Radius.full,
    backgroundColor: v1Colors.s2,
    borderWidth: borders.width,
    borderColor: v1Colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: v1Space.sm,
    marginBottom: 2,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 28,
    height: 28,
  },
  boldText: {
    fontFamily: fonts.bold,
  },
  bubbleWrapper: {
    maxWidth: '78%',
  },
  bubbleWrapperMine: {
    alignItems: 'flex-end',
  },
  bubbleWrapperOther: {
    alignItems: 'flex-start',
  },
  senderMetaLine: {
    marginBottom: 4,
    marginLeft: 2,
  },
  bubbleBox: {
    minHeight: 40,
    minWidth: layout.touch,
    paddingHorizontal: v1Space.optical14,
    paddingVertical: v1Space.sm + 2,
    borderRadius: v1Radius.chip,
  },
  bubbleBoxMine: {
    backgroundColor: v1Colors.apricot,
    borderBottomRightRadius: v1Radius.bar,
  },
  bubbleBoxOther: {
    backgroundColor: v1Colors.s2,
    borderBottomLeftRadius: v1Radius.bar,
  },
  bubbleFailed: {
    borderWidth: 1,
    borderColor: v1Colors.danger,
  },
  replyQuoteBox: {
    borderLeftWidth: space[1],
    paddingLeft: v1Space.sm,
    paddingVertical: 2,
    marginBottom: v1Space.xs,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  deletedText: {
    fontStyle: 'italic',
  },
  attachmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: v1Space.xs,
  },
  blockedImageContainer: {
    flexWrap: 'wrap',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: v1Space.xs,
    borderRadius: v1Radius.chip,
    gap: 4,
    backgroundColor: v1Colors.s1,
  },
  mediaRetry: {
    minHeight: layout.touch,
    minWidth: layout.touch,
    justifyContent: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  statusIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendingSpinner: {
    marginRight: 2,
  },
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
    paddingVertical: 2,
  },
});

void visualPrimitives;
