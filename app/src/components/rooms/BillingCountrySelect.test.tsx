import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }));
vi.mock('@/services/webBillingService', () => ({
  fetchBillingCountry: api.load,
  saveBillingCountry: api.save,
}));
vi.mock('react-native', () => ({ Platform: { OS: 'web' }, View: 'View' }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
}));
import { Platform } from 'react-native';
import { BillingCountrySelect } from './BillingCountrySelect';
let tree: ReactTestRenderer | undefined;
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  Platform.OS = 'web';
  api.load.mockResolvedValue('IN');
});
afterEach(async () => {
  if (tree) await act(async () => tree?.unmount());
  tree = undefined;
});
it('keeps the old country and checkout disabled until an online save is acknowledged', async () => {
  const saved = vi.fn(),
    busy = vi.fn();
  let acknowledge!: () => void;
  api.save.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        acknowledge = resolve;
      }),
  );
  await act(async () => {
    tree = create(<BillingCountrySelect onSaved={saved} onSaving={busy} />);
  });
  await act(async () =>
    tree!.root.findByType('select').props.onChange({ currentTarget: { value: 'US' } }),
  );
  expect(tree!.root.findByType('select').props.value).toBe('IN');
  expect(tree!.root.findByType('select').props.disabled).toBe(true);
  expect(busy).toHaveBeenLastCalledWith(true);
  expect(saved).not.toHaveBeenCalled();
  await act(async () => {
    acknowledge();
  });
  expect(tree!.root.findByType('select').props.value).toBe('US');
  expect(busy).toHaveBeenLastCalledWith(false);
  expect(saved).toHaveBeenCalledOnce();
});
it('a failed country save shows recovery without changing the quoted billing country', async () => {
  const saved = vi.fn();
  api.save.mockRejectedValue(new Error('offline'));
  await act(async () => {
    tree = create(<BillingCountrySelect onSaved={saved} />);
  });
  await act(async () =>
    tree!.root.findByType('select').props.onChange({ currentTarget: { value: 'US' } }),
  );
  expect(tree!.root.findByType('select').props.value).toBe('IN');
  expect(saved).not.toHaveBeenCalled();
  expect(JSON.stringify(tree!.toJSON())).toContain('Your billing country was not saved.');
});
it('the country selector never starts web billing requests on native', async () => {
  Platform.OS = 'android';
  await act(async () => {
    tree = create(<BillingCountrySelect onSaved={vi.fn()} />);
  });
  expect(tree!.toJSON()).toBeNull();
  expect(api.load).not.toHaveBeenCalled();
});
