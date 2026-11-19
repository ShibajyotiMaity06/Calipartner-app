import { MyMealsView } from './MyMealsView';
import { DescribeMealModal } from './DescribeMealModal';
import type { NutrientCorrection } from '@calipartner/core';
import { type as inputTypography } from '@calipartner/ui';
import { PaywallModal } from '@/components/rooms/PaywallModal';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Food, FoodCandidateItem, MealSection } from '@calipartner/core';
import { applyNutrientCorrection, scaleNutrients, sumNutrientSnapshots } from '@calipartner/core';
import { Button, Chip, homeLayout, Text } from '@calipartner/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { getDb } from '@/db';
import { useFoodSearch } from '@/hooks/useFoodSearch';
import { useFoodLibrary } from '@/hooks/useFoodLibrary';
import { FoodFavoriteButton } from './FoodFavoriteButton';
import { FoodFavoritesView } from './FoodFavoritesView';
import { NutrientSummary } from './NutrientSummary';
import { useAddEntry } from '@/hooks/useFoodEntries';
import { usePreviouslyLogged, type PreviouslyLoggedItem } from '@/hooks/usePreviouslyLogged';
import { t } from '@/i18n';
import { getSupabase } from '@/lib/supabase';
import {
  acceptAiProcessingConsent,
  analyzeFoodPhoto,
  checkAiProcessingConsent,
  getAiFoodPhotoUsageStatus,
  savePhotoCandidatesToDiary,
  type SupabaseFunctionsClient,
} from '@/services/aiFoodPhotoService';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { CustomFoodModal } from './CustomFoodModal';
import { QuantityModal } from './QuantityModal';
import {
  AiConsentSheet,
  FoodPhotoAnalyzingOverlay,
  FoodPhotoCameraModal,
  FoodPhotoDailyLimitModal,
  FoodPhotoResultsEditor,
} from '@/components/food_photo';
import { RecipeBrowseView } from '@/components/recipes';

export interface FoodLogModalProps {
  visible: boolean;
  defaultSection: MealSection;
  localDate: string;
  onClose: () => void;
  onLogged?: () => void;
  initialTab?: TabType;
}

type FoodView = 'search' | 'photo' | 'recipes' | 'favorites' | 'myMeals';
type TabType = FoodView | 'scan';

