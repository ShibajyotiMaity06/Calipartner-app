import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Food, MealSection } from '@calipartner/core';
import { useFoodSearch } from '@/hooks/useFoodSearch';
import {
  usePreviouslyLogged,
  type HistorySortOption,
  type PreviouslyLoggedItem,
} from '@/hooks/usePreviouslyLogged';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { CustomFoodModal } from './CustomFoodModal';
import { QuantityModal } from './QuantityModal';

export interface FoodLogModalProps {
  visible: boolean;
  defaultSection: MealSection;
  localDate: string;
  onClose: () => void;
  onLogged?: () => void;
}

type TabType = 'search' | 'scan' | 'photo' | 'history' | 'myFoods';

export function FoodLogModal({
  visible,
  defaultSection,
  localDate,
  onClose,
  onLogged,
}: FoodLogModalProps) {
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<TabType>('search');
  const [selectedFoodForQuantity, setSelectedFoodForQuantity] = useState<Food | null>(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showCustomFoodModal, setShowCustomFoodModal] = useState(false);
  const [prefilledBarcode, setPrefilledBarcode] = useState<string | null>(null);

  // Search tab hook
  const { query, setQuery, results: searchResults, loading: searchLoading } = useFoodSearch();

  // History tab hook
  const {
    items: historyItems,
    sort: historySort,
    setSort: setHistorySort,
    searchQuery: historySearchQuery,
    setSearchQuery: setHistorySearchQuery,
    oneTapAdd,
    removeFromHistory,
    loading: historyLoading,
  } = usePreviouslyLogged(defaultSection);

  const handleSelectFood = (food: Food) => {
    setSelectedFoodForQuantity(food);
  };

  const handleOneTapAdd = async (item: PreviouslyLoggedItem) => {
    await oneTapAdd(item, defaultSection, localDate);
    if (onLogged) onLogged();
    onClose();
  };

  const handleLogFromQuantity = (_data?: unknown) => {
    // Handled in today screen via callback or logged directly
    if (onLogged) onLogged();
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
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.md,
            }}
          >
            <View>
              <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.text }}>
                {t('foodLog.title')}
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
                {t(`diary.sections.${defaultSection}` as Parameters<typeof t>[0])} • {localDate}
              </Text>
            </View>

            <Pressable
              testID="btn-close-food-log"
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={26} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* 5 Tab Navigation Bar */}
          <View
            style={{
              flexDirection: 'row',
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              paddingHorizontal: spacing.sm,
            }}
          >
            {(['search', 'scan', 'photo', 'history', 'myFoods'] as TabType[]).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <Pressable
                  key={tab}
                  testID={`tab-log-${tab}`}
                  onPress={() => {
                    if (tab === 'scan') {
                      setShowBarcodeScanner(true);
                    } else {
                      setActiveTab(tab);
                    }
                  }}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 10,
                    borderBottomWidth: isActive ? 2.5 : 0,
                    borderBottomColor: colors.accent,
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: isActive ? '700' : '500',
                      color: isActive ? colors.accent : colors.textMuted,
                    }}
                  >
                    {t(`foodLog.tabs.${tab}` as Parameters<typeof t>[0])}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* TAB 1: Search */}
          {activeTab === 'search' && (
            <View style={{ flex: 1, paddingHorizontal: spacing.md, gap: spacing.sm }}>
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
                  autoFocus={true}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    paddingHorizontal: 8,
                    fontSize: fontSize.md,
                    color: colors.text,
                  }}
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
                <View style={{ paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm }}>
                  <Ionicons name="search-outline" size={36} color={colors.textMuted} />
                  <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: colors.text }}>
                    {t('foodLog.noResultsTitle')}
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center' }}>
                    {t('foodLog.noResultsSub')}
                  </Text>
                  <Pressable
                    testID="btn-create-custom-food-fallback"
                    onPress={() => setShowCustomFoodModal(true)}
                    style={{
                      marginTop: spacing.xs,
                      backgroundColor: colors.accent,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: radius.sm,
                    }}
                  >
                    <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: fontSize.sm }}>
                      {t('foodLog.createCustomFood')}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 20 }}>
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
                        borderRadius: radius.sm,
                        borderWidth: 1,
                        borderColor: colors.border,
                      })}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                          {f.name}
                        </Text>
                        <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
                          {f.brand ? `${f.brand} • ` : ''}P {f.protein_per_100g}g • C {f.carbs_per_100g}g • F {f.fat_per_100g}g (per 100g)
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: colors.macroCalories }}>
                          {f.calories_per_100g} kcal
                        </Text>
                        {f.owner_id ? (
                          <View style={{ backgroundColor: colors.surfaceAlt, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill }}>
                            <Text style={{ fontSize: 9, fontWeight: '700', color: colors.accent }}>MY FOOD</Text>
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* TAB 3: Photo (Placeholder PRD LOG-3) */}
          {activeTab === 'photo' && (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                padding: spacing.xl,
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: radius.pill,
                  backgroundColor: colors.surfaceAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="camera" size={36} color={colors.accent} />
              </View>

              <View
                style={{
                  backgroundColor: colors.surfaceAlt,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: fontSize.xs, fontWeight: '700', color: colors.accent }}>
                  {t('foodLog.photo.badge')}
                </Text>
              </View>

              <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.text, textAlign: 'center' }}>
                {t('foodLog.photo.title')}
              </Text>
              <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center', maxWidth: 280 }}>
                {t('foodLog.photo.description')}
              </Text>
            </View>
          )}

          {/* TAB 4: Previously Logged (History) */}
          {activeTab === 'history' && (
            <View style={{ flex: 1, paddingHorizontal: spacing.md, gap: spacing.xs }}>
              {/* Filter and Sort Bar */}
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                {(['recent', 'frequent', 'alpha'] as HistorySortOption[]).map((sortOpt) => {
                  const isSelected = historySort === sortOpt;
                  return (
                    <Pressable
                      key={sortOpt}
                      testID={`btn-history-sort-${sortOpt}`}
                      onPress={() => setHistorySort(sortOpt)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: radius.pill,
                        backgroundColor: isSelected ? colors.accent : colors.surfaceAlt,
                        borderWidth: 1,
                        borderColor: isSelected ? colors.accent : colors.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fontSize.xs,
                          fontWeight: '600',
                          color: isSelected ? colors.onAccent : colors.text,
                        }}
                      >
                        {sortOpt === 'recent'
                          ? t('foodLog.history.sortRecent')
                          : sortOpt === 'frequent'
                            ? t('foodLog.history.sortFrequent')
                            : t('foodLog.history.sortAlpha')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* History Search within */}
              <TextInput
                testID="input-history-search"
                value={historySearchQuery}
                onChangeText={setHistorySearchQuery}
                placeholder={t('foodLog.history.searchPlaceholder')}
                placeholderTextColor={colors.textMuted}
                style={{
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: radius.sm,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  fontSize: fontSize.sm,
                  color: colors.text,
                  borderWidth: 1,
                  borderColor: colors.border,
                  marginTop: 2,
                }}
              />

              {/* History Items List */}
              {historyLoading ? (
                <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.md }} />
              ) : historyItems.length === 0 ? (
                <View style={{ paddingVertical: spacing.xl, alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: colors.text }}>
                    {t('foodLog.history.emptyTitle')}
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center' }}>
                    {t('foodLog.history.emptySub')}
                  </Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 20, marginTop: 4 }}>
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
                        borderRadius: radius.sm,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Pressable
                        style={{ flex: 1, gap: 2 }}
                        onPress={() => handleSelectFood(item.food)}
                      >
                        <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                          {item.food.name}
                        </Text>
                        <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
                          {item.stats.last_quantity} {item.stats.last_unit} • {item.stats.use_count}x logged
                        </Text>
                      </Pressable>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {/* 1-tap quick add button (PRD 6.3 LOG-13) */}
                        <Pressable
                          testID={`btn-quick-add-${item.food.id}`}
                          onPress={() => handleOneTapAdd(item)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: colors.surfaceAlt,
                            paddingHorizontal: 8,
                            paddingVertical: 6,
                            borderRadius: radius.pill,
                            borderWidth: 1,
                            borderColor: colors.accent,
                            gap: 3,
                          }}
                        >
                          <Ionicons name="add" size={14} color={colors.accent} />
                          <Text style={{ fontSize: fontSize.xs, fontWeight: '700', color: colors.accent }}>
                            + Quick
                          </Text>
                        </Pressable>

                        {/* Remove from history button (PRD 6.3 LOG-15) */}
                        <Pressable
                          testID={`btn-hide-history-${item.food.id}`}
                          onPress={() => removeFromHistory(item.food.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* TAB 5: My Foods (Custom Foods) */}
          {activeTab === 'myFoods' && (
            <View style={{ flex: 1, paddingHorizontal: spacing.md, gap: spacing.sm }}>
              <Pressable
                testID="btn-create-custom-food"
                onPress={() => setShowCustomFoodModal(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.accent,
                  borderRadius: radius.sm,
                  paddingVertical: 12,
                  gap: 6,
                }}
              >
                <Ionicons name="add-circle" size={18} color={colors.onAccent} />
                <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: colors.onAccent }}>
                  {t('foodLog.myFoods.createButton')}
                </Text>
              </Pressable>

              <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, fontStyle: 'italic', marginTop: 4 }}>
                {t('foodLog.myFoods.emptySub')}
              </Text>
            </View>
          )}

          {/* Sub-modals */}
          {selectedFoodForQuantity && (
            <QuantityModal
              visible={Boolean(selectedFoodForQuantity)}
              food={selectedFoodForQuantity}
              defaultSection={defaultSection}
              onClose={() => setSelectedFoodForQuantity(null)}
              onSave={handleLogFromQuantity}
            />
          )}

          {showBarcodeScanner && (
            <BarcodeScannerModal
              visible={showBarcodeScanner}
              onClose={() => setShowBarcodeScanner(false)}
              onFoodFound={(f) => {
                setSelectedFoodForQuantity(f);
              }}
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
              onCreated={(f) => {
                setSelectedFoodForQuantity(f);
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
