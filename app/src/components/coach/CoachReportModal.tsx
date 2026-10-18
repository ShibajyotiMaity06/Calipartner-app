import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { CoachReportReason } from './types';

export interface CoachReportModalProps {
  visible: boolean;
  messageId: string | null;
  onClose: () => void;
  onSubmit: (messageId: string, reason: CoachReportReason, notes?: string) => void;
}

export function CoachReportModal({ visible, messageId, onClose, onSubmit }: CoachReportModalProps) {
  const { colors } = useTheme();
  const [selectedReason, setSelectedReason] = useState<CoachReportReason>('inaccurate');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reasons: { key: CoachReportReason; label: string }[] = [
    { key: 'inaccurate', label: t('coach.reportModal.reasons.inaccurate') },
    { key: 'unsafe', label: t('coach.reportModal.reasons.unsafe') },
    { key: 'disordered', label: t('coach.reportModal.reasons.disordered') },
    { key: 'inappropriate', label: t('coach.reportModal.reasons.inappropriate') },
    { key: 'other', label: t('coach.reportModal.reasons.other') },
  ];

  const handleSubmit = () => {
    if (!messageId) return;
    setSubmitting(true);
    try {
      onSubmit(messageId, selectedReason, notes.trim());
      setNotes('');
      setSelectedReason('inaccurate');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      testID="modal-coach-report"
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.container,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={[styles.title, { color: colors.text }]} testID="text-coach-report-title">
                {t('coach.reportModal.title')}
              </Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={t('coach.reportModal.cancel')}
                testID="btn-close-coach-report"
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {t('coach.reportModal.subtitle')}
            </Text>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Reason selector */}
            <View style={styles.reasonList}>
              {reasons.map((r) => {
                const isSelected = selectedReason === r.key;
                return (
                  <Pressable
                    key={r.key}
                    onPress={() => setSelectedReason(r.key)}
                    style={[
                      styles.reasonItem,
                      {
                        backgroundColor: isSelected ? colors.cardHighlight : colors.surfaceAlt,
                        borderColor: isSelected ? colors.accent : colors.border,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    testID={`radio-report-reason-${r.key}`}
                  >
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={isSelected ? colors.accent : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.reasonLabel,
                        {
                          color: isSelected ? colors.text : colors.textMuted,
                          fontWeight: isSelected ? '600' : '400',
                        },
                      ]}
                    >
                      {r.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Optional note */}
            <View style={styles.inputSection}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                {t('coach.reportModal.commentLabel')}
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={t('coach.reportModal.commentPlaceholder')}
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                testID="input-coach-report-notes"
              />
            </View>
          </ScrollView>

          {/* Footer buttons */}
          <View style={styles.footer}>
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={[
                styles.submitBtn,
                { backgroundColor: colors.accent, opacity: submitting ? 0.6 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('coach.reportModal.submit')}
              testID="btn-submit-coach-report"
            >
              <Text style={styles.submitBtnText}>
                {submitting ? t('coach.reportModal.submitting') : t('coach.reportModal.submit')}
              </Text>
            </Pressable>

            <Pressable
              onPress={onClose}
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('coach.reportModal.cancel')}
              testID="btn-cancel-coach-report"
            >
              <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>
                {t('coach.reportModal.cancel')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  container: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: fontSize.xs + 1,
    marginTop: 4,
  },
  body: {
    maxHeight: 320,
  },
  reasonList: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  reasonLabel: {
    fontSize: fontSize.sm,
    flex: 1,
  },
  inputSection: {
    marginBottom: spacing.sm,
  },
  inputLabel: {
    fontSize: fontSize.xs,
    marginBottom: 4,
  },
  textInput: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
    fontSize: fontSize.sm,
    textAlignVertical: 'top',
    minHeight: 70,
  },
  footer: {
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  submitBtn: {
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.sm + 1,
    fontWeight: '600',
  },
  cancelBtn: {
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: fontSize.sm,
  },
});
