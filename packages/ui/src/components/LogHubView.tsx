import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { dark } from '../tokens/colors';
import { radius } from '../tokens/radius';
import { space } from '../tokens/space';
import {
  FoodIcon,
  WorkoutIcon,
  WaterIcon,
  WeightIcon,
  FastIcon,
  ScanIcon,
  PhotoIcon,
  RecipesIcon,
  CloseIcon,
} from './Icons';

export type LogTileId = 'food' | 'workout' | 'water' | 'weight' | 'fast';
export type QuickAddId = 'scan' | 'photo' | 'recipes';
export type MealSectionType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface LogHubViewProps {
  /** Current selected meal section (e.g. 'lunch') */
  mealSection?: MealSectionType;
  /** Callback when meal section chip is pressed */
  onCycleMealSection?: () => void;
  /** Callback when one of the main logging tiles is pressed */
  onSelectTile: (tile: LogTileId) => void;
  /** Callback when a quick action is pressed */
  onSelectQuickAdd?: (action: QuickAddId) => void;
  /** Callback to close the sheet */
  onClose: () => void;
  /** Whether Fast tile should be shown (hidden if screening forbids or toggled off) */
  showFastTile?: boolean;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** Test identifier */
  testID?: string;
}

const MEAL_LABELS: Record<MealSectionType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

