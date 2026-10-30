import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
}));
import { LogHubView } from '../../../../packages/ui/src/components/LogHubView';

describe('Log menu after activity retirement', () => {
  it.each([true, false])(
    'keeps current logging actions and excludes the retired tile, fasting=%s',
    async (showFastTile) => {
      (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
        true;
      const select = vi.fn();
      let tree!: ReactTestRenderer;
      await act(async () => {
        tree = create(
          <LogHubView onSelectTile={select} onClose={vi.fn()} showFastTile={showFastTile} />,
        );
      });
      expect(tree.root.findAllByProps({ testID: 'btn-log-tile-focus' })).toHaveLength(0);
      for (const tile of ['food', 'workout', 'water', 'weight']) {
        await act(async () =>
          tree.root.findByProps({ testID: `btn-log-tile-${tile}` }).props.onPress(),
        );
        expect(select).toHaveBeenLastCalledWith(tile);
      }
      expect(tree.root.findAllByProps({ testID: 'btn-log-tile-fast' })).toHaveLength(
        showFastTile ? 1 : 0,
      );
      await act(async () => tree.unmount());
    },
  );
});
