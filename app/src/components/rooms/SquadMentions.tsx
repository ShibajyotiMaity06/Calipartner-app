import { useTheme as useAppearance } from '@calipartner/ui/theme';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, homeLayout, radius, space } from '@calipartner/ui';
import { useRouter } from 'expo-router';
import type { SquadMention } from '@calipartner/core';
import { useSquadMentions } from '@/hooks/useSquad';
import { Ionicons } from '@expo/vector-icons';
import { getSquadMentions, markSquadMentionSeen } from '@/services/squadService';
import { t, getLocale } from '@/i18n';
import { useSquadStyles } from './SquadViews';

export function SquadMentions({ roomId, visible }: { roomId: string; visible: boolean }) {
  const styles = useSquadStyles();

  const { colors: dark } = useAppearance();
  const localStyles = createLocalStyles(dark);

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
  const displayed = useRef<{ roomId: string; ids: Set<string> }>({ roomId, ids: new Set() });
  const [ackError, setAckError] = useState(false);
  const dismiss = async () => {
    setExpanded(false);
    const viewed = displayed.current;
    if (!viewed.ids.size) return;
    setAckError(false);
    const outcomes = await Promise.allSettled(
      [...viewed.ids].map(async (id) => {
        await markSquadMentionSeen(viewed.roomId, id);
        viewed.ids.delete(id);
      }),
    );
    if (active.current !== viewed.roomId) return;
    setAckError(outcomes.some((result) => result.status === 'rejected'));
    void refresh();
  };
  useEffect(() => {
    if (!visible) void dismiss();
    // Visibility closes the disclosure and acknowledges only items it displayed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  useEffect(() => {
    setExpanded(false);
    displayed.current = { roomId, ids: new Set() };
    setAckError(false);
  }, [roomId]);
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
  if (expanded && !data?.locked)
    for (const item of items) displayed.current.ids.add(item.message_id);
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
  if (!data?.count && !ackError) return <View />;
  return (
    <View style={localStyles.triggerGroup}>
      <Pressable
        style={localStyles.trigger}
        onPress={() => setExpanded(true)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        accessibilityLabel={t('squadDesign.mentions', { count: data?.count ?? 0 })}
        testID={`mentions-${roomId}`}
      >
        <Ionicons
          name="notifications-outline"
          size={homeLayout.editIconSize}
          color={dark.textMid}
          accessible={false}
        />
        {!!data?.count && (
          <Text variant="micro" tabular>
            {data.count > 99 ? '99+' : data.count}
          </Text>
        )}
      </Pressable>
      {ackError && (
        <Button
          variant="tertiary"
          label={t('squadDesign.mentionReadError') + ' ' + t('common.retry')}
          onPress={() => void dismiss()}
          testID="retry-mention-seen"
        />
      )}
      <Modal
        visible={expanded}
        transparent
        animationType="none"
        onRequestClose={() => void dismiss()}
      >
        <View style={localStyles.modal}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => void dismiss()}
            accessibilityRole="button"
            accessibilityLabel={t('squadDesign.dismissMentions')}
            testID="dismiss-home-mentions"
          />
          <ScrollView
            style={localStyles.panel}
            contentContainerStyle={localStyles.panelContent}
            accessibilityViewIsModal
          >
            <Button
              variant="tertiary"
              label={t('squadDesign.dismissMentions')}
              onPress={() => void dismiss()}
              testID="close-home-mentions"
            />
            {data?.locked ? (
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
                    onPress={() => {
                      void dismiss();
                      router.push({
                        pathname: '/(tabs)/room',
                        params: { room: roomId, tab: 'chat', mention: item.message_id },
                      });
                    }}
                    style={[styles.card, styles.touch, styles.mentionCard]}
                    accessibilityRole="button"
                    accessibilityLabel={t('squadDesign.openMention', { name: item.nickname })}
                    testID={`open-mention-${item.message_id}`}
                  >
                    <View style={styles.mentionHeader}>
                      <Text variant="label" style={styles.name}>
                        {item.nickname}
                      </Text>
                      <Text variant="micro" tabular>
                        {new Date(item.created_at).toLocaleString(getLocale(), {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <Text variant="label">{item.text}</Text>
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
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const createLocalStyles = (dark: ReturnType<typeof useAppearance>['colors']) =>
  StyleSheet.create({
    triggerGroup: { flexShrink: 1 },
    trigger: {
      minWidth: homeLayout.compactTouchSize,
      minHeight: homeLayout.compactTouchSize,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[1],
    },
    modal: { flex: 1, justifyContent: 'center', padding: space[4] },
    panel: {
      flexGrow: 0,
      maxHeight: '80%',
      backgroundColor: dark.s2,
      borderRadius: radius.card,
      borderColor: dark.copper,
      borderWidth: 1,
    },
    panelContent: { padding: space[3], gap: space[2] },
  });
