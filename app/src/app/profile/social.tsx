import React from 'react';
import { useRouter } from 'expo-router';
import { Text } from '@calipartner/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useFriends } from '@/hooks/useFriends';
import { SocialProfileEditor } from '@/components/friends/SocialProfileEditor';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import { t } from '@/i18n';

export default function SocialProfileScreen() {
  const { user } = useAuth();
  return <SocialProfileView key={user?.id ?? 'guest'} />;
}

function SocialProfileView() {
  const router = useRouter();
  const friends = useFriends({ profileOnly: true });
  const close = () => (router.canGoBack() ? router.back() : router.replace('/me'));
  if (!friends.signedIn) return <Text>{t('friends.signIn')}</Text>;
  if (friends.loading) return <LoadingState />;
  if (!friends.ownProfile)
    return (
      <ErrorState message={t('friends.genericError')} onRetry={() => void friends.refresh()} />
    );
  return (
    <SocialProfileEditor
      profile={friends.ownProfile}
      busy={friends.busy}
      onClose={close}
      onSave={friends.save}
    />
  );
}
