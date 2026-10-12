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

export interface ChatReportModalProps {
  visible: boolean;
  messageId: string | null;
  onClose: () => void;
  onSubmitReport: (messageId: string, reason: string, details?: string) => Promise<void>;
  testID?: string;
}

export function ChatReportModal({
  visible,
  messageId,
  onClose,
  onSubmitReport,
  testID = 'chat-report-modal',
}: ChatReportModalProps) {
  const { colors } = useTheme();
  const [reason, setReason] = useState<string>('inappropriate');
  const [details, setDetails] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedToast, setSubmittedToast] = useState(false);

  if (!messageId) return null;

  const reasons = [
    { key: 'inappropriate', label: t('rooms.reportModal.reasonInappropriate') },
    { key: 'harassment', label: t('rooms.reportModal.reasonHarassment') },
    { key: 'spam', label: t('rooms.reportModal.reasonSpam') },
    { key: 'other', label: t('rooms.reportModal.reasonOther') },
  ];

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmitReport(messageId, reason, details.trim() || undefined);
      setSubmittedToast(true);
      setTimeout(() => {
        setSubmittedToast(false);
        onClose();
        setDetails('');
      }, 1500);
    } finally {
      setSubmitting(false);
    }
  };

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
          style={[styles.sheetContainer, { backgroundColor: colors.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.handleIndicator, { backgroundColor: colors.border }]} />

          <Text style={[styles.title, { color: colors.text }]}>{t('rooms.reportModal.title')}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('rooms.reportModal.subtitle')}
          </Text>

          {submittedToast ? (
            <View style={styles.toastWrap} testID="toast-report-submitted">
              <Ionicons name="checkmark-circle" size={40} color="#10B981" />
              <Text style={[styles.toastText, { color: colors.text }]}>
                {t('rooms.reportModal.submittedToast')}
              </Text>
            </View>
          ) : (
            <>
              {/* Radio options */}
              <View style={styles.reasonsList}>
                {reasons.map((r) => {
                  const isSelected = reason === r.key;
                  return (
                    <Pressable
                      key={r.key}
                      onPress={() => setReason(r.key)}
                      style={[
                        styles.reasonRow,
                        { borderColor: isSelected ? colors.accent : colors.border },
                        isSelected && { backgroundColor: colors.cardHighlight },
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      testID={`radio-report-${r.key}`}
                    >
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={isSelected ? colors.accent : colors.textMuted}
                        style={styles.radioIcon}
                      />
                      <Text
                        style={[
                          styles.reasonLabel,
                          { color: isSelected ? colors.text : colors.textMuted },
                          isSelected && styles.reasonLabelSelected,
                        ]}
                      >
                        {r.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Optional details text area */}
              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder={t('rooms.reportModal.detailsPlaceholder')}
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                style={[
                  styles.detailsInput,
                  {
                    backgroundColor: colors.surfaceAlt,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                accessibilityLabel="Report details input"
                testID="input-report-details"
              />

              {/* Buttons Row */}
              <View style={styles.buttonsRow}>
                <Pressable
                  onPress={onClose}
                  style={[styles.cancelBtn, { backgroundColor: colors.surfaceAlt }]}
                  accessibilityRole="button"
                  testID="btn-cancel-report"
                >
                  <Text style={[styles.cancelBtnText, { color: colors.text }]}>
                    {t('chat.cancel')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleSubmit}
                  disabled={submitting}
                  style={[styles.submitBtn, { backgroundColor: colors.danger }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('rooms.reportModal.submitBtn')}
                  testID="btn-submit-report"
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitBtnText}>{t('rooms.reportModal.submitBtn')}</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  handleIndicator: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.md + 1,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: fontSize.xs,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  reasonsList: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  radioIcon: {
    marginRight: spacing.sm,
  },
  reasonLabel: {
    fontSize: fontSize.sm,
  },
  reasonLabelSelected: {
    fontWeight: '600',
  },
  detailsInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    height: 72,
    fontSize: fontSize.xs,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  toastWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  toastText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
