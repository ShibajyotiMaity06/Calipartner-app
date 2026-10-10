import { useState } from 'react';
import {
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

export interface ManualStepsModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (steps: number, distanceM?: number) => Promise<unknown>;
}

export function ManualStepsModal({ visible, onClose, onSave }: ManualStepsModalProps) {
  const { colors } = useTheme();
  const [stepsText, setStepsText] = useState('');
  const [distanceText, setDistanceText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const stepsVal = parseInt(stepsText.trim(), 10);
    if (isNaN(stepsVal) || stepsVal < 1 || stepsVal > 100000) {
      setError(t('trackers.steps.invalidSteps'));
      return;
    }

    let distVal: number | undefined;
    if (distanceText.trim()) {
      const parsedDist = parseFloat(distanceText.trim());
      if (isNaN(parsedDist) || parsedDist < 0 || parsedDist > 150000) {
        setError(t('trackers.steps.invalidDistance'));
        return;
      }
      distVal = parsedDist;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave(stepsVal, distVal);
      setStepsText('');
      setDistanceText('');
      onClose();
    } catch {
      setError(t('common.errorBody'));
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      testID="modal-manual-steps"
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={t('common.cancel')}
        />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="footsteps" size={20} color={colors.accent} />
              <Text style={[styles.title, { color: colors.text }]}>
                {t('trackers.steps.manualModalTitle')}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Steps Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textMuted }]}>
              {t('trackers.steps.manualStepsLabel')}
            </Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: colors.surfaceAlt, borderColor: error ? colors.danger : colors.border },
              ]}
            >
              <TextInput
                testID="input-steps-count"
                value={stepsText}
                onChangeText={(text) => {
                  setStepsText(text);
                  if (error) setError(null);
                }}
                keyboardType="numeric"
                placeholder={t('trackers.steps.manualStepsPlaceholder')}
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { color: colors.text }]}
                accessibilityLabel={t('trackers.steps.manualStepsLabel')}
              />
              <Text style={[styles.unitBadge, { color: colors.textMuted }]}>steps</Text>
            </View>
          </View>

          {/* Distance Input (Optional) */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textMuted }]}>
              {t('trackers.steps.manualDistanceLabel')}
            </Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
            >
              <TextInput
                testID="input-steps-distance"
                value={distanceText}
                onChangeText={(text) => {
                  setDistanceText(text);
                  if (error) setError(null);
                }}
                keyboardType="numeric"
                placeholder={t('trackers.steps.manualDistancePlaceholder')}
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { color: colors.text }]}
                accessibilityLabel={t('trackers.steps.manualDistanceLabel')}
              />
              <Text style={[styles.unitBadge, { color: colors.textMuted }]}>m</Text>
            </View>
          </View>

          {error ? (
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          ) : null}

          {/* Actions */}
          <View style={styles.actionsRow}>
            <Pressable
              testID="btn-cancel-steps"
              onPress={onClose}
              disabled={saving}
              style={[styles.btn, styles.cancelBtn, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={[styles.btnText, { color: colors.text }]}>{t('common.cancel')}</Text>
            </Pressable>

            <Pressable
              testID="btn-save-steps"
              onPress={handleSubmit}
              disabled={saving}
              style={[styles.btn, styles.submitBtn, { backgroundColor: colors.accent }]}
              accessibilityRole="button"
              accessibilityLabel={t('common.save')}
            >
              <Text style={[styles.btnText, { color: colors.onAccent, fontWeight: '700' }]}>
                {saving ? t('common.saving') : t('common.save')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    height: 48,
  },
  input: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  unitBadge: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    paddingLeft: 4,
  },
  errorText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
  },
  submitBtn: {},
  btnText: {
    fontSize: fontSize.sm,
  },
});
