import React, { useEffect, useState } from 'react';
import { Modal, View, StyleSheet } from 'react-native';
import { Button, Text, useTheme, space } from '@calipartner/ui';
import { useAvatar } from '@/hooks/useAvatar';
import { secureStoreAdapter } from '@/lib/secureStore';
import { t } from '@/i18n';
import { AvatarView } from './AvatarView';
export function AvatarMilestone() {
  const { state } = useAvatar();
  const profile = state?.profile;
  const { colors } = useTheme();
  const ownerId = profile?.user_id;
  const level = profile?.level;
  const form = profile?.form;
  const [milestone, setMilestone] = useState<{
    owner: string;
    formChanged: boolean;
    level: number;
  } | null>(null);
  useEffect(() => {
    let active = true;
    if (!ownerId || level == null || form == null) return;
    const key = `avatar.level-seen.${ownerId}`;
    void secureStoreAdapter
      .getItem(key)
      .then(async (value) => {
        const previous = value ? (JSON.parse(value) as { level: number; form: number }) : null;
        if (active && previous && level > previous.level)
          setMilestone({ owner: ownerId, level, formChanged: form > previous.form });
        if (active) await secureStoreAdapter.setItem(key, JSON.stringify({ level, form }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [ownerId, level, form]);
  const visible = !!profile && milestone?.owner === profile.user_id;
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="none"
      onRequestClose={() => setMilestone(null)}
    >
      <View style={[styles.content, { backgroundColor: colors.bg0 }]}>
        {profile && state ? (
          <AvatarView profile={profile} products={state.products} tints={state.tints} />
        ) : null}
        <Text variant="title1">
          {milestone?.formChanged
            ? t('avatar.formUp')
            : t('avatar.levelUp', { level: milestone?.level ?? 1 })}
        </Text>
        <Text>{t('avatar.keepGoing')}</Text>
        <Button
          label={t('avatar.close')}
          onPress={() => setMilestone(null)}
          testID="avatar-level-close"
        />
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', padding: space[5], gap: space[4] },
});
