import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, Chip, Text, space, radius, homeLayout, type as typography } from '@calipartner/ui';
import { useTheme } from '@calipartner/ui/theme';
import { PremiumFeatureModal } from '@/components/subscription/PremiumFeatureModal';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentLocalDate } from '@/hooks/useCurrentLocalDate';
import { getDb } from '@/db';
import { generateClientUuid } from '@/services/foodService';
import {
  deleteProgressPhoto,
  getProgressPhotos,
  saveProgressPhoto,
  type ProgressPhoto,
} from '@/services/progressPhotoService';
import { t } from '@/i18n';

export interface ProgressPhotosModalProps {
  visible: boolean;
  onClose: () => void;
  testID?: string;
  embedded?: boolean;
  startDate?: string;
  endDate?: string;
}
export function ProgressPhotosModal(props: ProgressPhotosModalProps) {
  return (
    <PremiumFeatureModal feature="progress_photos" visible={props.visible} onClose={props.onClose}>
      <PhotoVault {...props} />
    </PremiumFeatureModal>
  );
}
export function PhotoVault({
  visible,
  onClose,
  testID = 'progress-photos-modal',
  embedded = false,
  startDate,
  endDate,
}: ProgressPhotosModalProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { localDate } = useCurrentLocalDate();
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const [rows, setRows] = useState<ProgressPhoto[]>([]);
  const [loadedOwner, setLoadedOwner] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const acting = useRef(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<{ id: string; uri: string } | null>(null);
  const [date, setDate] = useState(localDate);
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [pose, setPose] = useState<ProgressPhoto['pose']>('front');
  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(false);
    try {
      const photos = await getProgressPhotos(await getDb(), user.id);
      if (owner.current === user.id) {
        setRows(photos);
        setLoadedOwner(user.id);
      }
    } catch {
      if (owner.current === user.id) setError(true);
    } finally {
      if (owner.current === user.id) setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    setDraft(null);
    setSelected([]);
    if (visible) void refresh();
  }, [visible, refresh]);
  const pick = async (camera: boolean) => {
    if (acting.current) return;
    const pickerOwner = owner.current;
    acting.current = true;
    setBusy(true);
    setError(false);
    try {
      const permission = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('PERMISSION_REQUIRED');
      const result = await (
        camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync
      )({ mediaTypes: ['images'], quality: 0.75, exif: false });
      if (owner.current === pickerOwner && !result.canceled && result.assets[0]) {
        setDraft({ id: generateClientUuid(), uri: result.assets[0].uri });
        setDate(localDate);
      }
    } catch {
      setError(true);
    } finally {
      acting.current = false;
      setBusy(false);
    }
  };
  const save = async () => {
    if (!user || !draft || acting.current) return;
    acting.current = true;
    setBusy(true);
    setError(false);
    try {
      if (
        date > localDate ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date
      )
        throw new Error('INVALID_DATE');
      await saveProgressPhoto(await getDb(), {
        id: draft.id,
        user_id: user.id,
        photo_uri: draft.uri,
        captured_date: date,
        weight_kg: weight.trim() ? Number(weight) : null,
        pose,
        notes,
      });
      setDraft(null);
      setNotes('');
      setWeight('');
      await refresh();
    } catch {
      setError(true);
    } finally {
      acting.current = false;
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    if (!user || acting.current) return;
    acting.current = true;
    setBusy(true);
    try {
      await deleteProgressPhoto(await getDb(), user.id, id);
      setSelected((current) => current.filter((value) => value !== id));
      await refresh();
    } catch {
      setError(true);
    } finally {
      acting.current = false;
      setBusy(false);
    }
  };
  const photos =
    loadedOwner === user?.id
      ? rows.filter(
          (photo) =>
            (!startDate || photo.captured_date >= startDate) &&
            (!endDate || photo.captured_date <= endDate),
        )
      : [];
  const comparison = photos.filter((row) => selected.includes(row.id));
  const image = (photo: ProgressPhoto) => (
    <Image
      source={{ uri: photo.photo_uri }}
      accessibilityLabel={t('launch.photoLabel', { date: photo.captured_date })}
      style={styles.photo}
      resizeMode="contain"
    />
  );
  return (
    <PhotoFrame embedded={embedded} visible={visible} onClose={onClose}>
      <SafeAreaView style={{ flex: embedded ? undefined : 1, backgroundColor: colors.bg0 }}>
        <ScrollView
          scrollEnabled={!embedded}
          style={{ backgroundColor: colors.bg0 }}
          contentContainerStyle={styles.content}
          testID={testID}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="title1">{t('trackers.weight.photosTitle')}</Text>
          <Text>{t('launch.photoNotice')}</Text>
          {!embedded && (
            <Button
              variant="secondary"
              label={t('common.cancel')}
              onPress={onClose}
              testID="photos-close"
              disabled={busy}
            />
          )}
          {loading && <ActivityIndicator accessibilityLabel={t('launch.loading')} />}
          {error && (
            <>
              <Text accessibilityRole="alert">{t('launch.photoError')}</Text>
              <Button
                label={t('common.retry')}
                variant="secondary"
                onPress={() => void refresh()}
                testID="photos-retry"
              />
            </>
          )}
          <View style={styles.actions}>
            <Button
              variant="secondary"
              label={t('launch.camera')}
              onPress={() => void pick(true)}
              disabled={busy}
              testID="photos-camera"
            />
            <Button
              variant="secondary"
              label={t('launch.gallery')}
              onPress={() => void pick(false)}
              disabled={busy}
              testID="photos-gallery"
            />
          </View>
          {draft && (
            <View style={styles.content}>
              <Image
                source={{ uri: draft.uri }}
                style={styles.photo}
                resizeMode="contain"
                accessibilityLabel={t('trackers.weight.addPhoto')}
              />
              {(
                [
                  { key: 'date', value: date, set: setDate, label: 'launch.date' },
                  { key: 'weight', value: weight, set: setWeight, label: 'launch.weight' },
                  { key: 'notes', value: notes, set: setNotes, label: 'launch.notes' },
                ] as const
              ).map((field) => (
                <TextInput
                  key={field.key}
                  value={field.value}
                  onChangeText={field.set}
                  accessibilityLabel={t(field.label)}
                  placeholder={t(field.label)}
                  placeholderTextColor={colors.textLo}
                  style={[styles.input, { color: colors.textHi, borderColor: colors.hairline }]}
                  testID={'photo-' + field.key}
                  maxLength={field.key === 'notes' ? 1000 : 12}
                />
              ))}
              <View style={styles.actions}>
                {(['front', 'side', 'back'] as const).map((value) => (
                  <Chip
                    key={value}
                    label={t(`launch.${value}`)}
                    selected={pose === value}
                    onPress={() => setPose(value)}
                    testID={'photo-pose-' + value}
                  />
                ))}
              </View>
              <Button
                label={t('launch.savePhoto')}
                onPress={() => void save()}
                disabled={busy}
                testID="photos-save"
              />
            </View>
          )}
          {!loading && !photos.length && <Text>{t('launch.photoEmpty')}</Text>}
          {!!photos.length && <Text>{t('launch.compare')}</Text>}
          {comparison.length === 2 && (
            <View style={styles.comparison} testID="photo-compare-view">
              {comparison.map((photo) => (
                <View key={photo.id} style={styles.side}>
                  {image(photo)}
                  <Text>{photo.captured_date}</Text>
                </View>
              ))}
            </View>
          )}
          {photos.map((photo) => (
            <View key={photo.id} style={styles.content}>
              {image(photo)}
              <Text>
                {photo.captured_date} ? {t(`launch.${photo.pose}`)}
              </Text>
              {photo.weight_kg !== null && <Text style={styles.number}>{photo.weight_kg} kg</Text>}
              {!!photo.notes && <Text>{photo.notes}</Text>}
              <Chip
                label={t('launch.photoLabel', { date: photo.captured_date })}
                selected={selected.includes(photo.id)}
                onPress={() =>
                  setSelected((current) =>
                    current.includes(photo.id)
                      ? current.filter((id) => id !== photo.id)
                      : [...current.slice(-1), photo.id],
                  )
                }
                testID={'photo-item-' + photo.id}
              />
              <Button
                variant="secondary"
                label={t('launch.deletePhoto')}
                disabled={busy}
                testID={'photo-delete-' + photo.id}
                onPress={() =>
                  Alert.alert(t('launch.deletePhoto'), t('launch.confirmDelete'), [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                      text: t('launch.deletePhoto'),
                      style: 'destructive',
                      onPress: () => void remove(photo.id),
                    },
                  ])
                }
              />
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </PhotoFrame>
  );
}
function PhotoFrame({
  embedded,
  visible,
  onClose,
  children,
}: {
  embedded: boolean;
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return embedded ? (
    <View>{children}</View>
  ) : (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide">
      {children}
    </Modal>
  );
}
const styles = StyleSheet.create({
  content: { padding: space[4], gap: space[3] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  comparison: { flexDirection: 'row', gap: space[2] },
  side: { flex: 1, minWidth: 0 },
  photo: { width: '100%', aspectRatio: 1 },
  input: {
    borderWidth: 1,
    borderRadius: radius.control,
    padding: space[3],
    minHeight: homeLayout.touchSize,
    fontFamily: typography.body.fontFamily,
  },
  number: { fontVariant: ['tabular-nums'] },
});
