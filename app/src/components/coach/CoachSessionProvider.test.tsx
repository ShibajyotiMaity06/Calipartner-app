import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ userId: 'alice' as string | null, loading: true, tier: 'pro' }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: state.userId ? { id: state.userId } : null }),
}));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    loading: state.loading,
    currentTier: state.tier,
    hasActiveAccess: state.tier === 'pro',
    isTrial: false,
  }),
}));
vi.mock('@/i18n', () => ({ t: (key: string) => key }));
import { CoachSessionProvider, useCoachSession } from './CoachSessionProvider';
let session: ReturnType<typeof useCoachSession>;
let renderer: ReactTestRenderer;
function Chat() {
  session = useCoachSession();
  return <div>{session.messages.length}</div>;
}
const tree = (open = true) => (
  <CoachSessionProvider>{open ? <Chat /> : <div>Home</div>}</CoachSessionProvider>
);
beforeEach(() => {
  state.userId = 'alice';
  state.loading = true;
  state.tier = 'pro';
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});
describe('coach navigation session', () => {
  it('retains draft and messages when reopening, including replies completed away from chat', async () => {
    await act(async () => {
      renderer = create(tree());
    });
    const completeReply = session.setMessages;
    await act(async () => {
      session.setInputText('My next question');
      session.setIsSending(true);
      renderer.update(tree(false));
    });
    await act(async () => {
      completeReply((messages) => [
        ...messages,
        {
          id: 'reply',
          role: 'assistant',
          content: 'Saved reply',
          timestamp: '2026-11-15T00:00:00Z',
        },
      ]);
      session.setIsSending(false);
    });
    await act(async () => {
      renderer.update(tree());
    });
    expect(session.inputText).toBe('My next question');
    expect(session.messages.at(-1)?.content).toBe('Saved reply');
    expect(session.isSending).toBe(false);
  });
  it('shows initial loading but preserves chat through background checks and still applies revocation', async () => {
    await act(async () => {
      renderer = create(tree());
    });
    expect(session.subscription.loading).toBe(true);
    state.loading = false;
    await act(async () => {
      renderer.update(tree());
    });
    state.loading = true;
    await act(async () => {
      renderer.update(tree());
    });
    expect(session.subscription.loading).toBe(false);
    state.loading = false;
    state.tier = 'free';
    await act(async () => {
      renderer.update(tree());
    });
    expect(session.subscription.hasActiveAccess).toBe(false);
  });
  it('clears private content on sign-out/account switch and ignores late responses from the old account', async () => {
    await act(async () => {
      renderer = create(tree());
    });
    const oldSetMessages = session.setMessages;
    await act(async () => {
      session.setInputText('Private draft');
    });
    state.userId = null;
    await act(async () => {
      renderer.update(tree());
    });
    expect(session.inputText).toBe('');
    state.userId = 'bob';
    await act(async () => {
      renderer.update(tree());
      oldSetMessages([]);
    });
    expect(session.messages).toHaveLength(1);
    expect(session.inputText).toBe('');
  });
});
