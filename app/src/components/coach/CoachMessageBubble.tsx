import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import {
  AlertCircleIcon,
  BrandRingMark,
  CheckCircleIcon,
  Text,
  borders,
  colors,
  radius,
  space,
} from '@calipartner/ui/v1';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { cleanCoachResponse } from '@/services/aiCoachClient';
import { CoachMealDraftCard } from './CoachMealDraftCard';
import { CoachSuggestionCard } from './CoachSuggestionCard';
import type { CoachMessage, CoachSuggestion } from './types';

export interface CoachMessageBubbleProps {
  demo?: boolean;
  message: CoachMessage;
  onThumbsUp?: (messageId: string) => void;
  onThumbsDown?: (messageId: string) => void;
  onReport?: (messageId: string) => void;
  onLogSuggestion?: (suggestion: CoachSuggestion) => void;
  onActionPrompt?: (prompt: string) => void;
  onAnotherIdea?: () => void;
  onMealLogged?: () => void;
  mealDisabled?: boolean;
}

export function CoachMessageBubble({
  demo = false,
  message,
  onThumbsUp,
  onThumbsDown,
  onReport,
  onLogSuggestion,
  onActionPrompt,
  onAnotherIdea,
  onMealLogged,
  mealDisabled,
}: CoachMessageBubbleProps) {
  const isUser = message.role === 'user';
  const hasRichCard = Boolean(
    !isUser && !message.isStreaming && (message.card || message.mealDraft),
  );
  const cleanText = isUser ? message.content : cleanCoachResponse(message.content);

  return (
    <View
      style={[
        styles.rowWrap,
        demo && styles.demoRow,
        isUser ? styles.userRowWrap : styles.coachRowWrap,
      ]}
      testID={`msg-bubble-${message.id}`}
    >
      <View
        style={[
          styles.bubbleContentWrap,
          isUser ? styles.userContentWrap : styles.coachContentWrap,
        ]}
      >
        {isUser ? (
          <View style={styles.userBubble}>
            <Text variant="body" color="textHi" testID={`text-msg-content-${message.id}`}>
              {cleanText}
            </Text>
            {message.attachedMeal ? (
              <View style={styles.attachedMealCard} testID={`coach-attached-meal-${message.id}`}>
                <View style={styles.attachedMealIcon}>
                  <BrandRingMark size={14} color={colors.textMid} />
                </View>
                <View style={styles.attachedMealInfo}>
                  <Text variant="label" color="textHi" tabular>
                    {`${message.attachedMeal.title} · ${Math.round(message.attachedMeal.calories)} kcal`}
                  </Text>
                  <Text variant="micro" color="textLo" tabular>
                    {`P ${Math.round(message.attachedMeal.protein)}   C ${Math.round(message.attachedMeal.carbs)}   F ${Math.round(message.attachedMeal.fat)}`}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.assistantStack}>
            {hasRichCard ? (
              <Text
                variant="body"
                color="textHi"
                style={styles.leadCopy}
                testID={`text-msg-content-${message.id}`}
              >
                {cleanText}
              </Text>
            ) : (
              <View style={styles.coachPlainBubble}>
                <Text variant="body" color="textHi" testID={`text-msg-content-${message.id}`}>
                  {cleanText}
                </Text>
                {message.isStreaming ? (
                  <View
                    style={styles.streamingIndicator}
                    testID={`indicator-streaming-${message.id}`}
                  >
                    <ActivityIndicator size="small" color={colors.apricot} />
                    <Text variant="meta" color="textLo">
                      typing…
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {!message.isStreaming && message.card ? (
              <View style={styles.structuredCard} testID={`coach-structured-card-${message.id}`}>
                {message.card.eyebrow ? (
                  <Text variant="eyebrow" color="textLo">
                    {message.card.eyebrow}
                  </Text>
                ) : null}

                <View style={styles.pointsList}>
                  {message.card.points.map((point, idx) => (
                    <View key={`${point.lead}-${idx}`} style={styles.pointRow}>
                      {point.kind === 'positive' ? (
                        <CheckCircleIcon size={18} color={colors.apricot} />
                      ) : (
                        <AlertCircleIcon size={18} color={colors.hairlineLit} />
                      )}
                      <Text style={styles.pointText}>
                        <Text variant="rowTitle" color="textHi">
                          {point.lead}
                        </Text>
                        {point.detail ? (
                          <Text variant="body" color="textLo">
                            {`  ${point.detail}`}
                          </Text>
                        ) : null}
                      </Text>
                    </View>
                  ))}
                </View>

                {message.card.actions?.length ? (
                  <View style={styles.cardActionsRow}>
                    {message.card.actions.map((action, idx) => (
                      <Pressable
                        key={`${action.label}-${idx}`}
                        onPress={() => onActionPrompt?.(action.prompt)}
                        accessibilityRole="button"
                        accessibilityLabel={action.label}
                        style={({ pressed }) => [
                          action.primary ? styles.cardPrimaryBtn : styles.cardSecondaryBtn,
                          pressed
                            ? action.primary
                              ? styles.primaryPressed
                              : styles.secondaryPressed
                            : null,
                        ]}
                        testID={`coach-card-action-${message.id}-${idx}`}
                      >
                        <Text variant="buttonS" color={action.primary ? 'onBrand' : 'textHi'}>
                          {action.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {!message.isStreaming && message.mealDraft ? (
              <CoachMealDraftCard
                draft={message.mealDraft}
                onLogged={onMealLogged}
                onAnotherIdea={onAnotherIdea}
                disabled={mealDisabled}
              />
            ) : null}

            {message.suggestions && message.suggestions.length > 0 && onLogSuggestion ? (
              <View style={styles.suggestionsContainer}>
                {message.suggestions.map((sug) => (
                  <CoachSuggestionCard key={sug.id} suggestion={sug} onLog={onLogSuggestion} />
                ))}
              </View>
            ) : null}

            {!demo && !message.isStreaming ? (
              <View style={styles.coachFooter}>
                <View style={styles.disclaimerRow}>
                  <Ionicons name="alert-circle-outline" size={12} color={colors.textOff} />
                  <Text
                    variant="micro"
                    color="textLo"
                    style={styles.disclaimerText}
                    testID="text-coach-disclaimer"
                  >
                    {t('coach.disclaimer')}
                  </Text>
                </View>

                <View style={styles.feedbackRow}>
                  <Pressable
                    onPress={() => onThumbsUp?.(message.id)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t('coach.feedback.helpful')}
                    style={[
                      styles.actionBtn,
                      message.feedback === 'up' ? styles.actionBtnActive : null,
                    ]}
                    testID={`btn-coach-thumbs-up-${message.id}`}
                  >
                    <Ionicons
                      name={message.feedback === 'up' ? 'thumbs-up' : 'thumbs-up-outline'}
                      size={14}
                      color={message.feedback === 'up' ? colors.apricot : colors.textLo}
                    />
                  </Pressable>

                  <Pressable
                    onPress={() => onThumbsDown?.(message.id)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t('coach.feedback.unhelpful')}
                    style={[
                      styles.actionBtn,
                      message.feedback === 'down' ? styles.actionBtnActive : null,
                    ]}
                    testID={`btn-coach-thumbs-down-${message.id}`}
                  >
                    <Ionicons
                      name={message.feedback === 'down' ? 'thumbs-down' : 'thumbs-down-outline'}
                      size={14}
                      color={message.feedback === 'down' ? colors.danger : colors.textLo}
                    />
                  </Pressable>

                  <Pressable
                    onPress={() => onReport?.(message.id)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t('coach.feedback.report')}
                    style={styles.actionBtn}
                    testID={`btn-coach-report-${message.id}`}
                  >
                    <Ionicons name="flag-outline" size={13} color={colors.textLo} />
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  demoRow: { paddingHorizontal: 0 },
  rowWrap: {
    flexDirection: 'row',
    marginBottom: space.lg,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  userRowWrap: {
    justifyContent: 'flex-end',
  },
  coachRowWrap: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  bubbleContentWrap: {
    flexShrink: 1,
  },
  userContentWrap: {
    maxWidth: '84%',
    alignItems: 'flex-end',
  },
  coachContentWrap: {
    flex: 1,
  },
  userBubble: {
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.sm + 2,
  },
  attachedMealCard: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.chip,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
  },
  attachedMealIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachedMealInfo: {
    gap: 2,
    flexShrink: 1,
  },
  assistantStack: {
    gap: space.sm + 2,
  },
  leadCopy: {
    paddingTop: 2,
  },
  coachPlainBubble: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  streamingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    marginTop: space.xs + 2,
  },
  structuredCard: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.md,
  },
  pointsList: {
    gap: space.sm + 2,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm + 2,
  },
  pointText: {
    flex: 1,
  },
  cardActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  cardPrimaryBtn: {
    minHeight: 40,
    paddingHorizontal: space.lg,
    borderRadius: radius.button,
    backgroundColor: colors.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSecondaryBtn: {
    minHeight: 40,
    paddingHorizontal: space.lg,
    borderRadius: radius.button,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairlineLit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: {
    backgroundColor: colors.apricotPressed,
  },
  secondaryPressed: {
    backgroundColor: colors.s3,
  },
  suggestionsContainer: {
    gap: space.sm,
  },
  coachFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  disclaimerText: {
    opacity: 0.75,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnActive: {
    backgroundColor: colors.s2,
  },
});
