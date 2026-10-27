import React, { useState } from 'react';
import { Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, SwitchRow, Text, useTheme, useReducedMotion } from '@calipartner/ui';
import { FriendDiscovery } from '@/components/friends/FriendDiscovery';
import { PublicSocialProfile } from '@/components/friends/PublicSocialProfile';
import { planStyles } from './PlanPrimitives';
import { useFriends } from '@/hooks/useFriends';
import { t } from '@/i18n';

export interface PartnerFinderOfferModalProps {
  visible: boolean;
  onClose: () => void;
  onAccept?: () => void;
  onSetPreferences?: () => void;
  testID?: string;
}
export function PartnerFinderOfferModal({
  visible,
  onClose,
  onAccept,
  testID = 'partner-finder-offer-modal',
}: PartnerFinderOfferModalProps) {
  const router = useRouter();
  const friends = useFriends();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const browse = () => {
    onClose();
    router.push('/friends' as never);
  };
  const pending = friends.outbox.filter((item) => item.status === 'pending');
  const selected = friends.selected;
  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      testID={testID}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg0 }}>
        <ScrollView contentContainerStyle={planStyles.reviewContent}>
          <Text variant="title1">{t('socialUpdate.offerTitle')}</Text>
          <Text>{t('socialUpdate.offerIntro')}</Text>
          <SwitchRow
            title={t('socialUpdate.openToPartner')}
            value={open}
            onValueChange={setOpen}
            testID="toggle-open-to-partner"
          />
          {open ? (
            <>
              {friends.loading ? <Text>{t('common.loading')}</Text> : null}
              {friends.error ? (
                <Text accessibilityRole="alert">{t('friends.genericError')}</Text>
              ) : null}
              {friends.outbox.some((item) => item.status === 'failed') ? (
                <Text accessibilityRole="alert">
                  {t(
                    friends.outbox.some((item) => item.last_error?.includes('FRIEND_WEEKLY_LIMIT'))
                      ? 'friends.weeklyLimit'
                      : 'friends.failedChanges',
                  )}
                </Text>
              ) : null}
              <FriendDiscovery
                random
                onOpen={(person) => void friends.openProfile(person)}
                onSend={friends.send}
                busy={friends.busy}
                remaining={friends.inbox?.quota.remaining}
                queuedIds={pending
                  .filter((item) => item.rpc_name === 'send_friend_request')
                  .map(
                    (item) =>
                      (JSON.parse(item.payload) as { p_recipient_id: string }).p_recipient_id,
                  )}
              />
              <Button
                variant="secondary"
                label={t('socialUpdate.more')}
                onPress={browse}
                testID="browse-more-friends"
              />
            </>
          ) : null}
          <Button
            label={t('socialUpdate.continue')}
            onPress={() => {
              if (open) onAccept?.();
              onClose();
            }}
            testID="btn-continue-partner"
          />
        </ScrollView>
        {selected ? (
          <PublicSocialProfile
            profile={selected}
            busy={friends.busy}
            queued={pending.some((item) => {
              const payload = JSON.parse(item.payload);
              return (
                payload.p_recipient_id === selected.id ||
                payload.p_request_id === selected.request_id
              );
            })}
            limitReached={friends.inbox?.quota.remaining === 0}
            onClose={friends.closeProfile}
            onSend={() => void friends.send(selected.id)}
            onRespond={(action) => {
              if (selected.request_id)
                void friends.respond(selected.request_id, action, selected.id);
            }}
            onUpgrade={browse}
            onBlock={() => void friends.block(selected.id)}
            onReport={browse}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
