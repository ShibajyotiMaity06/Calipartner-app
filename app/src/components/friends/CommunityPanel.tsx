import React, { useState } from 'react';
import { Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Avatar,
  Button,
  Text,
  onboardingLayout as layout,
  onboardingType,
  radius,
  space,
  useTheme,
} from '@calipartner/ui';
import type { SocialProfile } from '@calipartner/core';
import { useFriendDiscovery, type FriendGoal } from '@/hooks/useFriendDiscovery';
import type { useFriends } from '@/hooks/useFriends';
import { t } from '@/i18n';

type FriendsState = ReturnType<typeof useFriends>;
type Tab = 'discover' | 'requests' | 'friends';

export function CommunityPanel({
  friends,
  onEdit,
  onBack,
  onNotifications,
}: {
  friends: FriendsState;
  onEdit: () => void;
  onBack: () => void;
  onNotifications: () => void;
}) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('discover');
  const [requestTab, setRequestTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [query, setQuery] = useState('');
  const [goal, setGoal] = useState<FriendGoal>(null);
  const [shareError, setShareError] = useState(false);
  const discovery = useFriendDiscovery(goal, query);
  const incoming = friends.inbox?.incoming ?? [];
  const outgoing = friends.inbox?.outgoing ?? [];
  const connected = friends.inbox?.friends ?? [];
  const people = (
    tab === 'discover'
      ? discovery.people
      : tab === 'friends'
        ? connected
        : requestTab === 'incoming'
          ? incoming
          : outgoing
  ).filter(
    (person) =>
      !query || person.username.toLowerCase().includes(query.replace(/^@/, '').toLowerCase()),
  );
  const queuedFor = (person: SocialProfile) =>
    friends.outbox.some((item) => {
      const payload = JSON.parse(item.payload) as {
        p_recipient_id?: string;
        p_request_id?: string;
      };
      return (
        item.status === 'pending' &&
        (payload.p_recipient_id === person.id ||
          Boolean(person.request_id && payload.p_request_id === person.request_id))
      );
    });
  const iconButton = (
    icon: React.ComponentProps<typeof Ionicons>['name'],
    label: string,
    onPress: () => void,
    testID: string,
    disabled = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: pressed ? colors.s2 : colors.bg0 },
      ]}
    >
      <Ionicons name={icon} size={layout.icon} color={disabled ? colors.textLo : colors.textMid} />
    </Pressable>
  );
  const counts = {
    discover: discovery.people.length,
    requests: incoming.length + outgoing.length,
    friends: connected.length,
  };
  return (
    <View style={styles.section} testID="community-panel">
      <View style={styles.row}>
        {iconButton('arrow-back', t('friends.back'), onBack, 'back-from-friends')}
        <View style={styles.flex} />
        {iconButton(
          'notifications-outline',
          t('notifications.title'),
          onNotifications,
          'friend-notification-settings',
        )}
        {iconButton(
          'person-circle-outline',
          t('friends.editProfile'),
          onEdit,
          'edit-social-profile',
          !friends.ownProfile,
        )}
      </View>
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text
            variant="title2"
            fontSet="onboarding"
            color={colors.textHi}
            accessibilityRole="header"
          >
            {t('community.title')}
          </Text>
          <Text variant="bodyS" fontSet="onboarding" color={colors.textMid}>
            {t('community.subtitle')}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('community.invite')}
          disabled={!friends.ownProfile}
          testID="community-invite"
          onPress={() => {
            if (!friends.ownProfile) return;
            setShareError(false);
            void Share.share({
              message: t('community.shareMessage', { username: friends.ownProfile.username }),
            }).catch(() => setShareError(true));
          }}
          style={({ pressed }) => [
            styles.invite,
            { backgroundColor: pressed ? colors.s2 : colors.s1, borderColor: colors.hairline },
          ]}
        >
          <Ionicons name="share-social-outline" size={layout.icon} color={colors.textMid} />
          <Text variant="bodyS" fontSet="onboarding" color={colors.textHi}>
            {t('community.invite')}
          </Text>
        </Pressable>
      </View>
      {shareError ? (
        <Text accessibilityRole="alert" color={colors.danger}>
          {t('community.shareError')}
        </Text>
      ) : null}
      <View style={[styles.search, { backgroundColor: colors.s1, borderColor: colors.hairline }]}>
        <Ionicons name="search-outline" size={layout.icon} color={colors.textMid} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          accessibilityLabel={t('friends.searchLabel')}
          placeholder={t('community.search')}
          placeholderTextColor={colors.textLo}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={21}
          testID="friend-username-search"
          style={[styles.input, { color: colors.textHi }]}
        />
      </View>
      <View
        style={[styles.tabs, { backgroundColor: colors.s1, borderColor: colors.hairline }]}
        accessibilityRole="tablist"
      >
        {(['discover', 'requests', 'friends'] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
            onPress={() => setTab(value)}
            testID={`community-tab-${value}`}
            style={({ pressed }) => [
              styles.tab,
              { backgroundColor: tab === value || pressed ? colors.s2 : colors.s1 },
            ]}
          >
            <Text
              variant="bodyS"
              fontSet="onboarding"
              color={tab === value ? colors.textHi : colors.textMid}
            >
              {t(`community.${value}`)}
            </Text>
            <Text variant="bodyS" fontSet="onboarding" tabular color={colors.textMid}>
              {counts[value]}
            </Text>
          </Pressable>
        ))}
      </View>
      {tab === 'discover' ? (
        <View style={styles.filters} accessibilityRole="radiogroup">
          {([null, 'bulk', 'cut', 'maintain'] as const).map((value) => (
            <Pressable
              key={value ?? 'all'}
              accessibilityRole="radio"
              accessibilityState={{ checked: goal === value }}
              testID={`community-goal-${value ?? 'all'}`}
              onPress={() => setGoal(value)}
              style={({ pressed }) => [
                styles.filter,
                {
                  backgroundColor: goal === value || pressed ? colors.s2 : colors.bg0,
                  borderColor: goal === value ? colors.hairlineLit : colors.hairline,
                },
              ]}
            >
              <Text variant="bodyS" fontSet="onboarding" color={colors.textMid}>
                {t(
                  value === 'bulk'
                    ? 'socialUpdate.bulk'
                    : value === 'cut'
                      ? 'socialUpdate.cut'
                      : value === 'maintain'
                        ? 'socialUpdate.maintain'
                        : 'socialUpdate.all',
                )}
                {goal === value ? ' \u2713' : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {tab === 'requests' ? (
        <View style={styles.filters}>
          {(['incoming', 'outgoing'] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: requestTab === value }}
              testID={`community-requests-${value}`}
              onPress={() => setRequestTab(value)}
              style={[
                styles.filter,
                {
                  backgroundColor: requestTab === value ? colors.s2 : colors.bg0,
                  borderColor: colors.hairline,
                },
              ]}
            >
              <Text variant="bodyS" fontSet="onboarding" color={colors.textHi}>
                {t(`rooms.inboxModal.${value}Tab`)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.header}>
        <Text
          variant="bodyS"
          fontSet="onboarding"
          color={colors.textMid}
          tabular
          accessibilityRole="header"
        >
          {t(
            tab === 'discover'
              ? 'community.suggested'
              : tab === 'friends'
                ? 'community.friendsCount'
                : 'community.requestsCount',
            { count: people.length },
          )}
        </Text>
        <Text variant="bodyS" fontSet="onboarding" color={colors.textLo}>
          {t('community.tapProfile')}
        </Text>
      </View>
      {tab === 'discover' && discovery.loading ? (
        <Text accessibilityLiveRegion="polite">{t('common.loading')}</Text>
      ) : null}
      {tab === 'discover' && discovery.cached ? <Text>{t('friends.cached')}</Text> : null}
      {tab === 'discover' && discovery.error ? (
        <>
          <Text accessibilityRole="alert" color={colors.danger}>
            {t('friends.genericError')}
          </Text>
          <Button
            variant="tertiary"
            label={t('friends.retry')}
            onPress={() => void discovery.load()}
            testID="retry-community-discovery"
          />
        </>
      ) : null}
      {!people.length &&
      !(tab === 'discover'
        ? discovery.loading || discovery.error
        : friends.loading || friends.error) ? (
        <Text color={colors.textMid}>
          {t(
            query
              ? 'friends.searchEmpty'
              : tab === 'discover'
                ? 'community.empty'
                : tab === 'friends'
                  ? 'friends.friendsEmpty'
                  : requestTab === 'incoming'
                    ? 'rooms.inboxModal.emptyIncoming'
                    : 'rooms.inboxModal.emptyOutgoing',
          )}
        </Text>
      ) : null}
      {people.map((person) => {
        const queued = queuedFor(person);
        const request = (action: 'accept' | 'decline' | 'cancel') => {
          if (person.request_id) void friends.respond(person.request_id, action, person.id);
        };
        return (
          <View
            key={person.id}
            style={[styles.person, { backgroundColor: colors.s1, borderColor: colors.hairline }]}
            testID={`community-person-${person.id}`}
          >
            <Pressable
              onPress={() => void friends.openProfile(person)}
              accessibilityRole="button"
              accessibilityLabel={t('community.profileLabel', { name: person.nickname })}
              testID={`view-profile-${person.id}`}
              style={({ pressed }) => [
                styles.profile,
                { backgroundColor: pressed ? colors.s2 : colors.s1 },
              ]}
            >
              <Avatar name={person.nickname} uri={person.avatar_url} />
              <View style={styles.identity}>
                <Text fontSet="onboarding" variant="heading" color={colors.textHi}>
                  {person.nickname}
                </Text>
                <Text fontSet="onboarding" variant="bodyS" color={colors.textMid}>
                  @{person.username}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={layout.icon} color={colors.textLo} />
            </Pressable>
            <View style={styles.actions}>
              {tab === 'requests' ? (
                <>
                  <Button
                    variant="secondary"
                    label={t(
                      queued
                        ? 'community.queued'
                        : requestTab === 'incoming'
                          ? 'community.accept'
                          : 'community.cancel',
                    )}
                    disabled={friends.busy || queued}
                    onPress={() => request(requestTab === 'incoming' ? 'accept' : 'cancel')}
                    testID={`${requestTab === 'incoming' ? 'accept' : 'cancel'}-friend-${person.id}`}
                  />
                  {requestTab === 'incoming' ? (
                    <Button
                      variant="tertiary"
                      label={t('community.decline')}
                      disabled={friends.busy || queued}
                      onPress={() => request('decline')}
                      testID={`decline-friend-${person.id}`}
                    />
                  ) : null}
                </>
              ) : person.relationship === 'none' && !connected.some((p) => p.id === person.id) ? (
                <Button
                  variant="secondary"
                  label={t(
                    queued
                      ? 'community.queued'
                      : outgoing.some((p) => p.id === person.id)
                        ? 'community.sent'
                        : 'community.add',
                  )}
                  disabled={
                    friends.busy ||
                    queued ||
                    outgoing.some((p) => p.id === person.id) ||
                    friends.inbox?.quota.remaining === 0
                  }
                  onPress={() => void friends.send(person.id).then(() => discovery.load())}
                  testID={`send-friend-${person.id}`}
                />
              ) : (
                <Text variant="bodyS" fontSet="onboarding" color={colors.textMid}>
                  {t(
                    person.relationship === 'friends' || tab === 'friends'
                      ? 'community.connected'
                      : person.relationship === 'incoming'
                        ? 'community.received'
                        : 'community.sent',
                  )}
                </Text>
              )}
            </View>
          </View>
        );
      })}
      {tab === 'discover' && discovery.hasMore ? (
        <Button
          variant="tertiary"
          label={t('socialUpdate.more')}
          disabled={discovery.loading}
          onPress={() => void discovery.load(true)}
          testID="load-more-friends"
        />
      ) : null}
      {friends.inbox?.quota.remaining === 0 && !friends.inbox.quota.premium ? (
        <Text>{t('friends.weeklyLimit')}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space[4] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  flex: { flex: 1 },
  heading: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 'auto',
    maxWidth: '100%',
    minWidth: layout.touch,
    gap: space[1],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[3],
    justifyContent: 'space-between',
  },
  iconButton: {
    minWidth: layout.touch,
    minHeight: layout.touch,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invite: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[2],
    borderRadius: radius.full,
    borderWidth: layout.border,
    minHeight: layout.touch,
    padding: space[3],
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    borderRadius: radius.card,
    borderWidth: layout.border,
    paddingHorizontal: space[4],
  },
  input: {
    ...onboardingType.body,
    fontVariant: undefined,
    flex: 1,
    minWidth: 0,
    minHeight: layout.touch,
    paddingVertical: space[3],
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: radius.card,
    borderWidth: layout.border,
    padding: space[1],
    gap: space[1],
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    minHeight: layout.touch,
    padding: space[2],
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  filter: {
    minHeight: layout.touch,
    padding: space[3],
    borderRadius: radius.full,
    borderWidth: layout.border,
    justifyContent: 'center',
  },
  person: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    borderRadius: radius.card,
    borderWidth: layout.border,
  },
  profile: {
    flexDirection: 'row',
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 'auto',
    maxWidth: '100%',
    alignItems: 'center',
    minHeight: layout.touch,
    gap: space[3],
    borderRadius: radius.control,
  },
  identity: { flex: 1, minWidth: 0, gap: space[1] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] },
});
