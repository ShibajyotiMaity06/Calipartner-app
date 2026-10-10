import { useState } from 'react';
import {
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MealSection } from '@calipartner/core';
import { useCopyMeal } from '@/hooks/useFoodEntries';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface CopyMealModalProps {
  visible: boolean;
  mode: 'meal' | 'day';
  sourceDate: string;
  sourceSection?: MealSection;
  onClose: () => void;
  onSuccess: () => void;
}

const SECTIONS: MealSection[] = ['breakfast', 'lunch', 'dinner', 'snacks', 'extra'];

export function CopyMealModal({
  visible,
  mode,
  sourceDate,
  sourceSection = 'breakfast',
  onClose,
  onSuccess,
}: CopyMealModalProps) {
  const { colors } = useTheme();
  const { copyMeal, copyDay, loading } = useCopyMeal();

  const [targetDate, setTargetDate] = useState(() => {
    // Tomorrow by default
    const d = new Date(sourceDate);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [targetSection, setTargetSection] = useState<MealSection>(sourceSection);

  const handleSubmit = async () => {
    if (!targetDate.trim()) return;

    if (mode === 'meal') {
      await copyMeal(sourceDate, sourceSection, targetDate.trim(), targetSection);
    } else {
      await copyDay(sourceDate, targetDate.trim());
    }

    onSuccess();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}
      >
        <View
          testID="modal-copy-meal"
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            padding: spacing.md,
            gap: spacing.md,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.text }}>
              {mode === 'meal'
                ? t('copy.copyMealTitle', { section: t(`diary.sections.${sourceSection}` as Parameters<typeof t>[0]) })
                : t('copy.copyDayTitle')}
            </Text>
            <Pressable
              testID="btn-close-copy-modal"
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Target Date */}
          <View style={{ gap: spacing.xs }}>
            <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.text }}>
              {t('copy.targetDateLabel')}
            </Text>
            <TextInput
              testID="input-copy-target-date"
              value={targetDate}
              onChangeText={setTargetDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              style={{
                backgroundColor: colors.surfaceAlt,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.sm,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: fontSize.md,
                fontWeight: '600',
                color: colors.text,
              }}
            />
          </View>

          {/* Target Section (only if mode === 'meal') */}
          {mode === 'meal' && (
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.text }}>
                {t('copy.targetSectionLabel')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {SECTIONS.map((sec) => {
                  const isSelected = targetSection === sec;
                  return (
                    <Pressable
                      key={sec}
                      testID={`pill-copy-section-${sec}`}
                      onPress={() => setTargetSection(sec)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: radius.pill,
                        backgroundColor: isSelected ? colors.accent : colors.surfaceAlt,
                        borderWidth: 1,
                        borderColor: isSelected ? colors.accent : colors.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fontSize.sm,
                          fontWeight: '600',
                          color: isSelected ? colors.onAccent : colors.text,
                        }}
                      >
                        {t(`diary.sections.${sec}` as Parameters<typeof t>[0])}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <Pressable
            testID="btn-submit-copy"
            disabled={loading}
            onPress={handleSubmit}
            style={{
              backgroundColor: colors.accent,
              borderRadius: radius.sm,
              paddingVertical: 14,
              alignItems: 'center',
              marginTop: spacing.xs,
            }}
          >
            <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: fontSize.md }}>
              {loading ? t('common.loading') : t('copy.submitButton')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
