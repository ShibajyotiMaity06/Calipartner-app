import React, { useEffect, useState } from 'react';
import { Text, avatarLayout } from '@calipartner/ui';
import type { PublicAvatarProfile } from '@calipartner/core';
import { useAvatar } from '@/hooks/useAvatar';
import { getSupabase } from '@/lib/supabase';
import { fetchPublicAvatars } from '@/services/avatarService';
import { t } from '@/i18n';
import { AvatarView } from './AvatarView';
export function PublicAvatar({ userId, name }: { userId: string; name: string }) {
  const { state } = useAvatar();
  const [data, setData] = useState<{ owner: string; profile: PublicAvatarProfile | null } | null>(
    null,
  );
  useEffect(() => {
    let active = true;
    setData(null);
    if (state?.enabled)
      void fetchPublicAvatars(getSupabase(), [userId])
        .then((rows) => {
          if (active) setData({ owner: userId, profile: rows[0] ?? null });
        })
        .catch(() => {
          if (active) setData({ owner: userId, profile: null });
        });
    return () => {
      active = false;
    };
  }, [userId, state?.enabled]);
  if (!state?.enabled) return null;
  if (!data || data.owner !== userId) return <Text variant="label">{t('common.loading')}</Text>;
  if (!data.profile) return null;
  return (
    <AvatarView
      profile={data.profile}
      products={state.products}
      tints={state.tints}
      height={avatarLayout.compareHeight}
      preview
      label={t('avatar.partner', { name })}
    />
  );
}