export function LogHubView({
  mealSection = 'lunch',
  onCycleMealSection,
  onSelectTile,
  onSelectQuickAdd,
  onClose,
  showFastTile = true,
  style,
  testID = 'log-hub-view',
}: LogHubViewProps): React.JSX.Element {
  const mealName = MEAL_LABELS[mealSection] || 'Lunch';

  return (
    <View testID={testID} style={[styles.container, style]}>
      {/* Header: Title + Meal selector chip + Close button */}
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Add to {mealName.toLowerCase()}</Text>
          {onCycleMealSection ? (
            <TouchableOpacity
              testID="btn-meal-chip"
              accessibilityRole="button"
              accessibilityLabel={`Meal section: ${mealName}. Tap to change.`}
              style={styles.mealChip}
              onPress={onCycleMealSection}
              activeOpacity={0.7}
            >
              <Text style={styles.mealChipText}>{mealName}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          testID="btn-log-sheet-close"
          accessibilityRole="button"
          accessibilityLabel="Close log sheet"
          style={styles.closeBtn}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <CloseIcon size={22} color={dark.textMid} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 3x2 Grid of 96x96 Tiles */}
        <View style={styles.gridContainer}>
          {/* 1. Food */}
          <TouchableOpacity
            testID="btn-log-tile-food"
            accessibilityRole="button"
            accessibilityLabel="Log Food"
            style={styles.tile}
            activeOpacity={0.75}
            onPress={() => onSelectTile('food')}
          >
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(244, 182, 125, 0.16)' }]}>
              <FoodIcon size={28} color={dark.apricot} />
            </View>
            <Text style={styles.tileLabel}>Food</Text>
          </TouchableOpacity>

          {/* 2. Workout */}
          <TouchableOpacity
            testID="btn-log-tile-workout"
            accessibilityRole="button"
            accessibilityLabel="Log Workout"
            style={styles.tile}
            activeOpacity={0.75}
            onPress={() => onSelectTile('workout')}
          >
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(46, 192, 131, 0.16)' }]}>
              <WorkoutIcon size={28} color={dark.mint} />
            </View>
            <Text style={styles.tileLabel}>Workout</Text>
          </TouchableOpacity>

          {/* 3. Water */}
          <TouchableOpacity
            testID="btn-log-tile-water"
            accessibilityRole="button"
            accessibilityLabel="Log Water"
            style={styles.tile}
            activeOpacity={0.75}
            onPress={() => onSelectTile('water')}
          >
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(31, 189, 182, 0.16)' }]}>
              <WaterIcon size={28} color={dark.teal} />
            </View>
            <Text style={styles.tileLabel}>Water</Text>
          </TouchableOpacity>

          {/* 4. Weight */}
          <TouchableOpacity
            testID="btn-log-tile-weight"
            accessibilityRole="button"
            accessibilityLabel="Log Weight"
            style={styles.tile}
            activeOpacity={0.75}
            onPress={() => onSelectTile('weight')}
          >
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(180, 154, 252, 0.16)' }]}>
              <WeightIcon size={28} color={dark.iris} />
            </View>
            <Text style={styles.tileLabel}>Weight</Text>
          </TouchableOpacity>

          {/* 5. Fast (conditionally visible per FST-1) */}
          {showFastTile ? (
            <TouchableOpacity
              testID="btn-log-tile-fast"
              accessibilityRole="button"
              accessibilityLabel="Log Fast"
              style={styles.tile}
              activeOpacity={0.75}
              onPress={() => onSelectTile('fast')}
            >
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(187, 134, 97, 0.16)' }]}>
                <FastIcon size={28} color={dark.copper} />
              </View>
              <Text style={styles.tileLabel}>Fast</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.tile, styles.emptyTile]} />
          )}
        </View>

        {/* Quick Add Row */}
        {onSelectQuickAdd && (
          <View style={styles.quickAddSection}>
            <Text style={styles.sectionHeading}>Quick add</Text>
            <View style={styles.quickAddRow}>
              {/* Scan */}
              <TouchableOpacity
                testID="btn-quick-scan"
                accessibilityRole="button"
                accessibilityLabel="Barcode scan"
                style={styles.quickChip}
                activeOpacity={0.75}
                onPress={() => onSelectQuickAdd('scan')}
              >
                <ScanIcon size={18} color={dark.apricot} />
                <Text style={styles.quickChipText}>Scan</Text>
              </TouchableOpacity>

              {/* Photo */}
              <TouchableOpacity
                testID="btn-quick-photo"
                accessibilityRole="button"
                accessibilityLabel="AI food photo scan"
                style={styles.quickChip}
                activeOpacity={0.75}
                onPress={() => onSelectQuickAdd('photo')}
              >
                <PhotoIcon size={18} color={dark.teal} />
                <Text style={styles.quickChipText}>Photo</Text>
              </TouchableOpacity>

              {/* Recipes */}
              <TouchableOpacity
                testID="btn-quick-recipes"
                accessibilityRole="button"
                accessibilityLabel="Browse recipes"
                style={styles.quickChip}
                activeOpacity={0.75}
                onPress={() => onSelectQuickAdd('recipes')}
              >
                <RecipesIcon size={18} color={dark.mint} />
                <Text style={styles.quickChipText}>Recipes</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: space[4], // 16
    paddingBottom: space[4], // 16
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[2], // 8
    marginBottom: space[3], // 12
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2], // 8
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: dark.textHi,
    letterSpacing: -0.3,
  },
  mealChip: {
    paddingHorizontal: space[2], // 8
    paddingVertical: space[1], // 4
    borderRadius: radius.control, // 12
    backgroundColor: 'rgba(244, 182, 125, 0.16)',
    borderWidth: 1,
    borderColor: dark.apricot,
  },
  mealChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: dark.apricot,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  scrollContent: {
    paddingBottom: space[6], // 32
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: space[3], // 12
    marginBottom: space[6], // 32
  },
  tile: {
    width: '30%',
    minWidth: 96,
    height: 96, // 96x96 tile spec
    borderRadius: radius.card, // 20
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2], // 8
  },
  emptyTile: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: dark.textHi,
  },
  quickAddSection: {
    marginTop: space[1], // 4
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: dark.textLo,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: space[3], // 12
  },
  quickAddRow: {
    flexDirection: 'row',
    gap: space[2], // 8
    flexWrap: 'wrap',
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2], // 8
    paddingHorizontal: space[3], // 12
    paddingVertical: space[2], // 8
    height: 44, // Minimum 44 hit area
    borderRadius: radius.control, // 12
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
  },
  quickChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: dark.textHi,
  },
});
