import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isQuietHours, type MealReminderTimes, type NotificationSettings } from '@calipartner/core';
import {
  BellIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Chip,
  MinusIcon,
  PlusIcon,
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
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { useRooms } from '@/hooks/useRooms';
import { t } from '@/i18n';
import { getNotificationPermissionStatus } from '@/services/notificationPermissionService';
import { isRoomChatMuted } from '@/services/notificationSettingsService';
import { NotificationPrimerModal } from './NotificationPrimerModal';

export interface NotificationSettingsScreenProps {
  onBack?: () => void;
  testID?: string;
}

type MealSlot = 'breakfast' | 'lunch' | 'dinner';

const DEFAULT_MEAL_TIMES: Record<MealSlot, string> = {
  breakfast: '08:30',
  lunch: '13:00',
  dinner: '20:00',
};

const WATER_INTERVAL_OPTIONS = [1, 2, 3] as const;

function format12HourTime(hhmm: string): string {
  const [rawH, rawM] = hhmm.split(':');
  const h = parseInt(rawH ?? '8', 10);
  const m = parseInt(rawM ?? '0', 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function stepMinutes(hhmm: string, deltaMinutes: number): string {
  const [rawH, rawM] = hhmm.split(':');
  const h = parseInt(rawH ?? '8', 10);
  const m = parseInt(rawM ?? '0', 10);
  const total =
    ((((Number.isNaN(h) ? 8 : h) * 60 + (Number.isNaN(m) ? 0 : m) + deltaMinutes) % 1440) + 1440) %
    1440;
  const nextH = Math.floor(total / 60);
  const nextM = total % 60;
  return `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`;
}

interface ToggleRowProps {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  testID?: string;
  divider?: boolean;
  disabled?: boolean;
}

function SimpleSwitchRow({
  title,
  subtitle,
  value,
  onValueChange,
  testID,
  divider = false,
  disabled = false,
}: ToggleRowProps) {
  return (
    <View style={divider ? styles.rowDivider : undefined}>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text variant="label" color="textHi" style={styles.rowTitleText}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="meta" color="textLo">
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          accessibilityLabel={title}
          disabled={disabled}
          testID={testID}
        />
      </View>
    </View>
  );
}

export function NotificationSettingsScreen({
  onBack,
  testID = 'notification-settings-screen',
}: NotificationSettingsScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, isLoading, error, updateSettings, muteRoomChat, refresh } =
    useNotificationSettings();
  const { rooms, loading: roomsLoading } = useRooms();

  const [permissionStatus, setPermissionStatus] = useState<Notifications.PermissionStatus>(
    Notifications.PermissionStatus.GRANTED,
  );
  const [showPrimer, setShowPrimer] = useState(false);
  const [mutedRooms, setMutedRooms] = useState<Record<string, boolean>>({});
  const [loadingMuteRooms, setLoadingMuteRooms] = useState(false);
  const [quietStartInput, setQuietStartInput] = useState('22:00');
  const [quietEndInput, setQuietEndInput] = useState('07:00');
  const [showMorePrefs, setShowMorePrefs] = useState(false);
  const [editingMealSlot, setEditingMealSlot] = useState<MealSlot | null>(null);
  const [editingTimeValue, setEditingTimeValue] = useState('08:30');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const lastMealTimesRef = useRef<Record<MealSlot, string>>({ ...DEFAULT_MEAL_TIMES });

  useEffect(() => {
    if (settings) {
      setQuietStartInput(settings.quiet_hours_start || '22:00');
      setQuietEndInput(settings.quiet_hours_end || '07:00');
      for (const slot of ['breakfast', 'lunch', 'dinner'] as const) {
        const val = settings.meal_times?.[slot];
        if (val) lastMealTimesRef.current[slot] = val;
      }
    }
  }, [settings]);

  useEffect(() => {
    let mounted = true;
    void getNotificationPermissionStatus().then((status) => {
      if (mounted) setPermissionStatus(status);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const roomIdsKey = (rooms ?? []).map((room) => room.id).join(',');

  useEffect(() => {
    if (!roomIdsKey) return;
    const roomIds = roomIdsKey.split(',').filter(Boolean);
    let mounted = true;
    setLoadingMuteRooms(true);
    Promise.all(
      roomIds.map(async (roomId) => ({
        id: roomId,
        muted: await isRoomChatMuted(roomId),
      })),
    )
      .then((results) => {
        if (!mounted) return;
        const map: Record<string, boolean> = {};
        for (const item of results) map[item.id] = item.muted;
        setMutedRooms(map);
      })
      .finally(() => {
        if (mounted) setLoadingMuteRooms(false);
      });
    return () => {
      mounted = false;
    };
  }, [roomIdsKey]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 1800);
  };

  const handleToggle = async (key: keyof NotificationSettings, value: boolean) => {
    if (!settings) return;
    const saved = await updateSettings({ [key]: value });
    if (saved) showToast(t('notifications.saveSuccess'));
  };

  const handleMealSlotToggle = async (slot: MealSlot, enabled: boolean) => {
    if (!settings) return;
    const nextTimes: MealReminderTimes = { ...(settings.meal_times ?? {}) };
    if (enabled) {
      nextTimes[slot] = lastMealTimesRef.current[slot] || DEFAULT_MEAL_TIMES[slot];
    } else {
      if (nextTimes[slot]) lastMealTimesRef.current[slot] = nextTimes[slot]!;
      nextTimes[slot] = '';
    }
    const anyMealActive = Boolean(
      nextTimes.breakfast || nextTimes.lunch || nextTimes.dinner || nextTimes.snacks,
    );
    const saved = await updateSettings({
      meal_times: nextTimes,
      meal_reminders_enabled: anyMealActive,
    });
    if (saved) showToast(t('notifications.saveSuccess'));
  };

  const handleWaterIntervalSelect = async (hours: number) => {
    if (!settings) return;
    const saved = await updateSettings({
      water_interval_hours: hours,
      water_reminders_enabled: true,
    });
    if (saved) showToast(t('notifications.saveSuccess'));
  };

  const handleSaveMealTime = async () => {
    if (!settings || !editingMealSlot) return;
    lastMealTimesRef.current[editingMealSlot] = editingTimeValue;
    const nextTimes: MealReminderTimes = {
      ...(settings.meal_times ?? {}),
      [editingMealSlot]: editingTimeValue,
    };
    setEditingMealSlot(null);
    const saved = await updateSettings({
      meal_times: nextTimes,
      meal_reminders_enabled: true,
    });
    if (saved) showToast(t('notifications.saveSuccess'));
  };

  const handleQuietHoursBlur = async () => {
    if (!settings) return;
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(quietStartInput.trim()) || !timeRegex.test(quietEndInput.trim())) {
      setQuietStartInput(settings.quiet_hours_start || '22:00');
      setQuietEndInput(settings.quiet_hours_end || '07:00');
      return;
    }
    if (
      quietStartInput.trim() !== settings.quiet_hours_start ||
      quietEndInput.trim() !== settings.quiet_hours_end
    ) {
      const saved = await updateSettings({
        quiet_hours_start: quietStartInput.trim(),
        quiet_hours_end: quietEndInput.trim(),
      });
      if (saved) showToast(t('notifications.saveSuccess'));
    }
  };

  const handleRoomMuteToggle = async (roomId: string, currentMuted: boolean) => {
    const nextMuted = !currentMuted;
    setMutedRooms((prev) => ({ ...prev, [roomId]: nextMuted }));
    const ok = await muteRoomChat(roomId, nextMuted);
    if (!ok) {
      setMutedRooms((prev) => ({ ...prev, [roomId]: currentMuted }));
    } else {
      showToast(t('notifications.saveSuccess'));
    }
  };

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  if (isLoading) {
    return (
      <View style={[styles.root, styles.centered]} testID={`${testID}-loading`}>
        <ActivityIndicator size="large" color={colors.apricot} />
      </View>
    );
  }

  if (error && !settings) {
    return (
      <View style={[styles.root, styles.centered, styles.errorPad]} testID={`${testID}-error`}>
        <Text variant="titleS" color="textHi">
          {t('notifications.error')}
        </Text>
        <Text variant="meta" color="textLo" style={styles.errorCenter}>
          {error}
        </Text>
        <PrimaryButton
          title={t('notifications.retry')}
          onPress={() => refresh()}
          compact
          testID="btn-retry-notification-settings"
        />
      </View>
    );
  }

  if (!settings) {
    return (
      <View style={[styles.root, styles.centered]} testID={`${testID}-empty`}>
        <Text variant="meta" color="textLo">
          {t('notifications.empty')}
        </Text>
      </View>
    );
  }

  const pushEnabled = !settings.pause_all;
  const now = new Date();
  const currentLocalTime = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes(),
  ).padStart(2, '0')}`;
  const isCurrentlyInQuietHours =
    Boolean(settings.quiet_hours_enabled) &&
    isQuietHours(
      currentLocalTime,
      settings.quiet_hours_start || '22:00',
      settings.quiet_hours_end || '07:00',
    );

  const mealRows: Array<{ slot: MealSlot; label: string }> = [
    { slot: 'breakfast', label: t('settingsV1.notifBreakfast') },
    { slot: 'lunch', label: t('settingsV1.notifLunch') },
    { slot: 'dinner', label: t('settingsV1.notifDinner') },
  ];

  return (
    <View style={styles.root} testID={testID}>
      <View style={[styles.topBar, { paddingTop: Math.max(space.sm, insets.top + 6) }]}>
        <Pressable
          onPress={handleBack}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('notifications.back')}
          style={({ pressed }) => [styles.backButton, pressed ? styles.backPressed : null]}
          testID="btn-notification-settings-back"
        >
          <ChevronLeftIcon size={18} color={colors.textHi} />
        </Pressable>
        <Text variant="titleS" color="textHi" accessibilityRole="header" style={styles.headerTitle}>
          {t('settingsV1.notifTitle')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {toastMessage ? (
        <View style={styles.toastPill}>
          <CheckIcon size={14} color={colors.apricot} />
          <Text variant="meta" color="textHi">
            {toastMessage}
          </Text>
        </View>
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(space.xxl, insets.bottom + space.xl) },
        ]}
      >
        <View style={styles.innerWrap}>
          {permissionStatus !== Notifications.PermissionStatus.GRANTED ? (
            <Pressable
              testID="btn-primer-prompt"
              accessibilityRole="button"
              accessibilityLabel={t('notifications.permission.primerTitle')}
              onPress={() => setShowPrimer(true)}
              style={({ pressed }) => [
                styles.cardBox,
                styles.bannerRow,
                pressed ? styles.rowPressed : null,
              ]}
            >
              <View style={styles.bannerIconTile}>
                <BellIcon size={18} color={colors.apricot} />
              </View>
              <View style={styles.rowText}>
                <Text variant="label" color="textHi" style={styles.rowTitleText}>
                  {t('notifications.permission.primerTitle')}
                </Text>
                <Text variant="meta" color="apricot">
                  {t('notifications.permission.enableButton')}
                </Text>
              </View>
              <ChevronRightIcon size={16} color={colors.textLo} />
            </Pressable>
          ) : null}

          {error ? (
            <Text variant="meta" color="danger" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          {/* Top Master Switch Card */}
          <View style={styles.cardBox}>
            <SimpleSwitchRow
              title={t('settingsV1.notifPushTitle')}
              subtitle={t('settingsV1.notifPushSub')}
              value={pushEnabled}
              onValueChange={(val) => void handleToggle('pause_all', !val)}
              testID="switch-pause-all"
            />
          </View>

          <View
            style={[styles.groupStack, !pushEnabled ? styles.dimmedGroup : null]}
            pointerEvents={pushEnabled ? 'auto' : 'none'}
          >
            {/* MEALS */}
            <View style={styles.sectionBlock}>
              <Text variant="eyebrow" color="textLo" style={styles.eyebrow}>
                {t('settingsV1.notifMealsEyebrow')}
              </Text>
              <View style={styles.cardBox}>
                {mealRows.map((row, idx) => {
                  const configuredTime = settings.meal_times?.[row.slot];
                  const isMealOn =
                    Boolean(settings.meal_reminders_enabled) && Boolean(configuredTime);
                  const displayTime =
                    configuredTime ||
                    lastMealTimesRef.current[row.slot] ||
                    DEFAULT_MEAL_TIMES[row.slot];
                  return (
                    <View
                      key={row.slot}
                      style={[styles.row, idx < mealRows.length - 1 ? styles.rowDivider : null]}
                    >
                      <Text
                        variant="label"
                        color="textHi"
                        style={[styles.rowText, styles.rowTitleText]}
                      >
                        {row.label}
                      </Text>
                      <View style={styles.mealRightCluster}>
                        <Pressable
                          onPress={() => {
                            setEditingMealSlot(row.slot);
                            setEditingTimeValue(displayTime);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`${row.label} ${format12HourTime(displayTime)}`}
                          style={({ pressed }) => [
                            styles.timePill,
                            pressed ? styles.timePillPressed : null,
                          ]}
                          testID={`btn-meal-time-${row.slot}`}
                        >
                          <Text variant="meta" color="textMid" tabular>
                            {format12HourTime(displayTime)}
                          </Text>
                        </Pressable>
                        <Switch
                          value={isMealOn}
                          onValueChange={(val) => void handleMealSlotToggle(row.slot, val)}
                          accessibilityLabel={`${row.label} reminder`}
                          testID={`switch-meal-${row.slot}`}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* HYDRATION */}
            <View style={styles.sectionBlock}>
              <Text variant="eyebrow" color="textLo" style={styles.eyebrow}>
                {t('settingsV1.notifHydrationEyebrow')}
              </Text>
              <View style={[styles.cardBox, styles.hydrationCard]}>
                <SimpleSwitchRow
                  title={t('settingsV1.notifWaterTitle')}
                  subtitle={t('settingsV1.notifWaterSub')}
                  value={settings.water_reminders_enabled}
                  onValueChange={(val) => void handleToggle('water_reminders_enabled', val)}
                  testID="switch-water-reminders"
                />
                <View style={styles.intervalRow}>
                  {WATER_INTERVAL_OPTIONS.map((hours) => {
                    const selected = settings.water_interval_hours === hours;
                    return (
                      <Chip
                        key={hours}
                        label={t('settingsV1.notifEveryHours', { hours })}
                        selected={selected}
                        onPress={() => void handleWaterIntervalSelect(hours)}
                        testID={`chip-water-interval-${hours}h`}
                        style={styles.intervalChip}
                      />
                    );
                  })}
                </View>
              </View>
            </View>

            {/* FASTING AND SQUAD */}
            <View style={styles.sectionBlock}>
              <Text variant="eyebrow" color="textLo" style={styles.eyebrow}>
                {t('settingsV1.notifFastingSquadEyebrow')}
              </Text>
              <View style={styles.cardBox}>
                <SimpleSwitchRow
                  title={t('settingsV1.notifFastingTitle')}
                  subtitle={t('settingsV1.notifFastingSub')}
                  value={settings.fasting_reminders_enabled}
                  onValueChange={(val) => void handleToggle('fasting_reminders_enabled', val)}
                  testID="switch-fasting-reminders"
                  divider
                />
                <SimpleSwitchRow
                  title={t('settingsV1.notifPartnerWorkout')}
                  value={settings.partner_activity_enabled}
                  onValueChange={(val) => void handleToggle('partner_activity_enabled', val)}
                  testID="switch-partner-activity"
                  divider
                />
                <SimpleSwitchRow
                  title={t('settingsV1.notifSquadMessages')}
                  value={settings.chat_messages_enabled}
                  onValueChange={(val) => void handleToggle('chat_messages_enabled', val)}
                  testID="switch-chat-messages"
                />
              </View>
            </View>

            {/* Expandable Advanced Preferences preserving full backend capabilities */}
            <Pressable
              onPress={() => setShowMorePrefs((prev) => !prev)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showMorePrefs }}
              style={styles.moreToggleRow}
              testID="btn-notif-more-prefs"
            >
              <Text variant="meta" color="textLo">
                {t('settingsV1.notifMorePrefs')}
              </Text>
              <ChevronDownIcon size={15} color={colors.textLo} />
            </Pressable>

            {showMorePrefs ? (
              <View style={styles.groupStack}>
                <View style={styles.cardBox}>
                  <SimpleSwitchRow
                    title={t('notifications.types.nudge')}
                    subtitle={t('notifications.types.nudgeDesc')}
                    value={settings.nudge_enabled}
                    onValueChange={(val) => void handleToggle('nudge_enabled', val)}
                    testID="switch-nudge"
                    divider
                  />
                  <SimpleSwitchRow
                    title={t('notifications.types.roomRequests')}
                    subtitle={t('notifications.types.roomRequestsDesc')}
                    value={settings.room_requests_enabled}
                    onValueChange={(val) => void handleToggle('room_requests_enabled', val)}
                    testID="switch-room-requests"
                    divider
                  />
                  <SimpleSwitchRow
                    title={t('notifications.types.streakReminders')}
                    subtitle={t('notifications.types.streakRemindersDesc')}
                    value={settings.streak_reminders_enabled}
                    onValueChange={(val) => void handleToggle('streak_reminders_enabled', val)}
                    testID="switch-streak-reminders"
                    divider
                  />
                  <SimpleSwitchRow
                    title={t('notifications.types.weeklySummary')}
                    subtitle={t('notifications.types.weeklySummaryDesc')}
                    value={settings.weekly_summary_enabled}
                    onValueChange={(val) => void handleToggle('weekly_summary_enabled', val)}
                    testID="switch-weekly-summary"
                    divider
                  />
                  <SimpleSwitchRow
                    title={t('notifications.localReminders.weighIn')}
                    subtitle={t('notifications.localReminders.weighInDesc')}
                    value={settings.weigh_in_reminders_enabled}
                    onValueChange={(val) => void handleToggle('weigh_in_reminders_enabled', val)}
                    testID="switch-weigh-in-reminders"
                    divider
                  />
                  <SimpleSwitchRow
                    title={t('notifications.chatPrivacy.hidePreviews')}
                    subtitle={t('notifications.chatPrivacy.hidePreviewsDesc')}
                    value={settings.hide_previews}
                    onValueChange={(val) => void handleToggle('hide_previews', val)}
                    testID="switch-hide-previews"
                  />
                </View>

                <View style={styles.cardBox}>
                  <SimpleSwitchRow
                    title={t('notifications.quietHours.enable')}
                    subtitle={
                      isCurrentlyInQuietHours
                        ? t('notifications.quietHours.activeNotice', {
                            start: settings.quiet_hours_start,
                            end: settings.quiet_hours_end,
                          })
                        : t('notifications.quietHours.enableDesc')
                    }
                    value={settings.quiet_hours_enabled}
                    onValueChange={(val) => void handleToggle('quiet_hours_enabled', val)}
                    testID="switch-quiet-hours"
                  />
                  {settings.quiet_hours_enabled ? (
                    <View style={[styles.rowDividerTop, styles.quietInputsRow]}>
                      <View style={styles.quietCol}>
                        <Text variant="micro" color="textLo">
                          {t('notifications.quietHours.startLabel')}
                        </Text>
                        <TextInput
                          testID="input-quiet-hours-start"
                          accessibilityLabel={t('notifications.quietHours.startLabel')}
                          style={styles.quietInput}
                          value={quietStartInput}
                          onChangeText={setQuietStartInput}
                          onBlur={() => void handleQuietHoursBlur()}
                          placeholder="22:00"
                          placeholderTextColor={colors.textOff}
                          maxLength={5}
                        />
                      </View>
                      <View style={styles.quietCol}>
                        <Text variant="micro" color="textLo">
                          {t('notifications.quietHours.endLabel')}
                        </Text>
                        <TextInput
                          testID="input-quiet-hours-end"
                          accessibilityLabel={t('notifications.quietHours.endLabel')}
                          style={styles.quietInput}
                          value={quietEndInput}
                          onChangeText={setQuietEndInput}
                          onBlur={() => void handleQuietHoursBlur()}
                          placeholder="07:00"
                          placeholderTextColor={colors.textOff}
                          maxLength={5}
                        />
                      </View>
                    </View>
                  ) : null}
                </View>

                {rooms.length > 0 && !loadingMuteRooms && !roomsLoading ? (
                  <View style={styles.cardBox}>
                    {rooms.map((room, idx) => {
                      const isMuted = Boolean(mutedRooms[room.id]);
                      return (
                        <SimpleSwitchRow
                          key={room.id}
                          title={room.name}
                          subtitle={
                            isMuted
                              ? t('settingsV1.notifMutedLabel')
                              : t('settingsV1.notifActiveLabel')
                          }
                          value={isMuted}
                          onValueChange={() => void handleRoomMuteToggle(room.id, isMuted)}
                          testID={`switch-mute-room-${room.id}`}
                          divider={idx < rooms.length - 1}
                        />
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* Meal reminder time adjustment modal */}
      <Modal
        visible={Boolean(editingMealSlot)}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingMealSlot(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.timeModalCard}>
            <Text variant="titleS" color="textHi" style={styles.timeModalTitle}>
              {editingMealSlot
                ? `${t(`settingsV1.notif${editingMealSlot.charAt(0).toUpperCase()}${editingMealSlot.slice(1)}` as Parameters<typeof t>[0])} · ${t('settingsV1.notifPickTimeTitle')}`
                : t('settingsV1.notifPickTimeTitle')}
            </Text>
            <View style={styles.timeAdjustRow}>
              <Pressable
                onPress={() => setEditingTimeValue((v) => stepMinutes(v, -30))}
                accessibilityRole="button"
                accessibilityLabel="30 minutes earlier"
                style={styles.stepCircle}
                testID="btn-meal-time-minus"
              >
                <MinusIcon size={16} color={colors.textHi} />
              </Pressable>
              <Text variant="numM" color="textHi" tabular style={styles.timeBigValue}>
                {format12HourTime(editingTimeValue)}
              </Text>
              <Pressable
                onPress={() => setEditingTimeValue((v) => stepMinutes(v, 30))}
                accessibilityRole="button"
                accessibilityLabel="30 minutes later"
                style={styles.stepCircle}
                testID="btn-meal-time-plus"
              >
                <PlusIcon size={16} color={colors.textHi} />
              </Pressable>
            </View>
            <View style={styles.timeModalActions}>
              <Pressable
                onPress={() => setEditingMealSlot(null)}
                style={styles.timeCancelBtn}
                accessibilityRole="button"
              >
                <Text variant="buttonS" color="textMid">
                  {t('common.cancel')}
                </Text>
              </Pressable>
              <PrimaryButton
                title={t('common.save')}
                onPress={() => void handleSaveMealTime()}
                compact
                testID="btn-meal-time-save"
              />
            </View>
          </View>
        </View>
      </Modal>

      <NotificationPrimerModal
        visible={showPrimer}
        context="settings_manual"
        onDismiss={() => {
          setShowPrimer(false);
          void getNotificationPermissionStatus().then(setPermissionStatus);
        }}
        onGranted={() => {
          setShowPrimer(false);
          setPermissionStatus(Notifications.PermissionStatus.GRANTED);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg0,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorPad: {
    padding: space.xl,
    gap: space.md,
  },
  errorCenter: {
    textAlign: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: space.md,
    backgroundColor: colors.bg0,
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
  toastPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairlineLit,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 1,
    marginBottom: space.sm,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space.xs,
  },
  innerWrap: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: space.lg,
  },
  groupStack: {
    gap: space.lg,
  },
  dimmedGroup: {
    opacity: 0.48,
  },
  sectionBlock: {
    gap: space.xs + 2,
  },
  eyebrow: {
    paddingHorizontal: 2,
  },
  cardBox: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.md,
  },
  bannerIconTile: {
    width: 36,
    height: 36,
    borderRadius: radius.chip,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowPressed: {
    backgroundColor: colors.s2,
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
  rowDividerTop: {
    borderTopWidth: borders.width,
    borderTopColor: colors.hairline,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitleText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  mealRightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
  },
  timePill: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.full,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    minHeight: 32,
    justifyContent: 'center',
  },
  timePillPressed: {
    backgroundColor: colors.s3,
  },
  hydrationCard: {
    paddingBottom: space.md,
  },
  intervalRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
  },
  intervalChip: {
    flex: 1,
    justifyContent: 'center',
  },
  moreToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingVertical: space.sm,
    minHeight: layout.minTouchTarget,
  },
  quietInputsRow: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  quietCol: {
    flex: 1,
    gap: space.xs,
  },
  quietInput: {
    height: 44,
    borderRadius: radius.control,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    backgroundColor: colors.s2,
    color: colors.textHi,
    fontFamily: fonts.semibold,
    fontSize: 15,
    paddingHorizontal: space.md,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: layout.screenPaddingX,
  },
  timeModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairlineLit,
    borderRadius: radius.card,
    padding: space.xl,
    gap: space.lg,
  },
  timeModalTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    textAlign: 'center',
  },
  timeAdjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.sm,
  },
  stepCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBigValue: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 34,
  },
  timeModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space.md,
  },
  timeCancelBtn: {
    minHeight: 44,
    paddingHorizontal: space.md,
    justifyContent: 'center',
  },
});
