import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FocusSettings } from '@calipartner/core';
import { getFocusSettings, updateFocusSettings } from '@/services/focusService';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface FocusSettingsModalProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
  testID?: string;
}

export function FocusSettingsModal({
  visible,
  userId,
  onClose,
  testID = 'focus-settings-modal',
}: FocusSettingsModalProps) {
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [weeklyGoalHours, setWeeklyGoalHours] = useState('10');
  const [streakMinimumMinutes, setStreakMinimumMinutes] = useState('25');
  const [breakRemindersEnabled, setBreakRemindersEnabled] = useState(true);
  const [defaultLabel, setDefaultLabel] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !userId) return;

    let mounted = true;
    setLoading(true);
    setStatusMsg(null);

    getFocusSettings(userId)
      .then((settings) => {
        if (!mounted) return;
        setWeeklyGoalHours(
          settings.weekly_goal_minutes
            ? String(Math.round(settings.weekly_goal_minutes / 60))
            : '10',
        );
        setStreakMinimumMinutes(String(settings.streak_minimum_minutes || 25));
        setBreakRemindersEnabled(Boolean(settings.break_reminders));
        setDefaultLabel(settings.default_label || '');
      })
      .catch(() => {
        // Fallback default
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [visible, userId]);

  const handleSave = async () => {
    setStatusMsg(null);
    const goalHrs = parseInt(weeklyGoalHours.trim(), 10);
    const streakMin = parseInt(streakMinimumMinutes.trim(), 10);

    const partial: Partial<FocusSettings> = {
      weekly_goal_minutes: !isNaN(goalHrs) && goalHrs > 0 ? goalHrs * 60 : undefined,
      streak_minimum_minutes: !isNaN(streakMin) && streakMin > 0 ? streakMin : 25,
      break_reminders: breakRemindersEnabled,
      default_label: defaultLabel.trim() ? defaultLabel.trim().slice(0, 20) : null,
    };

    try {
      setSaving(true);
      await updateFocusSettings(userId, partial);
      setStatusMsg(t('focus.settings.saveSuccess'));
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: unknown) {
      setStatusMsg((err as { message?: string })?.message || t('common.errorBody'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      testID={testID}
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheetContainer,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('focus.settings.title')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {t('focus.settings.subtitle')}
              </Text>
            </View>
            <Pressable
              testID="btn-close-focus-settings"
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {loading ? (
            <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Weekly Goal (Hours) */}
              <View style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>
                  {t('focus.settings.weeklyGoal')}
                </Text>
                <TextInput
                  testID="input-weekly-goal"
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  keyboardType="number-pad"
                  value={weeklyGoalHours}
                  onChangeText={setWeeklyGoalHours}
                  placeholder="10"
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel={t('focus.settings.weeklyGoal')}
                />
              </View>

              {/* Streak Minimum (Minutes) */}
              <View style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>
                  {t('focus.settings.streakMinimum')}
                </Text>
                <TextInput
                  testID="input-streak-minimum"
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  keyboardType="number-pad"
                  value={streakMinimumMinutes}
                  onChangeText={setStreakMinimumMinutes}
                  placeholder="25"
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel={t('focus.settings.streakMinimum')}
                />
              </View>

              {/* Break Reminders Toggle */}
              <View style={[styles.toggleRow, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>
                    {t('focus.settings.breakReminders')}
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
                    Gentle reminder after 90 minutes of continuous focus
                  </Text>
                </View>
                <Switch
                  testID="switch-break-reminders"
                  value={breakRemindersEnabled}
                  onValueChange={setBreakRemindersEnabled}
                  trackColor={{ false: colors.surfaceAlt, true: colors.accent }}
                  accessibilityLabel={t('focus.settings.breakReminders')}
                />
              </View>

              {/* Default Label */}
              <View style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>
                  {t('focus.settings.defaultLabel')}
                </Text>
                <TextInput
                  testID="input-default-label"
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={defaultLabel}
                  onChangeText={(text) => setDefaultLabel(text.slice(0, 20))}
                  maxLength={20}
                  placeholder="e.g. Deep Work, Study"
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel={t('focus.settings.defaultLabel')}
                />
              </View>

              {/* Status or Error Banner */}
              {Boolean(statusMsg) && (
                <View
                  style={[
                    styles.statusBanner,
                    {
                      backgroundColor: colors.cardHighlight,
                      borderColor: colors.accent,
                    },
                  ]}
                >
                  <Text style={[styles.statusBannerText, { color: colors.accent }]}>
                    {statusMsg}
                  </Text>
                </View>
              )}
            </ScrollView>
          )}

          {/* Save Button */}
          <Pressable
            testID="btn-save-focus-settings"
            onPress={handleSave}
            disabled={saving || loading}
            style={[
              styles.saveBtn,
              { backgroundColor: colors.accent, opacity: saving ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('common.save')}
          >
            {saving ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={[styles.saveBtnText, { color: colors.onAccent }]}>
                {t('common.save')}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
    maxHeight: '85%',
    paddingBottom: 36,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  scrollContent: {
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  fieldWrap: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: fontSize.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  statusBanner: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  statusBannerText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
});
