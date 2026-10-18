import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LogRecipeModal } from '@/components/recipes';
import { FoodLogModal } from '@/components/diary/FoodLogModal';
import { AiCoachLockedCard, PaywallModal } from '@/components/rooms';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePaywall } from '@/hooks/usePaywall';
import { useSubscription } from '@/hooks/useSubscription';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { CoachDailyLimitBanner, CoachOfflineBanner } from './CoachBanners';
import { CoachConsentModal } from './CoachConsentModal';
import { CoachHistoryModal } from './CoachHistoryModal';
import { CoachMessageBubble } from './CoachMessageBubble';
import { CoachReportModal } from './CoachReportModal';
import { CoachSuggestedPrompts } from './CoachSuggestedPrompts';
import type { CoachConversation, CoachMessage, CoachReportReason, CoachSuggestion } from './types';
import type { Recipe } from '@calipartner/core';

export interface CoachChatViewProps {
  onBack?: () => void;
  initialConversationId?: string;
}

const MAX_CHAR_COUNT = 1000;
const DAILY_MESSAGE_LIMIT = 30;

export function CoachChatView({ onBack, initialConversationId }: CoachChatViewProps) {
  const { colors } = useTheme();
  const { hasPlan, loading: subLoading } = useSubscription();
  const { isOnline } = useNetworkStatus();
  const { checkAndTrigger, paywallState } = usePaywall();

  // Consent State
  const [hasConsent, setHasConsent] = useState<boolean>(true);
  const [showConsentModal, setShowConsentModal] = useState<boolean>(false);

  // Modals & Panels
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [showPaywallModal, setShowPaywallModal] = useState<boolean>(false);

  // Logging flow states for Suggestion Cards
  const [selectedRecipeForLog, setSelectedRecipeForLog] = useState<Recipe | null>(null);
  const [showFoodLogModal, setShowFoodLogModal] = useState<boolean>(false);

  // Chat message state
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [dailyMessagesUsed, setDailyMessagesUsed] = useState<number>(4); // default sample
  const [currentConversationId, setCurrentConversationId] = useState<string>(
    initialConversationId || 'conv-default',
  );

  const [conversations, setConversations] = useState<CoachConversation[]>([
    {
      id: 'conv-default',
      title: 'Nutrition & Protein Target Review',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 2,
      lastMessageSnippet: 'Here are a few high-protein meal suggestions for dinner.',
    },
  ]);

  const [messages, setMessages] = useState<CoachMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content:
        'Hello! I’m your personal CaliPartner Coach. How can I help you reach your goals today?',
      timestamp: new Date().toISOString(),
    },
  ]);

  const scrollViewRef = useRef<ScrollView>(null);

  const isDailyLimitReached = dailyMessagesUsed >= DAILY_MESSAGE_LIMIT;
  const isOffline = isOnline === false;
  const inputDisabled = isSending || isDailyLimitReached || isOffline;

  // Auto-scroll on new message
  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  // Handle plan unlock attempt
  const handleUnlockPress = useCallback(() => {
    checkAndTrigger('open_ai_coach');
    setShowPaywallModal(true);
  }, [checkAndTrigger]);

  // Consent agreement
  const handleAgreeConsent = useCallback(() => {
    setHasConsent(true);
    setShowConsentModal(false);
  }, []);

  const handleDeclineConsent = useCallback(() => {
    setShowConsentModal(false);
    if (!hasConsent && onBack) {
      onBack();
    }
  }, [hasConsent, onBack]);

  // Message sending with simulated streaming
  const handleSendMessage = useCallback(
    async (textToSend: string) => {
      const trimmed = textToSend.trim();
      if (!trimmed || inputDisabled) return;

      if (!hasConsent) {
        setShowConsentModal(true);
        return;
      }

      setInputText('');
      setIsSending(true);
      setDailyMessagesUsed((prev) => prev + 1);

      const userMsgId = `msg-user-${Date.now()}`;
      const assistantMsgId = `msg-asst-${Date.now()}`;

      const userMessage: CoachMessage = {
        id: userMsgId,
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);

      // Determine response based on user input
      let finalContent =
        'I’m analyzing your daily logs. Remember that staying consistent with your calorie and hydration targets is key to sustainable progress.';
      let suggestions: CoachSuggestion[] | undefined;

      const lower = trimmed.toLowerCase();
      if (lower.includes('protein') || lower.includes('eat tonight')) {
        finalContent =
          'To hit your remaining protein target tonight without exceeding your calories, aim for a lean protein base with light vegetables. Here is a curated option from our recipe library:';
        suggestions = [
          {
            id: 'sug-1',
            type: 'recipe',
            title: 'High-Protein Tofu & Lentil Bowl',
            portion: '1 bowl (350g)',
            calories: 420,
            protein: 34,
            carbs: 45,
            fat: 9,
            recipeId: 'rec-tofu-lentil',
          },
        ];
      } else if (lower.includes('calorie target') || lower.includes('explain')) {
        finalContent =
          'Your calorie target was calculated deterministically based on your Mifflin-St Jeor BMR, activity level, and target pace. We always enforce safety floors so you have plenty of energy for your workouts.';
      } else if (lower.includes('week') || lower.includes('how am i doing')) {
        finalContent =
          'Looking at your past 7 days, you’ve logged meals consistently for 6 days and stayed within 5% of your protein goal. Great consistency!';
      }

      // Append assistant message in streaming state
      const initialAssistantMessage: CoachMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isStreaming: true,
        suggestions,
      };

      setMessages((prev) => [...prev, initialAssistantMessage]);

      // Stream character by character / token chunks
      let currentLength = 0;
      const chunkSize = 12;
      const interval = setInterval(() => {
        currentLength += chunkSize;
        const streamedSlice = finalContent.slice(0, currentLength);

        if (currentLength >= finalContent.length) {
          clearInterval(interval);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: finalContent, isStreaming: false }
                : msg,
            ),
          );
          setIsSending(false);
        } else {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: streamedSlice, isStreaming: true }
                : msg,
            ),
          );
        }
      }, 50);
    },
    [inputDisabled, hasConsent],
  );

  // Thumbs feedback
  const handleThumbsUp = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, feedback: m.feedback === 'up' ? null : 'up' } : m)),
    );
  };

  const handleThumbsDown = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, feedback: m.feedback === 'down' ? null : 'down' } : m,
      ),
    );
  };

  // Report message
  const handleReportSubmit = (_msgId: string, _reason: CoachReportReason, _notes?: string) => {
    // Record report locally / feedback
    setReportTargetId(null);
  };

  // Suggestion card "Log it" trigger
  const handleLogSuggestion = (suggestion: CoachSuggestion) => {
    if (suggestion.type === 'recipe') {
      const mockRecipe: Recipe = {
        id: suggestion.recipeId || 'rec-1',
        title: suggestion.title,
        description: 'Suggested by AI Coach',
        cuisine: 'Healthy',
        diet_tags: ['vegetarian'],
        meal_type: 'dinner',
        prep_minutes: 15,
        cook_minutes: 20,
        difficulty: 'easy',
        servings: 1,
        steps: ['Combine ingredients', 'Cook thoroughly', 'Serve warm'],
        tips: ['Pairs well with a side of greens'],
        image_urls: [],
        status: 'published',
        nutrition_per_serving: {
          calories: suggestion.calories,
          protein: suggestion.protein,
          carbs: suggestion.carbs,
          fat: suggestion.fat,
          fiber: 6,
          sugar: 4,
          sodium_mg: 380,
        },
        nutrition_override_reason: null,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setSelectedRecipeForLog(mockRecipe);
    } else {
      setShowFoodLogModal(true);
    }
  };

  // Conversation history handling
  const handleDeleteConversation = (convId: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    if (currentConversationId === convId) {
      setMessages([
        {
          id: 'msg-welcome-fresh',
          role: 'assistant',
          content: 'Conversation cleared. How can I help you today?',
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  };

  const handleDeleteAllHistory = () => {
    setConversations([]);
    setMessages([
      {
        id: 'msg-welcome-fresh',
        role: 'assistant',
        content: 'All history deleted. How can I help you today?',
        timestamp: new Date().toISOString(),
      },
    ]);
    setShowHistoryModal(false);
  };

  // 1. Loading state for subscriptions
  if (subLoading) {
    return (
      <View
        style={[styles.centerContainer, { backgroundColor: colors.background }]}
        testID="view-coach-loading"
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // 2. Gating: Plan holders only (PRD 6.22 AIC-1, SUB-16)
  if (!hasPlan) {
    return (
      <View
        style={[styles.lockedContainer, { backgroundColor: colors.background }]}
        testID="view-coach-locked"
      >
        {/* Header */}
        <View
          style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {onBack && (
            <Pressable
              onPress={onBack}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Back"
              testID="btn-coach-back-locked"
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
          )}
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('coach.title')}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.lockedContent}
          showsVerticalScrollIndicator={false}
        >
          <AiCoachLockedCard onUnlock={handleUnlockPress} />
        </ScrollView>

        <PaywallModal
          visible={showPaywallModal || paywallState.isOpen}
          onClose={() => setShowPaywallModal(false)}
        />
      </View>
    );
  }

  // 3. Authenticated Plan Holder Chat Screen
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="screen-coach-chat"
    >
      {/* Top Header */}
      <View
        style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={styles.headerLeft}>
          {onBack && (
            <Pressable
              onPress={onBack}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Back"
              testID="btn-coach-back"
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
          )}
          <View style={styles.titleWrap}>
            <View style={styles.titleRow}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>{t('coach.title')}</Text>
              <View style={[styles.badgePill, { backgroundColor: colors.cardHighlight }]}>
                <Text style={[styles.badgeText, { color: colors.accent }]}>{t('coach.badge')}</Text>
              </View>
            </View>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              {t('coach.subtitle')}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            onPress={() => setShowConsentModal(true)}
            style={styles.headerIconBtn}
            accessibilityRole="button"
            accessibilityLabel="Privacy & Data Info"
            testID="btn-coach-privacy"
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.text} />
          </Pressable>

          <Pressable
            onPress={() => setShowHistoryModal(true)}
            style={styles.headerIconBtn}
            accessibilityRole="button"
            accessibilityLabel="View History"
            testID="btn-coach-history"
          >
            <Ionicons name="time-outline" size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Status Banners (Offline or Daily Limit) */}
      {isOffline && <CoachOfflineBanner />}
      {isDailyLimitReached && <CoachDailyLimitBanner />}

      {/* Chat Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => (
          <CoachMessageBubble
            key={msg.id}
            message={msg}
            onThumbsUp={handleThumbsUp}
            onThumbsDown={handleThumbsDown}
            onReport={(id) => setReportTargetId(id)}
            onLogSuggestion={handleLogSuggestion}
          />
        ))}
      </ScrollView>

      {/* Suggested Prompts Strip */}
      <CoachSuggestedPrompts onSelectPrompt={handleSendMessage} disabled={inputDisabled} />

      {/* Bottom Input Bar */}
      <View
        style={[
          styles.inputContainer,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder={t('coach.input.placeholder')}
          placeholderTextColor={colors.textMuted}
          editable={!inputDisabled}
          maxLength={MAX_CHAR_COUNT}
          multiline
          style={[
            styles.textInput,
            {
              backgroundColor: colors.surfaceAlt,
              borderColor: colors.border,
              color: colors.text,
              opacity: inputDisabled ? 0.6 : 1,
            },
          ]}
          testID="input-coach-message"
        />

        <Pressable
          onPress={() => handleSendMessage(inputText)}
          disabled={!inputText.trim() || inputDisabled}
          style={[
            styles.sendButton,
            {
              backgroundColor: colors.accent,
              opacity: !inputText.trim() || inputDisabled ? 0.4 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('coach.input.send')}
          testID="btn-coach-send"
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
          )}
        </Pressable>
      </View>

      {/* Character count when typing */}
      {inputText.length > 800 && (
        <View style={styles.charCountRow}>
          <Text style={[styles.charCountText, { color: colors.textMuted }]}>
            {t('coach.input.charCount', { count: inputText.length })}
          </Text>
        </View>
      )}

      {/* 4. Consent Modal */}
      <CoachConsentModal
        visible={showConsentModal}
        onAgree={handleAgreeConsent}
        onDecline={handleDeclineConsent}
        onOpenDeleteHistory={() => {
          setShowConsentModal(false);
          setShowHistoryModal(true);
        }}
      />

      {/* 5. History Modal */}
      <CoachHistoryModal
        visible={showHistoryModal}
        conversations={conversations}
        onClose={() => setShowHistoryModal(false)}
        onSelectConversation={(id) => setCurrentConversationId(id)}
        onDeleteConversation={handleDeleteConversation}
        onDeleteAllHistory={handleDeleteAllHistory}
      />

      {/* 6. Report Modal */}
      <CoachReportModal
        visible={Boolean(reportTargetId)}
        messageId={reportTargetId}
        onClose={() => setReportTargetId(null)}
        onSubmit={handleReportSubmit}
      />

      {/* 7. Recipe Logging Modal (Normal Logging Flow) */}
      {selectedRecipeForLog && (
        <LogRecipeModal
          visible={Boolean(selectedRecipeForLog)}
          recipe={selectedRecipeForLog}
          onClose={() => setSelectedRecipeForLog(null)}
          onLogged={() => setSelectedRecipeForLog(null)}
        />
      )}

      {/* 8. Food Log Modal (Normal Logging Flow) */}
      {showFoodLogModal && (
        <FoodLogModal
          visible={showFoodLogModal}
          defaultSection="lunch"
          localDate={new Date().toISOString().slice(0, 10)}
          onClose={() => setShowFoodLogModal(false)}
          onLogged={() => setShowFoodLogModal(false)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedContainer: {
    flex: 1,
  },
  lockedContent: {
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 44 : spacing.md,
    paddingBottom: spacing.sm + 4,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  backBtn: {
    padding: spacing.xs,
    marginLeft: -spacing.xs,
  },
  titleWrap: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerTitle: {
    fontSize: fontSize.md + 2,
    fontWeight: '700',
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontSize: fontSize.xs - 2,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    fontSize: fontSize.xs,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerIconBtn: {
    padding: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: fontSize.sm + 1,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  charCountRow: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingBottom: 2,
  },
  charCountText: {
    fontSize: fontSize.xs - 1,
  },
});
