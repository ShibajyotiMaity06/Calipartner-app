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

export interface CustomWaterModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (amountMl: number) => Promise<void>;
}

const PRESET_ADDITIONS = [150, 250, 330, 500, 750];

export function CustomWaterModal({ visible, onClose, onSave }: CustomWaterModalProps) {
  const { colors } = useTheme();
  const [amountText, setAmountText] = useState('250');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handlePreset = (val: number) => {
    setAmountText(String(val));
    setError(null);
  };

  const handleSubmit = async () => {
    const parsed = parseInt(amountText.trim(), 10);
    if (isNaN(parsed) || parsed < 10 || parsed > 5000) {
      setError(t('trackers.water.invalidAmount'));
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave(parsed);
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
      testID="modal-custom-water"
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
              <Ionicons name="water" size={20} color={colors.accent} />
              <Text style={[styles.title, { color: colors.text }]}>
                {t('trackers.water.customModalTitle')}
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

          {/* Quick Preset Buttons */}
          <View style={styles.presetsRow}>
            {PRESET_ADDITIONS.map((p) => (
              <Pressable
                key={p}
                onPress={() => handlePreset(p)}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor:
                      amountText === String(p) ? colors.accent : colors.surfaceAlt,
                    borderColor: colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${p} ml`}
              >
                <Text
                  style={[
                    styles.presetText,
                    {
                      color:
                        amountText === String(p) ? colors.onAccent : colors.text,
                    },
                  ]}
                >
                  {p} ml
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Amount Input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
              {t('trackers.water.amountLabel')}
            </Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: colors.surfaceAlt, borderColor: error ? colors.danger : colors.border },
              ]}
            >
              <TextInput
                testID="input-water-amount"
                value={amountText}
                onChangeText={(text) => {
                  setAmountText(text);
                  if (error) setError(null);
                }}
                keyboardType="numeric"
                placeholder={t('trackers.water.amountPlaceholder')}
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { color: colors.text }]}
                accessibilityLabel={t('trackers.water.amountLabel')}
              />
              <Text style={[styles.unitBadge, { color: colors.textMuted }]}>ml</Text>
            </View>
            {error ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            ) : null}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <Pressable
              testID="btn-cancel-water"
              onPress={onClose}
              disabled={saving}
              style={[styles.btn, styles.cancelBtn, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={[styles.btnText, { color: colors.text }]}>{t('common.cancel')}</Text>
            </Pressable>

            <Pressable
              testID="btn-submit-water"
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
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  presetText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  inputContainer: {
    gap: 6,
  },
  inputLabel: {
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
