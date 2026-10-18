import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { CoachSuggestion } from './types';

export interface CoachSuggestionCardProps {
  suggestion: CoachSuggestion;
  onLog: (suggestion: CoachSuggestion) => void;
}

export function CoachSuggestionCard({
  suggestion,
  onLog,
}: CoachSuggestionCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      testID={`card-coach-suggestion-${suggestion.id}`}
    >
      <View style={styles.topRow}>
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.typeBadge,
              { backgroundColor: colors.cardHighlight },
            ]}
          >
            <Ionicons
              name={suggestion.type === 'recipe' ? 'restaurant-outline' : 'nutrition-outline'}
              size={12}
              color={colors.accent}
            />
            <Text style={[styles.typeBadgeText, { color: colors.accent }]}>
              {suggestion.type === 'recipe'
                ? t('coach.suggestion.recipe')
                : t('coach.suggestion.food')}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => onLog(suggestion)}
          style={[styles.logButton, { backgroundColor: colors.accent }]}
          accessibilityRole="button"
          accessibilityLabel={`${t('coach.suggestion.logIt')} ${suggestion.title}`}
          testID={`btn-coach-log-${suggestion.id}`}
        >
          <Ionicons name="add" size={14} color="#FFFFFF" />
          <Text style={styles.logButtonText}>{t('coach.suggestion.logIt')}</Text>
        </Pressable>
      </View>

      <Text
        style={[styles.title, { color: colors.text }]}
        numberOfLines={2}
        testID={`text-suggestion-title-${suggestion.id}`}
      >
        {suggestion.title}
      </Text>

      {suggestion.portion ? (
        <Text style={[styles.portion, { color: colors.textMuted }]}>
          {t('coach.suggestion.portion', { serving: suggestion.portion })}
        </Text>
      ) : null}

      {/* Nutrient breakdown pill row */}
      <View style={styles.macroRow}>
        <View
          style={[styles.macroPill, { backgroundColor: colors.surfaceAlt }]}
        >
          <Text style={[styles.macroText, { color: colors.macroCalories, fontWeight: '700' }]}>
            {t('coach.suggestion.cal', { cal: Math.round(suggestion.calories) })}
          </Text>
        </View>

        <View
          style={[styles.macroPill, { backgroundColor: colors.surfaceAlt }]}
        >
          <Text style={[styles.macroText, { color: colors.macroProtein }]}>
            {t('coach.suggestion.p', { val: Math.round(suggestion.protein) })}
          </Text>
        </View>

        <View
          style={[styles.macroPill, { backgroundColor: colors.surfaceAlt }]}
        >
          <Text style={[styles.macroText, { color: colors.macroCarbs }]}>
            {t('coach.suggestion.c', { val: Math.round(suggestion.carbs) })}
          </Text>
        </View>

        <View
          style={[styles.macroPill, { backgroundColor: colors.surfaceAlt }]}
        >
          <Text style={[styles.macroText, { color: colors.macroFat }]}>
            {t('coach.suggestion.f', { val: Math.round(suggestion.fat) })}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm + 2,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  typeBadgeText: {
    fontSize: fontSize.xs - 1,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  logButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  title: {
    fontSize: fontSize.sm + 1,
    fontWeight: '600',
    marginTop: 2,
  },
  portion: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  macroPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  macroText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
