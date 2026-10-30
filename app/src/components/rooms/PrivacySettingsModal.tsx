import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import React, { useEffect, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, dark, space, SwitchRow, Text } from '@calipartner/ui';
import type { RoomPrivacySettings } from '@calipartner/core';
import { t } from '@/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getSupabase } from '@/lib/supabase';
import { fetchLeaderboardOptOutStatus, setLeaderboardOptOut } from '@/services/leaderboardService';
import { PerRoomVisibilityModal } from '@/components/profile/PerRoomVisibilityModal';
import type { RoomSummary } from '@/types/rooms';
export interface PrivacySettingsModalProps {
  visible: boolean;
  onClose: () => void;
  roomId?: string;
  rooms?: RoomSummary[];
  onGetPrivacy: () => Promise<RoomPrivacySettings>;
  onUpdatePrivacy: (settings: Partial<RoomPrivacySettings>) => Promise<RoomPrivacySettings>;
  onOpenPerRoom?: () => void;
}
const fields = [
  ['share_goal_completion', 'roomAudit.goal'],
  ['share_steps', 'roomAudit.steps'],
  ['share_water', 'roomAudit.water'],
  ['share_streak', 'roomAudit.logging'],
  ['share_weight_number', 'rooms.privacyModal.weight'],
  ['share_weight_progress', 'roomAudit.weightProgress'],
  ['share_workouts', 'rooms.privacyModal.workouts'],
  ['share_fasting', 'rooms.privacyModal.fasting'],
] as const;
export function PrivacySettingsModal({
  visible,
  onClose,
  onGetPrivacy,
  onUpdatePrivacy,
  onOpenPerRoom,
  rooms = [],
}: PrivacySettingsModalProps) {
  useBrowserModalBack(visible, onClose);
  const { profile, updateProfile } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [settings, setSettings] = useState<RoomPrivacySettings | null>(null);
  const [optedOut, setOptedOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [subModal, setSubModal] = useState<'rooms' | null>(null);
  useEffect(() => {
    let current = true;
    if (!visible) return;
    setSettings(null);
    setLoading(true);
    setError(false);
    void Promise.all([onGetPrivacy(), fetchLeaderboardOptOutStatus(getSupabase())])
      .then(([privacy, optOut]) => {
        if (current) {
          setSettings(privacy);
          setOptedOut(optOut);
        }
      })
      .catch(() => {
        if (current) setError(true);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [visible, onGetPrivacy, retry]);
  const change = async (operation: () => Promise<void>) => {
    if (saving || isOnline === false) return;
    setSaving(true);
    setError(false);
    try {
      await operation();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };
  const patch = (value: Partial<RoomPrivacySettings>) =>
    void change(async () => {
      setSettings(await onUpdatePrivacy(value));
    });
  const disabled = saving || isOnline === false;
  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide">
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} testID="modal-privacy-settings">
          <Button
            variant="tertiary"
            label={t('rooms.paywall.close')}
            onPress={onClose}
            testID="btn-close-privacy-modal"
          />
          <Text variant="title2">{t('rooms.privacyModal.title')}</Text>
          <Text>{t('rooms.privacyModal.intro')}</Text>
          <Text color={dark.textMid}>{t('rooms.privacyModal.immediateNote')}</Text>
          {isOnline === false ? (
            <Text accessibilityLiveRegion="polite">{t('roomAudit.onlinePrivacy')}</Text>
          ) : null}
          {loading ? <Text>{t('common.loading')}</Text> : null}
          {error ? (
            <View>
              <Text accessibilityRole="alert" color={dark.danger}>
                {t('roomAudit.privacyError')}
              </Text>
              {!settings ? (
                <Button
                  variant="secondary"
                  label={t('common.retry')}
                  onPress={() => setRetry((v) => v + 1)}
                  testID="retry-room-privacy"
                />
              ) : null}
            </View>
          ) : null}
          {settings ? (
            <Card>
              <SwitchRow
                title={t('rooms.privacyModal.mealItems')}
                consequence={t('rooms.privacyModal.mealItemsConsequence')}
                value={settings.share_meals !== 'never'}
                disabled={disabled}
                onValueChange={(value) => patch({ share_meals: value ? 'always' : 'never' })}
                testID="switch-share-meal-items"
              />
              <SwitchRow
                title={t('repairs.mealNutrition')}
                value={settings.share_calories_macros}
                disabled={disabled}
                onValueChange={(value) => patch({ share_calories_macros: value })}
                testID="switch-share-calories-macros"
              />
              {fields.map(([key, label]) => (
                <SwitchRow
                  key={key}
                  title={t(label)}
                  value={Boolean(settings[key])}
                  disabled={disabled}
                  onValueChange={(value) => patch({ [key]: value })}
                  testID={`switch-${key.replaceAll('_', '-')}`}
                />
              ))}
            </Card>
          ) : null}
          <Card>
            <SwitchRow
              title={t('rooms.privacyModal.discoverable')}
              consequence={t('rooms.privacyModal.discoverableConsequence')}
              value={profile?.discoverable ?? false}
              disabled={disabled || !profile}
              onValueChange={(discoverable) =>
                void change(async () => {
                  const result = await updateProfile({ discoverable });
                  if (result.error) throw result.error;
                })
              }
              testID="switch-discoverable"
            />
            <SwitchRow
              title={t('rooms.privacyModal.leaderboard')}
              consequence={t('rooms.privacyModal.leaderboardConsequence')}
              value={!optedOut}
              disabled={disabled || loading}
              onValueChange={(enabled) =>
                void change(async () => {
                  await setLeaderboardOptOut(getSupabase(), !enabled);
                  setOptedOut(!enabled);
                })
              }
              testID="switch-appear-leaderboard"
            />
          </Card>
          <Button
            variant="secondary"
            label={t('rooms.privacyModal.perRoomLink')}
            onPress={onOpenPerRoom ?? (() => setSubModal('rooms'))}
            testID="btn-per-room-visibility"
          />
        </ScrollView>
        {subModal === 'rooms' ? (
          <PerRoomVisibilityModal visible rooms={rooms} onClose={() => setSubModal(null)} />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.bg0 },
  content: { padding: space[4], gap: space[3], paddingBottom: space[8] },
});
