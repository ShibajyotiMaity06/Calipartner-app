import React from 'react';
import { Text } from '@calipartner/ui';

/** Keep the original text intact; only standalone @usernames receive emphasis. */
export function MentionText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const mentions = /(^|\s)(@[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)/g;
  let end = 0;
  for (const match of text.matchAll(mentions)) {
    const username = match[2]!;
    const start = match.index! + match[1]!.length;
    parts.push(text.slice(end, start));
    parts.push(
      <Text
        key={start}
        variant="label"
        color="apricot"
        style={{ fontWeight: '700' }}
        testID="chat-mention-text"
      >
        {username}
      </Text>,
    );
    end = start + username.length;
  }
  parts.push(text.slice(end));
  return <>{parts}</>;
}