export function FoodLogModal({
  visible,
  defaultSection,
  localDate,
  onClose,
  onLogged,
  initialTab = 'search',
}: FoodLogModalProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const photoSubscription = useSubscription();
  const hasPhotoAccess =
    photoSubscription.hasActiveAccess &&
    photoSubscription.currentTier === 'pro' &&
    !photoSubscription.isTrial;
  const library = useFoodLibrary();
  const [showDescribe, setShowDescribe] = useState(false);

  const [showPhotoPlans, setShowPhotoPlans] = useState(false);
  const [selectedFoods, setSelectedFoods] = useState<
    Record<
      string,
      {
        food: Food;
        quantity: number;
        unit: string;
        source: 'search' | 'history';
        nutrientOverrides?: NutrientCorrection;
      }
    >
  >({});
  const [batchMeal, setBatchMeal] = useState<MealSection | null>(null);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchError, setBatchError] = useState(false);
  const batchInFlight = useRef(false);
  const [loggedToast, setLoggedToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);
  const toggleSelection = (
    food: Food,
    quantity = !food.serving_units[0] || ['g', 'ml'].includes(food.serving_units[0].unit) ? 100 : 1,
    unit = food.serving_units[0]?.unit ?? 'g',
    source: 'search' | 'history' = 'search',
  ) => {
    setSelectedFoods((current) => {
      const next = { ...current };
      if (next[food.id]) delete next[food.id];
      else next[food.id] = { food, quantity, unit, source };
      return next;
    });
  };
  const [views, setViews] = useState<FoodView[]>([initialTab === 'scan' ? 'search' : initialTab]);
  const activeTab = views.at(-1)!;
  const backLabel = t(views.length > 1 ? 'common.back' : 'homeRefresh.close');
  const setActiveTab = (tab: FoodView) => {
    setViews((current) => (current.at(-1) === tab ? current : [...current, tab]));
  };
  const back = () => {
    if (batchInFlight.current) return;
    if (views.length > 1)
      setViews((current) =>
        current.length > 1 && current.at(-1) === activeTab ? current.slice(0, -1) : current,
      );
    else onClose();
  };
  useBrowserModalBack(visible, onClose, {
    depth: views.length - 1,
    onDepthChange: (depth) => setViews((current) => current.slice(0, depth + 1)),
  });
  const [portionDefaults, setPortionDefaults] = useState<{ quantity: number; unit: string }>();
  const [selectedFoodForQuantity, setSelectedFoodForQuantity] = useState<Food | null>(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  useEffect(() => {
    if (visible && initialTab === 'scan') setShowBarcodeScanner(true);
  }, [visible, initialTab]);
  const [showCustomFoodModal, setShowCustomFoodModal] = useState(false);
  const [prefilledBarcode, setPrefilledBarcode] = useState<string | null>(null);

  // Phase 11 AI Food Photo states
  const [showPhotoConsent, setShowPhotoConsent] = useState(false);
  const [showPhotoCamera, setShowPhotoCamera] = useState(false);
  const [photoAnalyzing, setPhotoAnalyzing] = useState<string | null>(null);
  const photoRequest = useRef(0);
  const [photoResults, setPhotoResults] = useState<FoodCandidateItem[] | null>(null);
  const [showResultsEditor, setShowResultsEditor] = useState(false);
  const [showDailyLimitModal, setShowDailyLimitModal] = useState(false);
  const [limitState, setLimitState] = useState<string>('free_after_trial');
  const [limitUsage, setLimitUsage] = useState<{ usedToday: number; dailyCap: number } | null>(
    null,
  );
  const [consentLoading, setConsentLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const closePhotoConsent = () => {
    if (!consentLoading) setShowPhotoConsent(false);
  };
  const returnToPhotoCamera = () => {
    photoRequest.current++;
    setPhotoAnalyzing(null);
    setShowResultsEditor(false);
    setPhotoResults(null);
    setShowPhotoCamera(true);
  };
  const closePhotoLimit = () => setShowDailyLimitModal(false);
  useBrowserModalBack(visible && showPhotoConsent, closePhotoConsent);
  useBrowserModalBack(visible && !!photoAnalyzing, returnToPhotoCamera);
  useBrowserModalBack(visible && showDailyLimitModal, closePhotoLimit);
  const { addEntry, error: saveError } = useAddEntry();
  const selection = Object.values(selectedFoods);
  const selectionTotals = sumNutrientSnapshots(
    selection.map((item) =>
      item.nutrientOverrides
        ? applyNutrientCorrection(
            scaleNutrients(item.food, item.quantity, item.unit),
            item.nutrientOverrides,
          )
        : scaleNutrients(item.food, item.quantity, item.unit),
    ),
  );
  const saveSelection = async () => {
    if (batchInFlight.current || !selection.length || !batchMeal) return;
    batchInFlight.current = true;
    setBatchSaving(true);
    setBatchError(false);
    try {
      for (const item of selection) {
        const saved = await addEntry({
          ...item,
          mealSection: batchMeal,
          localDate,
          source: item.source,
        });
        if (!saved) {
          setBatchError(true);
          return;
        }
        // Completed items leave the selection immediately; retry only the unsaved remainder.
        setSelectedFoods((current) => {
          const next = { ...current };
          delete next[item.food.id];
          return next;
        });
      }
      onLogged?.();
      onClose();
    } catch {
      setBatchError(true);
    } finally {
      batchInFlight.current = false;
      setBatchSaving(false);
    }
  };

  // Search tab hook
  const { query, setQuery, results: searchResults, loading: searchLoading } = useFoodSearch();

  // History tab hook
  const {
    items: historyItems,
    loading: historyLoading,
    error: historyError,
    saveError: historySaveError,
    saving: historySaving,
    refresh: refreshHistory,
  } = usePreviouslyLogged();

  const handleSelectFood = (food: Food) => {
    setPortionDefaults(undefined);
    setSelectedFoodForQuantity(food);
  };

  const handleOneTapAdd = (item: PreviouslyLoggedItem) => {
    setPortionDefaults({ quantity: item.stats.last_quantity, unit: item.stats.last_unit });
    setSelectedFoodForQuantity(item.food);
  };

  const handleLogFromQuantity = async (data: Parameters<typeof addEntry>[0]) => {
    if (selectedFoods[data.food.id]) {
      setSelectedFoods((current) => ({
        ...current,
        [data.food.id]: {
          ...current[data.food.id]!,
          food: data.food,
          quantity: data.quantity,
          unit: data.unit,
          nutrientOverrides: data.nutrientOverrides,
        },
      }));
      setSelectedFoodForQuantity(null);
      return;
    }
    const saved = await addEntry({
      ...data,
      localDate,
      source: portionDefaults ? 'history' : data.food.barcode ? 'scan' : 'search',
    });
    if (!saved) throw new Error(t('fixNovember.saveFailed'));
    if (onLogged) onLogged();
    setSelectedFoodForQuantity(null);
    setLoggedToast(data.food.name);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setLoggedToast(null), 3000);
    if (initialTab === 'scan') onClose();
  };

  const handleStartPhotoScan = async () => {
    setPhotoError(null);
    try {
      const status = await getAiFoodPhotoUsageStatus(
        getSupabase() as unknown as SupabaseFunctionsClient,
        user?.id ?? '',
      );
      setLimitUsage({ usedToday: status.usedToday, dailyCap: status.dailyCap });
      setLimitState(status.userState);
      if (!status.allowed && status.code !== 'CONSENT_REQUIRED') {
        if (
          status.code === 'UPGRADE_REQUIRED' ||
          ['MONTHLY_LIMIT_REACHED', 'DAILY_LIMIT_REACHED'].includes(status.code ?? '')
        ) {
          setLimitState(status.userState);
          setShowDailyLimitModal(true);
        } else {
          setPhotoError(t('brandRepair.unavailable'));
        }
        return;
      }
      const hasConsent = await checkAiProcessingConsent(
        getSupabase() as unknown as SupabaseFunctionsClient,
        user?.id ?? '',
      );
      if (!hasConsent) {
        setShowPhotoConsent(true);
      } else {
        setShowPhotoCamera(true);
      }
    } catch {
      setPhotoError(t('brandRepair.unavailable'));
    }
  };

  const handleAcceptConsent = async () => {
    try {
      setConsentLoading(true);
      await acceptAiProcessingConsent(getSupabase() as unknown as SupabaseFunctionsClient);
      setShowPhotoConsent(false);
      await handleStartPhotoScan();
    } catch {
      setPhotoError(t('capture.photoUnavailable'));
    } finally {
      setConsentLoading(false);
    }
  };

  const handlePhotoCaptured = async (payload: { base64: string; mimeType: string }) => {
    const request = ++photoRequest.current;
    setShowPhotoCamera(false);
    setPhotoAnalyzing(
      payload.base64.startsWith('data:')
        ? payload.base64
        : `data:${payload.mimeType};base64,${payload.base64}`,
    );
    try {
      const response = await analyzeFoodPhoto(getSupabase() as unknown as SupabaseFunctionsClient, {
        imageBase64: payload.base64,
        mimeType: payload.mimeType,
      });
      if (request !== photoRequest.current) return;

      if (!response.candidates.length) {
        setPhotoError(t('capture.noFood'));
        return;
      }
      setPhotoResults(response.candidates);
      setShowResultsEditor(true);
    } catch (err: unknown) {
      if (request !== photoRequest.current) return;
      const errorObj = err as { code?: string; message?: string };
      if (
        ['MONTHLY_LIMIT_REACHED', 'DAILY_LIMIT_REACHED'].includes(errorObj?.code ?? '') ||
        errorObj?.code === 'UPGRADE_REQUIRED' ||
        errorObj?.message?.includes('DAILY_LIMIT_REACHED')
      ) {
        try {
          const status = await getAiFoodPhotoUsageStatus(
            getSupabase() as unknown as SupabaseFunctionsClient,
            user?.id ?? '',
          );
          if (request !== photoRequest.current) return;
          setLimitState(status.userState);
          setLimitUsage({ usedToday: status.usedToday, dailyCap: status.dailyCap });
        } catch {
          if (request !== photoRequest.current) return;
          setLimitState(errorObj?.code === 'UPGRADE_REQUIRED' ? 'trial' : 'paid_pro');
        }
        setShowDailyLimitModal(true);
      } else if (errorObj?.code === 'CONSENT_REQUIRED') {
        setShowPhotoConsent(true);
      } else {
        setPhotoResults(null);
        setPhotoError(
          t(errorObj?.code === 'NO_FOOD_DETECTED' ? 'capture.noFood' : 'capture.photoUnavailable'),
        );
      }
    } finally {
      if (request === photoRequest.current) setPhotoAnalyzing(null);
    }
  };

  const handleSavePhotoMeal = async (
    candidatesToSave: FoodCandidateItem[],
    targetSection: MealSection,
  ) => {
    const db = await getDb();
    await savePhotoCandidatesToDiary(db, {
      userId: user?.id ?? '',
      candidates: candidatesToSave,
      mealSection: targetSection,
      localDate,
    });
    setShowResultsEditor(false);
    setPhotoResults(null);
    if (onLogged) onLogged();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={back}>
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}
      >
        <View
          testID="modal-food-log"
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            height: '92%',
            paddingTop: spacing.md,
            gap: spacing.sm,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: views.length > 1 ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.text }}>
                {t('foodLog.title')}
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
                {t(`diary.sections.${defaultSection}` as Parameters<typeof t>[0])} • {localDate}
              </Text>
            </View>

            <Button
              variant="tertiary"
              fullWidth={false}
              label={backLabel}
              iconOnly
              icon={
                <Ionicons
                  name={views.length > 1 ? 'chevron-back' : 'close'}
                  size={26}
                  color={colors.textMuted}
                />
              }
              testID="btn-close-food-log"
              accessibilityRole="button"
              accessibilityLabel={backLabel}
              style={{
                minWidth: homeLayout.touchSize,
                minHeight: homeLayout.touchSize,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={back}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            />
          </View>

          {loggedToast && (
            <View
              testID="food-log-success-toast"
              style={{
                marginHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.sm,
                backgroundColor: colors.surfaceAlt,
                borderRadius: radius.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
              }}
            >
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              <Text style={{ color: colors.text, fontSize: fontSize.sm }}>
                {t('launch.mealLogged')}: {loggedToast}
              </Text>
            </View>
          )}

          {(saveError || historySaveError) && (
            <Text
              accessibilityRole="alert"
              testID="food-log-save-error"
              style={{ color: colors.text }}
            >
              {t('fixNovember.saveFailed')}
            </Text>
          )}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              gap: spacing.xs,
              paddingHorizontal: spacing.md,
            }}
            testID="food-log-quick-actions"
          >
            {(
              [
                ['favorites', 'heart-outline', t('foodPolish.favorites')],
                ['myMeals', 'restaurant-outline', t('launch.meals')],
                ['search', 'search-outline', t('foodLog.tabs.search')],
              ] as const
            ).map(([tab, icon, label]) => (
              <Button
                key={tab}
                variant="tertiary"
                iconOnly
                fullWidth={false}
                label={label}
                accessibilityState={{ selected: activeTab === tab }}
                testID={`tab-log-${tab}`}
                icon={
                  <Ionicons
                    name={tab === 'favorites' && activeTab === tab ? 'heart' : icon}
                    size={homeLayout.iconSize}
                    color={activeTab === tab ? colors.accent : colors.text}
                  />
                }
                onPress={() => setActiveTab(tab)}
              />
            ))}
          </View>
          <Button
            variant="secondary"
            label={t('homeRefresh.describe')}
            testID="food-describe-meal"
            onPress={() => setShowDescribe(true)}
          />
          {showDescribe && (
            <DescribeMealModal
              visible
              section={defaultSection}
              localDate={localDate}
              onClose={() => setShowDescribe(false)}
              onLogged={onLogged}
            />
          )}
          <View
            testID="food-log-methods"
            style={{ flexDirection: 'row', gap: spacing.xs, padding: spacing.md }}
          >
            {(
              [
                ['recipes', 'book-outline', t('foodLog.tabs.recipes')],
                ['photo', 'camera-outline', t('foodLog.tabs.photo')],
                ['custom', 'create-outline', t('ownerPolish.custom')],
              ] as const
            ).map(([method, icon, label]) => {
              const selected = activeTab === method;
              return (
                <Pressable
                  key={method}
                  testID={`tab-log-${method}`}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    if (method === 'custom') {
                      setPrefilledBarcode(null);
                      setShowCustomFoodModal(true);
                    } else setActiveTab(method);
                  }}
                  style={({ pressed }) => ({
                    flexGrow: 1,
                    flexBasis: 0,
                    minWidth: homeLayout.compactTouchSize,
                    minHeight: homeLayout.touchSize,
                    padding: spacing.xs,
                    gap: spacing.xs,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: selected ? colors.accent : colors.border,
                    backgroundColor: pressed || selected ? colors.surfaceAlt : colors.surface,
                  })}
                >
                  <Ionicons
                    name={icon}
                    size={homeLayout.iconSize}
                    color={selected ? colors.accent : colors.textMuted}
                  />
                  <Text variant="bodyS" style={{ textAlign: 'center' }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {library.error && (
            <View style={{ paddingHorizontal: spacing.md, gap: spacing.xs }}>
              <Text accessibilityRole="alert">{t('foodPolish.libraryError')}</Text>
              <Button
                variant="secondary"
                label={t('common.retry')}
                onPress={() => void library.refresh()}
                testID="retry-food-library"
              />
            </View>
          )}
          {activeTab === 'myMeals' && (
            <MyMealsView
              selection={selection}
              section={defaultSection}
              localDate={localDate}
              onLogged={onLogged}
            />
          )}
          {activeTab === 'favorites' && (
            <FoodFavoritesView
              library={library}
              onFood={handleSelectFood}
              defaultSection={defaultSection}
              localDate={localDate}
              onLogged={onLogged}
            />
          )}
          {/* TAB 1: Search */}
          {activeTab === 'search' && (
            <View
              style={{
                flex: query.trim() ? 1 : undefined,
                paddingHorizontal: spacing.md,
                gap: spacing.sm,
              }}
            >
              {/* Search input bar */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: radius.md,
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  testID="input-food-search"
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('foodLog.searchPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  autoFocus={false}
                  style={[
                    {
                      flex: 1,
                      paddingVertical: 10,
                      paddingHorizontal: 8,
                      fontSize: fontSize.md,
                      color: colors.text,
                    },
                    { fontFamily: inputTypography.body.fontFamily },
                  ]}
                />
                {query.length > 0 && (
                  <Pressable onPress={() => setQuery('')}>
                    <Ionicons name="close" size={18} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>

              {/* Search status & results */}
              {searchLoading ? (
                <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
                  <ActivityIndicator color={colors.accent} size="small" />
                  <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, marginTop: 6 }}>
                    {t('foodLog.searching')}
                  </Text>
                </View>
              ) : query.trim().length > 0 && searchResults.length === 0 ? (
                <View
                  style={{ paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm }}
                >
                  <Ionicons name="search-outline" size={36} color={colors.textMuted} />
                  <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: colors.text }}>
                    {t('foodLog.noResultsTitle')}
                  </Text>
                  <Text
                    style={{ fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center' }}
                  >
                    {t('foodLog.noResultsSub')}
                  </Text>
                  <Button
                    variant="secondary"
                    fullWidth={false}
                    label={t('foodLog.createCustomFood')}
                    testID="btn-create-custom-food-fallback"
                    onPress={() => setShowCustomFoodModal(true)}
                    style={{
                      marginTop: spacing.xs,
                      backgroundColor: colors.accent,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: radius.sm,
                    }}
                  />
                </View>
              ) : (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingBottom: 20 }}
                >
                  {searchResults.map((f) => (
                    <Pressable
                      key={f.id}
                      testID={`search-result-${f.id}`}
                      onPress={() => handleSelectFood(f)}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
                        borderBottomWidth: 1,
                        borderColor: colors.border,
                      })}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text
                          style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.text }}
                          numberOfLines={1}
                        >
                          {f.name}
                        </Text>
                        {f.brand && <Text variant="micro">{f.brand}</Text>}
                        <NutrientSummary
                          variant="micro"
                          values={{
                            calories: f.calories_per_100g,
                            protein: f.protein_per_100g,
                            carbs: f.carbs_per_100g,
                            fat: f.fat_per_100g,
                          }}
                        />
                        <Text variant="micro">{t('foodPolish.portion')}</Text>
                      </View>

                      <FoodFavoriteButton food={f} library={library} />
                      <Pressable
                        testID={`select-food-${f.id}`}
                        onPress={(event) => {
                          event.stopPropagation();
                          toggleSelection(f);
                        }}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: Boolean(selectedFoods[f.id]) }}
                        accessibilityLabel={t('homeRefresh.selectFood', { name: f.name })}
                        style={{
                          minWidth: homeLayout.touchSize,
                          minHeight: homeLayout.touchSize,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons
                          name={selectedFoods[f.id] ? 'checkmark-circle' : 'add-circle-outline'}
                          size={homeLayout.iconSize}
                          color={colors.accent}
                        />
                      </Pressable>
                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <Text
                          nutrient="calories"
                          style={{
                            fontSize: fontSize.sm,
                            fontWeight: '700',
                            color: colors.macroCalories,
                          }}
                        >
                          {f.calories_per_100g} kcal
                        </Text>
                        {f.owner_id ? (
                          <View
                            style={{
                              backgroundColor: colors.surfaceAlt,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: radius.pill,
                            }}
                          >
                            <Text style={{ fontSize: 9, fontWeight: '700', color: colors.accent }}>
                              MY FOOD
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* TAB 3: Photo (PRD LOG-3) */}
          {activeTab === 'photo' && (
            <View testID="tab-view-photo-logging" style={{ gap: spacing.sm, padding: spacing.md }}>
              <Text variant="heading">{t('ownerPolish.scanMethods')}</Text>
              {photoError && (
                <Text accessibilityRole="alert" testID="food-photo-error">
                  {photoError}
                </Text>
              )}
              <Button
                variant="secondary"
                label={t('ownerPolish.barcodeScan')}
                icon={
                  <Ionicons name="barcode-outline" size={homeLayout.iconSize} color={colors.text} />
                }
                testID="tab-log-scan"
                onPress={() => setShowBarcodeScanner(true)}
              />
              <Button
                label={t('ownerPolish.aiScan')}
                icon={
                  <Ionicons
                    name="camera-outline"
                    size={homeLayout.iconSize}
                    color={colors.onAccent}
                  />
                }
                testID="btn-start-photo-scan"
                onPress={handleStartPhotoScan}
              />
              {!hasPhotoAccess && !photoSubscription.loading && (
                <Text variant="bodyS" testID="photo-access-copy">
                  {t('brandRepair.photoPro')}
                </Text>
              )}
            </View>
          )}

          {/* TAB: Recipes */}
          {activeTab === 'recipes' && (
            <View style={{ flex: 1 }}>
              <RecipeBrowseView
                hideFavoritesShortcut
                initialMealSection={defaultSection}
                localDate={localDate}
                onRecipeLogged={() => {
                  onLogged?.();
                }}
              />
            </View>
          )}

          {activeTab === 'search' && !query.trim() && (
            <View style={{ flex: 1, paddingHorizontal: spacing.md, gap: spacing.sm }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <Text variant="heading">{t('homeRefresh.recentFoods')}</Text>
                <Button
                  variant="tertiary"
                  fullWidth={false}
                  label={t('foodPolish.clearRecentFoods')}
                  disabled={library.busy || historyLoading || !historyItems.length}
                  onPress={() => void library.clearRecentFoods()}
                  testID="clear-recent-foods"
                />
              </View>
              {/* History Items List */}
              {historyError ? (
                <View>
                  <Text accessibilityRole="alert">{t('common.errorBody')}</Text>
                  <Button
                    variant="secondary"
                    label={t('common.retry')}
                    onPress={() => void refreshHistory()}
                    testID="retry-recent-foods"
                  />
                </View>
              ) : historyLoading ? (
                <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.md }} />
              ) : historyItems.length === 0 ? (
                <View style={{ paddingVertical: spacing.xl, alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: colors.text }}>
                    {t('foodLog.history.emptyTitle')}
                  </Text>
                  <Text
                    style={{ fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center' }}
                  >
                    {t('foodLog.history.emptySub')}
                  </Text>
                </View>
              ) : (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingBottom: 20, marginTop: 4 }}
                >
                  {historyItems.map((item) => (
                    <View
                      key={item.food.id}
                      testID={`history-item-${item.food.id}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        backgroundColor: colors.surface,
                        borderBottomWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Pressable
                        style={{ flex: 1, gap: 2 }}
                        onPress={() => handleSelectFood(item.food)}
                      >
                        <Text
                          style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.text }}
                          numberOfLines={1}
                        >
                          {item.food.name}
                        </Text>
                        <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
                          {t('homeRefresh.recentQuantity', {
                            quantity: item.stats.last_quantity,
                            unit: item.stats.last_unit,
                            count: item.stats.use_count,
                          })}
                        </Text>
                      </Pressable>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <FoodFavoriteButton food={item.food} library={library} />
                        <Pressable
                          testID={`select-history-${item.food.id}`}
                          onPress={() =>
                            toggleSelection(
                              item.food,
                              item.stats.last_quantity,
                              item.stats.last_unit,
                              'history',
                            )
                          }
                          disabled={batchSaving}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: Boolean(selectedFoods[item.food.id]) }}
                          accessibilityLabel={t('homeRefresh.selectFood', { name: item.food.name })}
                          style={{
                            minWidth: homeLayout.touchSize,
                            minHeight: homeLayout.touchSize,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons
                            name={
                              selectedFoods[item.food.id] ? 'checkmark-circle' : 'ellipse-outline'
                            }
                            size={homeLayout.iconSize}
                            color={colors.accent}
                          />
                        </Pressable>
                        {/* 1-tap quick add button (PRD 6.3 LOG-13) */}
                        <Button
                          variant="secondary"
                          fullWidth={false}
                          label={t('foodPolish.addFood')}
                          icon={<Ionicons name="add" size={14} color={colors.accent} />}
                          testID={`btn-quick-add-${item.food.id}`}
                          onPress={() => void handleOneTapAdd(item)}
                          disabled={historySaving || batchSaving}
                          accessibilityRole="button"
                          accessibilityLabel={t('foodPolish.chooseMealFor', {
                            name: item.food.name,
                          })}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: colors.surfaceAlt,
                            paddingHorizontal: 8,
                            paddingVertical: spacing.sm,
                            minHeight: homeLayout.touchSize,
                            borderRadius: radius.pill,
                            borderWidth: 1,
                            borderColor: colors.accent,
                            gap: 3,
                          }}
                        />
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Sub-modals */}
          {selection.length > 0 && (
            <View
              style={{ padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface }}
              testID="food-selection-footer"
            >
              <Text>{t('foodPolish.selected', { count: selection.length })}</Text>
              <Text>{t('foodPolish.chooseMeal')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {(['breakfast', 'lunch', 'dinner', 'snacks', 'extra'] as MealSection[]).map(
                  (meal) => (
                    <Chip
                      key={meal}
                      label={t(`diary.sections.${meal}`)}
                      selected={batchMeal === meal}
                      onPress={() => setBatchMeal(meal)}
                      testID={`batch-meal-${meal}`}
                    />
                  ),
                )}
              </View>
              <NutrientSummary values={selectionTotals} />
              {batchError && (
                <Text style={{ color: colors.danger }} accessibilityRole="alert">
                  {t('fixNovember.saveFailed')}
                </Text>
              )}
              <Button
                variant="primary"
                label={
                  batchSaving
                    ? t('common.saving')
                    : batchMeal
                      ? t('homeRefresh.addSelection', { meal: t(`diary.sections.${batchMeal}`) })
                      : t('foodPolish.chooseMeal')
                }
                onPress={() => void saveSelection()}
                disabled={batchSaving || !batchMeal}
                testID="save-food-selection"
              />
            </View>
          )}
          {showBarcodeScanner && (
            <BarcodeScannerModal
              visible={showBarcodeScanner}
              defaultSection={defaultSection}
              covered={Boolean(selectedFoodForQuantity) || showCustomFoodModal}
              onClose={() => setShowBarcodeScanner(false)}
              onFoodFound={handleSelectFood}
              onCreateCustomFood={(code) => {
                setPrefilledBarcode(code);
                setShowCustomFoodModal(true);
              }}
            />
          )}

          {showCustomFoodModal && (
            <CustomFoodModal
              visible={showCustomFoodModal}
              initialBarcode={prefilledBarcode}
              onClose={() => {
                setShowCustomFoodModal(false);
                setPrefilledBarcode(null);
              }}
              onCreated={handleSelectFood}
            />
          )}

          {selectedFoodForQuantity && (
            <QuantityModal
              visible={Boolean(selectedFoodForQuantity)}
              food={selectedFoodForQuantity}
              defaultSection={defaultSection}
              initialQuantity={portionDefaults?.quantity}
              initialUnit={portionDefaults?.unit}
              requireMealChoice={!selectedFoods[selectedFoodForQuantity.id]}
              onClose={() => {
                setSelectedFoodForQuantity(null);
                setPortionDefaults(undefined);
              }}
              onSave={handleLogFromQuantity}
            />
          )}

          {/* Phase 11 Food Photo Flow Modals */}
          {showPhotoConsent && (
            <AiConsentSheet
              visible={showPhotoConsent}
              loading={consentLoading}
              onAccept={handleAcceptConsent}
              onDecline={closePhotoConsent}
            />
          )}

          {showPhotoCamera && (
            <FoodPhotoCameraModal
              visible={showPhotoCamera}
              onClose={() => setShowPhotoCamera(false)}
              onPhotoCaptured={handlePhotoCaptured}
            />
          )}

          {photoAnalyzing && (
            <FoodPhotoAnalyzingOverlay
              visible
              imageUri={photoAnalyzing}
              onCancel={returnToPhotoCamera}
            />
          )}

          {showDailyLimitModal && (
            <FoodPhotoDailyLimitModal
              visible={showDailyLimitModal}
              userState={limitState}
              usedToday={limitUsage?.usedToday}
              dailyCap={limitUsage?.dailyCap}
              onClose={closePhotoLimit}
              onUpgrade={() => {
                setShowDailyLimitModal(false);
                setShowPhotoPlans(true);
              }}
              onLogManually={() => {
                setShowDailyLimitModal(false);
                setActiveTab('search');
              }}
            />
          )}

          {showPhotoPlans && (
            <PaywallModal
              visible
              preselectedTier="pro"
              context="general"
              onClose={() => {
                setShowPhotoPlans(false);
                setShowDailyLimitModal(true);
              }}
            />
          )}
          {showResultsEditor && photoResults && (
            <FoodPhotoResultsEditor
              visible={showResultsEditor}
              initialCandidates={photoResults}
              defaultSection={defaultSection}
              localDate={localDate}
              onClose={returnToPhotoCamera}
              onRetakePhoto={() => {
                setShowResultsEditor(false);
                setPhotoResults(null);
                void handleStartPhotoScan();
              }}
              onSaveMeal={handleSavePhotoMeal}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
