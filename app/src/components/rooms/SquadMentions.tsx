import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Text } from '@calipartner/ui';
import { useRouter } from 'expo-router';
import type { SquadMention } from '@calipartner/core';
import { useSquadMentions } from '@/hooks/useSquad';
import { getSquadMentions } from '@/services/squadService';
import { t, getLocale } from '@/i18n';
import { squadStyles as styles } from './SquadViews';

export function SquadMentions({ roomId, visible }: { roomId: string; visible: boolean }) {
  const { data, error, refresh } = useSquadMentions(roomId, visible);
  const router = useRouter();
  const [expanded, setExpanded] = useState(false),
    [extra, setExtra] = useState<SquadMention[]>([]),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(false),
    [pageError, setPageError] = useState(false);
  const active = useRef('');
  active.current = roomId;
  const revision = useRef(0);
  useEffect(
    () => () => {
      active.current = '';
    },
    [],
  );
  useEffect(() => {
    revision.current++;
    setBusy(false);
    setExtra([]);
    setMore(data?.has_more ?? false);
    setPageError(false);
  }, [data, roomId]);
  const items = [...(data?.mentions ?? []), ...extra];
  const loadMore = async () => {
    if (busy || !items.length) return;
    const request = revision.current;
    setBusy(true);
    setPageError(false);
    try {
      const page = await getSquadMentions(roomId, items[items.length - 1]);
      if (active.current === roomId && revision.current === request) {
        setExtra((previous) => [
          ...previous,
          ...page.mentions.filter(
            (item) => !items.some((existing) => existing.message_id === item.message_id),
          ),
        ]);
        setMore(page.has_more);
      }
    } catch {
      if (active.current === roomId && revision.current === request) setPageError(true);
    } finally {
      if (active.current === roomId && revision.current === request) setBusy(false);
    }
  };
  if (error)
    return (
      <Button
        variant="tertiary"
        label={t('squadDesign.mentionError') + ' ' + t('common.retry')}
        onPress={() => void refresh()}
        testID={`retry-mentions-${roomId}`}
      />
    );
  if (!data?.count) return null;
  return (
    <View style={styles.stack}>
      <Pressable
        style={styles.touch}
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        accessibilityLabel={t('squadDesign.mentions', { count: data.count })}
        testID={`mentions-${roomId}`}
      >
        <Text>
          {t('squadDesign.mentions', { count: data.count })} {expanded ? '⌃' : '⌄'}
        </Text>
      </Pressable>
      {expanded &&
        (data.locked ? (
          <Button
            variant="secondary"
            label={t('squadDesign.unlock')}
            onPress={() => router.push('/paywall')}
            testID="unlock-mentions"
          />
        ) : (
          <View style={styles.stack}>
            {items.map((item) => (
              <Pressable
                key={item.message_id}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/room',
                    params: { room: roomId, tab: 'chat', mention: item.message_id },
                  })
                }
                style={[styles.card, styles.touch]}
                accessibilityRole="button"
                accessibilityLabel={t('squadDesign.openMention', { name: item.nickname })}
                testID={`open-mention-${item.message_id}`}
              >
                <Text variant="heading">{item.nickname}</Text>
                <Text variant="bodyS">
                  {new Date(item.created_at).toLocaleTimeString(getLocale(), {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
                <Text>{item.text}</Text>
              </Pressable>
            ))}
            {pageError && <Text accessibilityRole="alert">{t('common.errorBody')}</Text>}
            {more && (
              <Button
                variant="tertiary"
                label={busy ? t('common.loading') : t('squadDesign.moreMentions')}
                onPress={() => void loadMore()}
                disabled={busy}
                testID="load-more-mentions"
              />
            )}
          </View>
        ))}
    </View>
  );
}
