import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  FlashIcon,
  IconButton,
  LinkButton,
  PrimaryButton,
  SearchIcon,
  SecondaryButton,
  Segmented,
  Text,
  borders,
  colors,
  elevation,
  fonts,
  layout,
  radius,
  space,
} from '@calipartner/ui/v1';
import {
  scaleNutrients,
  applyNutrientCorrection,
  sumNutrientSnapshots,
  type Food,
  type FoodCandidateItem,
  type MealSection,
} from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { t } from '@/i18n';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { swapCandidateFood, updateCandidateQuantity } from '@/services/aiFoodPhotoService';
import { generateClientUuid, searchLocalFoods } from '@/services/foodService';
import { AdvancedNutrition } from '../diary/AdvancedNutrition';
import { NutrientSummary } from '../diary/NutrientSummary';
import { QuantityModal } from '../diary/QuantityModal';

export interface FoodPhotoResultsEditorProps {
  mealDescription?: string;
  imageUri?: string | null;
  visible: boolean;
  initialCandidates: FoodCandidateItem[];
  defaultSection?: MealSection;
  localDate?: string;
  onClose: () => void;
  onSaveMeal: (finalCandidates: FoodCandidateItem[], mealSection: MealSection) => Promise<void>;
  onRetakePhoto?: () => void;
  onSectionChange?: (section: MealSection) => void;
}

