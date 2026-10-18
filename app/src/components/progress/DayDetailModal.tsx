import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface DayDetailData {
  date: string;
  calories?: number | null;
  targetCalories?: number | null;
  isLoggedDay?: boolean;
  isGoalDay?: boolean;
  weightKg?: number | null;
  steps?: number | null;
  waterMl?: number | null;
  metricLabel?: string;
  metricValue?: string | number;
}

interface DayDetailModalProps {
  visible: boolean;
  data: DayDetailData | null;
  onClose: () => void;
  testID?: string;
}

export function DayDetailModal({
  visible,
  data,
  onClose,
  testID = 'day-detail-modal',
}: DayDetailModalProps) {
  const { colors } = useTheme();

  if (!data) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID={testID}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: colors.surface }]}
          onPress={(e) => e.stopPropagation()}
          accessibilityRole="alert"
          accessibilityLabel={`${t('progress.dayDetailModal.title')} for ${data.date}`}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('progress.dayDetailModal.title')}
              </Text>
              <Text style={[styles.dateText, { color: colors.textMuted }]}>{data.date}</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel={t('progress.dayDetailModal.close')}
              testID={`${testID}-close`}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          {/* Details Body */}
          <View style={styles.body}>
            {/* Calories vs Target */}
            {data.calories != null && (
              <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                  {t('progress.dayDetailModal.calories')}
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {Math.round(data.calories)} kcal
                  {data.targetCalories != null ? ` / ${Math.round(data.targetCalories)} kcal` : ''}
                </Text>
              </View>
            )}

            {/* Logged Day & Goal Day Badges */}
            {(data.isLoggedDay != null || data.isGoalDay != null) && (
              <View style={[styles.badgesRow, { borderBottomColor: colors.border }]}>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: data.isLoggedDay ? colors.surfaceAlt : colors.surfaceAlt,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={data.isLoggedDay ? 'checkmark-circle' : 'close-circle'}
                    size={14}
                    color={data.isLoggedDay ? colors.accent : colors.textMuted}
                  />
                  <Text style={[styles.badgeText, { color: colors.text }]}>
                    {t('progress.dayDetailModal.loggedDay')}
                  </Text>
                </View>

                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: data.isGoalDay ? colors.surfaceAlt : colors.surfaceAlt,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={data.isGoalDay ? 'star' : 'ellipse-outline'}
                    size={14}
                    color={data.isGoalDay ? colors.accent : colors.textMuted}
                  />
                  <Text style={[styles.badgeText, { color: colors.text }]}>
                    {t('progress.dayDetailModal.goalDay')}
                  </Text>
                </View>
              </View>
            )}

            {/* Weight */}
            {data.weightKg != null && (
              <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                  {t('progress.weight.current')}
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {data.weightKg.toFixed(1)} kg
                </Text>
              </View>
            )}

            {/* Steps */}
            {data.steps != null && (
              <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                  {t('progress.steps.title')}
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {data.steps.toLocaleString()}
                </Text>
              </View>
            )}

            {/* Water */}
            {data.waterMl != null && (
              <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                  {t('progress.water.title')}
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{data.waterMl} ml</Text>
              </View>
            )}

            {/* Custom Metric */}
            {data.metricLabel != null && data.metricValue != null && (
              <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                  {data.metricLabel}
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{data.metricValue}</Text>
              </View>
            )}
          </View>

          {/* Dismiss Button */}
          <Pressable
            style={[styles.dismissBtn, { backgroundColor: colors.accent }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('progress.dayDetailModal.close')}
            testID={`${testID}-dismiss`}
          >
            <Text style={styles.dismissBtnText}>{t('progress.dayDetailModal.close')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  dateText: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailLabel: {
    fontSize: fontSize.sm,
  },
  detailValue: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  badgesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  dismissBtn: {
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    color: '#ffffff',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
