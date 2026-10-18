import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { CoachSuggestionCard } from './CoachSuggestionCard';
import type { CoachMessage, CoachSuggestion } from './types';

export interface CoachMessageBubbleProps {
  message: CoachMessage;
  onThumbsUp?: (messageId: string) => void;
  onThumbsDown?: (messageId: string) => void;
  onReport?: (messageId: string) => void;
  onLogSuggestion?: (suggestion: CoachSuggestion) => void;
}

export function CoachMessageBubble({
  message,
  onThumbsUp,
  onThumbsDown,
  onReport,
  onLogSuggestion,
}: CoachMessageBubbleProps) {
  const { colors } = useTheme();
  const isUser = message.role === 'user';

  return (
    <View
      style={[styles.rowWrap, isUser ? styles.userRowWrap : styles.coachRowWrap]}
      testID={`msg-bubble-${message.id}`}
    >
      {/* Coach Avatar */}
      {!isUser && (
        <View
          style={[styles.avatar, { backgroundColor: colors.cardHighlight }]}
          testID={`avatar-coach-${message.id}`}
        >
          <Ionicons name="sparkles" size={16} color={colors.accent} />
        </View>
      )}

      <View style={[styles.bubbleContentWrap, isUser && styles.userContentWrap]}>
        {/* Message Card */}
        <View
          style={[
            styles.bubble,
            isUser
              ? [styles.userBubble, { backgroundColor: colors.accent }]
              : [
                  styles.coachBubble,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ],
          ]}
        >
          <Text
            style={[styles.messageText, { color: isUser ? '#FFFFFF' : colors.text }]}
            testID={`text-msg-content-${message.id}`}
          >
            {message.content}
          </Text>

          {/* Streaming typing indicator */}
          {message.isStreaming && (
            <View style={styles.streamingIndicator} testID={`indicator-streaming-${message.id}`}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.streamingText, { color: colors.textMuted }]}>typing…</Text>
            </View>
          )}
        </View>

        {/* Suggestion Cards */}
        {!isUser && message.suggestions && message.suggestions.length > 0 && onLogSuggestion && (
          <View style={styles.suggestionsContainer}>
            {message.suggestions.map((sug) => (
              <CoachSuggestionCard key={sug.id} suggestion={sug} onLog={onLogSuggestion} />
            ))}
          </View>
        )}

        {/* Footer for Coach Answers: Thumbs up/down, Report & Medical Disclaimer */}
        {!isUser && !message.isStreaming && (
          <View style={styles.coachFooter}>
            {/* Disclaimer Label */}
            <View style={styles.disclaimerRow}>
              <Ionicons name="alert-circle-outline" size={12} color={colors.textMuted} />
              <Text
                style={[styles.disclaimerText, { color: colors.textMuted }]}
                testID="text-coach-disclaimer"
              >
                {t('coach.disclaimer')}
              </Text>
            </View>

            {/* Thumbs up / down and Report actions */}
            <View style={styles.feedbackRow}>
              <Pressable
                onPress={() => onThumbsUp?.(message.id)}
                style={[
                  styles.actionBtn,
                  message.feedback === 'up' && {
                    backgroundColor: colors.cardHighlight,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('coach.feedback.helpful')}
                testID={`btn-coach-thumbs-up-${message.id}`}
              >
                <Ionicons
                  name={message.feedback === 'up' ? 'thumbs-up' : 'thumbs-up-outline'}
                  size={15}
                  color={message.feedback === 'up' ? colors.accent : colors.textMuted}
                />
              </Pressable>

              <Pressable
                onPress={() => onThumbsDown?.(message.id)}
                style={[
                  styles.actionBtn,
                  message.feedback === 'down' && {
                    backgroundColor: colors.cardHighlight,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('coach.feedback.unhelpful')}
                testID={`btn-coach-thumbs-down-${message.id}`}
              >
                <Ionicons
                  name={message.feedback === 'down' ? 'thumbs-down' : 'thumbs-down-outline'}
                  size={15}
                  color={message.feedback === 'down' ? colors.danger : colors.textMuted}
                />
              </Pressable>

              <Pressable
                onPress={() => onReport?.(message.id)}
                style={styles.actionBtn}
                accessibilityRole="button"
                accessibilityLabel={t('coach.feedback.report')}
                testID={`btn-coach-report-${message.id}`}
              >
                <Ionicons name="flag-outline" size={14} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rowWrap: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  userRowWrap: {
    justifyContent: 'flex-end',
  },
  coachRowWrap: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bubbleContentWrap: {
    maxWidth: '82%',
  },
  userContentWrap: {
    alignItems: 'flex-end',
  },
  bubble: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  userBubble: {
    borderBottomRightRadius: 2,
  },
  coachBubble: {
    borderWidth: 1,
    borderBottomLeftRadius: 2,
  },
  messageText: {
    fontSize: fontSize.sm + 1,
    lineHeight: 21,
  },
  streamingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  streamingText: {
    fontSize: fontSize.xs,
    fontStyle: 'italic',
  },
  suggestionsContainer: {
    marginTop: 4,
    width: '100%',
  },
  coachFooter: {
    marginTop: 6,
    gap: 4,
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  disclaimerText: {
    fontSize: fontSize.xs - 1,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  actionBtn: {
    padding: 6,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
