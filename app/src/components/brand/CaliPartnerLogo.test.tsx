import React from 'react';
import { readFileSync } from 'node:fs';
import { act, create } from 'react-test-renderer';
import { it, expect, vi } from 'vitest';
vi.mock('react-native-svg', () => ({ SvgXml: 'SvgXml' }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  ...(await import('../../../../packages/ui/src/brand/logo')),
}));
import { CaliPartnerLogo } from './CaliPartnerLogo';
it('renders the exact supplied static SVG with no animated container', async () => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  let renderer: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(<CaliPartnerLogo size={100} />);
  });
  const svg = renderer!.root.findByType('SvgXml' as React.ElementType);
  expect(svg.props.xml.trim()).toBe(readFileSync('assets/logo.svg', 'utf8').trim());
  expect(svg.props.width).toBe(100);
  expect(svg.props.height).toBe(100);
  await act(async () => renderer!.unmount());
});
