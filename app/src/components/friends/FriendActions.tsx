import React, { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Sheet, Text, space } from '@calipartner/ui';
import type { SocialProfile } from '@calipartner/core';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { t } from '@/i18n';

export type FriendManagementAction = 'remove' | 'block';
export function FriendActions({
  person,
  busy,
  onConfirm,
  onResolved,
}: {
  person: SocialProfile;
  busy: boolean;
  onConfirm: (action: FriendManagementAction) => Promise<boolean>;
  onResolved: (action: FriendManagementAction) => void;
}) {
  const [action, setAction] = useState<FriendManagementAction | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const savingRef = useRef(false);
  const close = () => {
    if (!savingRef.current) setAction(null);
  };
  useBrowserModalBack(action !== null, close);
  const confirm = async () => {
    if (!action || busy || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFailed(false);
    try {
      if (await onConfirm(action)) {
        setAction(null);
        onResolved(action);
      } else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <>
      <View style={{ width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {(['remove', 'block'] as const).map((kind) => (
          <Button
            key={kind}
            variant="secondary"
            size="sm"
            fullWidth={false}
            style={{ flex: 1 }}
            label={t(kind === 'remove' ? 'friends.remove' : 'friends.blockFriend')}
            accessibilityLabel={t(
              kind === 'remove' ? 'friends.removeNamed' : 'friends.blockNamed',
              { name: person.nickname },
            )}
            disabled={busy || saving || (kind === 'remove' && !person.request_id)}
            onPress={() => {
              setFailed(false);
              setAction(kind);
            }}
            testID={`${kind}-friend-${person.id}`}
          />
        ))}
      </View>
      {action && (
        <Sheet
          visible
          onClose={close}
          accessibilityLabel={t(action === 'remove' ? 'friends.remove' : 'friends.blockFriend')}
          testID="friend-action-confirmation"
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: space[4], gap: space[4] }}
          >
            <Text variant="title2" accessibilityRole="header">
              {t(action === 'remove' ? 'friends.removeConfirm' : 'friends.blockConfirm', {
                name: person.nickname,
              })}
            </Text>
            <Text>{t(action === 'remove' ? 'friends.removeNote' : 'friends.blockNote')}</Text>
            {failed && (
              <Text color="danger" accessibilityRole="alert" testID="friend-action-error">
                {t('friends.actionUnconfirmed')}
              </Text>
            )}
            <Button
              variant="destructive"
              label={t(
                saving
                  ? 'friends.savingAction'
                  : action === 'remove'
                    ? 'friends.remove'
                    : 'friends.blockFriend',
              )}
              disabled={saving || busy}
              onPress={confirm}
              testID="confirm-friend-action"
            />
            <Button
              variant="secondary"
              label={t('common.cancel')}
              disabled={saving}
              onPress={close}
              testID="cancel-friend-action"
            />
          </ScrollView>
        </Sheet>
      )}
    </>
  );
}
