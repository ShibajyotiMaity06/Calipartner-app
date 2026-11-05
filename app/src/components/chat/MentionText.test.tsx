import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
vi.mock('@calipartner/ui', () => ({ Text: 'Text' }));
import { MentionText } from './MentionText';
it('emphasizes dotted and underscored usernames and preserves surrounding text and email addresses', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<MentionText text={'Hi @pav.one, meet @sam_2\nEmail me@site.com.'} />);
  });
  const mentions = tree.root.findAllByProps({ testID: 'chat-mention-text' });
  expect(mentions.map((node) => node.props.children)).toEqual(['@pav.one', '@sam_2']);
  expect(mentions.every((node) => node.props.style.fontWeight === '700')).toBe(true);
  expect(JSON.stringify(tree.toJSON())).toContain('Email me@site.com.');
  await act(async () => tree.unmount());
});
