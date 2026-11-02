import React from 'react';
import { View } from 'react-native';
import { Button, Card, Text } from '@calipartner/ui';
import { planStyles } from '@/components/onboarding/PlanPrimitives';
import { useFriends } from '@/hooks/useFriends';
import { t } from '@/i18n';

export function FriendRequests({
  tab,
  hideEmpty = false,
}: {
  tab: 'incoming' | 'outgoing';
  hideEmpty?: boolean;
}) {
  const friends = useFriends();
  const people = friends.inbox?.[tab] ?? [];
  return (
    <View style={planStyles.section}>
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
      {!hideEmpty && !friends.loading && !friends.error && !people.length ? (
        <Text>
          {t(
            tab === 'incoming'
              ? 'rooms.inboxModal.emptyIncoming'
              : 'rooms.inboxModal.emptyOutgoing',
          )}
        </Text>
      ) : null}
      {people.map((person) => {
        return (
          <Card key={person.id}>
            <View style={planStyles.gap}>
              <Text>{person.nickname}</Text>
              <Text variant="bodyS">@{person.username}</Text>
              {tab === 'incoming' ? (
                <>
                  <Button
                    variant="secondary"
                    label={t('friends.accept')}
                    disabled={friends.busy}
                    onPress={() => {
                      if (person.request_id)
                        void friends.respond(person.request_id, 'accept', person.id);
                    }}
                    testID={`accept-friend-${person.id}`}
                  />
                  <Button
                    variant="tertiary"
                    label={t('friends.decline')}
                    disabled={friends.busy}
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
                  disabled={friends.busy}
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
