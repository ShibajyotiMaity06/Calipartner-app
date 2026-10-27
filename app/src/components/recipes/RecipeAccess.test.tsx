import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
const state = vi.hoisted(() => ({ paid: false, list: vi.fn(), detail: vi.fn() }));
vi.mock('react-native', () => ({
  ActivityIndicator: 'Loading',
  Pressable: 'Pressable',
  RefreshControl: 'Refresh',
  Text: 'Text',
  View: 'View',
  StyleSheet: { create: (s: unknown) => s },
  FlatList: ({
    data,
    renderItem,
  }: {
    data: Array<{ id: string }>;
    renderItem: (o: unknown) => React.ReactElement;
  }) => <>{data.map((item) => React.cloneElement(renderItem({ item }), { key: item.id }))}</>,
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Button: 'Button',
}));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ hasActiveAccess: state.paid, loading: false }),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/db', () => ({ getDb: async () => ({}) }));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({}) }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock('@/services/recipeService', () => ({
  STARTER_RECIPE_IDS: new Set(['recipe-r0001']),
  getFavoriteRecipes: state.list,
  getRecipes: state.list,
  getRecipeDetail: state.detail,
  toggleRecipeFavorite: vi.fn(),
}));
vi.mock('@/components/rooms/PaywallModal', () => ({ PaywallModal: 'Paywall' }));
vi.mock('./RecipeCard', () => ({ RecipeCard: 'RecipeCard' }));
vi.mock('./RecipeDetailModal', () => ({ RecipeDetailModal: 'Detail' }));
vi.mock('./RecipeFilterBar', () => ({ RecipeFilterBar: 'Filters' }));
import { RecipeBrowseView } from './RecipeBrowseView';
const starter = { id: 'recipe-r0001', title: 'Starter' },
  paid = { id: 'recipe-r0011', title: 'Paid recipe' };
let renderer: ReactTestRenderer;
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  state.paid = false;
  state.list.mockResolvedValue([starter, paid]);
  state.detail.mockImplementation(async (_db, id) => (id === starter.id ? starter : paid));
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});
it('Free can open a fixed starter recipe, while search cannot unlock another recipe', async () => {
  await act(async () => {
    renderer = create(<RecipeBrowseView />);
  });
  const cards = () => renderer.root.findAllByType('RecipeCard' as React.ElementType);
  await act(async () =>
    cards()
      .find((card) => card.props.recipe.id === starter.id)!
      .props.onPress(starter),
  );
  expect(state.detail).toHaveBeenCalledWith({}, starter.id, 'owner', {});
  state.detail.mockClear();
  state.list.mockResolvedValue([paid]);
  await act(async () =>
    renderer.root.findByType('Filters' as React.ElementType).props.onQueryChange('Paid recipe'),
  );
  await act(async () => cards()[0]!.props.onPress(paid));
  expect(state.detail).not.toHaveBeenCalled();
  expect(renderer.root.findByType('Paywall' as React.ElementType).props.visible).toBe(true);
});
it('active Plus/Pro can open the full library and expiry removes an open paid detail', async () => {
  state.paid = true;
  await act(async () => {
    renderer = create(<RecipeBrowseView />);
  });
  await act(async () =>
    renderer.root
      .findAllByType('RecipeCard' as React.ElementType)
      .find((card) => card.props.recipe.id === paid.id)!
      .props.onPress(paid),
  );
  expect(renderer.root.findByType('Detail' as React.ElementType).props.visible).toBe(true);
  state.paid = false;
  await act(async () => renderer.update(<RecipeBrowseView />));
  expect(renderer.root.findAllByType('Detail' as React.ElementType)).toHaveLength(0);
});
