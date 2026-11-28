import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RoomPrivacySettings } from '@calipartner/core';
import {
  ChevronLeftIcon,
  Chip,
  LockIcon,
  PrimaryButton,
  Switch,
  Text,
  borders,
  colors,
  fonts,
  layout,
  radius,
  space,
} from '@calipartner/ui/v1';
import { useAuth } from '@/contexts/AuthContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getSupabase } from '@/lib/supabase';
import { t } from '@/i18n';
import { diaryEvents } from '@/services/diaryEvents';
import { invalidateReadCache } from '@/services/readCache';
import { getPrivacySettings, updatePrivacySettings } from '@/services/roomService';
import { getSquadToday } from '@/services/squadService';
import type { RoomSummary } from '@/types/rooms';

export interface PerRoomVisibilityModalProps {
  visible: boolean;
  onClose: () => void;
  rooms?: RoomSummary[];
  initialRoomId?: string | null;
  testID?: string;
}

export function PerRoomVisibilityModal({
  visible,
  onClose,
  rooms = [],
  initialRoomId,
  testID = 'modal-per-room-visibility',
}: PerRoomVisibilityModalProps) {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { isOnline } = useNetworkStatus();

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(
    initialRoomId ?? rooms[0]?.id ?? null,
  );
  const activeRoomId = rooms.some((room) => room.id === selectedRoomId)
    ? selectedRoomId
    : (rooms[0]?.id ?? null);

  const [settings, setSettings] = useState<RoomPrivacySettings | null>(null);
  const [selfScorePct, setSelfScorePct] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && initialRoomId && rooms.some((r) => r.id === initialRoomId)) {
      setSelectedRoomId(initialRoomId);
    } else if (visible && !selectedRoomId && rooms[0]?.id) {
      setSelectedRoomId(rooms[0].id);
    }
  }, [visible, initialRoomId, rooms, selectedRoomId]);

  const loadRoomPrivacy = useCallback(async (roomId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [privacy, squad] = await Promise.all([
        getPrivacySettings(getSupabase(), roomId),
        getSquadToday(roomId).catch(() => null),
      ]);
      setSettings(privacy);
      const selfMember = squad?.members?.find((m) => m.is_self);
      setSelfScorePct(typeof selfMember?.score === 'number' ? selfMember.score : null);
    } catch {
      setError(t('roomAudit.privacyError'));
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible || !activeRoomId) return;
    void loadRoomPrivacy(activeRoomId);
  }, [visible, activeRoomId, loadRoomPrivacy]);

  const patchPrivacy = async (patch: Partial<RoomPrivacySettings>) => {
    if (!activeRoomId || !settings || saving || isOnline === false) return;
    const prev = settings;
    const optimistic = { ...settings, ...patch };
    setSettings(optimistic);
    setSaving(true);
    setError(null);
    try {
      const saved = await updatePrivacySettings(getSupabase(), activeRoomId, optimistic);
      setSettings(saved);
      if (user?.id) invalidateReadCache('squad:' + activeRoomId, user.id);
      diaryEvents.emitChange();
    } catch {
      setSettings(prev);
      setError(t('roomAudit.privacyError'));
    } finally {
      setSaving(false);
    }
  };

  const displayName = profile?.nickname || profile?.username || t('homeRefresh.friend');
  const avatarInitial = (displayName.trim().charAt(0) || 'P').toUpperCase();
  const showCalories = Boolean(settings?.share_calories_macros);
  const showWeight = Boolean(settings?.share_weight_number);
  const showMeals = settings ? settings.share_meals !== 'never' : false;
  const showWorkouts = settings ? Boolean(settings.share_workouts) : false;

  const previewActivity =
    showWorkouts && showMeals
      ? t('settingsV1.squadVisPreviewActiveSub')
      : showWorkouts
        ? t('settingsV1.squadVisPreviewWorkoutsOnlySub')
        : showMeals
          ? t('settingsV1.squadVisPreviewMealsOnlySub')
          : t('settingsV1.squadVisPreviewPrivateSub');

  const lockedItems: string[] = [];
  if (!showCalories) lockedItems.push(t('settingsV1.squadVisLockCalories'));
  if (!showWeight) lockedItems.push(t('settingsV1.squadVisLockWeight'));
  if (!showMeals) lockedItems.push(t('settingsV1.squadVisLockMeals'));
  if (!showWorkouts) lockedItems.push(t('settingsV1.squadVisLockWorkouts'));

  const disabled = saving || isOnline === false || !settings;

  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide">
      <View style={styles.root} testID={testID}>
        <View style={[styles.topBar, { paddingTop: Math.max(space.sm, insets.top + 6) }]}>
          <Pressable
            onPress={onClose}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('squadDesign.back')}
            style={({ pressed }) => [styles.backButton, pressed ? styles.backPressed : null]}
            testID="btn-close-per-room"
          >
            <ChevronLeftIcon size={18} color={colors.textHi} />
          </Pressable>
          <Text
            variant="titleS"
            color="textHi"
            accessibilityRole="header"
            style={styles.headerTitle}
          >
            {t('settingsV1.squadVisTitle')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(space.xxl, insets.bottom + space.xl) },
          ]}
        >
          <View style={styles.innerWrap}>
            {rooms.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text variant="body" color="textMid" style={styles.centeredText}>
                  {t('settingsV1.squadVisNoSquads')}
                </Text>
              </View>
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsRow}
                >
                  {rooms.map((room) => (
                    <Chip
                      key={room.id}
                      label={room.name}
                      selected={room.id === activeRoomId}
                      onPress={() => setSelectedRoomId(room.id)}
                      testID={`room-option-${room.id}`}
                    />
                  ))}
                </ScrollView>

                <Text variant="meta" color="textLo" style={styles.helperIntro}>
                  {t('settingsV1.squadVisSub')}
                </Text>

                {isOnline === false ? (
                  <Text variant="meta" color="apricot">
                    {t('roomAudit.onlinePrivacy')}
                  </Text>
                ) : null}

                {loading && !settings ? (
                  <View style={styles.loadingCard}>
                    <ActivityIndicator color={colors.apricot} />
                  </View>
                ) : null}

                {error ? (
                  <View style={styles.errorBox}>
                    <Text variant="meta" color="danger" accessibilityRole="alert">
                      {error}
                    </Text>
                    {!settings && activeRoomId ? (
                      <PrimaryButton
                        title={t('common.retry')}
                        onPress={() => void loadRoomPrivacy(activeRoomId)}
                        compact
                      />
                    ) : null}
                  </View>
                ) : null}

                {settings ? (
                  <View style={styles.cardBox}>
                    <View style={[styles.row, styles.rowDivider]}>
                      <View style={styles.rowText}>
                        <Text variant="label" color="textHi" style={styles.rowTitle}>
                          {t('settingsV1.squadVisCalories')}
                        </Text>
                      </View>
                      <Switch
                        value={showCalories}
                        disabled={disabled}
                        onValueChange={(val) => void patchPrivacy({ share_calories_macros: val })}
                        accessibilityLabel={t('settingsV1.squadVisCalories')}
                        testID="visibility-toggle-calories"
                      />
                    </View>

                    <View style={[styles.row, styles.rowDivider]}>
                      <View style={styles.rowText}>
                        <Text variant="label" color="textHi" style={styles.rowTitle}>
                          {t('settingsV1.squadVisWeight')}
                        </Text>
                      </View>
                      <Switch
                        value={showWeight}
                        disabled={disabled}
                        onValueChange={(val) =>
                          void patchPrivacy({
                            share_weight_number: val,
                            share_weight_progress: val,
                          })
                        }
                        accessibilityLabel={t('settingsV1.squadVisWeight')}
                        testID="visibility-toggle-weight"
                      />
                    </View>

                    <View style={[styles.row, styles.rowDivider]}>
                      <View style={styles.rowText}>
                        <Text variant="label" color="textHi" style={styles.rowTitle}>
                          {t('settingsV1.squadVisMeals')}
                        </Text>
                        <Text variant="meta" color="textLo">
                          {t('settingsV1.squadVisProCompareSub')}
                        </Text>
                      </View>
                      <Switch
                        value={showMeals}
                        disabled={disabled}
                        onValueChange={(val) =>
                          void patchPrivacy({ share_meals: val ? 'always' : 'never' })
                        }
                        accessibilityLabel={t('settingsV1.squadVisMeals')}
                        testID="visibility-toggle-meals"
                      />
                    </View>

                    <View style={styles.row}>
                      <View style={styles.rowText}>
                        <Text variant="label" color="textHi" style={styles.rowTitle}>
                          {t('settingsV1.squadVisWorkouts')}
                        </Text>
                        <Text variant="meta" color="textLo">
                          {t('settingsV1.squadVisProCompareSub')}
                        </Text>
                      </View>
                      <Switch
                        value={showWorkouts}
                        disabled={disabled}
                        onValueChange={(val) =>
                          void patchPrivacy({
                            share_workouts: val,
                            share_workout_details: val,
                          })
                        }
                        accessibilityLabel={t('settingsV1.squadVisWorkouts')}
                        testID="visibility-toggle-workouts"
                      />
                    </View>
                  </View>
                ) : null}

                {settings ? (
                  <View style={styles.previewBlock}>
                    <Text variant="eyebrow" color="textLo" style={styles.eyebrow}>
                      {t('settingsV1.squadVisPreviewEyebrow')}
                    </Text>
                    <View style={styles.previewCard}>
                      <View style={styles.previewTopRow}>
                        <View style={styles.previewAvatar}>
                          <Text variant="buttonS" color="onBrand">
                            {avatarInitial}
                          </Text>
                        </View>
                        <View style={styles.previewBody}>
                          <Text variant="label" color="textHi" style={styles.rowTitle}>
                            {displayName}
                          </Text>
                          <Text variant="meta" color="textLo">
                            {previewActivity}
                          </Text>
                        </View>
                        <Text variant="numS" color="textHi" tabular>
                          {selfScorePct != null ? `${Math.round(selfScorePct)}%` : '0%'}
                        </Text>
                      </View>

                      {lockedItems.length > 0 ? (
                        <View style={styles.lockChipsRow}>
                          {lockedItems.map((item) => (
                            <View key={item} style={styles.lockChip}>
                              <LockIcon size={11} color={colors.textLo} />
                              <Text variant="micro" color="textLo">
                                {item}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: space.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: {
    backgroundColor: colors.s2,
  },
  headerTitle: {
    fontFamily: fonts.semibold,
    fontSize: 17,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space.xs,
  },
  innerWrap: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: space.md,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingVertical: space.xs,
  },
  helperIntro: {
    lineHeight: 19,
  },
  emptyCard: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    padding: space.xxl,
  },
  centeredText: {
    textAlign: 'center',
  },
  loadingCard: {
    paddingVertical: space.xxl,
    alignItems: 'center',
  },
  errorBox: {
    gap: space.sm,
  },
  cardBox: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 2,
    minHeight: 58,
    gap: space.md,
  },
  rowDivider: {
    borderBottomWidth: borders.width,
    borderBottomColor: colors.hairline,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  previewBlock: {
    gap: space.xs + 2,
    marginTop: space.xs,
  },
  eyebrow: {
    paddingHorizontal: 2,
  },
  previewCard: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.md,
  },
  previewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  previewAvatar: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBody: {
    flex: 1,
    gap: 2,
  },
  lockChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  lockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 1,
    borderRadius: radius.full,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
  },
});
