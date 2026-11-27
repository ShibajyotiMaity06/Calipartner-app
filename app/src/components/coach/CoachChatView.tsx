import {
  ArrowRightIcon,
  CameraIcon,
  ChevronLeftIcon,
  MoreDotsIcon,
  Text as V1Text,
  borders as v1Borders,
  colors as v1Colors,
  fonts as v1Fonts,
  radius as v1Radius,
  space as v1Space,
} from '@calipartner/ui/v1';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoachStartV1 } from './CoachStartV1';
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
import { useCoachSession } from './CoachSessionProvider';
import { t } from '@/i18n';
import { CoachDailyLimitBanner, CoachOfflineBanner } from './CoachBanners';
import { CoachConsentModal } from './CoachConsentModal';
import { CoachHistoryModal } from './CoachHistoryModal';
import { CoachMessageBubble } from './CoachMessageBubble';
import { CoachReportModal } from './CoachReportModal';
import { CoachSuggestedPrompts } from './CoachSuggestedPrompts';
import { useTargets } from '@/hooks/useTargets';
import { createLogger } from '@/lib/logger';
import type { CoachMessage, CoachReportReason, CoachSuggestion } from './types';
import type { CoachMealDraft, CoachStructuredCard } from '@calipartner/core';

const log = createLogger('CoachChatView');

export interface CoachChatViewProps {
  onBack?: () => void;
  initialConversationId?: string;
}

const MAX_CHAR_COUNT = 1000;

