import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RoomPrivacySettings } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface PrivacySettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onGetPrivacy: () => Promise<RoomPrivacySettings>;
  onUpdatePrivacy: (settings: Partial<RoomPrivacySettings>) => Promise<RoomPrivacySettings>;
}

export function PrivacySettingsModal({
  visible,
  onClose,
  onGetPrivacy,
  onUpdatePrivacy,
}: PrivacySettingsModalProps) {
  const { colors } = useTheme();
  const [settings, setSettings] = useState<RoomPrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      onGetPrivacy()
        .then((s) => setSettings(s))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [visible, onGetPrivacy]);

  const toggleField = async (key: keyof RoomPrivacySettings) => {
    if (!settings) return;
    const updatedVal = !settings[key];
    const newSettings = { ...settings, [key]: updatedVal };
    setSettings(newSettings);
    setSaving(true);
    try {
      await onUpdatePrivacy({ [key]: updatedVal });
    } catch {
      // Revert if error
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  const toggles: {
    key: keyof RoomPrivacySettings;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { key: 'share_streak', label: t('rooms.privacyModal.streak'), icon: 'flame-outline' },
    { key: 'share_goal_completion', label: t('rooms.privacyModal.goalCompletion'), icon: 'pie-chart-outline' },
    { key: 'share_steps', label: t('rooms.privacyModal.steps'), icon: 'footsteps-outline' },
    { key: 'share_water', label: t('rooms.privacyModal.water'), icon: 'water-outline' },
    { key: 'share_workouts', label: t('rooms.privacyModal.workouts'), icon: 'barbell-outline' },
    { key: 'share_workout_details', label: t('rooms.privacyModal.workoutDetails'), icon: 'fitness-outline' },
    { key: 'share_calories_macros', label: t('rooms.privacyModal.caloriesMacros'), icon: 'nutrition-outline' },
    { key: 'share_weight_progress', label: t('rooms.privacyModal.weightProgress'), icon: 'trending-up-outline' },
    { key: 'share_weight_number', label: t('rooms.privacyModal.weightNumber'), icon: 'scale-outline' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTextGroup}>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('rooms.privacyModal.title')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {t('rooms.privacyModal.subtitle')}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel="Close privacy settings"
              testID="btn-close-privacy-modal"
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {/* Notice */}
              <View style={[styles.noticeBox, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="eye-outline" size={16} color={colors.accent} />
                <Text style={[styles.noticeText, { color: colors.textMuted }]}>
                  {t('rooms.privacyModal.sharedEyeNotice')}
                </Text>
              </View>

              {/* Toggles list */}
              <View style={styles.togglesList}>
                {toggles.map((item) => {
                  const isShared = Boolean(settings?.[item.key]);
                  return (
                    <View
                      key={item.key}
                      style={[
                        styles.toggleRow,
                        {
                          backgroundColor: colors.surfaceAlt,
                          borderColor: isShared ? colors.border : 'transparent',
                        },
                      ]}
                    >
                      <View style={styles.toggleLabelRow}>
                        <Ionicons
                          name={isShared ? 'eye' : 'eye-off'}
                          size={18}
                          color={isShared ? colors.accent : colors.textMuted}
                        />
                        <Text style={[styles.toggleLabel, { color: colors.text }]}>
                          {item.label}
                        </Text>
                      </View>

                      <Switch
                        value={isShared}
                        onValueChange={() => toggleField(item.key)}
                        trackColor={{ false: colors.border, true: colors.accent }}
                        thumbColor="#FFFFFF"
                        testID={`switch-${item.key}`}
                      />
                    </View>
                  );
                })}
              </View>

              {/* Preview as Partner Box */}
              <View style={[styles.previewBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <View style={styles.previewHeader}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={colors.accent} />
                  <Text style={[styles.previewTitle, { color: colors.text }]}>
                    {t('rooms.privacyModal.previewTitle')}
                  </Text>
                </View>
                <Text style={[styles.previewSub, { color: colors.textMuted }]}>
                  {t('rooms.privacyModal.previewNotice')}
                </Text>

                <View style={styles.previewItemsRow}>
                  {toggles.map((item) => {
                    const isShared = Boolean(settings?.[item.key]);
                    return (
                      <View
                        key={item.key}
                        style={[
                          styles.previewChip,
                          {
                            backgroundColor: isShared ? colors.cardHighlight : colors.surface,
                            borderColor: isShared ? colors.accent : colors.border,
                          },
                        ]}
                      >
                        <Ionicons
                          name={isShared ? 'checkmark-circle' : 'lock-closed'}
                          size={12}
                          color={isShared ? colors.accent : colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.previewChipText,
                            { color: isShared ? colors.text : colors.textMuted },
                          ]}
                          numberOfLines={1}
                        >
                          {item.label.split('(')[0]?.trim()}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {saving && (
                <View style={styles.savingRow}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text style={[styles.savingText, { color: colors.textMuted }]}>
                    {t('rooms.privacyModal.saving')}
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  headerTextGroup: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.md + 2,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  loadingContainer: {
    paddingVertical: spacing.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  noticeText: {
    fontSize: 11,
    flex: 1,
  },
  togglesList: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 0.5,
  },
  toggleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  toggleLabel: {
    fontSize: fontSize.xs + 1,
    fontWeight: '600',
    flex: 1,
  },
  previewBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  previewTitle: {
    fontSize: fontSize.xs + 1,
    fontWeight: '700',
  },
  previewSub: {
    fontSize: 11,
    marginBottom: spacing.sm,
  },
  previewItemsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  previewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: 4,
  },
  previewChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  savingText: {
    fontSize: fontSize.xs,
  },
});
