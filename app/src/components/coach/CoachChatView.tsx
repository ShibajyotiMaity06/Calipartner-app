import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, homeLayout, type as typography } from '@calipartner/ui';
import {
  acceptAiProcessingConsent,
  type SupabaseFunctionsClient,
} from '@/services/aiFoodPhotoService';
import { generateClientUuid } from '@/services/foodService';
import { getSupabase } from '@/lib/supabase';
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
import { useTargets } from '@/hooks/useTargets';
import { createLogger } from '@/lib/logger';
import type { CoachConversation, CoachMessage, CoachReportReason, CoachSuggestion } from './types';
import type { CoachMealDraft } from '@calipartner/core';

const log = createLogger('CoachChatView');

export interface CoachChatViewProps {
  onBack?: () => void;
  initialConversationId?: string;
}

const MAX_CHAR_COUNT = 1000;

export function CoachChatView({ onBack, initialConversationId }: CoachChatViewProps) {
  const { colors } = useTheme();
  const { currentGoalProfile } = useTargets();
  const { currentTier, hasActiveAccess, isTrial, loading: subLoading } = useSubscription();
  const isPro = currentTier === 'pro' && hasActiveAccess && !isTrial;
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
  const [showFoodLogModal, setShowFoodLogModal] = useState<boolean>(false);

  // Chat message state
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isDailyLimitReached, setDailyLimitReached] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const [currentConversationId, setCurrentConversationId] = useState<string>(
    initialConversationId || 'conv-default',
  );

  const [conversations, setConversations] = useState<CoachConversation[]>([]);

  const [messages, setMessages] = useState<CoachMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: t('coach.meal.welcome'),
      timestamp: new Date().toISOString(),
    },
  ]);

  const scrollViewRef = useRef<ScrollView>(null);

  const isOffline = isOnline === false;
  const inputDisabled = isSending || isDailyLimitReached || isOffline;

  // Handle plan unlock attempt
  const handleUnlockPress = useCallback(() => {
    checkAndTrigger('open_ai_coach');
    setShowPaywallModal(true);
  }, [checkAndTrigger]);

  // Consent agreement
  const handleAgreeConsent = useCallback(async () => {
    try {
      await acceptAiProcessingConsent(getSupabase() as unknown as SupabaseFunctionsClient);
      setHasConsent(true);
      setShowConsentModal(false);
      setRequestError(null);
    } catch {
      setRequestError(t('coach.meal.consentError'));
    }
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
      if (!trimmed || inputDisabled || sendingRef.current) return;

      if (!hasConsent) {
        setShowConsentModal(true);
        return;
      }

      sendingRef.current = true;
      setInputText('');
      setIsSending(true);
      setRequestError(null);

      const userMsgId = generateClientUuid();
      const assistantMsgId = generateClientUuid();

      const userMessage: CoachMessage = {
        id: userMsgId,
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);

      // Append assistant message in streaming state
      const initialAssistantMessage: CoachMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, initialAssistantMessage]);

      // Determine response from live AI coach (Edge Function or direct Gemini 2.5 Flash)
      let finalContent = '';
      let suggestions: CoachSuggestion[] | undefined;
      let mealDraft: CoachMealDraft | null | undefined;

      try {
        if (!currentGoalProfile) throw new Error(t('common.targetUnavailable'));
        const { queryAiCoach } = await import('@/services/aiCoachClient');

        const historyPayload = [
          ...messages.map((m) => ({
            role: m.role,
            content: m.content + (m.mealLogged ? '\n' + t('coach.meal.logged') : ''),
          })),
          { role: 'user' as const, content: trimmed },
        ];

        const aiResult = await queryAiCoach(
          historyPayload,
          {
            calorieTarget: currentGoalProfile.daily_calorie_target,
            proteinTarget: currentGoalProfile.protein_grams,
            goal: currentGoalProfile.goal,
          },
          currentConversationId,
          { mealLogging: true },
        );

        finalContent = aiResult.content;
        suggestions = aiResult.suggestions;
        mealDraft = aiResult.mealDraft;
      } catch (coachErr: unknown) {
        const code = (coachErr as { code?: string })?.code;
        if (code === 'CONSENT_REQUIRED') {
          setHasConsent(false);
          setShowConsentModal(true);
        } else if (code === 'UPGRADE_REQUIRED') setShowPaywallModal(true);
        else if (code === 'DAILY_LIMIT_REACHED') setDailyLimitReached(true);
        log.error('AI Coach call failed', code ?? 'unavailable');
        setRequestError(t('brandRepair.coachUnavailable'));
        setInputText(trimmed);
        setMessages((previous) =>
          previous.filter((message) => message.id !== assistantMsgId && message.id !== userMsgId),
        );
        sendingRef.current = false;
        setIsSending(false);
        return;
      }

      setMessages((previous) =>
        previous.map((message) =>
          message.id === assistantMsgId
            ? { ...message, content: finalContent, isStreaming: false, suggestions, mealDraft }
            : message,
        ),
      );
      sendingRef.current = false;
      setIsSending(false);
    },
    [inputDisabled, hasConsent, currentConversationId, messages, currentGoalProfile],
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
  const handleLogSuggestion = (_suggestion: CoachSuggestion) => setShowFoodLogModal(true);

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

  // 2. Gating: Pro plan holders only (PRD 6.22 AIC-1, SUB-16)
  if (!isPro) {
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
          preselectedTier="pro"
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
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
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
            mealDisabled={
              isSending || isOffline || messages.at(-1)?.id !== msg.id || msg.mealLogged
            }
            onMealLogged={() =>
              setMessages((previous) =>
                previous.map((message) =>
                  message.id === msg.id ? { ...message, mealLogged: true } : message,
                ),
              )
            }
          />
        ))}
      </ScrollView>

      {/* Suggested Prompts Strip */}
      <CoachSuggestedPrompts onSelectPrompt={handleSendMessage} disabled={inputDisabled} />

      {requestError && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {requestError}
        </Text>
      )}
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
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <Ionicons name="arrow-up" size={18} color={colors.onAccent} />
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
    fontFamily: typography.body.fontFamily,
  },
  sendButton: {
    width: homeLayout.touchSize,
    height: homeLayout.touchSize,
    borderRadius: radius.pill,
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
