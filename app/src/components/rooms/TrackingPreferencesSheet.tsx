import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ChartBarIcon,
  CloseIcon,
  DropletIcon,
  FlameIcon,
  IconButton,
  InfoCircleIcon,
  PrimaryButton,
  PulseIcon,
  ScaleIcon,
  Sheet,
  SwitchRow,
  Text,
  borders,
  colors,
  radius,
  space,
} from '@calipartner/ui/v1';
import { TRACKING_METRICS, type TrackingMetric, type TrackingPreferences } from '@calipartner/core';
import { t } from '@/i18n';

const METRIC_META_KEY: Record<TrackingMetric, Parameters<typeof t>[0]> = {
  calories: 'customizeV1.caloriesMeta',
  protein: 'customizeV1.proteinMeta',
  carbs: 'customizeV1.carbsMeta',
  fat: 'customizeV1.fatMeta',
  steps: 'customizeV1.stepsMeta',
  water: 'customizeV1.waterMeta',
};

function renderMetricIcon(metric: TrackingMetric): React.ReactNode {
  switch (metric) {
    case 'calories':
      return <FlameIcon size={18} color={colors.textMid} />;
    case 'protein':
    case 'steps':
      return <PulseIcon size={18} color={colors.textMid} />;
    case 'carbs':
      return <ChartBarIcon size={18} color={colors.textMid} />;
    case 'fat':
      return <ScaleIcon size={18} color={colors.textMid} />;
    case 'water':
      return <DropletIcon size={18} color={colors.textMid} />;
  }
}

export function TrackingPreferencesSheet({
  enabled,
  onClose,
  onSave,
}: {
  enabled: TrackingPreferences;
  onClose: () => void;
  onSave: (enabled: TrackingPreferences) => Promise<void>;
}) {
  const [draft, setDraft] = useState({ ...enabled });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const lock = useRef(false);

  const safeClose = () => {
    if (!lock.current) onClose();
  };

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
      onClose={safeClose}
      accessibilityLabel={t('customizeV1.title')}
      testID="customize-day-sheet"
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text variant="titleM" color="textHi">
              {t('customizeV1.title')}
            </Text>
            <Text variant="meta" color="textLo">
              {t('customizeV1.subtitle')}
            </Text>
          </View>
          <IconButton
            icon={<CloseIcon size={16} color={colors.textHi} />}
            size={36}
            inSheet
            onPress={safeClose}
            accessibilityLabel={t('homeRefresh.close')}
            testID="close-tracking-preferences"
          />
        </View>

        <View style={styles.rowsContainer}>
          {TRACKING_METRICS.map((key, idx) => (
            <SwitchRow
              key={key}
              title={t(`squadDesign.${key}`)}
              meta={t(METRIC_META_KEY[key])}
              icon={renderMetricIcon(key)}
              value={draft[key]}
              disabled={saving}
              showDivider={idx < TRACKING_METRICS.length - 1}
              onValueChange={(value) => setDraft((previous) => ({ ...previous, [key]: value }))}
              testID={`track-${key}`}
            />
          ))}
        </View>

        <View style={styles.infoBanner}>
          <InfoCircleIcon size={18} color={colors.textLo} />
          <Text variant="meta" color="textLo" style={styles.infoText}>
            {t('customizeV1.infoNotice')}
          </Text>
        </View>

        {error ? (
          <Text variant="meta" color="danger" accessibilityRole="alert">
            {t('personalDay.trackingError')}
          </Text>
        ) : null}

        <PrimaryButton
          title={saving ? t('common.saving') : t('captureV1.done')}
          onPress={() => void save()}
          disabled={saving}
          loading={saving}
          testID="save-tracking-preferences"
        />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: space.md,
    paddingBottom: space.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
  },
  headerCopy: {
    flex: 1,
    gap: space.xs,
  },
  rowsContainer: {
    borderRadius: radius.card,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.banner,
    padding: space.md,
  },
  infoText: {
    flex: 1,
  },
});
