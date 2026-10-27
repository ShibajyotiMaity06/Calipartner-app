import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  scaleNutrients,
  sumNutrientSnapshots,
  type Food,
  type FoodCandidateItem,
  type MealSection,
} from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { t } from '@/i18n';
import { swapCandidateFood, updateCandidateQuantity } from '@/services/aiFoodPhotoService';
import { generateClientUuid, searchLocalFoods } from '@/services/foodService';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { AdvancedNutrition } from '../diary/AdvancedNutrition';
import { useTheme } from '@/theme/useTheme';

export interface FoodPhotoResultsEditorProps {
  visible: boolean;
  initialCandidates: FoodCandidateItem[];
  defaultSection?: MealSection;
  localDate?: string;
  onClose: () => void;
  onSaveMeal: (finalCandidates: FoodCandidateItem[], mealSection: MealSection) => Promise<void>;
  onRetakePhoto?: () => void;
}

const SECTIONS: MealSection[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export function FoodPhotoResultsEditor({
  visible,
  initialCandidates,
  defaultSection = 'lunch',
  localDate,
  onClose,
  onSaveMeal,
  onRetakePhoto,
}: FoodPhotoResultsEditorProps) {
  const { colors } = useTheme();
  const { user } = useAuth();

  const [candidates, setCandidates] = useState<FoodCandidateItem[]>(initialCandidates);
  const [selectedSection, setSelectedSection] = useState<MealSection>(defaultSection);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Search dialog for Swap or Add item
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchMode, setSearchMode] = useState<'swap' | 'add'>('swap');
  const [targetSwapIdx, setTargetSwapIdx] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Food[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    setCandidates(initialCandidates);
    setSelectedSection(defaultSection);
    setSaveError(null);
  }, [initialCandidates, defaultSection, visible]);

  // Handle Steppers
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
  };

  const handleRemove = (index: number) => {
    setCandidates((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Open Search for Swap
  const handleOpenSwap = (index: number) => {
    setTargetSwapIdx(index);
    setSearchMode('swap');
    setSearchQuery('');
    setSearchResults([]);
    setSearchModalVisible(true);
  };

  // Open Search for Add Missing Item
  const handleOpenAdd = () => {
    setTargetSwapIdx(null);
    setSearchMode('add');
    setSearchQuery('');
    setSearchResults([]);
    setSearchModalVisible(true);
  };

  // Debounced search inside SQLite local_foods
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
        if (active) {
          setSearchResults(results);
        }
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
        setCandidates((prev) => {
          const copy = [...prev];
          copy[targetSwapIdx] = swapped;
          return copy;
        });
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

      setCandidates((prev) => [...prev, newCandidate]);
    }

    setSearchModalVisible(false);
  };

  // Live Totals
  const activeCandidates = candidates.filter((c) => c.quantity > 0);
  const totals = sumNutrientSnapshots(activeCandidates.map((candidate) => candidate.nutrients));

  const handleSave = async () => {
    if (isSaving || activeCandidates.length === 0) return;
    try {
      setIsSaving(true);
      setSaveError(null);
      await onSaveMeal(activeCandidates, selectedSection);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save food entries';
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      testID="modal-food-photo-results"
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {/* Navigation / Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: colors.surface, borderBottomColor: colors.border },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {t('foodLog.photo.resultsTitle')}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              {localDate ? `${localDate} • ` : ''}
              {t('foodLog.photo.resultsSubtitle')}
            </Text>
          </View>

          <Pressable
            testID="btn-close-results-editor"
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={26} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Prominent AI Estimate Notice Banner (PRD LOG-3) */}
          <View
            testID="banner-estimate-notice"
            style={[
              styles.estimateBanner,
              { backgroundColor: colors.cardHighlight, borderColor: colors.border },
            ]}
          >
            <View style={styles.estimateBadgeRow}>
              <View
                style={[
                  styles.estimatePill,
                  { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                ]}
              >
                <Ionicons name="information-circle-outline" size={12} color={colors.accent} />
                <Text style={[styles.estimatePillText, { color: colors.accent }]}>
                  {t('foodLog.photo.badge')}
                </Text>
              </View>
              <Text style={[styles.estimateTitle, { color: colors.text }]}>AI Detected Foods</Text>
            </View>
            <Text style={[styles.estimateNoticeText, { color: colors.textMuted }]}>
              {t('foodLog.photo.estimateNotice')}
            </Text>
          </View>

          {/* Section Picker Pills */}
          <View style={styles.sectionWrap}>
            <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>Meal Time</Text>
            <View style={styles.sectionRow}>
              {SECTIONS.map((sec) => {
                const isSelected = selectedSection === sec;
                return (
                  <Pressable
                    key={sec}
                    testID={`pill-section-${sec}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setSelectedSection(sec)}
                    style={[
                      styles.sectionPill,
                      {
                        backgroundColor: isSelected ? colors.accent : colors.surface,
                        borderColor: isSelected ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sectionPillText,
                        { color: isSelected ? colors.onAccent : colors.text },
                      ]}
                    >
                      {t(`diary.sections.${sec}` as Parameters<typeof t>[0])}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Live Totals Card */}
          <View
            testID="card-macro-totals"
            accessibilityLabel={`Total ${totals.calories} calories, ${totals.protein}g protein, ${totals.carbs}g carbs, ${totals.fat}g fat`}
            style={[
              styles.totalsCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.totalsHeader}>
              <Text style={[styles.totalsLabel, { color: colors.textMuted }]}>
                {t('foodLog.photo.totalLabel')}
              </Text>
              <Text style={[styles.caloriesValue, { color: colors.macroCalories }]}>
                {totals.calories} <Text style={{ fontSize: fontSize.sm }}>kcal</Text>
              </Text>
            </View>

            <View style={styles.macroPillRow}>
              <View style={[styles.macroPill, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.macroPillLabel, { color: colors.textMuted }]}>P</Text>
                <Text style={[styles.macroPillVal, { color: colors.macroProtein }]}>
                  {totals.protein}g
                </Text>
              </View>

              <View style={[styles.macroPill, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.macroPillLabel, { color: colors.textMuted }]}>C</Text>
                <Text style={[styles.macroPillVal, { color: colors.macroCarbs }]}>
                  {totals.carbs}g
                </Text>
              </View>

              <View style={[styles.macroPill, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.macroPillLabel, { color: colors.textMuted }]}>F</Text>
                <Text style={[styles.macroPillVal, { color: colors.macroFat }]}>{totals.fat}g</Text>
              </View>
            </View>

            {/* D06: Confidence band & Estimate label */}
            <View
              testID="band-confidence-estimate"
              style={{
                marginTop: 10,
                paddingTop: 8,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                gap: 2,
              }}
            >
              <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: colors.text }}>
                {`About ${totals.calories} kcal (${Math.round(totals.calories * 0.85)} to ${Math.round(totals.calories * 1.15)})`}
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
                Estimate. Check the portions.
              </Text>
            </View>
          </View>

          {/* Error Banner */}
          {saveError && (
            <View
              testID="banner-results-error"
              style={[
                styles.errorBanner,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.danger },
              ]}
            >
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger }]}>{saveError}</Text>
            </View>
          )}

          {/* Candidates List / Empty State */}
          {candidates.length === 0 ? (
            <View
              testID="empty-candidates-card"
              style={[
                styles.emptyCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons name="restaurant-outline" size={44} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {t('foodLog.photo.noCandidatesTitle')}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                {t('foodLog.photo.noCandidatesSub')}
              </Text>

              <View style={styles.emptyActionsRow}>
                {onRetakePhoto && (
                  <Pressable
                    testID="btn-empty-retake-photo"
                    accessibilityRole="button"
                    accessibilityLabel={t('foodLog.photo.retake')}
                    onPress={onRetakePhoto}
                    style={[styles.emptyActionBtn, { backgroundColor: colors.accent }]}
                  >
                    <Ionicons name="camera-reverse" size={18} color={colors.onAccent} />
                    <Text style={{ color: colors.onAccent, fontWeight: '700' }}>
                      {t('foodLog.photo.retake')}
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  testID="btn-empty-add-item"
                  accessibilityRole="button"
                  accessibilityLabel={t('foodLog.photo.addItem')}
                  onPress={handleOpenAdd}
                  style={[
                    styles.emptyActionBtn,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Ionicons name="add" size={18} color={colors.text} />
                  <Text style={{ color: colors.text, fontWeight: '600' }}>
                    {t('foodLog.photo.addItem')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.candidatesListWrap}>
              <Text style={[styles.listHeader, { color: colors.textMuted }]}>
                Detected Food Items ({candidates.length})
              </Text>

              {candidates.map((candidate, idx) => {
                const foodName = candidate.matched_food?.name || candidate.detected_name;
                const kcal = candidate.nutrients?.calories || 0;
                const p = candidate.nutrients?.protein || 0;
                const c = candidate.nutrients?.carbs || 0;
                const f = candidate.nutrients?.fat || 0;

                return (
                  <View
                    key={`${candidate.matched_food.id}-${idx}`}
                    testID={`item-candidate-${idx}`}
                    style={[
                      styles.candidateCard,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    {/* Top Row: Food Name & Calories */}
                    <View style={styles.candidateTopRow}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text
                          style={[styles.candidateName, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {foodName}
                        </Text>
                        <Text style={[styles.confidenceLabel, { color: colors.textMuted }]}>
                          {Math.round(candidate.confidence * 100)}% match •{' '}
                          {candidate.estimated_grams}g
                        </Text>
                      </View>

                      <Text style={[styles.candidateKcal, { color: colors.macroCalories }]}>
                        {kcal} kcal
                      </Text>
                    </View>

                    {/* Middle Row: Stepper Controls & Portion */}
                    <View style={styles.stepperRow}>
                      <View style={styles.stepperControls}>
                        <Pressable
                          testID={`btn-stepper-minus-${idx}`}
                          accessibilityRole="button"
                          accessibilityLabel={`Decrease ${foodName} quantity`}
                          onPress={() => handleQuantityStep(idx, 'dec')}
                          style={[
                            styles.stepperBtn,
                            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                          ]}
                        >
                          <Ionicons name="remove" size={18} color={colors.text} />
                        </Pressable>

                        <View style={styles.quantityDisplay}>
                          <Text style={[styles.quantityVal, { color: colors.text }]}>
                            {candidate.quantity} {candidate.unit}
                          </Text>
                        </View>

                        <Pressable
                          testID={`btn-stepper-plus-${idx}`}
                          accessibilityRole="button"
                          accessibilityLabel={`Increase ${foodName} quantity`}
                          onPress={() => handleQuantityStep(idx, 'inc')}
                          style={[
                            styles.stepperBtn,
                            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                          ]}
                        >
                          <Ionicons name="add" size={18} color={colors.text} />
                        </Pressable>
                      </View>

                      {/* Item Macro Preview */}
                      <Text style={[styles.itemMacroText, { color: colors.textMuted }]}>
                        P: {p}g • C: {c}g • F: {f}g
                      </Text>
                    </View>

                    {/* Bottom Row: Swap & Remove Actions */}
                    <View style={[styles.candidateActionsRow, { borderTopColor: colors.border }]}>
                      <Pressable
                        testID={`btn-swap-candidate-${idx}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Swap ${foodName}`}
                        onPress={() => handleOpenSwap(idx)}
                        style={styles.cardActionBtn}
                      >
                        <Ionicons name="swap-horizontal" size={16} color={colors.accent} />
                        <Text style={[styles.cardActionText, { color: colors.accent }]}>
                          {t('foodLog.photo.swapItem')}
                        </Text>
                      </Pressable>

                      <Pressable
                        testID={`btn-remove-candidate-${idx}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${foodName}`}
                        onPress={() => handleRemove(idx)}
                        style={styles.cardActionBtn}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.danger} />
                        <Text style={[styles.cardActionText, { color: colors.danger }]}>
                          {t('foodLog.photo.removeItem')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}

              {/* Add Missing Item Button */}
              <Pressable
                testID="btn-add-missing-item"
                accessibilityRole="button"
                accessibilityLabel={t('foodLog.photo.addItem')}
                onPress={handleOpenAdd}
                style={[
                  styles.addItemBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
                <Text style={[styles.addItemBtnText, { color: colors.accent }]}>
                  {t('foodLog.photo.addItem')}
                </Text>
              </Pressable>
            </View>
          )}
          <AdvancedNutrition nutrients={totals} />
        </ScrollView>

        {/* Bottom Save Action Bar */}
        <View
          style={[
            styles.bottomBar,
            { backgroundColor: colors.surface, borderTopColor: colors.border },
          ]}
        >
          {onRetakePhoto && (
            <Pressable
              testID="btn-retake-photo"
              onPress={onRetakePhoto}
              style={{
                paddingVertical: 14,
                paddingHorizontal: 18,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: fontSize.md }}>
                Retake
              </Text>
            </Pressable>
          )}

          <Pressable
            testID="btn-save-photo-meal"
            accessibilityRole="button"
            accessibilityLabel={t('foodLog.photo.logButton', { count: activeCandidates.length })}
            disabled={isSaving || activeCandidates.length === 0}
            onPress={handleSave}
            style={[
              styles.saveBtn,
              {
                backgroundColor: colors.accent,
                opacity: isSaving || activeCandidates.length === 0 ? 0.6 : 1,
                flex: 1,
              },
            ]}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.onAccent} size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={colors.onAccent} />
                <Text style={[styles.saveBtnText, { color: colors.onAccent }]}>
                  {`Add to ${selectedSection}`}
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Submodal: Swap / Add Food Search */}
        <Modal
          testID="modal-swap-food"
          visible={searchModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setSearchModalVisible(false)}
        >
          <View style={styles.subModalBackdrop}>
            <View
              style={[
                styles.subModalContainer,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.subModalHeader}>
                <Text style={[styles.subModalTitle, { color: colors.text }]}>
                  {searchMode === 'swap'
                    ? t('foodLog.photo.swapModalTitle')
                    : t('foodLog.photo.addItem')}
                </Text>
                <Pressable
                  testID="btn-close-submodal"
                  onPress={() => setSearchModalVisible(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </Pressable>
              </View>

              {/* Search Input Bar */}
              <View
                style={[
                  styles.searchInputWrap,
                  { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                ]}
              >
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  testID="input-swap-search"
                  placeholder={t('foodLog.photo.searchPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                  style={[styles.searchInput, { color: colors.text }]}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <Ionicons name="close" size={16} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>

              {/* Results List */}
              {searchLoading ? (
                <View style={styles.subModalLoading}>
                  <ActivityIndicator size="small" color={colors.accent} />
                </View>
              ) : searchResults.length === 0 && searchQuery.trim().length > 0 ? (
                <View style={styles.subModalEmpty}>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                    No matching food items found
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={{ maxHeight: 320 }}
                  contentContainerStyle={{ gap: 6, paddingVertical: spacing.sm }}
                >
                  {searchResults.map((f) => (
                    <Pressable
                      key={f.id}
                      testID={`swap-result-${f.id}`}
                      onPress={() => handleSelectFoodSearchResult(f)}
                      style={[
                        styles.searchResultRow,
                        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                      ]}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text
                          style={[styles.searchResultName, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {f.name}
                        </Text>
                        <Text style={[styles.searchResultMacros, { color: colors.textMuted }]}>
                          P {f.protein_per_100g}g • C {f.carbs_per_100g}g • F {f.fat_per_100g}g (per
                          100g)
                        </Text>
                      </View>

                      <Text style={[styles.searchResultKcal, { color: colors.macroCalories }]}>
                        {f.calories_per_100g} kcal
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 100,
  },
  estimateBanner: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 6,
  },
  estimateBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  estimatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  estimatePillText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  estimateTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  estimateNoticeText: {
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  sectionWrap: {
    gap: 6,
  },
  sectionHeading: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sectionPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  sectionPillText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  totalsCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 12,
  },
  totalsHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  totalsLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  caloriesValue: {
    fontSize: fontSize.xl,
    fontWeight: '800',
  },
  macroPillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  macroPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  macroPillLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  macroPillVal: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  errorText: {
    fontSize: fontSize.xs,
    flex: 1,
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  candidatesListWrap: {
    gap: spacing.sm,
  },
  listHeader: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  candidateCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: 12,
  },
  candidateTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  candidateName: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  confidenceLabel: {
    fontSize: fontSize.xs,
  },
  candidateKcal: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityDisplay: {
    minWidth: 80,
    alignItems: 'center',
  },
  quantityVal: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  itemMacroText: {
    fontSize: fontSize.xs,
  },
  candidateActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardActionText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addItemBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  bottomBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  saveBtnText: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  subModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  subModalContainer: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    padding: spacing.md,
    maxHeight: '80%',
  },
  subModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  subModalTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 8,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    padding: 0,
  },
  subModalLoading: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  subModalEmpty: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  searchResultName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  searchResultMacros: {
    fontSize: fontSize.xs,
  },
  searchResultKcal: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
