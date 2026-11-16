import React, { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { t } from '@/i18n';
import type { CoachConversation, CoachMessage } from './types';

function useSessionState() {
  const subscription = useSubscription();
  const settled = useRef(false);
  if (!subscription.loading) settled.current = true;
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isDailyLimitReached, setDailyLimitReached] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const [currentConversationId, setCurrentConversationId] = useState('conv-default');
  const [conversations, setConversations] = useState<CoachConversation[]>([]);
  const [messages, setMessages] = useState<CoachMessage[]>(() => [
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: t('coach.meal.welcome'),
      timestamp: new Date().toISOString(),
    },
  ]);
  const [hasConsent, setHasConsent] = useState(true);
  return {
    subscription: { ...subscription, loading: subscription.loading && !settled.current },
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
  };
}
const Context = createContext<ReturnType<typeof useSessionState> | null>(null);

function Session({ children }: { children: ReactNode }) {
  const value = useSessionState();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** In-memory only. Survives route changes; sign-out, account switches and data resets clear it. */
export function CoachSessionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <Session key={user?.id ?? 'guest'}>{children}</Session>;
}

export function useCoachSession() {
  const session = useContext(Context);
  if (!session) throw new Error('CoachSessionProvider is required');
  return session;
}
