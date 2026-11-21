import React, { useState } from 'react';
import { Image, Modal, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import {
  progressPhotoDelta,
  selectJourneyPhotos,
  type ProgressPhotoPeriod,
} from '@calipartner/core';
import { Button, Card, SegmentedControl, Text, space, useTheme } from '@calipartner/ui';
import { ModalNavigation } from '@/components/ModalNavigation';
import { getLocale, t } from '@/i18n';
import type { ProgressPhoto } from '@/services/progressPhotoService';

const periods = ['weekly', 'monthly', 'all'] as const;

export function ProgressPhotoJourneyModal({
  photos,
  onClose,
  onDelete,
  busy,
  error,
}: {
  photos: ProgressPhoto[];
  onClose: () => void;
  onDelete: (id: string) => void;
  busy: boolean;
  error: boolean;
}) {
  const { colors, reduceMotion } = useTheme();
  const [period, setPeriod] = useState<ProgressPhotoPeriod>('weekly');
  const [selected, setSelected] = useState<string[]>([]);
  const all = selectJourneyPhotos(photos, 'all');
  const comparison = all.filter((photo) => selected.includes(photo.id));
  const dates = new Intl.DateTimeFormat(getLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const weights = new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 2 });
  const deltas = new Intl.NumberFormat(getLocale(), {
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  });
  const photoDetails = (photo: ProgressPhoto, compare = false) => {
    const date = dates.format(new Date(photo.captured_date + 'T12:00:00Z'));
    return (
      <>
        <Image
          source={{ uri: photo.photo_uri }}
          style={compare ? styles.comparePhoto : styles.photo}
          resizeMode="contain"
          accessibilityLabel={t('launch.photoLabel', { date })}
        />
        <Text variant="label" tabular>
          {date}
        </Text>
        <Text variant="bodyS">{t(`launch.${photo.pose}`)}</Text>
        {photo.weight_kg !== null && (
          <Text variant="bodyS" tabular>
            {t('photoJourney.weight', { weight: weights.format(photo.weight_kg) })}
          </Text>
        )}
      </>
    );
  };
  const [baseline, current] = comparison;
  const change = baseline && current ? progressPhotoDelta(baseline, current) : undefined;
  return (
    <Modal visible onRequestClose={onClose} animationType={reduceMotion ? 'none' : 'slide'}>
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg0 }]}>
        <View style={styles.container}>
          <ModalNavigation onClose={onClose} closeTestID="photo-journey-close" />
          <Text variant="title1" accessibilityRole="header">
            {t('photoJourney.title')}
          </Text>
          <SegmentedControl
            options={periods.map((value) => ({ value, label: t(`photoJourney.${value}`) }))}
            value={period}
            onChange={setPeriod}
            testID="photo-journey-period"
          />
        </View>
        <ScrollView contentContainerStyle={styles.container} testID="progress-photo-journey">
          {error && <Text accessibilityRole="alert">{t('launch.photoError')}</Text>}
          <Text>{t(photos.length ? 'photoJourney.hint' : 'launch.photoEmpty')}</Text>
          {change && (
            <Card testID="photo-compare-view">
              <View style={styles.comparison}>
                {comparison.map((photo) => (
                  <View key={photo.id} style={styles.side}>
                    {photoDetails(photo, true)}
                  </View>
                ))}
              </View>
              <Text tabular>{t('photoJourney.dayDelta', { count: change.days })}</Text>
              {change.weightKg !== null && (
                <Text tabular>
                  {t('photoJourney.weightDelta', {
                    weight: t('photoJourney.weight', {
                      weight: deltas.format(change.weightKg),
                    }),
                  })}
                </Text>
              )}
            </Card>
          )}
          {selectJourneyPhotos(photos, period).map((photo) => (
            <Card key={photo.id} style={styles.card}>
              {photoDetails(photo)}
              {!!photo.notes && <Text>{photo.notes}</Text>}
              <Button
                variant={selected.includes(photo.id) ? 'secondary' : 'tertiary'}
                accessibilityState={{ selected: selected.includes(photo.id) }}
                label={t('photoJourney.select', {
                  date: dates.format(new Date(photo.captured_date + 'T12:00:00Z')),
                })}
                onPress={() =>
                  setSelected((ids) =>
                    ids.includes(photo.id)
                      ? ids.filter((id) => id !== photo.id)
                      : [...ids.slice(-1), photo.id],
                  )
                }
                testID={`photo-item-${photo.id}`}
              />
              <Button
                variant="tertiary"
                label={t('launch.deletePhoto')}
                disabled={busy}
                onPress={() => onDelete(photo.id)}
                testID={`photo-delete-${photo.id}`}
              />
            </Card>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { gap: space[3], padding: space[4] },
  card: { gap: space[2] },
  photo: { width: '100%', height: space[9] },
  comparePhoto: { width: '100%', aspectRatio: 1 },
  comparison: { flexDirection: 'row', gap: space[3] },
  side: { flex: 1, gap: space[2] },
});
