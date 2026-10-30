import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { isQuietHours, type NotificationSettings } from '@calipartner/core';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { useRooms } from '@/hooks/useRooms';
import { t } from '@/i18n';
import { getNotificationPermissionStatus } from '@/services/notificationPermissionService';
import { isRoomChatMuted } from '@/services/notificationSettingsService';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { NotificationPrimerModal } from './NotificationPrimerModal';

export interface NotificationSettingsScreenProps {
  onBack?: () => void;
  testID?: string;
}

export function NotificationSettingsScreen({
  onBack,
  testID = 'notification-settings-screen',
}: NotificationSettingsScreenProps) {
  const router = useRouter();
  const { colors } = useTheme();

  const { settings, isLoading, error, updateSettings, muteRoomChat, refresh } =
    useNotificationSettings();

  const { rooms, loading: roomsLoading } = useRooms();

  const [permissionStatus, setPermissionStatus] = useState<Notifications.PermissionStatus>(
    Notifications.PermissionStatus.GRANTED,
  );
  const [showPrimer, setShowPrimer] = useState(false);
  const [mutedRooms, setMutedRooms] = useState<Record<string, boolean>>({});
  const [loadingMuteRooms, setLoadingMuteRooms] = useState(false);

  // Quiet hours local input state
  const [quietStartInput, setQuietStartInput] = useState('');
  const [quietEndInput, setQuietEndInput] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync inputs with settings
  useEffect(() => {
    if (settings) {
      setQuietStartInput(settings.quiet_hours_start || '22:00');
      setQuietEndInput(settings.quiet_hours_end || '07:00');
    }
  }, [settings]);

  // Check system permission status
  useEffect(() => {
    let mounted = true;
    getNotificationPermissionStatus().then((status) => {
      if (mounted) setPermissionStatus(status);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch mute status for each room
  useEffect(() => {
    if (!rooms || rooms.length === 0) return;
    let mounted = true;
    setLoadingMuteRooms(true);

    Promise.all(
      rooms.map(async (room) => {
        const muted = await isRoomChatMuted(room.id);
        return { id: room.id, muted };
      }),
    )
      .then((results) => {
        if (!mounted) return;
        const map: Record<string, boolean> = {};
        for (const item of results) {
          map[item.id] = item.muted;
        }
        setMutedRooms(map);
      })
      .finally(() => {
        if (mounted) setLoadingMuteRooms(false);
      });

    return () => {
      mounted = false;
    };
  }, [rooms]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2000);
  };

  const handleToggle = async (key: keyof NotificationSettings, value: boolean) => {
    if (!settings) return;
    const res = await updateSettings({ [key]: value });
    if (res) {
      showToast(t('notifications.saveSuccess'));
    }
  };

  const handleQuietHoursBlur = async () => {
    if (!settings) return;
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    const validStart = timeRegex.test(quietStartInput.trim());
    const validEnd = timeRegex.test(quietEndInput.trim());

    if (!validStart || !validEnd) {
      Alert.alert(
        t('notifications.quietHours.sectionTitle'),
        t('notifications.quietHours.invalidTimeError'),
      );
      setQuietStartInput(settings.quiet_hours_start || '22:00');
      setQuietEndInput(settings.quiet_hours_end || '07:00');
      return;
    }

    if (
      quietStartInput.trim() !== settings.quiet_hours_start ||
      quietEndInput.trim() !== settings.quiet_hours_end
    ) {
      const res = await updateSettings({
        quiet_hours_start: quietStartInput.trim(),
        quiet_hours_end: quietEndInput.trim(),
      });
      if (res) {
        showToast(t('notifications.saveSuccess'));
      }
    }
  };

  const handleRoomMuteToggle = async (roomId: string, currentMuted: boolean) => {
    const nextMuted = !currentMuted;
    setMutedRooms((prev) => ({ ...prev, [roomId]: nextMuted }));
    const ok = await muteRoomChat(roomId, nextMuted);
    if (!ok) {
      // Revert on failure
      setMutedRooms((prev) => ({ ...prev, [roomId]: currentMuted }));
    } else {
      showToast(t('notifications.saveSuccess'));
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  // Determine current quiet hours status
  const now = new Date();
  const currentLocalTime = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes(),
  ).padStart(2, '0')}`;
  const isCurrentlyInQuietHours =
    Boolean(settings?.quiet_hours_enabled) &&
    isQuietHours(
      currentLocalTime,
      settings?.quiet_hours_start || '22:00',
      settings?.quiet_hours_end || '07:00',
    );

  if (isLoading) {
    return (
      <View
        style={[styles.container, styles.center, { backgroundColor: colors.background }]}
        testID={`${testID}-loading`}
      >
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.statusText, { color: colors.textMuted }]}>
          {t('notifications.loading')}
        </Text>
      </View>
    );
  }

  if (error && !settings) {
    return (
      <View
        style={[styles.container, styles.center, { backgroundColor: colors.background }]}
        testID={`${testID}-error`}
      >
        <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>{t('notifications.error')}</Text>
        <Text style={[styles.statusText, { color: colors.textMuted, marginBottom: spacing.md }]}>
          {error}
        </Text>
        <Pressable
          testID="btn-retry-notification-settings"
          accessibilityRole="button"
          accessibilityLabel={t('notifications.retry')}
          style={[styles.primaryButton, { backgroundColor: colors.accent }]}
          onPress={() => refresh()}
        >
          <Text style={[styles.primaryButtonText, { color: colors.onAccent }]}>
            {t('notifications.retry')}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!settings) {
    return (
      <View
        style={[styles.container, styles.center, { backgroundColor: colors.background }]}
        testID={`${testID}-empty`}
      >
        <Text style={[styles.statusText, { color: colors.textMuted }]}>
          {t('notifications.empty')}
        </Text>
      </View>
    );
  }

  const isPaused = settings.pause_all;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID={testID}>
      {/* Top Header */}
      <View
        style={[styles.header, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Pressable
          testID="btn-notification-settings-back"
          accessibilityRole="button"
          accessibilityLabel={t('notifications.back')}
          style={styles.backButton}
          onPress={handleBack}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('notifications.title')}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            {t('notifications.subtitle')}
          </Text>
        </View>
      </View>

      {/* Floating Save Toast */}
      {toastMessage && (
        <View
          style={[styles.toast, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
        >
          <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
          <Text style={[styles.toastText, { color: colors.text }]}>{toastMessage}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Permission Priming Banner if not Granted */}
        {permissionStatus !== Notifications.PermissionStatus.GRANTED && (
          <Pressable
            testID="btn-primer-prompt"
            accessibilityRole="button"
            accessibilityLabel={t('notifications.permission.primerTitle')}
            style={[
              styles.banner,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            ]}
            onPress={() => setShowPrimer(true)}
          >
            <Ionicons name="notifications-circle-outline" size={32} color={colors.accent} />
            <View style={styles.bannerText}>
              <Text style={[styles.bannerTitle, { color: colors.text }]}>
                {t('notifications.permission.primerTitle')}
              </Text>
              <Text style={[styles.bannerSubtitle, { color: colors.textMuted }]}>
                {t('notifications.permission.enableButton')} →
              </Text>
            </View>
          </Pressable>
        )}

        {/* Master Pause Switch Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                {t('notifications.pauseAll.title')}
              </Text>
              <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
                {t('notifications.pauseAll.description')}
              </Text>
            </View>
            <Switch
              testID="switch-pause-all"
              accessibilityRole="switch"
              accessibilityLabel={t('notifications.pauseAll.title')}
              accessibilityState={{ checked: isPaused }}
              value={isPaused}
              onValueChange={(val) => handleToggle('pause_all', val)}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surface}
            />
          </View>
        </View>

        {/* Section: Push Notifications */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('notifications.types.sectionTitle')}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: isPaused ? 0.45 : 1,
            },
          ]}
          pointerEvents={isPaused ? 'none' : 'auto'}
        >
          {/* Nudge */}
          <SettingToggleRow
            testID="switch-nudge"
            title={t('notifications.types.nudge')}
            desc={t('notifications.types.nudgeDesc')}
            value={settings.nudge_enabled}
            onChange={(val) => handleToggle('nudge_enabled', val)}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Partner Activity */}
          <SettingToggleRow
            testID="switch-partner-activity"
            title={t('notifications.types.partnerActivity')}
            desc={t('notifications.types.partnerActivityDesc')}
            value={settings.partner_activity_enabled}
            onChange={(val) => handleToggle('partner_activity_enabled', val)}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Room Requests */}
          <SettingToggleRow
            testID="switch-room-requests"
            title={t('notifications.types.roomRequests')}
            desc={t('notifications.types.roomRequestsDesc')}
            value={settings.room_requests_enabled}
            onChange={(val) => handleToggle('room_requests_enabled', val)}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Chat Messages */}
          <SettingToggleRow
            testID="switch-chat-messages"
            title={t('notifications.types.chatMessages')}
            desc={t('notifications.types.chatMessagesDesc')}
            value={settings.chat_messages_enabled}
            onChange={(val) => handleToggle('chat_messages_enabled', val)}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Streak Reminders */}
          <SettingToggleRow
            testID="switch-streak-reminders"
            title={t('notifications.types.streakReminders')}
            desc={t('notifications.types.streakRemindersDesc')}
            value={settings.streak_reminders_enabled}
            onChange={(val) => handleToggle('streak_reminders_enabled', val)}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Weekly Summary */}
          <SettingToggleRow
            testID="switch-weekly-summary"
            title={t('notifications.types.weeklySummary')}
            desc={t('notifications.types.weeklySummaryDesc')}
            value={settings.weekly_summary_enabled}
            onChange={(val) => handleToggle('weekly_summary_enabled', val)}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Room Trial */}
          <SettingToggleRow
            testID="switch-trial-reminders"
            title={t('notifications.types.trialReminders')}
            desc={t('notifications.types.trialRemindersDesc')}
            value={settings.trial_reminders_enabled}
            onChange={(val) => handleToggle('trial_reminders_enabled', val)}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Billing Alerts */}
          <SettingToggleRow
            testID="switch-billing-alerts"
            title={t('notifications.types.billingAlerts')}
            desc={t('notifications.types.billingAlertsDesc')}
            value={settings.billing_alerts_enabled}
            onChange={(val) => handleToggle('billing_alerts_enabled', val)}
            colors={colors}
          />
        </View>

        {/* Section: Daily Local Reminders */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('notifications.localReminders.sectionTitle')}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: isPaused ? 0.45 : 1,
            },
          ]}
          pointerEvents={isPaused ? 'none' : 'auto'}
        >
          {/* Meals */}
          <SettingToggleRow
            testID="switch-meal-reminders"
            title={t('notifications.localReminders.meals')}
            desc={t('notifications.localReminders.mealsDesc')}
            value={settings.meal_reminders_enabled}
            onChange={(val) => handleToggle('meal_reminders_enabled', val)}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Water */}
          <SettingToggleRow
            testID="switch-water-reminders"
            title={t('notifications.localReminders.water')}
            desc={t('notifications.localReminders.waterDesc')}
            value={settings.water_reminders_enabled}
            onChange={(val) => handleToggle('water_reminders_enabled', val)}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Weigh In */}
          <SettingToggleRow
            testID="switch-weigh-in-reminders"
            title={t('notifications.localReminders.weighIn')}
            desc={t('notifications.localReminders.weighInDesc')}
            value={settings.weigh_in_reminders_enabled}
            onChange={(val) => handleToggle('weigh_in_reminders_enabled', val)}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Fasting */}
          <SettingToggleRow
            testID="switch-fasting-reminders"
            title={t('notifications.localReminders.fasting')}
            desc={t('notifications.localReminders.fastingDesc')}
            value={settings.fasting_reminders_enabled}
            onChange={(val) => handleToggle('fasting_reminders_enabled', val)}
            colors={colors}
          />
        </View>

        {/* Section: Quiet Hours */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('notifications.quietHours.sectionTitle')}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: isPaused ? 0.45 : 1,
            },
          ]}
          pointerEvents={isPaused ? 'none' : 'auto'}
        >
          <SettingToggleRow
            testID="switch-quiet-hours"
            title={t('notifications.quietHours.enable')}
            desc={t('notifications.quietHours.enableDesc')}
            value={settings.quiet_hours_enabled}
            onChange={(val) => handleToggle('quiet_hours_enabled', val)}
            colors={colors}
          />

          {settings.quiet_hours_enabled && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.timeInputsRow}>
                <View style={styles.timeInputCol}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                    {t('notifications.quietHours.startLabel')}
                  </Text>
                  <TextInput
                    testID="input-quiet-hours-start"
                    accessibilityLabel={t('notifications.quietHours.startLabel')}
                    style={[
                      styles.timeInput,
                      {
                        backgroundColor: colors.surfaceAlt,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    value={quietStartInput}
                    onChangeText={setQuietStartInput}
                    onBlur={handleQuietHoursBlur}
                    placeholder="22:00"
                    placeholderTextColor={colors.textMuted}
                    maxLength={5}
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.timeInputCol}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                    {t('notifications.quietHours.endLabel')}
                  </Text>
                  <TextInput
                    testID="input-quiet-hours-end"
                    accessibilityLabel={t('notifications.quietHours.endLabel')}
                    style={[
                      styles.timeInput,
                      {
                        backgroundColor: colors.surfaceAlt,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    value={quietEndInput}
                    onChangeText={setQuietEndInput}
                    onBlur={handleQuietHoursBlur}
                    placeholder="07:00"
                    placeholderTextColor={colors.textMuted}
                    maxLength={5}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {isCurrentlyInQuietHours && (
                <View
                  style={[
                    styles.quietBadge,
                    { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                  ]}
                >
                  <Ionicons name="moon-outline" size={16} color={colors.accent} />
                  <Text style={[styles.quietBadgeText, { color: colors.text }]}>
                    {t('notifications.quietHours.activeNotice', {
                      start: settings.quiet_hours_start,
                      end: settings.quiet_hours_end,
                    })}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Section: Chat Privacy */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('notifications.chatPrivacy.sectionTitle')}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: isPaused ? 0.45 : 1,
            },
          ]}
          pointerEvents={isPaused ? 'none' : 'auto'}
        >
          <SettingToggleRow
            testID="switch-hide-previews"
            title={t('notifications.chatPrivacy.hidePreviews')}
            desc={t('notifications.chatPrivacy.hidePreviewsDesc')}
            value={settings.hide_previews}
            onChange={(val) => handleToggle('hide_previews', val)}
            colors={colors}
          />
        </View>

        {/* Section: Mute Specific Rooms */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('notifications.roomMute.sectionTitle')}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: isPaused ? 0.45 : 1,
            },
          ]}
          pointerEvents={isPaused ? 'none' : 'auto'}
        >
          {roomsLoading || loadingMuteRooms ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : rooms.length === 0 ? (
            <View style={styles.emptyRooms}>
              <Text style={[styles.emptyRoomsText, { color: colors.textMuted }]}>
                {t('notifications.roomMute.noRooms')}
              </Text>
            </View>
          ) : (
            rooms.map((room, index) => {
              const isMuted = Boolean(mutedRooms[room.id]);
              return (
                <React.Fragment key={room.id}>
                  {index > 0 && (
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  )}
                  <View style={styles.row}>
                    <View style={styles.rowText}>
                      <Text style={[styles.rowTitle, { color: colors.text }]}>{room.name}</Text>
                      <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
                        {isMuted ? t('notifications.statusMuted') : t('notifications.statusActive')}
                      </Text>
                    </View>
                    <Switch
                      testID={`switch-room-mute-${room.id}`}
                      accessibilityRole="switch"
                      accessibilityLabel={`${room.name} ${isMuted ? 'Muted' : 'Unmuted'}`}
                      accessibilityState={{ checked: isMuted }}
                      value={isMuted}
                      onValueChange={() => handleRoomMuteToggle(room.id, isMuted)}
                      trackColor={{ false: colors.border, true: colors.accent }}
                      thumbColor={colors.surface}
                    />
                  </View>
                </React.Fragment>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Permission Primer Modal */}
      <NotificationPrimerModal
        visible={showPrimer}
        context="settings_manual"
        onGranted={() => {
          setPermissionStatus(Notifications.PermissionStatus.GRANTED);
          showToast(t('notifications.saveSuccess'));
        }}
        onDismiss={() => setShowPrimer(false)}
      />
    </View>
  );
}

interface SettingToggleRowProps {
  testID: string;
  title: string;
  desc: string;
  value: boolean;
  onChange: (val: boolean) => void;
  colors: {
    text: string;
    textMuted: string;
    border: string;
    surface: string;
    accent: string;
  };
}

function SettingToggleRow({ testID, title, desc, value, onChange, colors }: SettingToggleRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.rowDesc, { color: colors.textMuted }]}>{desc}</Text>
      </View>
      <Switch
        testID={testID}
        accessibilityRole="switch"
        accessibilityLabel={title}
        accessibilityState={{ checked: value }}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 48 : spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  toast: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 70,
    alignSelf: 'center',
    zIndex: 99,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toastText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  bannerSubtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  sectionHeader: {
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    minHeight: 52,
  },
  rowText: {
    flex: 1,
    paddingRight: spacing.md,
  },
  rowTitle: {
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  rowDesc: {
    fontSize: fontSize.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  timeInputsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  timeInputCol: {
    flex: 1,
  },
  inputLabel: {
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  timeInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  quietBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  quietBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  inlineLoading: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  emptyRooms: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  emptyRoomsText: {
    fontSize: fontSize.sm,
  },
  statusText: {
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  primaryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  primaryButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
