import { type as inputTypography } from '@calipartner/ui';
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
import { useFriendDiscovery } from '@/hooks/useFriendDiscovery';
import type { useFriends } from '@/hooks/useFriends';
import { t } from '@/i18n';
import { LoadingState } from '@/components/LoadingState';
import { FriendActions } from './FriendActions';

type FriendsState = ReturnType<typeof useFriends>;
type Tab = 'discover' | 'requests' | 'friends';

export function CommunityPanel({
  friends,
  embedded: _embedded = false,
  onEdit,
  onBack,
  onNotifications,
}: {
  friends: FriendsState;
  embedded?: boolean;
  onEdit: () => void;
  onBack: () => void;
  onNotifications: () => void;
}) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('discover');
  const [requestTab, setRequestTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [query, setQuery] = useState('');
  const [shareError, setShareError] = useState(false);
  const [resolved, setResolved] = useState(new Set<string>());
  const [actionStatus, setActionStatus] = useState('');
  const friendshipKey = (person: SocialProfile) => `${person.id}:${person.request_id ?? ''}`;
  const discovery = useFriendDiscovery(null, query);
  const incoming = friends.inbox?.incoming ?? [];
  const outgoing = friends.inbox?.outgoing ?? [];
  const connected = (friends.inbox?.friends ?? []).filter(
    (person) => !resolved.has(friendshipKey(person)),
  );
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
      !resolved.has(friendshipKey(person)) &&
      (!query || person.username.toLowerCase().includes(query.replace(/^@/, '').toLowerCase())),
  );
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
    requests: incoming.length,
    friends: connected.length,
  };
  return (
    <View style={styles.section} testID="community-panel" accessibilityLabel={t('community.title')}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('friends.back')}
          onPress={onBack}
          testID="back-from-friends"
          style={styles.backButtonContainer}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textHi} />
          <Text variant="title1" color={colors.textHi} accessibilityRole="header">
            {t('community.friends')}
          </Text>
        </Pressable>
        <View style={styles.flex} />
        {iconButton(
          'notifications-outline',
          t('notifications.title'),
          onNotifications,
          'friend-notification-settings',
        )}
        {iconButton(
          'person-add-outline',
          t('community.invite'),
          () => {
            if (!friends.ownProfile) return;
            setShareError(false);
            void Share.share({
              message: t('community.shareMessage', { username: friends.ownProfile.username }),
            }).catch(() => setShareError(true));
          },
          'community-invite',
          !friends.ownProfile,
        )}
        {iconButton(
          'person-circle-outline',
          t('friends.editProfile'),
          onEdit,
          'edit-social-profile',
          !friends.ownProfile,
        )}
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
          style={[
            [styles.input, { color: colors.textHi }],
            { fontFamily: inputTypography.body.fontFamily },
          ]}
        />
      </View>
      <View style={[styles.tabBar, { borderBottomColor: colors.hairline }]} testID="community-tab">
        {(['friends', 'requests', 'discover'] as const).map((value) => {
          const active = tab === value;
          const count = counts[value];
          const hasCount = value === 'requests' ? count > 0 : count !== undefined && count > 0;
          const label = `${t(`community.${value}`)}${hasCount ? ` (${count})` : ''}`;
          return (
            <Pressable
              key={value}
              onPress={() => setTab(value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              testID={`community-tab-${value}`}
              style={styles.tabItem}
            >
              <Text
                variant="body"
                color={active ? colors.textHi : colors.textMid}
                style={active ? styles.tabTextActive : undefined}
              >
                {label}
              </Text>
              {active ? (
                <View style={[styles.tabIndicator, { backgroundColor: colors.apricot }]} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {tab === 'requests' ? (
        <View style={styles.requestSubTabs} testID="community-requests">
          {(['incoming', 'outgoing'] as const).map((value) => {
            const active = requestTab === value;
            const count = value === 'incoming' ? incoming.length : outgoing.length;
            return (
              <Pressable
                key={value}
                onPress={() => setRequestTab(value)}
                accessibilityRole="button"
                testID={`community-requests-${value}`}
                style={[
                  styles.requestChip,
                  {
                    backgroundColor: active ? colors.s2 : 'transparent',
                    borderColor: active ? colors.apricot : colors.hairline,
                  },
                ]}
              >
                <Text
                  variant="bodyS"
                  color={active ? colors.textHi : colors.textLo}
                  style={active ? styles.tabTextActive : undefined}
                >
                  {t(`rooms.inboxModal.${value}Tab`)} ({count})
                </Text>
              </Pressable>
            );
          })}
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
              ? query.trim()
                ? 'compactProfile.searchResults'
                : 'compactProfile.searchResults'
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
      {tab === 'discover' && discovery.loading ? <LoadingState /> : null}
      {tab === 'discover' && !query.trim() && (
        <Text variant="bodyS">{t('foodPolish.suggestions')}</Text>
      )}
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
                ? 'foodPolish.suggestionsEmpty'
                : tab === 'friends'
                  ? 'friends.friendsEmpty'
                  : requestTab === 'incoming'
                    ? 'rooms.inboxModal.emptyIncoming'
                    : 'rooms.inboxModal.emptyOutgoing',
          )}
        </Text>
      ) : null}
      {people.map((person) => {
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
            <View
              style={[
                styles.actions,
                tab === 'friends' && { width: '100%' },
                tab === 'requests' && requestTab === 'outgoing' && styles.outgoingActions,
              ]}
            >
              {tab === 'friends' ? (
                <FriendActions
                  person={person}
                  busy={friends.busy}
                  onConfirm={(action) =>
                    action === 'block'
                      ? friends.block(person.id)
                      : person.request_id
                        ? friends.respond(person.request_id, 'remove', person.id)
                        : Promise.resolve(false)
                  }
                  onResolved={(action) => {
                    setResolved((previous) => new Set(previous).add(friendshipKey(person)));
                    setActionStatus(
                      t(action === 'remove' ? 'friends.removedNamed' : 'friends.blockedNamed', {
                        name: person.nickname,
                      }),
                    );
                    void discovery.load();
                  }}
                />
              ) : tab === 'requests' ? (
                <>
                  <Button
                    variant={requestTab === 'incoming' ? 'secondary' : 'cancel'}
                    label={t(requestTab === 'incoming' ? 'community.accept' : 'community.cancel')}
                    disabled={friends.busy}
                    onPress={() => request(requestTab === 'incoming' ? 'accept' : 'cancel')}
                    testID={`${requestTab === 'incoming' ? 'accept' : 'cancel'}-friend-${person.id}`}
                  />
                  {requestTab === 'incoming' ? (
                    <Button
                      variant="tertiary"
                      label={t('community.decline')}
                      disabled={friends.busy}
                      onPress={() => request('decline')}
                      testID={`decline-friend-${person.id}`}
                    />
                  ) : null}
                </>
              ) : person.relationship === 'none' && !connected.some((p) => p.id === person.id) ? (
                <Button
                  variant="secondary"
                  label={t(
                    outgoing.some((p) => p.id === person.id) ? 'community.sent' : 'community.add',
                  )}
                  disabled={
                    friends.busy ||
                    outgoing.some((p) => p.id === person.id) ||
                    friends.inbox?.quota.remaining === 0
                  }
                  onPress={() => void friends.send(person.id).then(() => discovery.load())}
                  testID={`send-friend-${person.id}`}
                />
              ) : (
                <Text variant="bodyS" fontSet="onboarding" color={colors.textMid}>
                  {t(
                    person.relationship === 'friends'
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
      {actionStatus && (
        <Text variant="bodyS" accessibilityLiveRegion="polite" testID="friend-action-status">
          {actionStatus}
        </Text>
      )}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: layout.touch,
  },
  backButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    marginTop: space[1],
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[3],
    position: 'relative',
    minHeight: 44,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: space[3],
    right: space[3],
    height: 3,
    borderRadius: radius.full,
  },
  tabTextActive: {
    fontWeight: '700',
  },
  requestSubTabs: {
    flexDirection: 'row',
    gap: space[2],
    paddingVertical: space[2],
  },
  requestChip: {
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
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
  outgoingActions: { width: '100%', flexDirection: 'column' },
});
