import React, { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  TextInput: 'TextInput',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('@calipartner/ui', () => ({
  SegmentedControl: 'SegmentedControl',
  Text: 'Text',
  CheckIcon: 'CheckIcon',
  space: [0, 4, 8, 12, 16],
  radius: {},
  onboardingType: { heading: {} },
  onboardingLayout: {},
  useTheme: () => ({ colors: {} }),
}));
import { HeightField } from './HeightField';

describe('independent height units', () => {
  it('preserves canonical centimetres when toggling and converts feet/inches only on edits', async () => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    const changed = vi.fn();
    function Controlled() {
      const [cm, setCm] = useState(175);
      return (
        <HeightField
          value={cm}
          onChange={(next) => {
            changed(next);
            setCm(next);
          }}
        />
      );
    }
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<Controlled />);
    });
    await act(async () => renderer.root.findByProps({ testID: 'height-unit-ft' }).props.onPress());
    expect(changed).not.toHaveBeenCalled();
    const inches = renderer.root.findAll(
      (node) => typeof node.type === 'string' && node.props.testID === 'input-height-in',
    )[0]!;
    await act(async () => inches.props.onChangeText('10'));
    expect(changed).toHaveBeenLastCalledWith(177.8);
    await act(async () => renderer.root.findByProps({ testID: 'height-unit-cm' }).props.onPress());
    const cm = renderer.root.findAll(
      (node) => typeof node.type === 'string' && node.props.testID === 'input-height',
    )[0]!;
    expect(cm.props.value).toBe('177.8');
    await act(async () => renderer.unmount());
  });
});
