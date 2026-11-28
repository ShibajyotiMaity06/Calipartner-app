import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { customFoodNutritionForPortion, type Food, type MealSection } from '@calipartner/core';
import {
  BarcodeIcon,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  PrimaryButton,
  Text,
  borders,
  colors,
  fonts,
  layout,
  radius,
  space,
} from '@calipartner/ui/v1';
import { useCustomFood } from '@/hooks/useFoodEntries';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { t } from '@/i18n';
import { generateClientUuid } from '@/services/foodService';

export interface CustomFoodModalProps {
  visible: boolean;
  initialBarcode?: string | null;
  defaultSection?: MealSection;
  onClose: () => void;
  onCreated: (food: Food) => void;
  onSaveOnly?: (food: Food) => void;
}

export function CustomFoodModal({
  visible,
  initialBarcode,
  defaultSection = 'dinner',
  onClose,
  onCreated,
  onSaveOnly,
}: CustomFoodModalProps) {
  const insets = useSafeAreaInsets();
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
  const [sugar, setSugar] = useState('0');
  const [sodium, setSodium] = useState('0');
  const [barcode, setBarcode] = useState(initialBarcode ?? '');
  const [showMoreNutrients, setShowMoreNutrients] = useState(false);
  const [showBarcodeInput, setShowBarcodeInput] = useState(Boolean(initialBarcode));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const clientId = useRef(generateClientUuid());
  const savingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setBarcode(initialBarcode ?? '');
      setShowBarcodeInput(Boolean(initialBarcode));
      setErrorMsg(null);
    }
  }, [visible, initialBarcode]);

  const cancel = () => {
    if (!savingRef.current) onClose();
  };
  useBrowserModalBack(visible, cancel);

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
    setSugar('0');
    setSodium('0');
    setBarcode('');
    setShowMoreNutrients(false);
    setShowBarcodeInput(false);
    setErrorMsg(null);
    clientId.current = generateClientUuid();
  };

  const calNum = Number(calories) || 0;
  const pNum = Number(protein) || 0;
  const cNum = Number(carbs) || 0;
  const fNum = Number(fat) || 0;
  const macroKcal = Math.round(pNum * 4 + cNum * 4 + fNum * 9);
  const showMacroBanner = calNum > 0 || macroKcal > 0;
  const macrosCloseEnough = useMemo(() => {
    if (calNum <= 0) return false;
    return Math.abs(macroKcal - calNum) <= Math.max(25, calNum * 0.1);
  }, [macroKcal, calNum]);

  const handleSave = async (addAfterSave: boolean) => {
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
          protein: Number(protein) || 0,
          carbs: Number(carbs) || 0,
          fat: Number(fat) || 0,
          fiber: Number(fiber) || 0,
          sugar: Number(sugar) || 0,
          sodium_mg: Number(sodium) || 0,
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
        barcode: barcode.trim() || null,
        ...nutrition,
      });
      if (!newFood) throw new Error('SAVE_UNCONFIRMED');
      resetForm();
      if (!addAfterSave && onSaveOnly) {
        onSaveOnly(newFood);
      } else {
        onCreated(newFood);
      }
      onClose();
    } catch {
      setErrorMsg(t('foodPolish.actionError'));
    } finally {
      savingRef.current = false;
    }
  };

  const sectionLabel = t(`diary.sections.${defaultSection}` as Parameters<typeof t>[0]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={cancel}>
      <View style={styles.root} testID="modal-custom-food">
        {/* Top Bar */}
        <View style={[styles.topBar, { paddingTop: Math.max(space.sm, insets.top + 6) }]}>
          <Pressable
            onPress={cancel}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            style={({ pressed }) => [styles.closeCircle, pressed ? styles.circlePressed : null]}
            testID="btn-close-custom-food"
          >
            <CloseIcon size={17} color={colors.textMid} />
          </Pressable>
          <Text
            variant="titleS"
            color="textHi"
            accessibilityRole="header"
            style={styles.headerTitle}
          >
            {t('captureV1.newFoodTitle')}
          </Text>
          <Pressable
            onPress={() => void handleSave(false)}
            disabled={loading}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('captureV1.newFoodSaveOnly')}
            style={styles.topSaveBtn}
            testID="btn-header-save-custom-food"
          >
            <Text variant="label" color="apricot" style={styles.topSaveText}>
              {loading ? t('common.saving') : t('captureV1.newFoodSaveOnly')}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scrollContent, { paddingBottom: space.xl }]}
        >
          <View style={styles.innerWrap}>
            {errorMsg ? (
              <Text variant="meta" color="danger" accessibilityRole="alert">
                {errorMsg}
              </Text>
            ) : null}

            {/* Food name */}
            <View style={styles.fieldGroup}>
              <Text variant="meta" color="textLo" style={styles.fieldLabel}>
                {t('captureV1.newFoodNameLabel')}
              </Text>
              <View style={styles.inputBox}>
                <TextInput
                  testID="input-custom-food-name"
                  value={name}
                  onChangeText={setName}
                  placeholder={t('captureV1.newFoodNamePlaceholder')}
                  placeholderTextColor={colors.textOff}
                  style={styles.textInput}
                />
              </View>
            </View>

            {/* Brand */}
            <View style={styles.fieldGroup}>
              <Text variant="meta" color="textLo" style={styles.fieldLabel}>
                {t('captureV1.newFoodBrandLabel')}
              </Text>
              <View style={styles.inputBox}>
                <TextInput
                  testID="input-custom-food-brand"
                  value={brand}
                  onChangeText={setBrand}
                  placeholder={t('captureV1.newFoodBrandPlaceholder')}
                  placeholderTextColor={colors.textOff}
                  style={styles.textInput}
                />
              </View>
            </View>

            {/* Serving size + Calories */}
            <View style={styles.twoColRow}>
              <View style={styles.colItem}>
                <Text variant="meta" color="textLo" style={styles.fieldLabel}>
                  {t('captureV1.newFoodServingSize')}
                </Text>
                <View style={styles.inputBoxRow}>
                  <TextInput
                    testID="input-custom-food-serving-size"
                    value={servingSize}
                    onChangeText={setServingSize}
                    keyboardType="decimal-pad"
                    placeholder="60"
                    placeholderTextColor={colors.textOff}
                    style={[styles.textInput, styles.tabularInput]}
                  />
                  <Pressable
                    onPress={() =>
                      setServingUnit((u) => (u === 'g' ? 'ml' : u === 'ml' ? 'serving' : 'g'))
                    }
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`Serving unit ${servingUnit}`}
                    testID="input-custom-food-serving-unit"
                  >
                    <Text variant="meta" color="textLo">
                      {servingUnit}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.colItem}>
                <Text variant="meta" color="textLo" style={styles.fieldLabel}>
                  {t('captureV1.newFoodCalories')}
                </Text>
                <View style={styles.inputBoxRow}>
                  <TextInput
                    testID="input-custom-food-calories"
                    value={calories}
                    onChangeText={setCalories}
                    keyboardType="decimal-pad"
                    placeholder="300"
                    placeholderTextColor={colors.textOff}
                    style={[styles.textInput, styles.tabularInput]}
                  />
                  <Text variant="meta" color="textLo">
                    kcal
                  </Text>
                </View>
              </View>
            </View>

            {/* Protein / Carbs / Fat */}
            <View style={styles.threeColRow}>
              <View style={styles.colItem}>
                <Text variant="meta" color="textLo" style={styles.fieldLabel}>
                  {t('homeV1.protein')}
                </Text>
                <View style={styles.inputBoxRow}>
                  <TextInput
                    testID="input-custom-food-protein"
                    value={protein}
                    onChangeText={setProtein}
                    keyboardType="decimal-pad"
                    placeholder="24"
                    placeholderTextColor={colors.textOff}
                    style={[styles.textInput, styles.tabularInput]}
                  />
                  <Text variant="meta" color="textLo">
                    g
                  </Text>
                </View>
              </View>

              <View style={styles.colItem}>
                <Text variant="meta" color="textLo" style={styles.fieldLabel}>
                  {t('homeV1.carbs')}
                </Text>
                <View style={styles.inputBoxRow}>
                  <TextInput
                    testID="input-custom-food-carbs"
                    value={carbs}
                    onChangeText={setCarbs}
                    keyboardType="decimal-pad"
                    placeholder="30"
                    placeholderTextColor={colors.textOff}
                    style={[styles.textInput, styles.tabularInput]}
                  />
                  <Text variant="meta" color="textLo">
                    g
                  </Text>
                </View>
              </View>

              <View style={styles.colItem}>
                <Text variant="meta" color="textLo" style={styles.fieldLabel}>
                  {t('homeV1.fat')}
                </Text>
                <View style={styles.inputBoxRow}>
                  <TextInput
                    testID="input-custom-food-fat"
                    value={fat}
                    onChangeText={setFat}
                    keyboardType="decimal-pad"
                    placeholder="10"
                    placeholderTextColor={colors.textOff}
                    style={[styles.textInput, styles.tabularInput]}
                  />
                  <Text variant="meta" color="textLo">
                    g
                  </Text>
                </View>
              </View>
            </View>

            {/* Live Macro Sum Consistency Card */}
            {showMacroBanner ? (
              <View style={styles.macroCheckCard} testID="custom-food-macro-check">
                <View
                  style={[
                    styles.checkBadge,
                    { backgroundColor: macrosCloseEnough ? colors.apricot : colors.s3 },
                  ]}
                >
                  <CheckIcon
                    size={13}
                    color={macrosCloseEnough ? colors.onBrand : colors.textMid}
                    strokeWidth={2.5}
                  />
                </View>
                <Text variant="meta" color="textMid" style={styles.macroCheckCopy}>
                  {macrosCloseEnough
                    ? t('captureV1.newFoodMacroClose', { macroKcal, calories: calNum })
                    : t('captureV1.newFoodMacroMismatch', { macroKcal, calories: calNum })}
                </Text>
              </View>
            ) : null}

            {/* Optional Expandable Card */}
            <View style={styles.optionalCard}>
              <Pressable
                onPress={() => setShowMoreNutrients((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showMoreNutrients }}
                style={({ pressed }) => [
                  styles.optionalRow,
                  styles.optionalDivider,
                  pressed ? styles.rowPressed : null,
                ]}
                testID="btn-toggle-more-nutrients"
              >
                <Text variant="label" color="textHi" style={styles.optionalTitle}>
                  {t('captureV1.newFoodMoreNutrients')}
                </Text>
                <View style={styles.optionalRight}>
                  <Text variant="meta" color="textLo">
                    {t('captureV1.newFoodMoreNutrientsHint')}
                  </Text>
                  <ChevronRightIcon size={15} color={colors.textLo} />
                </View>
              </Pressable>

              {showMoreNutrients ? (
                <View style={[styles.extraInputsRow, styles.optionalDivider]}>
                  <View style={styles.colItem}>
                    <Text variant="micro" color="textLo">
                      Fiber (g)
                    </Text>
                    <View style={styles.miniInputBox}>
                      <TextInput
                        value={fiber}
                        onChangeText={setFiber}
                        keyboardType="decimal-pad"
                        style={styles.textInput}
                        testID="input-custom-food-fiber"
                      />
                    </View>
                  </View>
                  <View style={styles.colItem}>
                    <Text variant="micro" color="textLo">
                      Sugar (g)
                    </Text>
                    <View style={styles.miniInputBox}>
                      <TextInput
                        value={sugar}
                        onChangeText={setSugar}
                        keyboardType="decimal-pad"
                        style={styles.textInput}
                        testID="input-custom-food-sugar"
                      />
                    </View>
                  </View>
                  <View style={styles.colItem}>
                    <Text variant="micro" color="textLo">
                      Sodium (mg)
                    </Text>
                    <View style={styles.miniInputBox}>
                      <TextInput
                        value={sodium}
                        onChangeText={setSodium}
                        keyboardType="decimal-pad"
                        style={styles.textInput}
                        testID="input-custom-food-sodium"
                      />
                    </View>
                  </View>
                </View>
              ) : null}

              <Pressable
                onPress={() => setShowBarcodeInput((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showBarcodeInput }}
                style={({ pressed }) => [styles.optionalRow, pressed ? styles.rowPressed : null]}
                testID="btn-toggle-barcode-input"
              >
                <View style={styles.barcodeLeft}>
                  <BarcodeIcon size={16} color={colors.textMid} />
                  <Text variant="label" color="textHi" style={styles.optionalTitle}>
                    {t('captureV1.newFoodAddBarcode')}
                  </Text>
                </View>
                <View style={styles.optionalRight}>
                  {barcode ? (
                    <Text variant="meta" color="textLo" tabular>
                      {barcode}
                    </Text>
                  ) : null}
                  <ChevronRightIcon size={15} color={colors.textLo} />
                </View>
              </Pressable>

              {showBarcodeInput ? (
                <View style={styles.barcodeFieldWrap}>
                  <View style={styles.miniInputBox}>
                    <TextInput
                      value={barcode}
                      onChangeText={setBarcode}
                      placeholder="EAN / UPC barcode"
                      placeholderTextColor={colors.textOff}
                      keyboardType="number-pad"
                      style={styles.textInput}
                      testID="input-custom-food-barcode"
                    />
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>

        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(space.lg, insets.bottom + space.md) },
          ]}
        >
          <View style={styles.innerWrap}>
            <PrimaryButton
              title={
                loading
                  ? t('common.saving')
                  : t('captureV1.newFoodSaveAndAdd', { section: sectionLabel })
              }
              showArrow={!loading}
              loading={loading}
              disabled={loading}
              onPress={() => void handleSave(true)}
              testID="btn-submit-custom-food"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: space.md,
  },
  closeCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePressed: {
    backgroundColor: colors.s2,
  },
  headerTitle: {
    fontFamily: fonts.semibold,
    fontSize: 17,
  },
  topSaveBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  topSaveText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space.xs,
  },
  innerWrap: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: space.md,
  },
  fieldGroup: {
    gap: space.xs + 1,
  },
  fieldLabel: {
    paddingHorizontal: 2,
  },
  inputBox: {
    height: 50,
    borderRadius: radius.input,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
  inputBoxRow: {
    height: 50,
    borderRadius: radius.input,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.xs,
  },
  textInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textHi,
    paddingVertical: 0,
  },
  tabularInput: {
    fontFamily: fonts.semibold,
    fontVariant: ['tabular-nums'],
  },
  twoColRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  threeColRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  colItem: {
    flex: 1,
    gap: space.xs + 1,
  },
  macroCheckCard: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroCheckCopy: {
    flex: 1,
    lineHeight: 18,
  },
  optionalCard: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  optionalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 2,
    minHeight: 54,
    gap: space.sm,
  },
  optionalDivider: {
    borderBottomWidth: borders.width,
    borderBottomColor: colors.hairline,
  },
  rowPressed: {
    backgroundColor: colors.s2,
  },
  optionalTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  optionalRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
  },
  barcodeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
  },
  extraInputsRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  miniInputBox: {
    height: 44,
    borderRadius: radius.control,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    paddingHorizontal: space.md,
    justifyContent: 'center',
  },
  barcodeFieldWrap: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  bottomBar: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space.md,
    backgroundColor: colors.bg0,
  },
});
