import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@calipartner/ui';
import {
  BarcodeIcon,
  CameraIcon,
  CheckIcon,
  ChevronLeftIcon,
  Chip,
  CloseIcon,
  EditIcon,
  IconButton,
  LinkButton,
  PlusIcon,
  PrimaryButton,
  SearchIcon,
  Text,
  borders,
  colors,
  elevation,
  fonts,
  layout,
  radius,
  space,
} from '@calipartner/ui/v1';
import type { Food, FoodCandidateItem, MealSection, NutrientCorrection } from '@calipartner/core';
import { applyNutrientCorrection, scaleNutrients, sumNutrientSnapshots } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { getDb } from '@/db';
import { useFoodSearch } from '@/hooks/useFoodSearch';
import { useFoodLibrary } from '@/hooks/useFoodLibrary';
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
import { PaywallModal } from '@/components/rooms/PaywallModal';
import { RecipeBrowseView } from '@/components/recipes';
import {
  AiConsentSheet,
  FoodPhotoAnalyzingOverlay,
  FoodPhotoCameraModal,
  FoodPhotoDailyLimitModal,
  FoodPhotoResultsEditor,
} from '@/components/food_photo';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { CustomFoodModal } from './CustomFoodModal';
import { DescribeMealModal } from './DescribeMealModal';
import { FoodFavoriteButton } from './FoodFavoriteButton';
import { FoodFavoritesView } from './FoodFavoritesView';
import { MyMealsView } from './MyMealsView';
import { QuantityModal } from './QuantityModal';

