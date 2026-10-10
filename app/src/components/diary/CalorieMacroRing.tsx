import { Text, View } from 'react-native';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface CalorieMacroRingProps {
  eatenCalories: number;
  targetCalories: number;
  proteinGrams: number;
  targetProtein: number;
  carbGrams: number;
  targetCarbs: number;
  fatGrams: number;
  targetFat: number;
  testID?: string;
}

export function CalorieMacroRing({
  eatenCalories,
  targetCalories,
  proteinGrams,
  targetProtein,
  carbGrams,
  targetCarbs,
  fatGrams,
  targetFat,
  testID = 'calorie-macro-ring',
}: CalorieMacroRingProps) {
  const { colors } = useTheme();

  const remainingCalories = Math.max(0, targetCalories - eatenCalories);
  const isOver = eatenCalories > targetCalories && targetCalories > 0;
  const calPercent = targetCalories > 0 ? Math.min(100, Math.round((eatenCalories / targetCalories) * 100)) : 0;

  const proPercent = targetProtein > 0 ? Math.min(100, Math.round((proteinGrams / targetProtein) * 100)) : 0;
  const carbPercent = targetCarbs > 0 ? Math.min(100, Math.round((carbGrams / targetCarbs) * 100)) : 0;
  const fatPercent = targetFat > 0 ? Math.min(100, Math.round((fatGrams / targetFat) * 100)) : 0;

  const a11ySummary = t('diary.calorieRingA11y', {
    eaten: eatenCalories,
    target: targetCalories,
    remaining: isOver ? eatenCalories - targetCalories : remainingCalories,
  });

  return (
    <View
      testID={testID}
      accessible={true}
      accessibilityRole="summary"
      accessibilityLabel={a11ySummary}
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: spacing.md,
        gap: spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {/* Top calories hero section */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Left: Calorie circle representation */}
        <View
          style={{
            width: 104,
            height: 104,
            borderRadius: radius.pill,
            borderWidth: 8,
            borderColor: colors.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* Subtle colored ring border overlay */}
          <View
            style={{
              position: 'absolute',
              top: -8,
              left: -8,
              right: -8,
              bottom: -8,
              borderRadius: radius.pill,
              borderWidth: 8,
              borderColor: isOver ? colors.danger : colors.macroCalories,
              borderTopColor: isOver ? colors.danger : colors.macroCalories,
              borderRightColor: calPercent > 25 ? (isOver ? colors.danger : colors.macroCalories) : 'transparent',
              borderBottomColor: calPercent > 50 ? (isOver ? colors.danger : colors.macroCalories) : 'transparent',
              borderLeftColor: calPercent > 75 ? (isOver ? colors.danger : colors.macroCalories) : 'transparent',
              opacity: 0.9,
            }}
          />
          <Text
            style={{
              fontSize: fontSize.xl,
              fontWeight: '800',
              color: isOver ? colors.danger : colors.text,
              letterSpacing: -0.5,
            }}
          >
            {isOver ? eatenCalories - targetCalories : remainingCalories}
          </Text>
          <Text
            style={{
              fontSize: fontSize.xs,
              fontWeight: '600',
              color: colors.textMuted,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {isOver ? t('diary.caloriesOver') : t('diary.caloriesRemaining')}
          </Text>
        </View>

        {/* Right: Eaten vs Target pill details */}
        <View style={{ flex: 1, marginLeft: spacing.md, gap: spacing.xs }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: colors.surfaceAlt,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs + 2,
              borderRadius: radius.sm,
            }}
          >
            <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '500' }}>
              {t('diary.caloriesEaten')}
            </Text>
            <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: colors.macroCalories }}>
              {eatenCalories} <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>kcal</Text>
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: colors.surfaceAlt,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs + 2,
              borderRadius: radius.sm,
            }}
          >
            <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '500' }}>
              {t('diary.caloriesTarget')}
            </Text>
            <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: colors.text }}>
              {targetCalories} <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>kcal</Text>
            </Text>
          </View>
        </View>
      </View>

      {/* Macro Breakdown Bars */}
      <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
        {/* Protein */}
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.text }}>
              {t('diary.macroProtein')}
            </Text>
            <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '500' }}>
              {targetProtein > 0
                ? t('diary.macroGrams', { current: proteinGrams, target: targetProtein })
                : t('diary.macroGramsSimple', { grams: proteinGrams })}
            </Text>
          </View>
          <View
            style={{
              height: 7,
              backgroundColor: colors.surfaceAlt,
              borderRadius: radius.pill,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${proPercent}%`,
                backgroundColor: colors.macroProtein,
                borderRadius: radius.pill,
              }}
            />
          </View>
        </View>

        {/* Carbs */}
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.text }}>
              {t('diary.macroCarbs')}
            </Text>
            <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '500' }}>
              {targetCarbs > 0
                ? t('diary.macroGrams', { current: carbGrams, target: targetCarbs })
                : t('diary.macroGramsSimple', { grams: carbGrams })}
            </Text>
          </View>
          <View
            style={{
              height: 7,
              backgroundColor: colors.surfaceAlt,
              borderRadius: radius.pill,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${carbPercent}%`,
                backgroundColor: colors.macroCarbs,
                borderRadius: radius.pill,
              }}
            />
          </View>
        </View>

        {/* Fat */}
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.text }}>
              {t('diary.macroFat')}
            </Text>
            <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '500' }}>
              {targetFat > 0
                ? t('diary.macroGrams', { current: fatGrams, target: targetFat })
                : t('diary.macroGramsSimple', { grams: fatGrams })}
            </Text>
          </View>
          <View
            style={{
              height: 7,
              backgroundColor: colors.surfaceAlt,
              borderRadius: radius.pill,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${fatPercent}%`,
                backgroundColor: colors.macroFat,
                borderRadius: radius.pill,
              }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
