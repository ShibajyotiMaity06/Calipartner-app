import { type as inputTypography } from '@calipartner/ui';
import { Text } from '@calipartner/ui';
import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Food } from '@calipartner/core';
import { customFoodNutritionForPortion } from '@calipartner/core';
import { generateClientUuid } from '@/services/foodService';
import { useCustomFood } from '@/hooks/useFoodEntries';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface CustomFoodModalProps {
  visible: boolean;
  initialBarcode?: string | null;
  onClose: () => void;
  onCreated: (food: Food) => void;
}

export function CustomFoodModal({
  visible,
  initialBarcode,
  onClose,
  onCreated,
}: CustomFoodModalProps) {
  const { colors } = useTheme();
  const { createFood, loading } = useCustomFood();

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [servingSize, setServingSize] = useState('100');
  const [servingUnit, setServingUnit] = useState('g');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('0');
  const [sodium, setSodium] = useState('0');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const clientId = useRef(generateClientUuid());
  const savingRef = useRef(false);

  const resetForm = () => {
    setName('');
    setBrand('');
    setServingSize('100');
    setServingUnit('g');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setFiber('0');
    setSodium('0');
    setErrorMsg(null);
    clientId.current = generateClientUuid();
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    if (!name.trim()) {
      setErrorMsg(t('foodPolish.nameRequired'));
      return;
    }
    if (!calories.trim()) {
      setErrorMsg(t('foodPolish.invalidNutrition'));
      return;
    }
    let nutrition;
    try {
      nutrition = customFoodNutritionForPortion(
        {
          calories: Number(calories),
          protein: Number(protein),
          carbs: Number(carbs),
          fat: Number(fat),
          fiber: Number(fiber),
          sugar: 0,
          sodium_mg: Number(sodium),
        },
        Number(servingSize),
        servingUnit,
      );
    } catch {
      setErrorMsg(t('foodPolish.invalidNutrition'));
      return;
    }
    savingRef.current = true;
    setErrorMsg(null);
    try {
      const newFood = await createFood({
        id: clientId.current,
        name: name.trim(),
        brand: brand.trim() || null,
        source: 'user',
        barcode: initialBarcode ?? null,
        ...nutrition,
      });
      if (!newFood) throw new Error('SAVE_UNCONFIRMED');
      resetForm();
      onCreated(newFood);
      onClose();
    } catch {
      setErrorMsg(t('foodPolish.actionError'));
    } finally {
      savingRef.current = false;
    }
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
          testID="modal-custom-food"
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            maxHeight: '90%',
            padding: spacing.md,
            gap: spacing.sm,
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
              {t('customFood.createTitle')}
            </Text>
            <Pressable
              testID="btn-close-custom-food"
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          {errorMsg && (
            <Text style={{ color: colors.danger, fontSize: fontSize.sm, fontWeight: '600' }}>
              {errorMsg}
            </Text>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm }}
          >
            {/* Name */}
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: fontSize.xs, fontWeight: '600', color: colors.text }}>
                {t('customFood.nameLabel')}
              </Text>
              <TextInput
                testID="input-custom-food-name"
                value={name}
                onChangeText={setName}
                placeholder={t('customFood.namePlaceholder')}
                placeholderTextColor={colors.textMuted}
                style={[
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.sm,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: fontSize.md,
                    color: colors.text,
                  },
                  { fontFamily: inputTypography.body.fontFamily },
                ]}
              />
            </View>

            {/* Brand */}
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: fontSize.xs, fontWeight: '600', color: colors.text }}>
                {t('customFood.brandLabel')}
              </Text>
              <TextInput
                testID="input-custom-food-brand"
                value={brand}
                onChangeText={setBrand}
                placeholder={t('customFood.brandPlaceholder')}
                placeholderTextColor={colors.textMuted}
                style={[
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.sm,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: fontSize.md,
                    color: colors.text,
                  },
                  { fontFamily: inputTypography.body.fontFamily },
                ]}
              />
            </View>

            {/* Serving Size & Unit row */}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: fontSize.xs, fontWeight: '600', color: colors.text }}>
                  {t('customFood.servingSizeLabel')}
                </Text>
                <TextInput
                  testID="input-custom-food-serving-size"
                  value={servingSize}
                  onChangeText={setServingSize}
                  keyboardType="numeric"
                  placeholder="100"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.sm,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      fontSize: fontSize.md,
                      color: colors.text,
                    },
                    { fontFamily: inputTypography.body.fontFamily },
                  ]}
                />
              </View>

              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: fontSize.xs, fontWeight: '600', color: colors.text }}>
                  {t('customFood.servingUnitLabel')}
                </Text>
                <TextInput
                  testID="input-custom-food-serving-unit"
                  value={servingUnit}
                  onChangeText={setServingUnit}
                  placeholder="g / piece / katori"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.sm,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      fontSize: fontSize.md,
                      color: colors.text,
                    },
                    { fontFamily: inputTypography.body.fontFamily },
                  ]}
                />
              </View>
            </View>

            {/* Nutrients Grid */}
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: '700',
                color: colors.textMuted,
                textTransform: 'uppercase',
                marginTop: 6,
              }}
            >
              {t('customFood.nutrientsHeader')}
            </Text>

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  nutrient="calories"
                  style={{ fontSize: fontSize.xs, fontWeight: '600', color: colors.macroCalories }}
                >
                  {t('customFood.caloriesLabel')}
                </Text>
                <TextInput
                  testID="input-custom-food-calories"
                  value={calories}
                  onChangeText={setCalories}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.sm,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      fontSize: fontSize.md,
                      fontWeight: '700',
                      color: colors.macroCalories,
                    },
                    { fontFamily: inputTypography.body.fontFamily },
                  ]}
                />
              </View>

              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  nutrient="protein"
                  style={{ fontSize: fontSize.xs, fontWeight: '600', color: colors.macroProtein }}
                >
                  {t('customFood.proteinLabel')}
                </Text>
                <TextInput
                  testID="input-custom-food-protein"
                  value={protein}
                  onChangeText={setProtein}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.sm,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      fontSize: fontSize.md,
                      color: colors.macroProtein,
                    },
                    { fontFamily: inputTypography.body.fontFamily },
                  ]}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  nutrient="carbs"
                  style={{ fontSize: fontSize.xs, fontWeight: '600', color: colors.macroCarbs }}
                >
                  {t('customFood.carbsLabel')}
                </Text>
                <TextInput
                  testID="input-custom-food-carbs"
                  value={carbs}
                  onChangeText={setCarbs}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.sm,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      fontSize: fontSize.md,
                      color: colors.macroCarbs,
                    },
                    { fontFamily: inputTypography.body.fontFamily },
                  ]}
                />
              </View>

              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  nutrient="fat"
                  style={{ fontSize: fontSize.xs, fontWeight: '600', color: colors.macroFat }}
                >
                  {t('customFood.fatLabel')}
                </Text>
                <TextInput
                  testID="input-custom-food-fat"
                  value={fat}
                  onChangeText={setFat}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.sm,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      fontSize: fontSize.md,
                      color: colors.macroFat,
                    },
                    { fontFamily: inputTypography.body.fontFamily },
                  ]}
                />
              </View>
            </View>
          </ScrollView>

          <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
            <Pressable
              testID="btn-submit-custom-food"
              disabled={loading}
              onPress={handleSave}
              style={{
                backgroundColor: colors.accent,
                borderRadius: radius.md,
                paddingVertical: 14,
                alignItems: 'center',
                minHeight: 48,
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: fontSize.md }}>
                {loading ? t('common.saving') : t('customFood.saveButton')}
              </Text>
            </Pressable>

            <Pressable
              testID="btn-cancel-custom-food"
              disabled={loading}
              onPress={onClose}
              style={{
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 12,
                alignItems: 'center',
                minHeight: 44,
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: fontSize.sm }}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
