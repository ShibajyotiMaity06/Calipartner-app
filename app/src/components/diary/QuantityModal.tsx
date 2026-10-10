import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  scaleNutrients,
  type Food,
  type FoodEntry,
  type MealSection,
} from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface QuantityModalProps {
  visible: boolean;
  food: Food | null;
  initialEntry?: FoodEntry | null;
  defaultSection?: MealSection;
  onClose: () => void;
  onSave: (data: {
    food: Food;
    quantity: number;
    unit: string;
    mealSection: MealSection;
  }) => void;
  onDelete?: (entryId: string) => void;
}

const COMMON_UNITS = [
  'g',
  'ml',
  'piece',
  'bowl',
  'katori',
  'cup',
  'tbsp',
  'tsp',
  'slice',
  'plate',
  'serving',
];

const SECTIONS: MealSection[] = ['breakfast', 'lunch', 'dinner', 'snacks', 'extra'];

export function QuantityModal({
  visible,
  food,
  initialEntry,
  defaultSection = 'breakfast',
  onClose,
  onSave,
  onDelete,
}: QuantityModalProps) {
  const { colors } = useTheme();

  const [quantityStr, setQuantityStr] = useState('1');
  const [selectedUnit, setSelectedUnit] = useState('serving');
  const [selectedSection, setSelectedSection] = useState<MealSection>(defaultSection);

  useEffect(() => {
    if (initialEntry) {
      setQuantityStr(String(initialEntry.quantity));
      setSelectedUnit(initialEntry.unit);
      setSelectedSection(initialEntry.meal_section);
    } else if (food) {
      setQuantityStr('1');
      const firstUnit = food.serving_units?.[0]?.unit || 'g';
      setSelectedUnit(firstUnit);
      setSelectedSection(defaultSection);
    }
  }, [initialEntry, food, defaultSection, visible]);

  const parsedQty = parseFloat(quantityStr) || 0;

  // Live Scaled Nutrients Preview
  const preview = useMemo(() => {
    if (!food || parsedQty <= 0) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    }
    return scaleNutrients(food, parsedQty, selectedUnit);
  }, [food, parsedQty, selectedUnit]);

  // Available units for this food (custom serving units + standard)
  const availableUnits = useMemo(() => {
    const list: string[] = [];
    if (food?.serving_units) {
      for (const su of food.serving_units) {
        if (!list.includes(su.unit)) list.push(su.unit);
      }
    }
    for (const u of COMMON_UNITS) {
      if (!list.includes(u)) list.push(u);
    }
    return list;
  }, [food]);

  if (!food) return null;

  const handleSave = () => {
    if (parsedQty <= 0) return;
    onSave({
      food,
      quantity: parsedQty,
      unit: selectedUnit,
      mealSection: selectedSection,
    });
    onClose();
  };

  const handleDelete = () => {
    if (!initialEntry || !onDelete) return;
    Alert.alert(
      t('quantity.deleteButton'),
      t('quantity.confirmDelete'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            onDelete(initialEntry.id);
            onClose();
          },
        },
      ],
    );
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
          testID="modal-quantity"
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            maxHeight: '90%',
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
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.text }}>
                {initialEntry ? t('quantity.editTitle') : t('quantity.title', { section: t(`diary.sections.${selectedSection}` as Parameters<typeof t>[0]) })}
              </Text>
              <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }} numberOfLines={1}>
                {food.name} {food.brand ? `• ${food.brand}` : ''}
              </Text>
            </View>

            <Pressable
              testID="btn-close-quantity-modal"
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
            {/* Live Nutrient Preview Box */}
            <View
              testID="preview-nutrients"
              style={{
                backgroundColor: colors.surfaceAlt,
                borderRadius: radius.md,
                padding: spacing.md,
                gap: spacing.xs,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: '700',
                  color: colors.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {t('quantity.previewTitle')}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ fontSize: fontSize.xl, fontWeight: '800', color: colors.macroCalories }}>
                  {preview.calories} <Text style={{ fontSize: fontSize.sm, fontWeight: '500', color: colors.textMuted }}>kcal</Text>
                </Text>
                <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '600' }}>
                  P <Text style={{ color: colors.macroProtein, fontWeight: '700' }}>{preview.protein}g</Text> • C <Text style={{ color: colors.macroCarbs, fontWeight: '700' }}>{preview.carbs}g</Text> • F <Text style={{ color: colors.macroFat, fontWeight: '700' }}>{preview.fat}g</Text>
                </Text>
              </View>
            </View>

            {/* Quantity Input */}
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.text }}>
                {t('quantity.amountLabel')}
              </Text>
              <TextInput
                testID="input-quantity-amount"
                value={quantityStr}
                onChangeText={setQuantityStr}
                keyboardType="decimal-pad"
                placeholder="1"
                placeholderTextColor={colors.textMuted}
                style={{
                  backgroundColor: colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.sm,
                  paddingHorizontal: spacing.md,
                  paddingVertical: 12,
                  fontSize: fontSize.lg,
                  fontWeight: '700',
                  color: colors.text,
                }}
              />
            </View>

            {/* Serving Units selector */}
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.text }}>
                {t('quantity.unitLabel')}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {availableUnits.map((u) => {
                  const isSelected = selectedUnit.toLowerCase() === u.toLowerCase();
                  return (
                    <Pressable
                      key={u}
                      testID={`unit-pill-${u}`}
                      onPress={() => setSelectedUnit(u)}
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
                        {u}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Meal Section Picker */}
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.text }}>
                {t('quantity.sectionLabel')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {SECTIONS.map((sec) => {
                  const isSelected = selectedSection === sec;
                  return (
                    <Pressable
                      key={sec}
                      testID={`section-picker-${sec}`}
                      onPress={() => setSelectedSection(sec)}
                      style={{
                        paddingHorizontal: 14,
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
          </ScrollView>

          {/* Action Buttons */}
          <View style={{ gap: 8, marginTop: spacing.xs }}>
            <Pressable
              testID="btn-submit-quantity"
              onPress={handleSave}
              style={{
                backgroundColor: colors.accent,
                borderRadius: radius.sm,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: fontSize.md }}>
                {initialEntry ? t('quantity.saveChanges') : t('quantity.logButton')}
              </Text>
            </Pressable>

            {initialEntry && onDelete && (
              <Pressable
                testID="btn-delete-entry-modal"
                onPress={handleDelete}
                style={{
                  backgroundColor: 'transparent',
                  borderColor: colors.danger,
                  borderWidth: 1,
                  borderRadius: radius.sm,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.danger, fontWeight: '700', fontSize: fontSize.sm }}>
                  {t('quantity.deleteButton')}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
