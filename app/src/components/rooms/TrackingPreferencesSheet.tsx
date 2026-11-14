import { useTheme as useAppearance } from '@calipartner/ui/theme';
import React, { useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { Button, Sheet, SwitchRow, Text } from '@calipartner/ui';
import { TRACKING_METRICS, type TrackingPreferences } from '@calipartner/core';
import { t } from '@/i18n';
import { useSquadStyles } from './SquadViews';

export function TrackingPreferencesSheet({
  enabled,
  onClose,
  onSave,
}: {
  enabled: TrackingPreferences;
  onClose: () => void;
  onSave: (enabled: TrackingPreferences) => Promise<void>;
}) {
  const styles = useSquadStyles();

  const { colors: dark } = useAppearance();

  const [draft, setDraft] = useState({ ...enabled });
  const [saving, setSaving] = useState(false),
    [error, setError] = useState(false);
  const lock = useRef(false);
  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError(false);
    try {
      await onSave(draft);
      onClose();
    } catch {
      setError(true);
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };
  return (
    <Sheet
      visible
      onClose={() => {
        if (!lock.current) onClose();
      }}
      snapPoint="tall"
      accessibilityLabel={t('personalDay.tracking')}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="heading">{t('personalDay.tracking')}</Text>
        <Text>{t('personalDay.trackingHint')}</Text>
        {TRACKING_METRICS.map((key) => (
          <SwitchRow
            key={key}
            title={t(`squadDesign.${key}`)}
            value={draft[key]}
            disabled={saving}
            onValueChange={(value) => setDraft((previous) => ({ ...previous, [key]: value }))}
            testID={`track-${key}`}
          />
        ))}
        {error && (
          <Text accessibilityRole="alert" color={dark.danger}>
            {t('personalDay.trackingError')}
          </Text>
        )}
        <Button
          label={t(saving ? 'common.saving' : 'common.save')}
          onPress={() => void save()}
          disabled={saving}
          testID="save-tracking-preferences"
        />
      </ScrollView>
    </Sheet>
  );
}