const SECTIONS: readonly MealSection[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

type MultiplierKey = '0.5' | '1' | '1.5' | '2';

const MULTIPLIER_OPTIONS: ReadonlyArray<{ id: MultiplierKey; label: string; factor: number }> = [
  { id: '0.5', label: '½×', factor: 0.5 },
  { id: '1', label: '1×', factor: 1 },
  { id: '1.5', label: '1.5×', factor: 1.5 },
  { id: '2', label: '2×', factor: 2 },
];

function buildCompoundMealTitle(
  mealDescription: string | undefined,
  candidates: readonly FoodCandidateItem[],
): string {
  const desc = mealDescription?.trim();
  if (desc) {
    return desc.charAt(0).toUpperCase() + desc.slice(1);
  }
  const names = candidates
    .map((c) => (c.matched_food?.name || c.detected_name || '').trim())
    .filter(Boolean);
  if (names.length === 0) return t('captureV1.mealNameFallback');
  if (names.length === 1) return names[0]!;
  return `${names[0]} & ${names[1]!.toLowerCase()}`;
}

export function FoodPhotoResultsEditor({
  mealDescription,
  imageUri,
  visible,
  initialCandidates,
  defaultSection = 'lunch',
  onClose,
  onSaveMeal,
  onRetakePhoto,
  onSectionChange,
}: FoodPhotoResultsEditorProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [baseCandidates, setBaseCandidates] = useState<FoodCandidateItem[]>(initialCandidates);
  const [candidates, setCandidates] = useState<FoodCandidateItem[]>(initialCandidates);
  const [multiplier, setMultiplier] = useState<MultiplierKey>('1');
  const [selectedSection, setSelectedSection] = useState<MealSection>(defaultSection);
  const [mealMenuOpen, setMealMenuOpen] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  // Search dialog for Swap or Add item
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchMode, setSearchMode] = useState<'swap' | 'add'>('swap');
  const [targetSwapIdx, setTargetSwapIdx] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Food[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const close = () => {
    if (!savingRef.current) onClose();
  };
  const closeSearch = () => setSearchModalVisible(false);
  useBrowserModalBack(visible, close);
  useBrowserModalBack(visible && searchModalVisible, closeSearch);

  useEffect(() => {
    setBaseCandidates(initialCandidates);
    setCandidates(initialCandidates);
    setMultiplier('1');
    setSelectedSection(defaultSection);
    setSaveError(null);
    setExpandedIdx(null);
    setMealMenuOpen(false);
  }, [initialCandidates, defaultSection, visible]);

  const activeFactor = useMemo(
    () => MULTIPLIER_OPTIONS.find((opt) => opt.id === multiplier)?.factor ?? 1,
    [multiplier],
  );

  const handleMultiplierChange = (nextKey: MultiplierKey) => {
    setMultiplier(nextKey);
    const nextFactor = MULTIPLIER_OPTIONS.find((opt) => opt.id === nextKey)?.factor ?? 1;
    setCandidates(
      baseCandidates.map((baseItem) => {
        const scaledQty = Math.max(0, Math.round(baseItem.quantity * nextFactor * 100) / 100);
        return updateCandidateQuantity(baseItem, scaledQty);
      }),
    );
  };

  const handleQuantityStep = (index: number, direction: 'inc' | 'dec') => {
    const item = candidates[index];
    if (!item) return;

    const isGramUnit = item.unit.toLowerCase() === 'g' || item.unit.toLowerCase() === 'ml';
    const delta = isGramUnit ? 25 : 0.25;
    const nextQty =
      direction === 'inc'
        ? Math.round((item.quantity + delta) * 100) / 100
        : Math.max(0, Math.round((item.quantity - delta) * 100) / 100);

    const updated = updateCandidateQuantity(item, nextQty);
    setCandidates((prev) => {
      const copy = [...prev];
      copy[index] = updated;
      return copy;
    });
    setBaseCandidates((prev) => {
      const copy = [...prev];
      const baseQty = Math.round((nextQty / activeFactor) * 100) / 100;
      if (copy[index]) copy[index] = updateCandidateQuantity(copy[index]!, baseQty);
      return copy;
    });
  };

  const handleRemove = (index: number) => {
    setCandidates((prev) => prev.filter((_, idx) => idx !== index));
    setBaseCandidates((prev) => prev.filter((_, idx) => idx !== index));
    setExpandedIdx((cur) => (cur === index ? null : cur));
  };

  const handleOpenSwap = (index: number) => {
    setTargetSwapIdx(index);
    setSearchMode('swap');
    setSearchQuery('');
    setSearchResults([]);
    setSearchModalVisible(true);
  };

  const handleOpenAdd = () => {
    setTargetSwapIdx(null);
    setSearchMode('add');
    setSearchQuery('');
    setSearchResults([]);
    setSearchModalVisible(true);
  };

  useEffect(() => {
    let active = true;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const db = await getDb();
        const results = await searchLocalFoods(db, trimmed, user?.id);
        if (active) setSearchResults(results);
      } catch {
        if (active) setSearchResults([]);
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, user?.id]);

  const handleSelectFoodSearchResult = (food: Food) => {
    if (searchMode === 'swap' && targetSwapIdx !== null) {
      const target = candidates[targetSwapIdx];
      if (target) {
        const swapped = swapCandidateFood(target, food);
        setCandidates((prev) => prev.map((c, idx) => (idx === targetSwapIdx ? swapped : c)));
        setBaseCandidates((prev) =>
          prev.map((c, idx) => (idx === targetSwapIdx ? swapCandidateFood(c, food) : c)),
        );
      }
    } else if (searchMode === 'add') {
      const defaultUnit = food.serving_units?.[0]?.unit || 'g';
      const defaultGrams = food.serving_units?.[0]?.grams || 100;
      const initialQty = defaultUnit === 'g' ? defaultGrams : 1;
      const nutrients = scaleNutrients(food, initialQty, defaultUnit);
      const newCandidate: FoodCandidateItem = {
        id: generateClientUuid(),
        detected_name: food.name,
        estimated_grams: defaultGrams,
        confidence: 1.0,
        matched_food: food,
        quantity: initialQty,
        unit: defaultUnit,
        nutrients,
        is_estimate: true,
      };
      setBaseCandidates((prev) => [...prev, newCandidate]);
      setCandidates((prev) => [...prev, newCandidate]);
    }
    setSearchModalVisible(false);
  };

  const activeCandidates = candidates.filter((c) => c.quantity > 0);
  const totals = sumNutrientSnapshots(activeCandidates.map((candidate) => candidate.nutrients));
  const mealTitle = buildCompoundMealTitle(mealDescription, activeCandidates);
  const sectionLabel = t(`diary.sections.${selectedSection}` as Parameters<typeof t>[0]);
  const floatingPins = activeCandidates.slice(0, 3);

  const handleSave = async () => {
    if (savingRef.current || isSaving || activeCandidates.length === 0) return;
    savingRef.current = true;
    try {
      setIsSaving(true);
      setSaveError(null);
      await onSaveMeal(activeCandidates, selectedSection);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save food entries';
      setSaveError(msg);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Modal
      testID="modal-food-photo-results"
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={close}
    >
      <View style={styles.screen}>
        {/* Top Photo / Detected Pins Preview Stage */}
        <View style={[styles.photoStage, { paddingTop: insets.top + layout.topContentOffset }]}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : null}
          <View style={styles.photoScrim} />

          {/* Subtle circular plate illustration when no photo is present */}
          {!imageUri ? (
            <View pointerEvents="none" style={styles.plateRingWrap}>
              <View style={styles.plateOuter} />
            </View>
          ) : null}

          {/* Top Navigation Bar */}
          <View style={styles.topOverlayBar}>
            <IconButton
              icon={<CloseIcon size={18} color={colors.textHi} />}
              variant="glass"
              onPress={close}
              accessibilityLabel={t('common.cancel')}
              testID="btn-close-results-editor"
            />

            <View style={styles.dropdownAnchor}>
              <Pressable
                onPress={() => setMealMenuOpen((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel={sectionLabel}
                style={styles.sectionPill}
                testID="results-meal-section-picker"
              >
                <Text variant="label" color="textHi">
                  {`${sectionLabel} ▾`}
                </Text>
              </Pressable>
              {mealMenuOpen ? (
                <View style={styles.dropdownMenu}>
                  {SECTIONS.map((sec, idx) => {
                    const selected = sec === selectedSection;
                    return (
                      <Pressable
                        key={sec}
                        onPress={() => {
                          setSelectedSection(sec);
                          onSectionChange?.(sec);
                          setMealMenuOpen(false);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        testID={`pill-section-${sec}`}
                        style={[
                          styles.dropdownItem,
                          idx < SECTIONS.length - 1 ? styles.dropdownDivider : null,
                        ]}
                      >
                        <Text variant="label" color={selected ? 'apricot' : 'textHi'}>
                          {t(`diary.sections.${sec}` as Parameters<typeof t>[0])}
                        </Text>
                        {selected ? <CheckIcon size={14} color={colors.apricot} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>

            <IconButton
              icon={<FlashIcon size={18} color={colors.textMid} />}
              variant="glass"
              onPress={onRetakePhoto ?? close}
              accessibilityLabel={t('captureV1.retake')}
            />
          </View>

          {/* Floating Detected Pins */}
          <View style={styles.pinsContainer} pointerEvents="none">
            {floatingPins[0] ? (
              <View style={[styles.pinPill, styles.pinLeft]}>
                <View style={styles.pinDot} />
                <Text variant="micro" color="textHi" numberOfLines={1}>
                  {
                    (floatingPins[0].matched_food?.name || floatingPins[0].detected_name).split(
                      ',',
                    )[0]
                  }
                </Text>
              </View>
            ) : null}
            {floatingPins[1] ? (
              <View style={[styles.pinPill, styles.pinRight]}>
                <View style={styles.pinDot} />
                <Text variant="micro" color="textHi" numberOfLines={1}>
                  {
                    (floatingPins[1].matched_food?.name || floatingPins[1].detected_name).split(
                      ',',
                    )[0]
                  }
                </Text>
              </View>
            ) : null}
            {floatingPins[2] ? (
              <View style={[styles.pinPill, styles.pinBottom]}>
                <View style={styles.pinDot} />
                <Text variant="micro" color="textHi" numberOfLines={1}>
                  {
                    (floatingPins[2].matched_food?.name || floatingPins[2].detected_name).split(
                      ',',
                    )[0]
                  }
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Bottom Elevated Results Sheet */}
        <View
          style={[
            styles.bottomSheet,
            elevation.sheet,
            { paddingBottom: Math.max(layout.ctaBottomMin, insets.bottom + space.sm) },
          ]}
        >
          <View style={styles.grabber} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header Row: AI Eyebrow + Compound Title | Hero Calories */}
            <View style={styles.resultHeaderRow}>
              <View style={styles.resultTitleCol}>
                <Text variant="eyebrow" color="textLo" testID="banner-estimate-notice">
                  {t('captureV1.aiEstimateEyebrow')}
                </Text>
                <Pressable
                  onPress={onClose}
                  disabled={!mealDescription}
                  accessibilityRole={mealDescription ? 'button' : undefined}
                  testID="edit-meal-description"
                >
                  <Text variant="titleM" color="textHi" numberOfLines={2}>
                    {mealTitle}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.heroKcalCol}>
                <Text variant="numL" tabular color="textHi">
                  {String(Math.round(totals.calories))}
                </Text>
                <Text variant="meta" color="textLo">
                  kcal
                </Text>
              </View>
            </View>

            {/* Macro Summary Pills */}
            <View
              style={styles.macroRow}
              testID="card-macro-totals"
              accessibilityLabel={`Total ${totals.calories} calories, ${totals.protein}g protein, ${totals.carbs}g carbs, ${totals.fat}g fat`}
            >
              <View style={styles.macroPill}>
                <Text variant="meta" color="textMid" tabular>
                  {t('captureV1.proteinShort', { g: Math.round(totals.protein) })}
                </Text>
              </View>
              <View style={styles.macroPill}>
                <Text variant="meta" color="textMid" tabular>
                  {t('captureV1.carbsShort', { g: Math.round(totals.carbs) })}
                </Text>
              </View>
              <View style={styles.macroPill}>
                <Text variant="meta" color="textMid" tabular>
                  {t('captureV1.fatShort', { g: Math.round(totals.fat) })}
                </Text>
              </View>
            </View>

            {/* Confidence band caption */}
            <Text variant="micro" color="textLo" testID="band-confidence-estimate">
              {`About ${Math.round(totals.calories)} kcal (${Math.round(totals.calories * 0.85)}–${Math.round(totals.calories * 1.15)})`}
            </Text>

            {/* Multiplier Segmented Bar */}
            <Segmented
              options={MULTIPLIER_OPTIONS.map((m) => ({ value: m.id, label: m.label }))}
              value={multiplier}
              onChange={(val) => handleMultiplierChange(val as MultiplierKey)}
              compact
              testID="segmented-meal-multiplier"
            />

            {saveError ? (
              <View testID="banner-results-error" style={styles.errorBanner}>
                <Text variant="meta" color="danger" accessibilityRole="alert">
                  {saveError}
                </Text>
              </View>
            ) : null}

            {/* Ingredient Rows */}
            {candidates.length === 0 ? (
              <View testID="empty-candidates-card" style={styles.emptyCard}>
                <Text variant="rowTitle" color="textHi">
                  {t('foodLog.photo.noCandidatesTitle')}
                </Text>
                <Text variant="meta" color="textLo" style={styles.centeredText}>
                  {t('foodLog.photo.noCandidatesSub')}
                </Text>
                <View style={styles.emptyActions}>
                  {onRetakePhoto ? (
                    <PrimaryButton
                      title={t('foodLog.photo.retake')}
                      onPress={onRetakePhoto}
                      testID="btn-empty-retake-photo"
                    />
                  ) : null}
                  <SecondaryButton
                    title={t('foodLog.photo.addItem')}
                    onPress={handleOpenAdd}
                    testID="btn-empty-add-item"
                  />
                </View>
              </View>
            ) : (
              <View>
                {candidates.map((candidate, idx) => {
                  const foodName = candidate.matched_food?.name || candidate.detected_name;
                  const kcal = Math.round(candidate.nutrients?.calories ?? 0);
                  const qtyDisplay =
                    candidate.unit === 'g' || candidate.unit === 'ml'
                      ? `${Math.round(candidate.quantity)} ${candidate.unit}`
                      : `${candidate.quantity} ${candidate.unit}`;
                  const isExpanded = expandedIdx === idx;

                  return (
                    <View
                      key={`${candidate.matched_food.id}-${idx}`}
                      testID={`item-candidate-${idx}`}
                    >
                      <Pressable
                        onPress={() => setExpandedIdx((cur) => (cur === idx ? null : idx))}
                        accessibilityRole="button"
                        accessibilityLabel={`${foodName}, ${qtyDisplay}, ${kcal} kcal`}
                        style={styles.ingredientRow}
                      >
                        <Text
                          variant="rowTitle"
                          color="textHi"
                          numberOfLines={1}
                          style={styles.ingredientName}
                        >
                          {foodName}
                          <Text variant="meta" color="textLo">{` · ${qtyDisplay}`}</Text>
                        </Text>
                        <View style={styles.ingredientRight}>
                          <Text variant="rowTitle" tabular color="textHi">
                            {String(kcal)}
                          </Text>
                          <Text variant="meta" color="textLo">
                            {' kcal'}
                          </Text>
                          <ChevronRightIcon size={16} color={colors.textLo} />
                        </View>
                      </Pressable>

                      {isExpanded ? (
                        <View style={styles.adjustDrawer}>
                          <View style={styles.stepperRow}>
                            <Pressable
                              onPress={() => handleQuantityStep(idx, 'dec')}
                              accessibilityRole="button"
                              accessibilityLabel={`Decrease ${foodName} quantity`}
                              testID={`btn-stepper-minus-${idx}`}
                              style={styles.stepperBtn}
                            >
                              <Text variant="buttonM" color="textHi">
                                −
                              </Text>
                            </Pressable>
                            <Text variant="label" tabular color="textHi">
                              {qtyDisplay}
                            </Text>
                            <Pressable
                              onPress={() => handleQuantityStep(idx, 'inc')}
                              accessibilityRole="button"
                              accessibilityLabel={`Increase ${foodName} quantity`}
                              testID={`btn-stepper-plus-${idx}`}
                              style={styles.stepperBtn}
                            >
                              <Text variant="buttonM" color="textHi">
                                +
                              </Text>
                            </Pressable>
                          </View>

                          <View style={styles.drawerActions}>
                            <LinkButton
                              title={t('foodPolish.editNutrition')}
                              variant="accent"
                              onPress={() => setEditing(idx)}
                              testID={`edit-candidate-nutrition-${idx}`}
                            />
                            <LinkButton
                              title={t('foodLog.photo.swapItem')}
                              variant="default"
                              onPress={() => handleOpenSwap(idx)}
                              testID={`btn-swap-candidate-${idx}`}
                            />
                            <LinkButton
                              title={t('foodLog.photo.removeItem')}
                              variant="default"
                              onPress={() => handleRemove(idx)}
                              testID={`btn-remove-candidate-${idx}`}
                            />
                          </View>
                        </View>
                      ) : null}

                      <View style={styles.rowDivider} />
                    </View>
                  );
                })}

                <Pressable
                  onPress={handleOpenAdd}
                  accessibilityRole="button"
                  accessibilityLabel={t('foodLog.photo.addItem')}
                  testID="btn-add-missing-item"
                  style={styles.addItemLink}
                >
                  <Text variant="buttonS" color="apricot">
                    {t('captureV1.addItem')}
                  </Text>
                </Pressable>
              </View>
            )}

            <AdvancedNutrition nutrients={totals} />
          </ScrollView>

          {/* Bottom Save CTA & Retake */}
          <View style={styles.footerActions}>
            <PrimaryButton
              title={t('captureV1.logToSection', { section: sectionLabel })}
              showArrow
              loading={isSaving}
              disabled={isSaving || activeCandidates.length === 0}
              onPress={() => void handleSave()}
              testID="btn-save-photo-meal"
            />
            {onRetakePhoto ? (
              <LinkButton
                title={t('captureV1.retake')}
                variant="default"
                onPress={onRetakePhoto}
                testID="btn-retake-photo"
              />
            ) : null}
          </View>
        </View>

        {editing !== null && candidates[editing] ? (
          <QuantityModal
            visible
            food={candidates[editing]!.matched_food}
            initialNutrients={candidates[editing]!.nutrients}
            initialQuantity={candidates[editing]!.quantity}
            initialUnit={candidates[editing]!.unit}
            defaultSection={selectedSection}
            onClose={() => setEditing(null)}
            onSave={(data) => {
              const candidate = candidates[editing];
              if (!candidate) return;
              const updated = updateCandidateQuantity(candidate, data.quantity, data.unit);
              const nutrients = applyNutrientCorrection(updated.nutrients, data.nutrientOverrides);
              const nextCandidate: FoodCandidateItem = {
                ...updated,
                nutrients,
                corrected_nutrients: {
                  quantity: data.quantity,
                  unit: data.unit,
                  nutrients,
                },
              };
              setCandidates((current) =>
                current.map((item, index) => (index === editing ? nextCandidate : item)),
              );
              setBaseCandidates((current) =>
                current.map((item, index) => (index === editing ? nextCandidate : item)),
              );
            }}
          />
        ) : null}

        {/* Search Submodal for Swap / Add Item */}
        <Modal
          testID="modal-swap-food"
          visible={searchModalVisible}
          animationType="slide"
          transparent
          onRequestClose={closeSearch}
        >
          <View style={styles.subModalBackdrop}>
            <View style={styles.subModalCard}>
              <View style={styles.subModalHeader}>
                <Text variant="titleS" color="textHi">
                  {searchMode === 'swap'
                    ? t('foodLog.photo.swapModalTitle')
                    : t('foodLog.photo.addItem')}
                </Text>
                <IconButton
                  icon={<CloseIcon size={16} color={colors.textHi} />}
                  size={36}
                  inSheet
                  onPress={closeSearch}
                  accessibilityLabel={t('common.cancel')}
                  testID="btn-close-submodal"
                />
              </View>

              <View style={styles.searchBar}>
                <SearchIcon size={18} color={colors.textLo} />
                <TextInput
                  testID="input-swap-search"
                  placeholder={t('foodLog.photo.searchPlaceholder')}
                  placeholderTextColor={colors.textLo}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                  style={styles.searchInput}
                />
                {searchQuery.length > 0 ? (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <CloseIcon size={16} color={colors.textLo} />
                  </Pressable>
                ) : null}
              </View>

              {searchLoading ? (
                <View style={styles.searchStatePad}>
                  <ActivityIndicator size="small" color={colors.apricot} />
                </View>
              ) : searchResults.length === 0 && searchQuery.trim().length > 0 ? (
                <View style={styles.searchStatePad}>
                  <Text variant="meta" color="textLo">
                    {t('foodLog.noResultsTitle')}
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.searchList}
                  contentContainerStyle={styles.searchListContent}
                >
                  {searchResults.map((f) => (
                    <Pressable
                      key={f.id}
                      testID={`swap-result-${f.id}`}
                      onPress={() => handleSelectFoodSearchResult(f)}
                      style={styles.searchResultRow}
                    >
                      <View style={styles.searchResultCopy}>
                        <Text variant="rowTitle" color="textHi" numberOfLines={1}>
                          {f.name}
                        </Text>
                        <NutrientSummary
                          variant="micro"
                          values={{
                            calories: f.calories_per_100g,
                            protein: f.protein_per_100g,
                            carbs: f.carbs_per_100g,
                            fat: f.fat_per_100g,
                          }}
                        />
                      </View>
                      <Text variant="rowTitle" tabular color="textHi">
                        {f.calories_per_100g}
                        <Text variant="meta" color="textLo">
                          {' kcal'}
                        </Text>
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg0,
  },
  photoStage: {
    height: 248,
    backgroundColor: colors.bg0,
    position: 'relative',
    paddingHorizontal: layout.screenPaddingX,
    justifyContent: 'space-between',
    paddingBottom: space.xl,
  },
  photoScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.apricotGlowSoft,
  },
  plateRingWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateOuter: {
    width: 176,
    height: 176,
    borderRadius: radius.full,
    borderWidth: borders.width,
    borderColor: colors.s2,
    backgroundColor: colors.s1,
  },
  topOverlayBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  glassCircle: {
    backgroundColor: colors.glass,
    borderColor: colors.hairline,
  },
  dropdownAnchor: {
    position: 'relative',
    alignItems: 'center',
  },
  sectionPill: {
    backgroundColor: colors.glass,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.full,
    paddingHorizontal: space.lg,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 46,
    minWidth: 160,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairlineLit,
    borderRadius: radius.card,
    paddingVertical: space.xs,
    zIndex: 30,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minHeight: 40,
  },
  dropdownDivider: {
    borderBottomWidth: borders.width,
    borderBottomColor: colors.s2,
  },
  pinsContainer: {
    height: 112,
    position: 'relative',
  },
  pinPill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: colors.glass,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    maxWidth: 150,
  },
  pinDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.apricot,
  },
  pinLeft: {
    left: 4,
    top: 8,
  },
  pinRight: {
    right: 4,
    top: 2,
  },
  pinBottom: {
    alignSelf: 'center',
    left: '34%',
    bottom: 2,
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: colors.s1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: borders.width,
    borderColor: colors.hairlineLit,
    paddingHorizontal: layout.sheetPaddingX,
    paddingTop: space.sm,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: colors.hairline,
    alignSelf: 'center',
    marginBottom: space.md,
  },
  sheetScrollContent: {
    gap: space.md,
    paddingBottom: space.md,
  },
  resultHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
  },
  resultTitleCol: {
    flex: 1,
    gap: space.xs,
  },
  heroKcalCol: {
    alignItems: 'flex-end',
  },
  macroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  macroPill: {
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.chip,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  errorBanner: {
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.danger,
    borderRadius: radius.banner,
    padding: space.md,
  },
  emptyCard: {
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    padding: space.xl,
    gap: space.md,
    alignItems: 'center',
  },
  centeredText: {
    textAlign: 'center',
  },
  emptyActions: {
    width: '100%',
    gap: space.sm,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    minHeight: 48,
    gap: space.sm,
  },
  ingredientName: {
    flex: 1,
  },
  ingredientRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.xs,
  },
  adjustDrawer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: space.sm,
    paddingBottom: space.md,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  rowDivider: {
    height: borders.width,
    backgroundColor: colors.s2,
  },
  addItemLink: {
    paddingVertical: space.md,
    alignSelf: 'flex-start',
  },
  footerActions: {
    gap: space.xs,
    alignItems: 'center',
    paddingTop: space.sm,
  },
  subModalBackdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'flex-end',
  },
  subModalCard: {
    backgroundColor: colors.s1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: borders.width,
    borderColor: colors.hairlineLit,
    padding: layout.sheetPaddingX,
    gap: space.md,
    maxHeight: '85%',
  },
  subModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.input,
    paddingHorizontal: space.md,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    color: colors.textHi,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  searchStatePad: {
    paddingVertical: space.xl,
    alignItems: 'center',
  },
  searchList: {
    maxHeight: 320,
  },
  searchListContent: {
    gap: space.sm,
    paddingBottom: space.md,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    padding: space.md,
  },
  searchResultCopy: {
    flex: 1,
    gap: space.xs,
  },
});
