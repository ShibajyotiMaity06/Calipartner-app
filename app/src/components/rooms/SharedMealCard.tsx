import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MealSection } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface PendingSharedMeal {
  id: string;
  sender_name: string;
  food_name: string;
  calories: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  meal_section: MealSection;
  quantity: number;
  unit: string;
}

interface SharedMealCardProps {
  meal: PendingSharedMeal;
  onAccept: (sharedMealId: string, quantity: number, section: MealSection) => Promise<void>;
  onDecline: (sharedMealId: string) => Promise<void>;
}

export function SharedMealCard({ meal, onAccept, onDecline }: SharedMealCardProps) {
  const { colors } = useTheme();
  const [portionMultiplier, setPortionMultiplier] = useState<number>(1.0);
  const [selectedSection, setSelectedSection] = useState<MealSection>(meal.meal_section);
  const [loadingAction, setLoadingAction] = useState<'accept' | 'decline' | null>(null);

  const multipliers = [0.5, 1.0, 1.5, 2.0];
  const sections: MealSection[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

  const computedCalories = Math.round(meal.calories * portionMultiplier);
  const computedQuantity = Number((meal.quantity * portionMultiplier).toFixed(2));

  const handleAccept = async () => {
    setLoadingAction('accept');
    try {
      await onAccept(meal.id, computedQuantity, selectedSection);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDecline = async () => {
    setLoadingAction('decline');
    try {
      await onDecline(meal.id);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={[styles.iconPill, { backgroundColor: colors.cardHighlight }]}>
          <Ionicons name="restaurant-outline" size={16} color={colors.accent} />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('rooms.sharedMealCard.header', {
              name: meal.sender_name,
              section: meal.meal_section.charAt(0).toUpperCase() + meal.meal_section.slice(1),
            })}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('rooms.sharedMealCard.prompt')}
          </Text>
        </View>
      </View>

      {/* Food Details */}
      <View style={[styles.foodInfoBox, { backgroundColor: colors.surfaceAlt }]}>
        <Text style={[styles.foodName, { color: colors.text }]}>{meal.food_name}</Text>
        <Text style={[styles.caloriesText, { color: colors.macroCalories }]}>
          {computedCalories} kcal • {computedQuantity} {meal.unit}
        </Text>
      </View>

      {/* Portion Scaler Selector */}
      <View style={styles.optionRow}>
        <Text style={[styles.optionLabel, { color: colors.textMuted }]}>
          {t('rooms.sharedMealCard.portionLabel')}
        </Text>
        <View style={styles.portionPillsRow}>
          {multipliers.map((m) => {
            const isSelected = portionMultiplier === m;
            return (
              <Pressable
                key={m}
                onPress={() => setPortionMultiplier(m)}
                style={[
                  styles.portionPill,
                  {
                    backgroundColor: isSelected ? colors.accent : colors.surfaceAlt,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${m}x portion`}
              >
                <Text
                  style={[
                    styles.portionPillText,
                    { color: isSelected ? '#FFFFFF' : colors.text },
                  ]}
                >
                  {m}x
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Meal Section Selector */}
      <View style={styles.optionRow}>
        <Text style={[styles.optionLabel, { color: colors.textMuted }]}>
          {t('rooms.sharedMealCard.sectionLabel')}
        </Text>
        <View style={styles.portionPillsRow}>
          {sections.map((sec) => {
            const isSelected = selectedSection === sec;
            return (
              <Pressable
                key={sec}
                onPress={() => setSelectedSection(sec)}
                style={[
                  styles.portionPill,
                  {
                    backgroundColor: isSelected ? colors.surface : colors.surfaceAlt,
                    borderColor: isSelected ? colors.accent : 'transparent',
                    borderWidth: isSelected ? 1 : 0,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Meal section: ${sec}`}
              >
                <Text
                  style={[
                    styles.sectionPillText,
                    { color: isSelected ? colors.accent : colors.textMuted },
                  ]}
                >
                  {sec.charAt(0).toUpperCase() + sec.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Buttons */}
      <View style={styles.buttonRow}>
        <Pressable
          onPress={handleDecline}
          disabled={loadingAction !== null}
          style={[styles.declineButton, { backgroundColor: colors.surfaceAlt }]}
          accessibilityRole="button"
          accessibilityLabel="Dismiss shared meal"
          testID="btn-decline-shared-meal"
        >
          {loadingAction === 'decline' ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <Text style={[styles.declineButtonText, { color: colors.textMuted }]}>
              {t('rooms.sharedMealCard.declineBtn')}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={handleAccept}
          disabled={loadingAction !== null}
          style={[styles.acceptButton, { backgroundColor: colors.accent }]}
          accessibilityRole="button"
          accessibilityLabel="Add to my diary"
          testID="btn-accept-shared-meal"
        >
          {loadingAction === 'accept' ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.acceptButtonText}>
              {t('rooms.sharedMealCard.acceptBtn')}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  iconPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  foodInfoBox: {
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  foodName: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  caloriesText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginTop: 3,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs + 2,
  },
  optionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  portionPillsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  portionPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  portionPillText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  sectionPillText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  declineButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButtonText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 2,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
});
