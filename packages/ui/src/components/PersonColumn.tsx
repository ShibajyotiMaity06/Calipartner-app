import React from 'react';
import { View, StyleSheet, TouchableOpacity, type AccessibilityProps } from 'react-native';
import { dark, type IdentityHue, getIdentityColor } from '../tokens/colors';
import { space } from '../tokens/space';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { HiddenMetric } from './HiddenMetric';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export interface MealStatus {
  logged: boolean;
  name?: string;
  calories?: number;
}

export interface PersonColumnProps extends AccessibilityProps {
  /** Left (You) or Right (Partner) side. Mirrored across the seam (Spec 5.4) */
  side: 'left' | 'right';
  /** Display name (e.g. "You" or "Priya") */
  name: string;
  /** Identity hue */
  identityHue: IdentityHue;
  /** Goal completion percent (e.g. 78 or 125) */
  percent: number;
  /** Calories over goal if > 100% (e.g. "320 over") */
  overAmount?: string | number;
  /** Steps count (e.g. 8420) */
  steps?: number;
  /** Steps goal (e.g. 10000) */
  stepsGoal?: number;
  /** Four meal statuses */
  meals?: Record<MealType, MealStatus>;
  /** Whether this person's diary data is hidden by privacy settings (Spec CMP-25) */
  isDataHidden?: boolean;
  /** Whether this person has paused participation (Spec ROOM-10) */
  isPaused?: boolean;
  /** Date until which participation is paused (e.g. "24 Oct") */
  pauseUntilDate?: string;
  /** Avatar image URL (optional) */
  avatarUrl?: string;
  /** Callback when tapping a meal dot to react (SOC-2) */
  onReactMeal?: (meal: MealType) => void;
  /** Callback when long-pressing a meal row (view partner entry) */
  onLongPressMeal?: (meal: MealType) => void;
  /** Custom test ID */
  testID?: string;
}

const DEFAULT_MEALS: Record<MealType, MealStatus> = {
  breakfast: { logged: false },
  lunch: { logged: false },
  dinner: { logged: false },
  snacks: { logged: false },
};

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