export function CoachChatView({ onBack, initialConversationId }: CoachChatViewProps) {
  const insets = useSafeAreaInsets();
  const { currentGoalProfile } = useTargets();
  const [menuOpen, setMenuOpen] = useState(false);
  const {
    subscription: { currentTier, hasActiveAccess, isTrial, loading: subLoading },
    inputText,
    setInputText,
    isSending,
    setIsSending,
    isDailyLimitReached,
    setDailyLimitReached,
    requestError,
    setRequestError,
    sendingRef,
    currentConversationId,
    setCurrentConversationId,
    conversations,
    setConversations,
    messages,
    setMessages,
    hasConsent,
    setHasConsent,
  } = useCoachSession();
  useEffect(() => {
    if (initialConversationId) setCurrentConversationId(initialConversationId);
  }, [initialConversationId, setCurrentConversationId]);
  const isPro = currentTier === 'pro' && hasActiveAccess && !isTrial;
  const { isOnline } = useNetworkStatus();
  const { checkAndTrigger, paywallState, closePaywall } = usePaywall();

  // Consent State
  const [showConsentModal, setShowConsentModal] = useState<boolean>(false);

  // Modals & Panels
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [showPaywallModal, setShowPaywallModal] = useState<boolean>(false);

  // Logging flow states for Suggestion Cards
  const [showFoodLogModal, setShowFoodLogModal] = useState<boolean>(false);

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
  }, [setHasConsent, setRequestError]);

  const handleDeclineConsent = useCallback(() => {
    setShowConsentModal(false);
    if (!hasConsent && onBack) {
      onBack();
    }
  }, [hasConsent, onBack]);

  // The session owns in-flight replies, including while this route is closed.
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

      // Coach requests always go through the authenticated Edge Function.
      let finalContent = '';
      let suggestions: CoachSuggestion[] | undefined;
      let mealDraft: CoachMealDraft | null | undefined;
      let structuredCard: CoachStructuredCard | null | undefined;
      let quickReplies: string[] | undefined;

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
        structuredCard = aiResult.card ?? null;
        quickReplies = aiResult.quickReplies ?? [];
      } catch (coachErr: unknown) {
        const code = (coachErr as { code?: string })?.code;
        const allowanceReached = code === 'MONTHLY_LIMIT_REACHED' || code === 'DAILY_LIMIT_REACHED';
        if (code === 'CONSENT_REQUIRED') {
          setHasConsent(false);
          setShowConsentModal(true);
        } else if (code === 'UPGRADE_REQUIRED') setShowPaywallModal(true);
        else if (allowanceReached) setDailyLimitReached(true);
        log.error('AI Coach call failed', code ?? 'unavailable');
        setRequestError(
          allowanceReached
            ? null
            : t(
                code === 'REQUEST_IN_PROGRESS'
                  ? 'aiAllowance.processing'
                  : 'brandRepair.coachUnavailable',
              ),
        );
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
            ? {
                ...message,
                content: finalContent,
                isStreaming: false,
                suggestions,
                mealDraft,
                card: structuredCard ?? null,
                quickReplies: quickReplies ?? [],
              }
            : message,
        ),
      );
      sendingRef.current = false;
      setIsSending(false);
    },
    [
      inputDisabled,
      hasConsent,
      currentConversationId,
      messages,
      currentGoalProfile,
      sendingRef,
      setDailyLimitReached,
      setHasConsent,
      setInputText,
      setIsSending,
      setMessages,
      setRequestError,
    ],
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
      <View style={styles.centerContainer} testID="view-coach-loading">
        <ActivityIndicator size="large" color={v1Colors.apricot} />
      </View>
    );
  }

  // 2. Gating: Pro plan holders only (PRD 6.22 AIC-1, SUB-16)
  if (!isPro) {
    return (
      <View style={styles.lockedContainer} testID="view-coach-locked">
        <View
          style={[styles.header, { paddingTop: Math.max(v1Space.sm, insets.top + v1Space.xs) }]}
        >
          <View style={styles.headerLeft}>
            {onBack ? (
              <Pressable
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel={t('common.back')}
                style={({ pressed }) => [
                  styles.circleBtn,
                  pressed ? styles.circleBtnPressed : null,
                ]}
                testID="btn-coach-back-locked"
              >
                <ChevronLeftIcon size={18} color={v1Colors.textHi} />
              </Pressable>
            ) : null}
            <V1Text variant="rowTitle" color="textHi">
              {t('coachV1.headerTitle')}
            </V1Text>
          </View>
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
          onClose={() => {
            setShowPaywallModal(false);
            closePaywall();
          }}
        />
      </View>
    );
  }

  const hasStartedChat = messages.some((m) => m.role === 'user') || messages.length > 1;
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');
  const activeQuickReplies =
    lastAssistantMsg?.quickReplies && lastAssistantMsg.quickReplies.length > 0
      ? lastAssistantMsg.quickReplies
      : lastAssistantMsg?.mealDraft
        ? [
            t('coachV1.quickSwapRice'),
            t('coachV1.quickMoreProtein'),
            t('coachV1.quickLighterOption'),
          ]
        : undefined;
  const canSend = Boolean(inputText.trim()) && !inputDisabled;

  // 3. Authenticated Plan Holder Chat Screen
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="screen-coach-chat"
    >
      {/* Compact Header (No star icon, minimal top padding) */}
      <View style={[styles.header, { paddingTop: Math.max(v1Space.sm, insets.top + v1Space.xs) }]}>
        <View style={styles.headerLeft}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              style={({ pressed }) => [styles.circleBtn, pressed ? styles.circleBtnPressed : null]}
              testID="btn-coach-back"
            >
              <ChevronLeftIcon size={18} color={v1Colors.textHi} />
            </Pressable>
          ) : null}
          <View style={styles.titleWrap}>
            <V1Text variant="rowTitle" color="textHi" numberOfLines={1}>
              {t('coachV1.headerTitle')}
            </V1Text>
            <V1Text variant="meta" color="textLo" numberOfLines={1}>
              {t('coachV1.headerSubtitle')}
            </V1Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            onPress={() => setMenuOpen((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={t('coachV1.menuHistory')}
            style={({ pressed }) => [styles.circleBtn, pressed ? styles.circleBtnPressed : null]}
            testID="btn-coach-menu"
          >
            <MoreDotsIcon size={18} color={v1Colors.textHi} />
          </Pressable>
        </View>
      </View>

      {menuOpen ? (
        <View style={styles.menuDropdown} testID="coach-header-menu">
          <Pressable
            onPress={() => {
              setMenuOpen(false);
              setShowHistoryModal(true);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.menuItem, pressed ? styles.menuItemPressed : null]}
            testID="btn-coach-history"
          >
            <V1Text variant="label" color="textHi">
              {t('coachV1.menuHistory')}
            </V1Text>
          </Pressable>
          <View style={styles.menuDivider} />
          <Pressable
            onPress={() => {
              setMenuOpen(false);
              setShowConsentModal(true);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.menuItem, pressed ? styles.menuItemPressed : null]}
            testID="btn-coach-privacy"
          >
            <V1Text variant="label" color="textHi">
              {t('coachV1.menuPrivacy')}
            </V1Text>
          </Pressable>
          {hasStartedChat ? (
            <>
              <View style={styles.menuDivider} />
              <Pressable
                onPress={() => {
                  setMenuOpen(false);
                  setMessages([]);
                  setRequestError(null);
                  setCurrentConversationId(generateClientUuid());
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.menuItem, pressed ? styles.menuItemPressed : null]}
                testID="btn-coach-new-chat"
              >
                <V1Text variant="label" color="apricot">
                  {t('coachV1.menuNewChat')}
                </V1Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}

      {/* Status Banners (Offline or Daily Limit) */}
      {isOffline && <CoachOfflineBanner />}
      {isDailyLimitReached && <CoachDailyLimitBanner />}

      {!hasStartedChat ? (
        <View style={styles.startWrap}>
          <CoachStartV1
            onSelectPrompt={(prompt) => void handleSendMessage(prompt)}
            disabled={inputDisabled}
          />
        </View>
      ) : (
        <>
          <ScrollView
            ref={scrollViewRef}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contextPillCenter}>
              <View style={styles.usingLogsPill} testID="coach-using-logs-pill">
                <V1Text variant="micro" color="textMid">
                  {t('coachV1.usingLogsPill')}
                </V1Text>
              </View>
            </View>

            {messages.map((msg) => (
              <CoachMessageBubble
                key={msg.id}
                message={msg}
                onThumbsUp={handleThumbsUp}
                onThumbsDown={handleThumbsDown}
                onReport={(id) => setReportTargetId(id)}
                onLogSuggestion={handleLogSuggestion}
                onActionPrompt={(prompt) => void handleSendMessage(prompt)}
                onAnotherIdea={() => void handleSendMessage(t('coachV1.anotherIdeaPrompt'))}
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

          <CoachSuggestedPrompts
            onSelectPrompt={(prompt) => void handleSendMessage(prompt)}
            disabled={inputDisabled}
            quickReplies={activeQuickReplies}
          />
        </>
      )}

      {requestError ? (
        <V1Text
          variant="meta"
          color="danger"
          accessibilityRole="alert"
          style={styles.errorBannerText}
        >
          {requestError}
        </V1Text>
      ) : null}

      {/* Bottom Composer Bar */}
      <View
        style={[
          styles.composerWrap,
          { paddingBottom: Math.max(v1Space.md, insets.bottom + v1Space.xs) },
        ]}
      >
        <View style={styles.composerPill}>
          <Pressable
            onPress={() => setShowFoodLogModal(true)}
            disabled={inputDisabled}
            accessibilityRole="button"
            accessibilityLabel={t('homeV1.scanMeal')}
            style={({ pressed }) => [
              styles.cameraBtn,
              pressed ? styles.circleBtnPressed : null,
              inputDisabled ? styles.btnDisabled : null,
            ]}
            testID="btn-coach-camera"
          >
            <CameraIcon size={18} color={v1Colors.textMid} />
          </Pressable>

          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder={t('coachV1.inputPlaceholder')}
            placeholderTextColor={v1Colors.textLo}
            editable={!inputDisabled}
            maxLength={MAX_CHAR_COUNT}
            multiline
            style={[
              styles.textInput,
              {
                opacity: inputDisabled ? 0.6 : 1,
                fontFamily: v1Fonts.regular,
              },
            ]}
            testID="input-coach-message"
          />

          <Pressable
            onPress={() => void handleSendMessage(inputText)}
            disabled={!canSend}
            style={({ pressed }) => [
              styles.sendButton,
              canSend ? styles.sendButtonActive : styles.sendButtonIdle,
              canSend && pressed ? styles.sendButtonPressed : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('coach.input.send')}
            testID="btn-coach-send"
          >
            {isSending ? (
              <ActivityIndicator size="small" color={v1Colors.onBrand} />
            ) : (
              <ArrowRightIcon size={18} color={canSend ? v1Colors.onBrand : v1Colors.textLo} />
            )}
          </Pressable>
        </View>

        {inputText.length > 800 ? (
          <View style={styles.charCountRow}>
            <V1Text variant="micro" color="textLo" tabular>
              {t('coach.input.charCount', { count: inputText.length })}
            </V1Text>
          </View>
        ) : null}
      </View>

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
    backgroundColor: v1Colors.bg0,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: v1Colors.bg0,
  },
  lockedContainer: {
    flex: 1,
    backgroundColor: v1Colors.bg0,
  },
  lockedContent: {
    padding: v1Space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: v1Space.xl,
    paddingBottom: v1Space.sm + 2,
    backgroundColor: v1Colors.bg0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: v1Space.md,
    flex: 1,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: v1Radius.full,
    backgroundColor: v1Colors.s1,
    borderWidth: v1Borders.width,
    borderColor: v1Colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtnPressed: {
    backgroundColor: v1Colors.s2,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  titleWrap: {
    flex: 1,
    gap: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: v1Space.xs,
  },
  menuDropdown: {
    marginHorizontal: v1Space.xl,
    marginBottom: v1Space.sm,
    backgroundColor: v1Colors.s1,
    borderWidth: v1Borders.width,
    borderColor: v1Colors.hairlineLit,
    borderRadius: v1Radius.chip,
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: v1Space.lg,
    paddingVertical: v1Space.md,
  },
  menuItemPressed: {
    backgroundColor: v1Colors.s2,
  },
  menuDivider: {
    height: v1Borders.width,
    backgroundColor: v1Colors.hairline,
  },
  startWrap: {
    flex: 1,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingTop: v1Space.sm,
    paddingBottom: v1Space.md,
  },
  contextPillCenter: {
    alignItems: 'center',
    marginBottom: v1Space.lg,
  },
  usingLogsPill: {
    backgroundColor: v1Colors.s1,
    borderWidth: v1Borders.width,
    borderColor: v1Colors.hairline,
    borderRadius: v1Radius.full,
    paddingHorizontal: v1Space.lg,
    paddingVertical: v1Space.xs + 2,
  },
  errorBannerText: {
    paddingHorizontal: v1Space.xl,
    paddingBottom: v1Space.xs,
  },
  composerWrap: {
    paddingHorizontal: v1Space.xl,
    paddingTop: v1Space.xs,
  },
  composerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: v1Space.sm,
    backgroundColor: v1Colors.s1,
    borderWidth: v1Borders.width,
    borderColor: v1Colors.hairline,
    borderRadius: v1Radius.full,
    paddingHorizontal: v1Space.sm,
    paddingVertical: v1Space.xs + 2,
    minHeight: 52,
  },
  cameraBtn: {
    width: 36,
    height: 36,
    borderRadius: v1Radius.full,
    backgroundColor: v1Colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 110,
    paddingHorizontal: v1Space.xs,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    fontSize: 15,
    color: v1Colors.textHi,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: v1Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: v1Colors.apricot,
  },
  sendButtonIdle: {
    backgroundColor: v1Colors.s2,
    borderWidth: v1Borders.width,
    borderColor: v1Colors.hairline,
  },
  sendButtonPressed: {
    backgroundColor: v1Colors.apricotPressed,
  },
  charCountRow: {
    alignItems: 'flex-end',
    paddingTop: v1Space.xs,
    paddingRight: v1Space.sm,
  },
});
