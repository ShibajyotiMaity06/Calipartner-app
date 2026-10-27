import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Avatar, Button, Card, Text, onboardingLayout } from '@calipartner/ui';
import type { SocialProfile } from '@calipartner/core';
import { PlanTextField, planStyles } from '@/components/onboarding/PlanPrimitives';
import { t } from '@/i18n';

export type ConnectChoice = 'create-squad' | 'join-squad';
export interface SquadConnectFlowProps {
  isPlusOrPro: boolean;
  memberCap?: number;
  friends?: SocialProfile[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onFindFriend?: () => void;
  onOpenPaywall: () => void;
  onCreateSquad: (
    name: string,
    friendIds: string[],
  ) => Promise<{ room_id: string; code?: string } | void>;
  onJoinSquad: () => void;
  onSquadCreatedAndReady?: (roomId: string) => void;
  testID?: string;
}
export function SquadConnectFlow({
  isPlusOrPro,
  memberCap = isPlusOrPro ? 5 : 2,
  friends = [],
  loading,
  error,
  onRetry,
  onFindFriend,
  onOpenPaywall,
  onCreateSquad,
  onJoinSquad,
  onSquadCreatedAndReady,
  testID = 'squad-connect-flow',
}: SquadConnectFlowProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const submitting = useRef(false);
  const submit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setFailed(null);
    try {
      const result = await onCreateSquad(name.trim(), selected);
      if (result) onSquadCreatedAndReady?.(result.room_id);
    } catch (err) {
      setFailed(
        err instanceof Error && err.message.includes('HOSTED_ROOM_LIMIT')
          ? t('setup.hostRoomLimit')
          : t('socialUpdate.createError'),
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <ScrollView contentContainerStyle={planStyles.reviewContent} testID={testID}>
      <Text variant="title1">{t(creating ? 'socialUpdate.create' : 'socialUpdate.connect')}</Text>
      {!creating ? (
        <>
          <Text>{t('socialUpdate.choose')}</Text>
          <Button
            label={t('socialUpdate.create')}
            onPress={() => setCreating(true)}
            testID="option-create-squad"
          />
          <Button
            variant="secondary"
            label={t('socialUpdate.join')}
            onPress={onJoinSquad}
            testID="option-join-squad"
          />
          <Button
            variant="tertiary"
            label={t('socialUpdate.addFriends')}
            onPress={onFindFriend}
            testID="squad-add-friends"
          />
        </>
      ) : (
        <>
          <Button
            variant="tertiary"
            label={t('friends.back')}
            disabled={busy}
            onPress={() => setCreating(false)}
            testID="squad-back"
          />
          <Button
            variant="secondary"
            label={t('socialUpdate.addFriends')}
            disabled={busy}
            onPress={onFindFriend}
            testID="squad-add-friends"
          />
          <PlanTextField
            label={t('rooms.createModal.title')}
            value={name}
            onChangeText={setName}
            maxLength={100}
            editable={!busy}
            testID="squad-name"
          />
          <Text variant="heading">{t('socialUpdate.selectFriends')}</Text>
          <Text>{t('socialUpdate.capacity', { count: memberCap - 1 })}</Text>
          {loading ? <Text accessibilityLiveRegion="polite">{t('common.loading')}</Text> : null}
          {error ? (
            <>
              <Text accessibilityRole="alert">{t('friends.genericError')}</Text>
              <Button
                variant="tertiary"
                label={t('friends.retry')}
                onPress={onRetry}
                testID="squad-retry-friends"
              />
            </>
          ) : null}
          {!loading && !error && !friends.length ? <Text>{t('friends.friendsEmpty')}</Text> : null}
          {friends.map((person) => (
            <Card key={person.id}>
              <Pressable
                style={[planStyles.row, { minHeight: onboardingLayout.touch }]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected.includes(person.id), disabled: busy }}
                accessibilityLabel={t(
                  selected.includes(person.id) ? 'socialUpdate.selected' : 'socialUpdate.select',
                  { name: person.nickname },
                )}
                disabled={busy}
                onPress={() => {
                  if (selected.includes(person.id))
                    setSelected((previous) => previous.filter((id) => id !== person.id));
                  else if (selected.length >= memberCap - 1) onOpenPaywall();
                  else setSelected((previous) => [...previous, person.id]);
                }}
                testID={`squad-friend-${person.id}`}
              >
                <Avatar name={person.nickname} uri={person.avatar_url} />
                <View style={planStyles.flex}>
                  <Text>{person.nickname}</Text>
                  <Text variant="bodyS">@{person.username}</Text>
                </View>
                <Text>{selected.includes(person.id) ? '\u2713' : ''}</Text>
              </Pressable>
            </Card>
          ))}
          {!isPlusOrPro ? (
            <Button
              variant="secondary"
              label={t('socialUpdate.upgrade')}
              onPress={onOpenPaywall}
              testID="squad-upgrade"
            />
          ) : null}
          <Text>{t('socialUpdate.invitationNote')}</Text>
          {failed ? <Text accessibilityRole="alert">{failed}</Text> : null}
          <Button
            label={t('socialUpdate.create')}
            disabled={
              busy ||
              name.trim().length < 3 ||
              !selected.length ||
              Boolean(error) ||
              Boolean(loading)
            }
            onPress={() => void submit()}
            testID="create-squad-submit"
          />
        </>
      )}
    </ScrollView>
  );
}
