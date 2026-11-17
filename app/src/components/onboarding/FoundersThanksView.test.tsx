import React from 'react';
import { createRequire } from 'node:module';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const priorImageHandler = require.extensions['.png'];
beforeAll(() => {
  require.extensions['.png'] = (module) => {
    module.exports = 1;
  };
});
afterAll(() => {
  if (priorImageHandler) require.extensions['.png'] = priorImageHandler;
  else delete require.extensions['.png'];
});
const open = vi.hoisted(() => vi.fn());
vi.mock('@/services/storeReviewService', () => ({ openStoreReviewPage: open }));
vi.mock('react-native', () => ({
  Image: 'Image',
  View: 'View',
  StyleSheet: { create: (v: unknown) => v },
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: (await import('@/test/ButtonStub')).ButtonStub,
  useTheme: () => ({ colors: {} }),
}));
import { FoundersThanksView } from './FoundersThanksView';
let tree: ReactTestRenderer;
beforeEach(() => {
  vi.clearAllMocks();
  open.mockResolvedValue(true);
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('asks warmly for an honest review and only opens the store after a tap', async () => {
  const next = vi.fn();
  await act(async () => {
    tree = create(<FoundersThanksView onContinue={next} />);
  });
  expect(JSON.stringify(tree.toJSON())).toContain('honest review');
  expect(open).not.toHaveBeenCalled();
  await act(async () => tree.root.findByProps({ testID: 'founders-rate' }).props.onPress());
  expect(open).toHaveBeenCalledTimes(1);
  expect(next).not.toHaveBeenCalled();
  await act(async () => tree.root.findByProps({ testID: 'founders-continue' }).props.onPress());
  expect(next).toHaveBeenCalledTimes(1);
});
it('allows continuing without reviewing and handles unavailable listings and store failures honestly', async () => {
  const next = vi.fn();
  open.mockResolvedValue(false);
  await act(async () => {
    tree = create(<FoundersThanksView onContinue={next} />);
  });
  await act(async () => tree.root.findByProps({ testID: 'founders-rate' }).props.onPress());
  expect(tree.root.findByProps({ testID: 'founders-status' }).props.children).toContain(
    'live in your app store',
  );
  open.mockRejectedValue(new Error('offline'));
  await act(async () => tree.root.findByProps({ testID: 'founders-rate' }).props.onPress());
  expect(tree.root.findByProps({ testID: 'founders-status' }).props.children).toContain(
    'try again or continue',
  );
  await act(async () => tree.root.findByProps({ testID: 'founders-continue' }).props.onPress());
  expect(next).toHaveBeenCalledTimes(1);
});
