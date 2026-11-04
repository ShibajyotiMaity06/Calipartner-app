import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ownerRecipeToRecipe } from '@calipartner/core';
import supplied from '../../../../datasets/owner_recipes.json';
const state = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock('react-native', () => ({
  ActivityIndicator: 'Loading',
  Modal: 'Modal',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Text: 'Text',
  View: 'View',
  StyleSheet: { create: (s: unknown) => s },
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner' }, profile: { timezone: 'America/New_York' } }),
}));
vi.mock('@/db', () => ({ getDb: async () => ({}) }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock('@/services/recipeService', () => ({ logRecipe: state.log }));
import { LogRecipeModal } from './LogRecipeModal';
let renderer: ReactTestRenderer;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-02T02:00:00Z'));
  state.log.mockReset().mockResolvedValue({});
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.useRealTimers();
});
it('logs a supplied portion on the stored local day and prevents a double tap from saving twice', async () => {
  const recipe = ownerRecipeToRecipe(supplied[0]!, supplied[0]!.id),
    closed = vi.fn();
  await act(async () => {
    renderer = create(<LogRecipeModal visible recipe={recipe} onClose={closed} />);
  });
  await act(async () => {
    const button = renderer.root.findByProps({ testID: 'btn-log-recipe-submit' });
    button.props.onPress();
    button.props.onPress();
  });
  expect(state.log).toHaveBeenCalledOnce();
  expect(state.log.mock.calls[0]![1]).toMatchObject({
    recipeId: recipe.id,
    servings: 1,
    localDate: '2026-11-01',
    loggedAt: '2026-11-02T02:00:00.000Z',
  });
  expect(closed).toHaveBeenCalledOnce();
});
