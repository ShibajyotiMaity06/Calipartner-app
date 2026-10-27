import React from 'react';
import { View } from 'react-native';
import { Button, Card, Text } from '@calipartner/ui';
import { planStyles } from '@/components/onboarding/PlanPrimitives';
import { useFriends } from '@/hooks/useFriends';
import { t } from '@/i18n';

export function FriendRequests({ tab }: { tab: 'incoming' | 'outgoing' }) {
  const friends = useFriends();
  const people = friends.inbox?.[tab] ?? [];
  return (
    <View style={planStyles.section}>
      <Text variant="heading">{t('socialUpdate.requests')}</Text>
      {friends.loading ? <Text>{t('common.loading')}</Text> : null}
      {friends.error ? (
        <>
          <Text accessibilityRole="alert">{t('friends.genericError')}</Text>
          <Button
            variant="tertiary"
            label={t('friends.retry')}
            onPress={() => void friends.refresh()}
            testID="retry-friend-inbox"
          />
        </>
      ) : null}
      {friends.cached ? <Text>{t('friends.cached')}</Text> : null}
      {!friends.loading && !people.length ? (
        <Text>{t(tab === 'incoming' ? 'friends.incomingEmpty' : 'friends.outgoingEmpty')}</Text>
      ) : null}
      {friends.outbox.some((item) => item.status === 'failed') ? (
        <Text accessibilityRole="alert">{t('friends.failedChanges')}</Text>
      ) : null}
      {people.map((person) => {
        const queued = friends.outbox.some(
          (item) =>
            item.status === 'pending' &&
            (JSON.parse(item.payload) as { p_request_id?: string }).p_request_id ===
              person.request_id,
        );
        return (
          <Card key={person.id}>
            <View style={planStyles.gap}>
              <Text>{person.nickname}</Text>
              <Text variant="bodyS">@{person.username}</Text>
              {queued ? <Text accessibilityLiveRegion="polite">{t('friends.queued')}</Text> : null}
              {tab === 'incoming' ? (
                <>
                  <Button
                    variant="secondary"
                    label={t('friends.accept')}
                    disabled={friends.busy || queued}
                    onPress={() => {
                      if (person.request_id)
                        void friends.respond(person.request_id, 'accept', person.id);
                    }}
                    testID={`accept-friend-${person.id}`}
                  />
                  <Button
                    variant="tertiary"
                    label={t('friends.decline')}
                    disabled={friends.busy || queued}
                    onPress={() => {
                      if (person.request_id)
                        void friends.respond(person.request_id, 'decline', person.id);
                    }}
                    testID={`decline-friend-${person.id}`}
                  />
                </>
              ) : (
                <Button
                  variant="secondary"
                  label={t('friends.cancel')}
                  disabled={friends.busy || queued}
                  onPress={() => {
                    if (person.request_id)
                      void friends.respond(person.request_id, 'cancel', person.id);
                  }}
                  testID={`cancel-friend-${person.id}`}
                />
              )}
            </View>
          </Card>
        );
      })}
    </View>
  );
}
