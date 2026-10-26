import React from 'react';
import { Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button, HiddenMetric, Text, useTheme } from '@calipartner/ui';
import type { FriendAction, SocialProfile } from '@calipartner/core';
import { planStyles } from '@/components/onboarding/PlanPrimitives';
import { t } from '@/i18n';

export function PublicSocialProfile({
  profile,
  busy,
  queued,
  limitReached,
  onClose,
  onSend,
  onRespond,
  onUpgrade,
  onBlock,
  onReport,
}: {
  profile: SocialProfile;
  busy: boolean;
  queued: boolean;
  limitReached: boolean;
  onClose: () => void;
  onSend: () => void;
  onRespond: (action: FriendAction) => void;
  onUpgrade: () => void;
  onBlock: () => void;
  onReport: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible onRequestClose={onClose} animationType="slide">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg0 }}>
        <ScrollView contentContainerStyle={planStyles.reviewContent}>
          <Button
            variant="tertiary"
            label={t('friends.close')}
            onPress={onClose}
            testID="close-public-profile"
          />
          <Avatar uri={profile.avatar_url} name={profile.nickname} size="lg" />
          <Text variant="title2" accessibilityRole="header">
            {profile.nickname}
          </Text>
          <Text>@{profile.username}</Text>
          {!profile.is_public ? (
            <HiddenMetric label={t('friends.privateProfile')} />
          ) : (
            <>
              <Text>{profile.bio || t('friends.noBio')}</Text>
              {profile.training_style === 'bulk' || profile.training_style === 'cut' ? (
                <Text>{t(profile.training_style === 'bulk' ? 'fixes.bulk' : 'fixes.cut')}</Text>
              ) : null}
            </>
          )}
          {queued ? <Text accessibilityLiveRegion="polite">{t('friends.queued')}</Text> : null}
          {profile.relationship === 'none' ? (
            limitReached ? (
              <>
                <Text>{t('friends.weeklyLimit')}</Text>
                <Button
                  label={t('friends.upgrade')}
                  onPress={onUpgrade}
                  testID="upgrade-friend-limit"
                />
              </>
            ) : (
              <Button
                label={t('friends.send')}
                disabled={busy || queued}
                onPress={onSend}
                testID="send-friend-request"
              />
            )
          ) : null}
          {profile.relationship === 'incoming' ? (
            <>
              <Button
                label={t('friends.accept')}
                disabled={busy || queued}
                onPress={() => onRespond('accept')}
                testID="accept-friend-request"
              />
              <Button
                variant="secondary"
                label={t('friends.decline')}
                disabled={busy || queued}
                onPress={() => onRespond('decline')}
                testID="decline-friend-request"
              />
            </>
          ) : null}
          {profile.relationship === 'outgoing' ? (
            <>
              <Text>{t('friends.pending')}</Text>
              <Button
                variant="secondary"
                label={t('friends.cancel')}
                disabled={busy || queued}
                onPress={() => onRespond('cancel')}
                testID="cancel-friend-request"
              />
            </>
          ) : null}
          {profile.relationship === 'friends' ? (
            <>
              <Text>{t('friends.connected')}</Text>
              <Text variant="bodyS">{t('friends.removeNote')}</Text>
              <Button
                variant="destructive"
                label={t('friends.remove')}
                disabled={busy || queued}
                onPress={() => onRespond('remove')}
                testID="remove-friend"
              />
            </>
          ) : null}
          <Text variant="bodyS">{t('friends.roomsNote')}</Text>
          <Button
            variant="tertiary"
            label={t('friends.block')}
            disabled={busy}
            onPress={onBlock}
            testID="block-social-profile"
          />
          <Button
            variant="tertiary"
            label={t('friends.report')}
            disabled={busy}
            onPress={onReport}
            testID="report-social-profile"
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
