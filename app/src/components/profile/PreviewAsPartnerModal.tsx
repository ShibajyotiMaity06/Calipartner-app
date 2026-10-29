import React, { useEffect, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import { Button, Card, dark, HiddenMetric, space, Text } from '@calipartner/ui';
import { getRoomSnapshot, getPrivacySettings } from '@/services/roomService';
import { getSupabase } from '@/lib/supabase';
import { t } from '@/i18n';
export interface PreviewAsPartnerModalProps {
  visible: boolean;
  onClose: () => void;
  roomId?: string;
  testID?: string;
}
export function PreviewAsPartnerModal({
  visible,
  onClose,
  roomId,
  testID = 'modal-preview-as-partner',
}: PreviewAsPartnerModalProps) {
  const [data, setData] = useState<{ name: string; goal: number | 'locked' } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    setData(null);
    setError(false);
    if (visible && roomId)
      void Promise.all([
        getRoomSnapshot(getSupabase(), roomId),
        getPrivacySettings(getSupabase(), roomId),
      ])
        .then(([snapshot, privacy]) => {
          if (!current) return;
          const own = snapshot.members.find((m) => m.user_id === snapshot.caller_id);
          if (!own) throw new Error('NOT_ROOM_MEMBER');
          setData({
            name: own.nickname,
            goal: privacy.share_goal_completion ? own.metrics.goal_completion : 'locked',
          });
        })
        .catch(() => {
          if (current) setError(true);
        });
    return () => {
      current = false;
    };
  }, [visible, roomId, retry]);
  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide">
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} testID={testID}>
          <Button
            variant="tertiary"
            label={t('rooms.paywall.close')}
            onPress={onClose}
            testID="btn-close-preview-partner"
          />
          <Text variant="title2">{t('me.previewPartner.title')}</Text>
          <Text color={dark.textMid}>{t('me.previewPartner.goalCompletionOnly')}</Text>
          {!roomId ? (
            <Text>{t('roomAudit.noRooms')}</Text>
          ) : error ? (
            <>
              <Text accessibilityRole="alert">{t('roomAudit.privacyError')}</Text>
              <Button
                variant="secondary"
                label={t('common.retry')}
                onPress={() => setRetry((v) => v + 1)}
              />
            </>
          ) : !data ? (
            <Text>{t('common.loading')}</Text>
          ) : (
            <Card>
              <Text variant="heading">{data.name}</Text>
              {data.goal === 'locked' ? (
                <HiddenMetric label={t('roomAudit.privateGoal')} />
              ) : (
                <Text tabular>{t('roomAudit.goalPercent', { percent: data.goal })}</Text>
              )}
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.bg0 },
  content: { padding: space[4], gap: space[3] },
});
