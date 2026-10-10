import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Food } from '@calipartner/core';
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
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setErrorMsg('Please enter a food name');
      return;
    }
    const cal = parseFloat(calories);
    const pro = parseFloat(protein);
    const carb = parseFloat(carbs);
    const f = parseFloat(fat);

    if (isNaN(cal) || cal < 0) {
      setErrorMsg('Please enter valid calories');
      return;
    }

    const sSize = parseFloat(servingSize) || 100;
    const factorTo100g = sSize > 0 ? 100 / sSize : 1;

    const newFood = await createFood({
      name: name.trim(),
      brand: brand.trim() || null,
      source: 'user',
      barcode: initialBarcode ?? null,
      calories_per_100g: Math.round(cal * factorTo100g * 10) / 10,
      protein_per_100g: Math.round((isNaN(pro) ? 0 : pro) * factorTo100g * 10) / 10,
      carbs_per_100g: Math.round((isNaN(carb) ? 0 : carb) * factorTo100g * 10) / 10,
      fat_per_100g: Math.round((isNaN(f) ? 0 : f) * factorTo100g * 10) / 10,
      fiber_per_100g: Math.round((parseFloat(fiber) || 0) * factorTo100g * 10) / 10,
      sodium_mg_per_100g: Math.round((parseFloat(sodium) || 0) * factorTo100g * 10) / 10,
      serving_units: [
        { unit: servingUnit || 'serving', grams: sSize },
        { unit: 'g', grams: 1 },
      ],
    });

    if (newFood) {
      resetForm();
      onCreated(newFood);
      onClose();
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
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          {errorMsg && (
            <Text style={{ color: colors.danger, fontSize: fontSize.sm, fontWeight: '600' }}>
              {errorMsg}
            </Text>
          )}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
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
                style={{
                  backgroundColor: colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.sm,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: fontSize.md,
                  color: colors.text,
                }}
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
                style={{
                  backgroundColor: colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.sm,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: fontSize.md,
                  color: colors.text,
                }}
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
                  style={{
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.sm,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: fontSize.md,
                    color: colors.text,
                  }}
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
                  style={{
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.sm,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: fontSize.md,
                    color: colors.text,
                  }}
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
                <Text style={{ fontSize: fontSize.xs, fontWeight: '600', color: colors.macroCalories }}>
                  {t('customFood.caloriesLabel')}
                </Text>
                <TextInput
                  testID="input-custom-food-calories"
                  value={calories}
                  onChangeText={setCalories}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.sm,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: fontSize.md,
                    fontWeight: '700',
                    color: colors.text,
                  }}
                />
              </View>

              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: fontSize.xs, fontWeight: '600', color: colors.macroProtein }}>
                  {t('customFood.proteinLabel')}
                </Text>
                <TextInput
                  testID="input-custom-food-protein"
                  value={protein}
                  onChangeText={setProtein}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.sm,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: fontSize.md,
                    color: colors.text,
                  }}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: fontSize.xs, fontWeight: '600', color: colors.macroCarbs }}>
                  {t('customFood.carbsLabel')}
                </Text>
                <TextInput
                  testID="input-custom-food-carbs"
                  value={carbs}
                  onChangeText={setCarbs}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.sm,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: fontSize.md,
                    color: colors.text,
                  }}
                />
              </View>

              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: fontSize.xs, fontWeight: '600', color: colors.macroFat }}>
                  {t('customFood.fatLabel')}
                </Text>
                <TextInput
                  testID="input-custom-food-fat"
                  value={fat}
                  onChangeText={setFat}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.sm,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: fontSize.md,
                    color: colors.text,
                  }}
                />
              </View>
            </View>
          </ScrollView>

          <Pressable
            testID="btn-submit-custom-food"
            disabled={loading}
            onPress={handleSave}
            style={{
              backgroundColor: colors.accent,
              borderRadius: radius.sm,
              paddingVertical: 14,
              alignItems: 'center',
              marginTop: spacing.xs,
            }}
          >
            <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: fontSize.md }}>
              {loading ? t('common.saving') : t('customFood.saveButton')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
