import { FriendsContent } from '@/components/friends/FriendsContent';
import { HeaderActions } from '@/components/HeaderActions';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Pressable, TextInput, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import {
  Text,
  Button,
  space,
  radius,
  homeLayout,
  useTheme,
  SegmentedControl,
} from '@calipartner/ui';
import { useRooms } from '@/hooks/useRooms';
import { useAuth } from '@/contexts/AuthContext';
import { getChatMessages, getChatUnreadCount } from '@/services/chatService';
import { getSupabase } from '@/lib/supabase';
import { getDb } from '@/db';
import { LoadingState } from '@/components/LoadingState';
import { t, getLocale } from '@/i18n';
import type { RoomSummary } from '@/types/rooms';
function Conversation({ room }: { room: RoomSummary }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<{ text: string; date?: string; unread: number } | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setFailed(false);
    void (async () => {
      const db = await getDb();
      const [messages, unread] = await Promise.all([
        getChatMessages(getSupabase(), db, room.id, { limit: 1, ownerId: user?.id }),
        getChatUnreadCount(getSupabase(), room.id),
      ]);
      const last = messages.at(-1);
      if (active)
        setSummary({
          text: last?.deleted_at ? t('chat.deletedMessage') : (last?.text ?? ''),
          date: last?.created_at,
          unread,
        });
    })().catch(() => {
      if (active) setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [room.id, user?.id]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={room.name}
      testID={`chat-thread-${room.id}`}
      onPress={() =>
        router.push({
          pathname: '/(tabs)/room',
          params: { room: room.id, tab: 'chat', chat: 'open', returnTo: 'chat' },
        })
      }
      style={[styles.row, { borderColor: colors.hairline }]}
    >
      <View style={styles.flex}>
        <Text variant="heading">{room.name}</Text>
        <Text variant="bodyS" color={colors.textMid}>
          {failed
            ? t('common.errorBody')
            : summary?.text ||
              t('homeRefresh.members', {
                count: room.member_count,
                cap: room.member_cap ?? room.member_count,
              })}
        </Text>
      </View>
      <View>
        <Text variant="micro">
          {summary?.date ? new Date(summary.date).toLocaleDateString(getLocale()) : ''}
        </Text>
        {summary && summary.unread > 0 ? <Text tabular>{summary.unread}</Text> : null}
      </View>
    </Pressable>
  );
}
export default function ChatScreen() {
  const { colors } = useTheme();
  const { rooms, loading, error, refresh } = useRooms();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'chat' | 'friends'>(params.tab === 'friends' ? 'friends' : 'chat');
  useEffect(() => {
    if (params.tab === 'friends') setTab('friends');
  }, [params.tab]);
  const [query, setQuery] = useState('');
  const [revision, setRevision] = useState(0);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      setRevision((n) => n + 1);
    }, [refresh]),
  );
  const filtered = rooms.filter((r) =>
    r.name.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()),
  );
  return (
    <View testID="chat-screen-shell" style={{ flex: 1, backgroundColor: colors.bg0 }}>
      <View style={styles.tabs}>
        <View style={styles.header}>
          <Text variant="title1" style={styles.flex}>
            {t('avatar.chats')}
          </Text>
          <HeaderActions />
        </View>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'chat', label: t('rooms.segments.chat') },
            { value: 'friends', label: t('community.friends') },
          ]}
          testID="chat-friends-tabs"
        />
      </View>
      {tab === 'friends' ? (
        <FriendsContent embedded />
      ) : (
        <ScrollView
          style={{ backgroundColor: colors.bg0 }}
          contentContainerStyle={styles.content}
          testID="screen-chat"
        >
          <TextInput
            value={query}
            onChangeText={setQuery}
            accessibilityLabel={t('avatar.searchChats')}
            placeholder={t('avatar.searchChats')}
            placeholderTextColor={colors.textLo}
            style={[styles.search, { color: colors.textHi, backgroundColor: colors.s1 }]}
            testID="chat-search"
          />
          {loading && !rooms.length ? (
            <LoadingState />
          ) : error ? (
            <Button
              variant="secondary"
              label={t('common.retry')}
              onPress={() => void refresh()}
              testID="chat-retry"
            />
          ) : !filtered.length ? (
            <Text>{t(rooms.length ? 'avatar.noMatches' : 'avatar.noChats')}</Text>
          ) : null}
          {[false, true].map((pair) => (
            <View key={String(pair)}>
              {pair && filtered.some((r) => r.member_cap === 2) ? (
                <Text variant="heading">{t('avatar.partners')}</Text>
              ) : null}
              {filtered
                .filter((r) => (r.member_cap === 2) === pair)
                .map((room) => (
                  <Conversation key={`${room.id}-${revision}`} room={room} />
                ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  tabs: {
    padding: space[4],
    width: '100%',
    maxWidth: homeLayout.maxContentWidth,
    alignSelf: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  content: {
    padding: space[4],
    paddingBottom: homeLayout.touchSize * 3,
    gap: space[4],
    width: '100%',
    maxWidth: homeLayout.maxContentWidth,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: space[3],
    paddingVertical: space[4],
    borderBottomWidth: 1,
    minHeight: homeLayout.touchSize,
  },
  flex: { flex: 1, gap: space[1] },
  search: { minHeight: homeLayout.touchSize, padding: space[3], borderRadius: radius.control },
});
