import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  enabled: true,
  paid: true,
  active: false,
  error: null as string | null,
  start: vi.fn(),
  end: vi.fn(),
}));
vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
  Sheet: 'Sheet',
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/hooks/useFasting', () => ({
  useFasting: () => ({
    settings: { enabled: state.enabled, protocol: '16:8' },
    activeSession: state.active ? { id: 'session' } : null,
    computedState: {
      isActive: state.active,
      elapsedMinutes: 480,
      remainingMinutes: 480,
      progressPercentage: 50,
      session: { planned_minutes: 960 },
    },
    scheduledState: { isEatingWindow: true },
    gating: { canAccess: true },
    hasPaidAccess: state.paid,
    loading: false,
    error: state.error,
    startFast: state.start,
    endFast: state.end,
  }),
}));
vi.mock('./FastingTimerModal', () => ({ FastingTimerModal: 'Timer' }));
vi.mock('./FastingProgressRing', () => ({ FastingProgressRing: 'Ring' }));
import { FastingCard } from './FastingCard';
let tree: ReactTestRenderer;
beforeEach(() => {
  vi.clearAllMocks();
  state.enabled = true;
  state.paid = true;
  state.active = false;
  state.error = null;
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('hides disabled fasting and blocks new Free starts', async () => {
  state.enabled = false;
  await act(async () => {
    tree = create(<FastingCard />);
  });
  expect(tree.toJSON()).toBeNull();
  state.enabled = true;
  state.paid = false;
  await act(async () => tree.update(<FastingCard />));
  expect(tree.toJSON()).toBeNull();
});
it('lets expired members end an active fast only after confirmation', async () => {
  state.paid = false;
  state.active = true;
  await act(async () => {
    tree = create(<FastingCard />);
  });
  await act(async () =>
    tree.root
      .findByProps({ testID: 'button-fasting-card-action' })
      .props.onPress({ stopPropagation: vi.fn() }),
  );
  expect(state.end).not.toHaveBeenCalled();
  expect(tree.root.findByType('Sheet' as React.ElementType).props.visible).toBe(true);
  await act(async () =>
    tree.root.findByProps({ testID: 'fasting-card-confirm-end' }).props.onPress(),
  );
  expect(state.end).toHaveBeenCalledOnce();
  expect(state.start).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain('Half of your planned time');
});
it('shows actionable request errors without making health claims', async () => {
  state.active = true;
  state.error = 'NETWORK_UNAVAILABLE';
  await act(async () => {
    tree = create(<FastingCard />);
  });
  expect(tree.root.findByProps({ accessibilityRole: 'alert' })).toBeDefined();
  expect(JSON.stringify(tree.toJSON())).not.toMatch(/ketosis|autophagy|fat burning/i);
});
