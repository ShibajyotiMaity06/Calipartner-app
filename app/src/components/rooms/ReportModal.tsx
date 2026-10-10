import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface ReportModalProps {
  visible: boolean;
  targetType: 'user' | 'room' | 'message' | 'meal';
  targetId: string;
  targetName?: string;
  onClose: () => void;
  onSubmitReport: (
    targetType: 'user' | 'room' | 'message' | 'meal',
    targetId: string,
    reason: string,
    details?: string,
  ) => Promise<unknown>;
}

export function ReportModal({
  visible,
  targetType,
  targetId,
  targetName,
  onClose,
  onSubmitReport,
}: ReportModalProps) {
  const { colors } = useTheme();

  const reasons = [
    { id: 'spam', label: t('rooms.reportModal.reasonSpam') },
    { id: 'harassment', label: t('rooms.reportModal.reasonHarassment') },
    { id: 'inappropriate', label: t('rooms.reportModal.reasonInappropriate') },
    { id: 'other', label: t('rooms.reportModal.reasonOther') },
  ];

  const [selectedReason, setSelectedReason] = useState<string>(reasons[0]!.label);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [submittedToast, setSubmittedToast] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmitReport(targetType, targetId, selectedReason, details.trim() || undefined);
      setSubmittedToast(true);
      setTimeout(() => {
        setSubmittedToast(false);
        setDetails('');
        onClose();
      }, 1200);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('rooms.reportModal.title')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {t('rooms.reportModal.subtitle')}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel="Close report modal"
              testID="btn-close-report-modal"
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          {targetName && (
            <View style={[styles.targetBox, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.targetText, { color: colors.text }]}>
                Reporting: {targetName}
              </Text>
            </View>
          )}

          {/* Reasons */}
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {t('rooms.reportModal.reasonLabel')}
          </Text>
          <View style={styles.reasonsList}>
            {reasons.map((r) => {
              const isSelected = selectedReason === r.label;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => setSelectedReason(r.label)}
                  style={[
                    styles.reasonRow,
                    {
                      backgroundColor: isSelected ? colors.cardHighlight : colors.surfaceAlt,
                      borderColor: isSelected ? colors.accent : colors.border,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  testID={`report-reason-${r.id}`}
                >
                  <Text style={[styles.reasonText, { color: colors.text }]}>{r.label}</Text>
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={16}
                    color={isSelected ? colors.accent : colors.textMuted}
                  />
                </Pressable>
              );
            })}
          </View>

          {/* Additional Details */}
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {t('rooms.reportModal.detailsLabel')}
          </Text>
          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder={t('rooms.reportModal.detailsPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={[
              styles.textInput,
              {
                backgroundColor: colors.surfaceAlt,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            multiline
            numberOfLines={3}
            testID="input-report-details"
          />

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={[styles.submitButton, { backgroundColor: colors.danger }]}
            accessibilityRole="button"
            accessibilityLabel="Submit report"
            testID="btn-submit-report"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                {submittedToast ? t('rooms.reportModal.submittedToast') : t('rooms.reportModal.submitBtn')}
              </Text>
            )}
          </Pressable>
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
    paddingBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.md + 2,
    fontWeight: '700',
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
  targetBox: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  targetText: {
    fontSize: fontSize.xs + 1,
    fontWeight: '600',
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  reasonsList: {
    gap: 6,
    marginBottom: spacing.sm,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  reasonText: {
    fontSize: fontSize.xs + 1,
    fontWeight: '500',
  },
  textInput: {
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.sm,
    height: 70,
    textAlignVertical: 'top',
    fontSize: fontSize.xs + 1,
    marginBottom: spacing.md,
  },
  submitButton: {
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
