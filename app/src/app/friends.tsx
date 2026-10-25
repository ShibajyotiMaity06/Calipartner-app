import React, { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar, Button, Card, Text, useTheme } from '@calipartner/ui';
import type { SocialProfile } from '@calipartner/core';
import { PlanTextField, planStyles } from '@/components/onboarding/PlanPrimitives';
import { SocialProfileEditor } from '@/components/friends/SocialProfileEditor';
import { PublicSocialProfile } from '@/components/friends/PublicSocialProfile';
import { PaywallModal } from '@/components/rooms/PaywallModal';
import { useFriends } from '@/hooks/useFriends';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/i18n';

export default function FriendsScreen() {
  const { user } = useAuth();
  return <FriendsView key={user?.id ?? 'guest'} />;
}

function FriendsView() {
  const friends = useFriends();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ edit?: string }>();
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [editing, setEditing] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const openedEditor = useRef(false);
  useEffect(() => {
    if (params.edit === '1' && friends.ownProfile && !openedEditor.current) {
      openedEditor.current = true;
      setEditing(true);
    }
  }, [params.edit, friends.ownProfile]);
  const errorLabel = friends.error?.includes('INVALID_QUERY')
    ? t('friends.queryError')
    : friends.error?.includes('PROFILE_UNAVAILABLE')
      ? t('friends.unavailable')
      : t('friends.genericError');
  const pending = friends.outbox.filter((item) => item.status === 'pending');
  const selected = friends.selected;
  const queued = Boolean(
    selected &&
    pending.some((item) => {
      const payload = JSON.parse(item.payload) as Record<string, unknown>;
      return (
        payload.p_recipient_id === selected.id ||
        (selected.request_id && payload.p_request_id === selected.request_id)
      );
    }),
  );
  const showUpgrade = () => {
    friends.closeProfile();
    setPaywall(true);
  };
  const list = (people: SocialProfile[], empty: string) => (
    <View style={planStyles.section}>
      {people.length ? (
        people.map((person) => (
          <Card key={person.id}>
            <View style={planStyles.gap}>
              <View style={planStyles.row}>
                <Avatar name={person.nickname} uri={person.avatar_url} />
                <View style={planStyles.flex}>
                  <Text variant="heading">{person.nickname}</Text>
                  <Text variant="bodyS">@{person.username}</Text>
                </View>
              </View>
              <Button
                variant="secondary"
                label={t('friends.viewProfile')}
                onPress={() => void friends.openProfile(person)}
                testID={`view-profile-${person.id}`}
              />
            </View>
          </Card>
        ))
      ) : (
        <Text variant="bodyS">{empty}</Text>
      )}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg0 }}>
      <ScrollView
        contentContainerStyle={planStyles.reviewContent}
        keyboardShouldPersistTaps="handled"
        testID="friends-screen"
      >
        <Button
          variant="tertiary"
          label={t('friends.back')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
          testID="back-from-friends"
        />
        <Text variant="title2" accessibilityRole="header">
          {t('friends.title')}
        </Text>
        {!friends.signedIn ? (
          <Button
            label={t('friends.signIn')}
            onPress={() => router.push('/auth/sign-in')}
            testID="friends-sign-in"
          />
        ) : (
          <>
            <Text>{t('friends.intro')}</Text>
            <Button
              variant="secondary"
              label={t('friends.editProfile')}
              disabled={!friends.ownProfile}
              onPress={() => setEditing(true)}
              testID="edit-social-profile"
            />
            {friends.loading ? (
              <Text accessibilityLiveRegion="polite">{t('common.loading')}</Text>
            ) : null}
            {friends.cached ? <Text variant="bodyS">{t('friends.cached')}</Text> : null}
            {friends.error ? (
              <Text accessibilityRole="alert" color={colors.danger}>
                {errorLabel}
              </Text>
            ) : null}
            <Button
              variant="tertiary"
              label={t('friends.retry')}
              onPress={() => void friends.refresh()}
              testID="refresh-friends"
            />
            {pending.length ? (
              <Text accessibilityLiveRegion="polite">
                {t('friends.pendingChanges', { count: pending.length })}
              </Text>
            ) : null}
            {friends.outbox
              .filter((item) => item.status === 'failed')
              .map((item) => (
                <Card key={item.id}>
                  <View style={planStyles.gap}>
                    <Text accessibilityRole="alert">
                      {item.last_error?.includes('FRIEND_WEEKLY_LIMIT')
                        ? t('friends.weeklyLimit')
                        : t('friends.failedChanges')}
                    </Text>
                    {item.last_error?.includes('FRIEND_WEEKLY_LIMIT') ? (
                      <Button
                        variant="secondary"
                        label={t('friends.upgrade')}
                        onPress={showUpgrade}
                        testID="upgrade-queued-friend-request"
                      />
                    ) : null}
                    <Button
                      variant="tertiary"
                      label={t('friends.dismiss')}
                      onPress={() => void friends.dismiss(item.id)}
                      testID={`dismiss-social-${item.id}`}
                    />
                  </View>
                </Card>
              ))}
            <Text variant="bodyS" tabular>
              {friends.inbox?.quota.premium
                ? t('friends.premiumQuota')
                : friends.inbox
                  ? t('friends.quota', { remaining: friends.inbox.quota.remaining ?? 0 })
                  : t('friends.quotaUnknown')}
            </Text>
            <PlanTextField
              label={t('friends.searchLabel')}
              placeholder={t('friends.searchPlaceholder')}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={21}
              onSubmitEditing={() => {
                setSearched(true);
                void friends.search(query);
              }}
              testID="friend-username-search"
            />
            <Button
              label={friends.searching ? t('common.loading') : t('friends.search')}
              disabled={friends.searching}
              onPress={() => {
                setSearched(true);
                void friends.search(query);
              }}
              testID="search-friends"
            />
            {list(friends.results, t(searched ? 'friends.searchEmpty' : 'friends.searchHint'))}
            <Text variant="heading" accessibilityRole="header">
              {t('friends.incoming')}
            </Text>
            {list(friends.inbox?.incoming ?? [], t('friends.incomingEmpty'))}
            <Text variant="heading" accessibilityRole="header">
              {t('friends.outgoing')}
            </Text>
            {list(friends.inbox?.outgoing ?? [], t('friends.outgoingEmpty'))}
            <Text variant="heading" accessibilityRole="header">
              {t('friends.title')}
            </Text>
            {list(friends.inbox?.friends ?? [], t('friends.friendsEmpty'))}
          </>
        )}
      </ScrollView>
      {editing && friends.ownProfile ? (
        <SocialProfileEditor
          profile={friends.ownProfile}
          busy={friends.busy}
          onClose={() => setEditing(false)}
          onSave={friends.save}
        />
      ) : null}
      {selected ? (
        <PublicSocialProfile
          key={selected.id}
          profile={selected}
          busy={friends.busy}
          queued={queued}
          limitReached={friends.inbox?.quota.remaining === 0 && !friends.inbox.quota.premium}
          onClose={friends.closeProfile}
          onSend={() => void friends.send(selected.id)}
          onRespond={(action) => {
            if (selected.request_id) void friends.respond(selected.request_id, action, selected.id);
          }}
          onUpgrade={showUpgrade}
          onBlock={() => {
            void friends.block(selected.id);
            friends.closeProfile();
          }}
          onReport={() => {
            setReportTarget(selected.id);
            friends.closeProfile();
          }}
        />
      ) : null}
      {reportTarget ? (
        <Modal visible onRequestClose={() => setReportTarget(null)} animationType="slide">
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg0 }}>
            <ScrollView
              contentContainerStyle={planStyles.reviewContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text variant="title2">{t('friends.report')}</Text>
              {friends.error ? (
                <Text accessibilityRole="alert" color={colors.danger}>
                  {t('friends.genericError')}
                </Text>
              ) : null}
              <PlanTextField
                label={t('rooms.reportModal.reasonOther')}
                value={reason}
                onChangeText={setReason}
                maxLength={100}
                testID="social-report-reason"
              />
              <PlanTextField
                label={t('rooms.reportModal.detailsPlaceholder')}
                value={details}
                onChangeText={setDetails}
                multiline
                maxLength={2000}
                testID="social-report-details"
              />
              <Button
                label={t('friends.report')}
                disabled={friends.busy || !reason.trim()}
                onPress={() =>
                  void friends.report(reportTarget, reason, details).then((saved) => {
                    if (saved) {
                      setReportTarget(null);
                      setReason('');
                      setDetails('');
                    }
                  })
                }
                testID="submit-social-report"
              />
              <Button
                variant="secondary"
                label={t('friends.close')}
                onPress={() => setReportTarget(null)}
                testID="close-social-report"
              />
            </ScrollView>
          </SafeAreaView>
        </Modal>
      ) : null}
      <PaywallModal
        visible={paywall}
        onClose={() => setPaywall(false)}
        context="general"
        preselectedTier="plus"
        onSuccess={() => {
          setPaywall(false);
          void friends.refresh();
        }}
      />
    </SafeAreaView>
  );
}