export function PersonColumn({
  side,
  name,
  identityHue,
  percent,
  overAmount,
  steps = 0,
  stepsGoal = 10000,
  meals = DEFAULT_MEALS,
  isDataHidden = false,
  isPaused = false,
  pauseUntilDate,
  avatarUrl,
  onReactMeal,
  onLongPressMeal,
  testID = 'person-column',
  accessibilityLabel,
  ...rest
}: PersonColumnProps): React.JSX.Element {
  const isLeft = side === 'left';
  const personColor = getIdentityColor(identityHue);

  // Steps progress (clamped to 100%)
  const stepsPct = stepsGoal > 0 ? Math.min(100, Math.max(0, (steps / stepsGoal) * 100)) : 0;

  // Four fixed meal rows in order: Breakfast, Lunch, Dinner, Snacks
  const mealKeys: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

  const a11ySummary = `${name}: ${Math.round(percent)}% of goal, ${steps.toLocaleString()} steps. ${
    isDataHidden ? 'Data is not shared.' : ''
  }`;

  return (
    <View
      style={[styles.container, isLeft ? styles.leftContainer : styles.rightContainer]}
      testID={testID}
      accessibilityRole="summary"
      accessibilityLabel={accessibilityLabel || a11ySummary}
      {...rest}
    >
      {/* 1. Header: Avatar + Name + Percent */}
      <View style={[styles.headerRow, isLeft ? styles.headerRowLeft : styles.headerRowRight]}>
        <Avatar size="sm" name={name} uri={avatarUrl} identityHue={identityHue} />
        <View style={[styles.nameBlock, isLeft ? styles.nameBlockLeft : styles.nameBlockRight]}>
          <Text variant="label" color={dark.textHi} numberOfLines={1}>
            {name}
          </Text>
          {isPaused ? (
            <Text variant="micro" color={dark.textMid}>
              {pauseUntilDate ? `Paused until ${pauseUntilDate}` : 'Paused'}
            </Text>
          ) : isDataHidden ? (
            <HiddenMetric label="Not shared" />
          ) : percent > 100 ? (
            <View style={styles.percentRow}>
              <Text variant="numeralM" color={dark.cream}>
                {`${Math.round(percent)}%`}
              </Text>
              <Text variant="micro" color={dark.textMid} style={styles.overLabel}>
                {overAmount ? `${overAmount} over` : 'over'}
              </Text>
            </View>
          ) : (
            <Text variant="numeralM" color={personColor}>
              {`${Math.round(percent)}%`}
            </Text>
          )}
        </View>
      </View>

      {/* 2. Steps Bar */}
      <View style={styles.stepsSection}>
        <View style={styles.stepsTextRow}>
          <Text variant="micro" color={dark.textMid}>
            {isDataHidden ? 'Steps: Not shared' : `${steps.toLocaleString()} steps`}
          </Text>
        </View>
        <View style={styles.stepsTrack}>
          {!isDataHidden && (
            <View
              style={[
                styles.stepsFill,
                {
                  width: `${stepsPct}%`,
                  backgroundColor: personColor,
                },
              ]}
            />
          )}
        </View>
      </View>

      {/* 3. Four Meal Rows (Mirrored facing the seam) */}
      <View style={styles.mealsContainer}>
        {mealKeys.map((mealKey) => {
          const meal = meals[mealKey] || { logged: false };
          const isLogged = meal.logged;
          const label = MEAL_LABELS[mealKey];

          // Status Glyph: facing the seam!
          // If isLeft (You), glyph is at the right edge facing center seam.
          // If isRight (Partner), glyph is at the left edge facing center seam.
          const statusGlyph = (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onReactMeal?.(mealKey)}
              onLongPress={() => onLongPressMeal?.(mealKey)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={`${label}: ${isLogged ? 'logged' : 'not logged'}`}
              accessibilityRole="button"
              style={styles.glyphTouchArea}
            >
              {isLogged ? (
                <View style={[styles.loggedDot, { backgroundColor: personColor }]} />
              ) : (
                <View style={styles.unloggedCircle} />
              )}
            </TouchableOpacity>
          );

          return (
            <TouchableOpacity
              key={mealKey}
              activeOpacity={0.8}
              onLongPress={() => onLongPressMeal?.(mealKey)}
              disabled={!onLongPressMeal}
              style={[styles.mealRow, isLeft ? styles.mealRowLeft : styles.mealRowRight]}
            >
              {isLeft ? (
                <>
                  <Text
                    variant="bodyS"
                    color={isLogged ? dark.textHi : dark.textMid}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                  {statusGlyph}
                </>
              ) : (
                <>
                  {statusGlyph}
                  <Text
                    variant="bodyS"
                    color={isLogged ? dark.textHi : dark.textMid}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: space[1],
  },
  leftContainer: {
    paddingRight: space[2],
  },
  rightContainer: {
    paddingLeft: space[2],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginBottom: space[3],
  },
  headerRowLeft: {
    justifyContent: 'flex-start',
  },
  headerRowRight: {
    justifyContent: 'flex-end',
    flexDirection: 'row-reverse',
  },
  nameBlock: {
    gap: 2,
  },
  nameBlockLeft: {
    alignItems: 'flex-start',
  },
  nameBlockRight: {
    alignItems: 'flex-end',
  },
  percentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  overLabel: {
    fontSize: 10,
    lineHeight: 12,
  },
  stepsSection: {
    marginBottom: space[3],
    gap: 4,
  },
  stepsTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepsTrack: {
    height: 4,
    backgroundColor: dark.s2,
    borderRadius: 2,
    overflow: 'hidden',
    width: '100%',
  },
  stepsFill: {
    height: '100%',
    borderRadius: 2,
  },
  mealsContainer: {
    gap: 4,
  },
  mealRow: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mealRowLeft: {
    paddingRight: 4,
  },
  mealRowRight: {
    paddingLeft: 4,
  },
  glyphTouchArea: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loggedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  unloggedCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: dark.hairlineLit,
    backgroundColor: 'transparent',
  },
});