export interface FoodLogModalProps {
  visible: boolean;
  defaultSection: MealSection;
  localDate: string;
  onClose: () => void;
  onLogged?: () => void;
  initialTab?: TabType;
  autoStartPhoto?: boolean;
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
  autoStartPhoto = false,
}: FoodLogModalProps) {
  const insets = useSafeAreaInsets();
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
  const [batchMeal, setBatchMeal] = useState<MealSection | null>(defaultSection);
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
    quantity = !food.serving_units?.[0] || ['g', 'ml'].includes(food.serving_units[0].unit)
      ? 100
      : 1,
    unit = food.serving_units?.[0]?.unit ?? 'g',
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
    if (views.length > 1) {
      setViews((current) =>
        current.length > 1 && current.at(-1) === activeTab ? current.slice(0, -1) : current,
      );
    } else {
      onClose();
    }
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

  // AI Food Photo states
  const [showPhotoConsent, setShowPhotoConsent] = useState(false);
  const [showPhotoCamera, setShowPhotoCamera] = useState(false);
  const [photoAnalyzing, setPhotoAnalyzing] = useState<string | null>(null);
  const [lastPhotoUri, setLastPhotoUri] = useState<string | null>(null);
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
  const autoStartedRef = useRef(false);

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

  const { query, setQuery, results: searchResults, loading: searchLoading } = useFoodSearch();
  const {
    items: historyItems,
    loading: historyLoading,
    error: historyError,
    saveError: historySaveError,
    saving: historySaving,
    refresh: refreshHistory,
  } = usePreviouslyLogged();

  const handleSelectFood = (food: Food, initialPortion?: { quantity: number; unit: string }) => {
    setPortionDefaults(initialPortion);
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

  const startPhotoRef = useRef(handleStartPhotoScan);
  startPhotoRef.current = handleStartPhotoScan;

  useEffect(() => {
    if (!visible) {
      autoStartedRef.current = false;
      return;
    }
    if (autoStartPhoto && initialTab === 'photo' && !autoStartedRef.current) {
      autoStartedRef.current = true;
      void startPhotoRef.current();
    }
  }, [visible, autoStartPhoto, initialTab]);

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
    const dataUri = payload.base64.startsWith('data:')
      ? payload.base64
      : `data:${payload.mimeType};base64,${payload.base64}`;
    setLastPhotoUri((prev) => prev ?? dataUri);
    setShowPhotoCamera(false);
    setPhotoAnalyzing(dataUri);
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
    onLogged?.();
    onClose();
  };

  const targetSection = batchMeal ?? defaultSection;
  const targetSectionLabel = t(`diary.sections.${targetSection}` as Parameters<typeof t>[0]);
  const segmentValue =
    activeTab === 'favorites' ? 'favorites' : activeTab === 'myMeals' ? 'myMeals' : 'search';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={back}>
      <View style={styles.backdrop}>
        <View
          testID="modal-food-log"
          style={[
            styles.sheetRoot,
            {
              paddingTop: Math.max(space.lg, insets.top + layout.topContentOffset),
              paddingBottom: Math.max(space.lg, insets.bottom + space.sm),
            },
          ]}
        >
          {/* Top Nav Bar: < and + New food pill */}
          <View style={styles.topBar}>
            <IconButton
              icon={<ChevronLeftIcon size={20} color={colors.textHi} />}
              onPress={back}
              accessibilityLabel={backLabel}
              testID="btn-close-food-log"
            />
            <Pressable
              onPress={() => {
                setPrefilledBarcode(null);
                setShowCustomFoodModal(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('ownerPolish.custom')}
              testID="tab-log-custom"
              style={styles.newFoodPill}
            >
              <Text variant="buttonS" color="textHi">
                {t('captureV1.newFoodPill')}
              </Text>
            </Pressable>
          </View>

          {/* Eyebrow + Your foods Headline */}
          <View style={styles.titleBlock}>
            <View style={styles.eyebrowRow}>
              <View style={styles.apricotDot} />
              <Text variant="eyebrow" color="textLo">
                {t('captureV1.addingToEyebrow', {
                  section: t(
                    `diary.sections.${defaultSection}` as Parameters<typeof t>[0],
                  ).toUpperCase(),
                })}
              </Text>
            </View>
            <Text variant="title" color="textHi">
              {t('captureV1.yourFoodsTitle')}
            </Text>
          </View>

          {loggedToast ? (
            <View testID="food-log-success-toast" style={styles.toastBanner}>
              <CheckIcon size={16} color={colors.apricot} />
              <Text variant="meta" color="textHi">
                {`${t('launch.mealLogged')}: ${loggedToast}`}
              </Text>
            </View>
          ) : null}

          {saveError || historySaveError ? (
            <Text
              variant="meta"
              color="danger"
              accessibilityRole="alert"
              testID="food-log-save-error"
            >
              {t('fixNovember.saveFailed')}
            </Text>
          ) : null}

          {/* Search Input */}
          <View style={styles.searchBar}>
            <SearchIcon size={18} color={colors.textLo} />
            <TextInput
              testID="input-food-search"
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                if (text.trim() && activeTab !== 'search') setActiveTab('search');
              }}
              placeholder={t('captureV1.searchYourFoods')}
              placeholderTextColor={colors.textLo}
              autoFocus={false}
              style={styles.searchInput}
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')}>
                <CloseIcon size={16} color={colors.textLo} />
              </Pressable>
            ) : null}
          </View>

          {/* 3-Tab Segmented Switcher (Saved | Recent | Meals) preserving tab-log-* */}
          <View style={styles.segmentedBar} testID="food-log-quick-actions">
            {(
              [
                ['favorites', t('captureV1.tabSaved')],
                ['search', t('captureV1.tabRecent')],
                ['myMeals', t('captureV1.tabMeals')],
              ] as const
            ).map(([tab, label]) => {
              const selected =
                segmentValue === tab && activeTab !== 'photo' && activeTab !== 'recipes';
              return (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected }}
                  testID={`tab-log-${tab}`}
                  style={[styles.segmentBtn, selected ? styles.segmentBtnSelected : null]}
                >
                  <Text variant="buttonS" color={selected ? 'textHi' : 'textLo'} numberOfLines={1}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {library.error ? (
            <View style={styles.errorBanner}>
              <Text variant="meta" color="danger" accessibilityRole="alert">
                {t('foodPolish.libraryError')}
              </Text>
              <LinkButton
                title={t('common.retry')}
                variant="accent"
                onPress={() => void library.refresh()}
                testID="retry-food-library"
              />
            </View>
          ) : null}

          {/* Tab Body */}
          <View style={styles.bodyFlex}>
            {activeTab === 'myMeals' ? (
              <MyMealsView
                selection={selection}
                section={defaultSection}
                localDate={localDate}
                onLogged={onLogged}
              />
            ) : activeTab === 'favorites' ? (
              <FoodFavoritesView
                library={library}
                onFood={handleSelectFood}
                defaultSection={defaultSection}
                localDate={localDate}
                onLogged={onLogged}
                selectedIds={Object.fromEntries(Object.keys(selectedFoods).map((k) => [k, true]))}
                onToggleSelect={(food) => toggleSelection(food)}
              />
            ) : activeTab === 'photo' ? (
              <View testID="tab-view-photo-logging" style={styles.photoTabCard}>
                <Text variant="titleS" color="textHi">
                  {t('ownerPolish.scanMethods')}
                </Text>
                {photoError ? (
                  <Text
                    variant="meta"
                    color="danger"
                    accessibilityRole="alert"
                    testID="food-photo-error"
                  >
                    {photoError}
                  </Text>
                ) : null}
                <PrimaryButton
                  title={t('ownerPolish.aiScan')}
                  onPress={() => void handleStartPhotoScan()}
                  testID="btn-start-photo-scan"
                />
                <Button
                  variant="secondary"
                  label={t('ownerPolish.barcodeScan')}
                  testID="tab-log-scan"
                  onPress={() => setShowBarcodeScanner(true)}
                />
                {!hasPhotoAccess && !photoSubscription.loading ? (
                  <Text variant="meta" color="textLo" testID="photo-access-copy">
                    {t('brandRepair.photoPro')}
                  </Text>
                ) : null}
              </View>
            ) : activeTab === 'recipes' ? (
              <View style={styles.bodyFlex}>
                <RecipeBrowseView
                  hideFavoritesShortcut
                  initialMealSection={defaultSection}
                  localDate={localDate}
                  onRecipeLogged={() => {
                    onLogged?.();
                  }}
                />
              </View>
            ) : query.trim().length > 0 ? (
              /* Search results */
              searchLoading ? (
                <View style={styles.centerPad}>
                  <ActivityIndicator color={colors.apricot} size="small" />
                  <Text variant="meta" color="textLo">
                    {t('foodLog.searching')}
                  </Text>
                </View>
              ) : searchResults.length === 0 ? (
                <View style={styles.emptySearch}>
                  <Text variant="rowTitle" color="textHi">
                    {t('foodLog.noResultsTitle')}
                  </Text>
                  <Text variant="meta" color="textLo" style={styles.centeredText}>
                    {t('foodLog.noResultsSub')}
                  </Text>
                  <PrimaryButton
                    title={t('foodLog.createCustomFood')}
                    onPress={() => setShowCustomFoodModal(true)}
                    testID="btn-create-custom-food-fallback"
                  />
                </View>
              ) : (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {searchResults.map((f, idx) => {
                    const isSelected = Boolean(selectedFoods[f.id]);
                    const baseServing = f.serving_units?.[0];
                    const subMeta = baseServing
                      ? `1 ${baseServing.unit} · ${Math.round(baseServing.grams)} g`
                      : t('foodPolish.portion');
                    const displayKcal = baseServing
                      ? Math.round((f.calories_per_100g * baseServing.grams) / 100)
                      : Math.round(f.calories_per_100g);

                    return (
                      <View key={f.id}>
                        <View style={styles.foodRow}>
                          <Pressable
                            testID={`search-result-${f.id}`}
                            onPress={() => handleSelectFood(f)}
                            style={styles.foodRowCopy}
                          >
                            <Text variant="rowTitle" color="textHi">
                              {f.name}
                            </Text>
                            <Text variant="meta" color="textLo">
                              {subMeta}
                            </Text>
                          </Pressable>

                          <View style={styles.foodRowRight}>
                            <FoodFavoriteButton food={f} library={library} />
                            <Text variant="rowTitle" tabular color="textHi">
                              {String(displayKcal)}
                              <Text variant="meta" color="textLo">
                                {' kcal'}
                              </Text>
                            </Text>
                            <Pressable
                              testID={`select-food-${f.id}`}
                              onPress={() => toggleSelection(f)}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: isSelected }}
                              accessibilityLabel={t('homeRefresh.selectFood', { name: f.name })}
                              style={[
                                styles.circleBtn,
                                isSelected ? styles.circleBtnSelected : null,
                              ]}
                            >
                              {isSelected ? (
                                <CheckIcon size={16} color={colors.onBrand} strokeWidth={2.5} />
                              ) : (
                                <PlusIcon size={16} color={colors.textMid} />
                              )}
                            </Pressable>
                          </View>
                        </View>
                        {idx < searchResults.length - 1 ? <View style={styles.divider} /> : null}
                      </View>
                    );
                  })}
                </ScrollView>
              )
            ) : (
              /* Recent / History items */
              <View style={styles.bodyFlex}>
                {historyError ? (
                  <View style={styles.errorBanner}>
                    <Text variant="meta" color="danger" accessibilityRole="alert">
                      {t('common.errorBody')}
                    </Text>
                    <LinkButton
                      title={t('common.retry')}
                      variant="accent"
                      onPress={() => void refreshHistory()}
                      testID="retry-recent-foods"
                    />
                  </View>
                ) : historyLoading ? (
                  <View style={styles.centerPad}>
                    <ActivityIndicator color={colors.apricot} />
                  </View>
                ) : historyItems.length === 0 ? (
                  <View style={styles.emptySearch}>
                    <Text variant="rowTitle" color="textHi">
                      {t('foodLog.history.emptyTitle')}
                    </Text>
                    <Text variant="meta" color="textLo" style={styles.centeredText}>
                      {t('foodLog.history.emptySub')}
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                  >
                    {historyItems.map((item, idx) => {
                      const isSelected = Boolean(selectedFoods[item.food.id]);
                      const scaled = scaleNutrients(
                        item.food,
                        item.stats.last_quantity,
                        item.stats.last_unit,
                      );
                      return (
                        <View key={item.food.id} testID={`history-item-${item.food.id}`}>
                          <View style={styles.foodRow}>
                            <Pressable
                              style={styles.foodRowCopy}
                              onPress={() => handleSelectFood(item.food)}
                            >
                              <Text variant="rowTitle" color="textHi">
                                {item.food.name}
                              </Text>
                              <Text variant="meta" color="textLo">
                                {t('homeRefresh.recentQuantity', {
                                  quantity: item.stats.last_quantity,
                                  unit: item.stats.last_unit,
                                  count: item.stats.use_count,
                                })}
                              </Text>
                            </Pressable>

                            <View style={styles.foodRowRight}>
                              <Text variant="rowTitle" tabular color="textHi">
                                {String(Math.round(scaled.calories))}
                                <Text variant="meta" color="textLo">
                                  {' kcal'}
                                </Text>
                              </Text>

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
                                accessibilityState={{ checked: isSelected }}
                                accessibilityLabel={t('homeRefresh.selectFood', {
                                  name: item.food.name,
                                })}
                                style={[
                                  styles.circleBtn,
                                  isSelected ? styles.circleBtnSelected : null,
                                ]}
                              >
                                {isSelected ? (
                                  <CheckIcon size={16} color={colors.onBrand} strokeWidth={2.5} />
                                ) : (
                                  <PlusIcon size={16} color={colors.textMid} />
                                )}
                              </Pressable>
                            </View>
                          </View>

                          <View style={styles.subtleRowMeta}>
                            <FoodFavoriteButton food={item.food} library={library} />
                            <LinkButton
                              title={t('foodPolish.addFood')}
                              variant="default"
                              onPress={() => void handleOneTapAdd(item)}
                              disabled={historySaving || batchSaving}
                              testID={`btn-quick-add-${item.food.id}`}
                            />
                          </View>

                          {idx < historyItems.length - 1 ? <View style={styles.divider} /> : null}
                        </View>
                      );
                    })}

                    <View style={styles.clearRecentWrap}>
                      <LinkButton
                        title={t('foodPolish.clearRecentFoods')}
                        variant="default"
                        disabled={library.busy || historyLoading || !historyItems.length}
                        onPress={() => void library.clearRecentFoods()}
                        testID="clear-recent-foods"
                      />
                    </View>
                  </ScrollView>
                )}
              </View>
            )}
          </View>

          {/* Compact Secondary Capture Strip */}
          <View style={styles.methodsStrip} testID="food-log-methods">
            <Pressable
              testID="tab-log-photo"
              accessibilityRole="button"
              onPress={() => setActiveTab('photo')}
              style={styles.methodChip}
            >
              <CameraIcon size={14} color={colors.textLo} />
              <Text variant="micro" color="textLo">
                {t('foodLog.tabs.photo')}
              </Text>
            </Pressable>
            <Pressable
              testID="food-describe-meal"
              accessibilityRole="button"
              onPress={() => setShowDescribe(true)}
              style={styles.methodChip}
            >
              <EditIcon size={14} color={colors.textLo} />
              <Text variant="micro" color="textLo">
                {t('homeRefresh.describe')}
              </Text>
            </Pressable>
            <Pressable
              testID="tab-log-recipes"
              accessibilityRole="button"
              onPress={() => setActiveTab('recipes')}
              style={styles.methodChip}
            >
              <BarcodeIcon size={14} color={colors.textLo} />
              <Text variant="micro" color="textLo">
                {t('foodLog.tabs.recipes')}
              </Text>
            </Pressable>
          </View>

          {/* Floating Summary Pill (Screen 32) */}
          {selection.length > 0 ? (
            <View testID="food-selection-footer" style={styles.selectionFooterWrap}>
              <View style={styles.batchMealsRow}>
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
              {batchError ? (
                <Text variant="meta" color="danger" accessibilityRole="alert">
                  {t('fixNovember.saveFailed')}
                </Text>
              ) : null}
              <View style={[styles.floatingSummaryPill, elevation.floatingBar]}>
                <View style={styles.summaryCopyRow}>
                  <Text variant="rowTitle" color="textHi" tabular>
                    {t('captureV1.addedCount', { count: selection.length })}
                  </Text>
                  <Text variant="meta" color="textLo" tabular>
                    {` · ${t('captureV1.summaryTotal', {
                      calories: Math.round(selectionTotals.calories).toLocaleString('en-US'),
                      section: targetSectionLabel,
                    })}`}
                  </Text>
                </View>
                <Pressable
                  testID="save-food-selection"
                  accessibilityRole="button"
                  disabled={batchSaving || !batchMeal}
                  onPress={() => void saveSelection()}
                  style={[
                    styles.donePillBtn,
                    batchSaving || !batchMeal ? styles.donePillDisabled : null,
                  ]}
                >
                  <Text variant="buttonS" color="onBrand">
                    {batchSaving ? t('common.saving') : t('captureV1.done')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {showDescribe ? (
            <DescribeMealModal
              visible
              section={defaultSection}
              localDate={localDate}
              onClose={() => setShowDescribe(false)}
              onLogged={onLogged}
            />
          ) : null}

          {showBarcodeScanner ? (
            <BarcodeScannerModal
              visible={showBarcodeScanner}
              defaultSection={defaultSection}
              onSwitchToPhoto={() => {
                setShowBarcodeScanner(false);
                void handleStartPhotoScan();
              }}
              covered={Boolean(selectedFoodForQuantity) || showCustomFoodModal}
              onClose={() => setShowBarcodeScanner(false)}
              onFoodFound={handleSelectFood}
              onCreateCustomFood={(code) => {
                setPrefilledBarcode(code);
                setShowCustomFoodModal(true);
              }}
            />
          ) : null}

          {showCustomFoodModal ? (
            <CustomFoodModal
              visible={showCustomFoodModal}
              initialBarcode={prefilledBarcode}
              onClose={() => {
                setShowCustomFoodModal(false);
                setPrefilledBarcode(null);
              }}
              onCreated={handleSelectFood}
            />
          ) : null}

          {selectedFoodForQuantity ? (
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
          ) : null}

          {showPhotoConsent ? (
            <AiConsentSheet
              visible={showPhotoConsent}
              loading={consentLoading}
              onAccept={handleAcceptConsent}
              onDecline={closePhotoConsent}
            />
          ) : null}

          {showPhotoCamera ? (
            <FoodPhotoCameraModal
              visible={showPhotoCamera}
              defaultSection={defaultSection}
              onSwitchToBarcode={() => {
                setShowPhotoCamera(false);
                setShowBarcodeScanner(true);
              }}
              onSwitchToDescribe={() => {
                setShowPhotoCamera(false);
                setShowDescribe(true);
              }}
              onClose={() => setShowPhotoCamera(false)}
              onPhotoUri={setLastPhotoUri}
              onPhotoCaptured={handlePhotoCaptured}
            />
          ) : null}

          {photoAnalyzing ? (
            <FoodPhotoAnalyzingOverlay
              visible
              imageUri={photoAnalyzing}
              onCancel={returnToPhotoCamera}
            />
          ) : null}

          {showDailyLimitModal ? (
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
          ) : null}

          {showPhotoPlans ? (
            <PaywallModal
              visible
              preselectedTier="pro"
              context="general"
              onClose={() => {
                setShowPhotoPlans(false);
                setShowDailyLimitModal(true);
              }}
            />
          ) : null}

          {showResultsEditor && photoResults ? (
            <FoodPhotoResultsEditor
              visible={showResultsEditor}
              imageUri={lastPhotoUri}
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
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.bg0,
  },
  sheetRoot: {
    flex: 1,
    backgroundColor: colors.bg0,
    paddingHorizontal: layout.screenPaddingX,
    gap: space.md,
  },
  topBar: {
    height: layout.navRowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newFoodPill: {
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    gap: space.xs,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  apricotDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.apricot,
  },
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.apricot,
    borderRadius: radius.banner,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.s1,
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
  segmentedBar: {
    flexDirection: 'row',
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.segmented,
    padding: space.xs,
    gap: space.xs,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnSelected: {
    backgroundColor: colors.s3,
  },
  errorBanner: {
    gap: space.xs,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.danger,
    borderRadius: radius.banner,
    padding: space.md,
  },
  bodyFlex: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 120,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.md,
    minHeight: 56,
  },
  foodRowCopy: {
    flex: 1,
    gap: 2,
  },
  foodRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  circleBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtnSelected: {
    backgroundColor: colors.apricot,
    borderColor: colors.apricot,
  },
  subtleRowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: space.xs,
  },
  divider: {
    height: borders.width,
    backgroundColor: colors.s2,
  },
  centerPad: {
    paddingVertical: space.xl,
    alignItems: 'center',
    gap: space.sm,
  },
  emptySearch: {
    paddingVertical: space.xl,
    alignItems: 'center',
    gap: space.sm,
  },
  centeredText: {
    textAlign: 'center',
  },
  clearRecentWrap: {
    alignItems: 'center',
    paddingTop: space.md,
  },
  photoTabCard: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    padding: layout.cardPadding,
    gap: space.md,
  },
  methodsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.full,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
  },
  selectionFooterWrap: {
    gap: space.sm,
  },
  batchMealsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  floatingSummaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.tabBar,
    paddingLeft: space.lg,
    paddingRight: space.xs,
    paddingVertical: space.xs,
    minHeight: 56,
    gap: space.sm,
  },
  summaryCopyRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    overflow: 'hidden',
  },
  donePillBtn: {
    backgroundColor: colors.apricot,
    borderRadius: radius.button,
    paddingHorizontal: space.lg,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donePillDisabled: {
    opacity: 0.5,
  },
});
