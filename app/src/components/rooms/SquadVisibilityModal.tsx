import React, { useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { Button, Sheet, SwitchRow, Text } from '@calipartner/ui';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import {
  getSquadVisibility,
  setSquadVisibility,
  type SquadVisibility,
} from '@/services/squadService';
import { t } from '@/i18n';
import { squadStyles as styles } from './SquadViews';

export function SquadVisibilityModal({
  visible,
  roomId,
  onClose,
}: {
  visible: boolean;
  roomId: string;
  onClose: () => void;
}) {
  useBrowserModalBack(visible, onClose);
  const scope = roomId + String(visible);
  const active = useRef(scope);
  active.current = scope;
  const pending = useRef(false);
  const [settings, setSettings] = useState<SquadVisibility | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    let current = true;
    if (!visible) return;
    pending.current = false;
    setSaving(false);
    setLoading(true);
    setSettings(null);
    setError(false);
    void getSquadVisibility(roomId)
      .then((data) => {
        if (current) setSettings(data);
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
  }, [visible, roomId, retry]);
  const change = async (next: SquadVisibility) => {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setError(false);
    try {
      const saved = await setSquadVisibility(roomId, next);
      if (active.current === scope) setSettings(saved);
    } catch {
      if (active.current === scope) setError(true);
    } finally {
      if (active.current === scope) {
        pending.current = false;
        setSaving(false);
      }
    }
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      snapPoint="tall"
      accessibilityLabel={t('rooms.privacyModal.title')}
      testID="squad-visibility-modal"
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Button variant="tertiary" label={t('squadDesign.close')} onPress={onClose} />
        <Text variant="title1">{t('rooms.privacyModal.title')}</Text>
        <Text>{t('squadDesign.sharing')}</Text>
        {loading ? <Text>{t('common.loading')}</Text> : null}
        {error ? (
          <>
            <Text accessibilityRole="alert">{t('common.errorBody')}</Text>
            <Button
              variant="secondary"
              label={t('common.retry')}
              onPress={() => setRetry((n) => n + 1)}
              testID="retry-squad-visibility"
            />
          </>
        ) : null}
        {settings && (
          <>
            <SwitchRow
              title={t('squadDesign.showWeight')}
              value={settings.share_weight}
              disabled={saving}
              onValueChange={(value) => void change({ ...settings, share_weight: value })}
              testID="squad-share-weight"
            />
            <SwitchRow
              title={t('squadDesign.showHeight')}
              value={settings.share_height}
              disabled={saving}
              onValueChange={(value) => void change({ ...settings, share_height: value })}
              testID="squad-share-height"
            />
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}
