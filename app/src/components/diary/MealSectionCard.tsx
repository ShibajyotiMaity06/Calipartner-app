import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DiarySectionSummary, FoodEntry, MealSection } from '@calipartner/core';
import { useSectionSuggestions, type SectionSuggestion } from '@/hooks/useSectionSuggestions';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface MealSectionCardProps {
  section: MealSection;
  summary: DiarySectionSummary;
  onAddFood: (section: MealSection) => void;
  onEditEntry: (entry: FoodEntry) => void;
  onDeleteEntry: (entryId: string) => void;
  onCopyMeal: (section: MealSection) => void;
  onSelectSuggestion?: (suggestion: SectionSuggestion, section: MealSection) => void;
  testID?: string;
}

const SECTION_ICONS: Record<MealSection, keyof typeof Ionicons.glyphMap> = {
  breakfast: 'sunny-outline',
  lunch: 'restaurant-outline',
  dinner: 'moon-outline',
  snacks: 'cafe-outline',
  extra: 'flash-outline',
};

export function MealSectionCard({
  section,
  summary,
  onAddFood,
  onEditEntry,
  onDeleteEntry,
  onCopyMeal,
  onSelectSuggestion,
  testID,
}: MealSectionCardProps) {
  const { colors } = useTheme();
  const { suggestions } = useSectionSuggestions(section);

  const sectionName = t(`diary.sections.${section}` as Parameters<typeof t>[0]);
  const iconName = SECTION_ICONS[section] ?? 'fast-food-outline';

  return (
    <View
      testID={testID ?? `card-section-${section}`}
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: spacing.md,
        gap: spacing.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.sm,
              backgroundColor: colors.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={iconName} size={18} color={colors.accent} />
          </View>
          <View>
            <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: colors.text }}>
              {sectionName}
            </Text>
            {summary.entries.length > 0 && (
              <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
                P {summary.protein}g • C {summary.carbs}g • F {summary.fat}g
              </Text>
            )}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text
            style={{
              fontSize: fontSize.md,
              fontWeight: '800',
              color: summary.calories > 0 ? colors.macroCalories : colors.textMuted,
            }}
          >
            {t('diary.subtotal', { kcal: summary.calories })}
          </Text>

          {summary.entries.length > 0 && (
            <Pressable
              testID={`btn-copy-${section}`}
              onPress={() => onCopyMeal(section)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                padding: 4,
                borderRadius: radius.sm,
              }}
              accessibilityLabel={t('diary.copyMeal')}
            >
              <Ionicons name="copy-outline" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Smart Section Suggestions Bar (PRD 6.3 LOG-14) */}
      {suggestions.length > 0 && (
        <View style={{ marginTop: 2 }}>
          <Text
            style={{
              fontSize: fontSize.xs,
              color: colors.textMuted,
              fontWeight: '600',
              marginBottom: 4,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {t('diary.suggestions')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {suggestions.slice(0, 4).map((s) => (
              <Pressable
                key={s.food_id}
                testID={`suggestion-${section}-${s.food_id}`}
                onPress={() => onSelectSuggestion && onSelectSuggestion(s, section)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.surfaceAlt,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: radius.pill,
                  gap: 4,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="add" size={13} color={colors.accent} />
                <Text style={{ fontSize: fontSize.xs, color: colors.text, fontWeight: '600' }} numberOfLines={1}>
                  {s.food_name}
                </Text>
                <Text style={{ fontSize: fontSize.xs - 1, color: colors.textMuted }}>
                  ({s.last_quantity} {s.last_unit})
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Entries List */}
      {summary.entries.length > 0 ? (
        <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
          {summary.entries.map((entry) => (
            <Pressable
              key={entry.id}
              testID={`entry-row-${entry.id}`}
              onPress={() => onEditEntry(entry)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: radius.sm,
                backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
                borderBottomWidth: 1,
                borderBottomColor: colors.surfaceAlt,
              })}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.text }}
                  numberOfLines={1}
                >
                  {entry.food_name}
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
                  {entry.quantity} {entry.unit}
                  {entry.brand_name ? ` • ${entry.brand_name}` : ''} • P {entry.protein}g • C {entry.carbs}g • F {entry.fat}g
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: '700',
                    color: colors.macroCalories,
                  }}
                >
                  {entry.calories} kcal
                </Text>

                <Pressable
                  testID={`btn-delete-${entry.id}`}
                  onPress={() => onDeleteEntry(entry.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={{ paddingVertical: spacing.xs }}>
          <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, fontStyle: 'italic' }}>
            {t('diary.emptySection')}
          </Text>
        </View>
      )}

      {/* Add Food Button */}
      <Pressable
        testID={`btn-add-food-${section}`}
        onPress={() => onAddFood(section)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
          borderColor: colors.accent,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderRadius: radius.sm,
          paddingVertical: 10,
          gap: 6,
          marginTop: 2,
        })}
      >
        <Ionicons name="add-circle" size={18} color={colors.accent} />
        <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: colors.accent }}>
          {t('diary.addFood')}
        </Text>
      </Pressable>
    </View>
  );
}
