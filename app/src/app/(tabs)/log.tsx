import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getMealSectionForTime, type MealSection } from '@calipartner/core';
import { FoodLogModal } from '@/components/diary/FoodLogModal';
import { WorkoutLoggerModal } from '@/components/workouts/WorkoutLoggerModal';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function LogScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [sheetVisible, setSheetVisible] = useState(true);
  const [activeFlow, setActiveFlow] = useState<'picker' | 'food' | 'workout'>('picker');

  const todayDate = new Date().toISOString().slice(0, 10);
  const currentSection: MealSection = getMealSectionForTime(new Date());

  const handleCloseAll = () => {
    setSheetVisible(false);
    router.replace('/today');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Quick Log Action Sheet / Picker Modal */}
      {activeFlow === 'picker' && (
        <Modal
          testID="log-sheet-modal"
          visible={sheetVisible}
          transparent
          animationType="fade"
          onRequestClose={handleCloseAll}
        >
          <View style={styles.backdrop}>
            <View
              style={[
                styles.sheetContainer,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.sheetHeader}>
                <View style={styles.titleWrap}>
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>
                    {t('workouts.logSheet.title')}
                  </Text>
                  <Text style={[styles.sheetSubtitle, { color: colors.textMuted }]}>
                    {t('workouts.logSheet.subtitle')}
                  </Text>
                </View>
                <TouchableOpacity
                  testID="btn-log-sheet-close"
                  onPress={handleCloseAll}
                  style={styles.closeBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.cancel')}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.optionsWrap}>
                {/* Log Food Option */}
                <TouchableOpacity
                  testID="btn-log-sheet-food"
                  style={[
                    styles.optionCard,
                    { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                  onPress={() => setActiveFlow('food')}
                  accessibilityRole="button"
                  accessibilityLabel={t('workouts.logSheet.foodOption')}
                >
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: colors.cardHighlight },
                    ]}
                  >
                    <Ionicons name="restaurant-outline" size={24} color={colors.accent} />
                  </View>
                  <View style={styles.optionInfo}>
                    <Text style={[styles.optionTitle, { color: colors.text }]}>
                      {t('workouts.logSheet.foodOption')}
                    </Text>
                    <Text style={[styles.optionDesc, { color: colors.textMuted }]}>
                      {t(`diary.sections.${currentSection}` as const)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>

                {/* Log Workout Option */}
                <TouchableOpacity
                  testID="btn-log-sheet-workout"
                  style={[
                    styles.optionCard,
                    { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                  onPress={() => setActiveFlow('workout')}
                  accessibilityRole="button"
                  accessibilityLabel={t('workouts.logSheet.workoutOption')}
                >
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: colors.cardHighlight },
                    ]}
                  >
                    <Ionicons name="barbell-outline" size={24} color={colors.macroCalories} />
                  </View>
                  <View style={styles.optionInfo}>
                    <Text style={[styles.optionTitle, { color: colors.text }]}>
                      {t('workouts.logSheet.workoutOption')}
                    </Text>
                    <Text style={[styles.optionDesc, { color: colors.textMuted }]}>
                      {t('workouts.cardTitle')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Food Log Modal Flow */}
      {activeFlow === 'food' && (
        <FoodLogModal
          visible={sheetVisible}
          defaultSection={currentSection}
          localDate={todayDate}
          onClose={handleCloseAll}
          onLogged={handleCloseAll}
        />
      )}

      {/* Workout Logger Modal Flow */}
      {activeFlow === 'workout' && (
        <WorkoutLoggerModal
          visible={sheetVisible}
          defaultDate={todayDate}
          onClose={handleCloseAll}
          onSaved={handleCloseAll}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 40,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWrap: {
    gap: 2,
  },
  sheetTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  sheetSubtitle: {
    fontSize: fontSize.xs,
  },
  closeBtn: {
    padding: 6,
  },
  optionsWrap: {
    gap: spacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionInfo: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  optionDesc: {
    fontSize: fontSize.xs,
  },
});
