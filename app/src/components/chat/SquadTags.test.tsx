import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Image: 'Image',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  View: 'View',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock('./ChatMediaPickerModal', () => ({ ChatMediaPickerModal: 'ChatMediaPickerModal' }));
import { ChatComposer } from './ChatComposer';
let tree: ReactTestRenderer;
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
const members = [{ user_id: 'peer', username: 'pav.one', nickname: 'Pav' }];
it('offers a tag action, inserts the real username, and waits for server acknowledgement before clearing', async () => {
  let acknowledge!: () => void;
  const send = vi.fn(
    () =>
      new Promise<void>((done) => {
        acknowledge = done;
      }),
  );
  await act(async () => {
    tree = create(
      <ChatComposer
        onSend={send}
        mentionMembers={members}
        termsAccepted
        onRequireTerms={vi.fn()}
      />,
    );
  });
  await act(async () =>
    tree.root.findByProps({ testID: 'input-chat-message' }).props.onChangeText('Leg day?'),
  );
  await act(async () => tree.root.findByProps({ testID: 'chat-tag-member' }).props.onPress());
  await act(async () => tree.root.findByProps({ testID: 'tag-member-peer' }).props.onPress());
  expect(tree.root.findByProps({ testID: 'input-chat-message' }).props.value).toBe(
    'Leg day? @pav.one ',
  );
  let sending!: Promise<void>;
  await act(async () => {
    sending = tree.root.findByProps({ testID: 'btn-chat-send' }).props.onPress();
  });
  expect(send).toHaveBeenCalledWith('Leg day? @pav.one', undefined);
  expect(tree.root.findByProps({ testID: 'input-chat-message' }).props.value).toContain('@pav.one');
  await act(async () => {
    acknowledge();
    await sending;
  });
  expect(tree.root.findByProps({ testID: 'input-chat-message' }).props.value).toBe('');
});
it('keeps the tagged message on a failed send so an explicit retry preserves the recipient', async () => {
  const send = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  await act(async () => {
    tree = create(
      <ChatComposer
        onSend={send}
        mentionMembers={members}
        termsAccepted
        onRequireTerms={vi.fn()}
      />,
    );
  });
  await act(async () =>
    tree.root.findByProps({ testID: 'input-chat-message' }).props.onChangeText('@pav'),
  );
  await act(async () => tree.root.findByProps({ testID: 'tag-member-peer' }).props.onPress());
  await act(async () => tree.root.findByProps({ testID: 'btn-chat-send' }).props.onPress());
  expect(tree.root.findByProps({ testID: 'input-chat-message' }).props.value).toBe('@pav.one ');
  await act(async () => tree.root.findByProps({ testID: 'btn-chat-send' }).props.onPress());
  expect(send.mock.calls.map((call) => call[0])).toEqual(['@pav.one', '@pav.one']);
});
