import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { isAtLeast18 } from '@calipartner/core';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface InteractiveDobPickerProps {
  value: string; // YYYY-MM-DD
  onChange: (dob: string) => void;
  error?: string;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const FULL_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function InteractiveDobPicker({ value, onChange, error }: InteractiveDobPickerProps) {
  const { colors } = useTheme();

  // Parse initial YYYY-MM-DD or default to an adult born in 2000
  const parsed = useMemo(() => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return { year: 2000, month: 0, day: 15 };
    }
    const [y, m, d] = value.split('-').map(Number);
    return {
      year: y || 2000,
      month: Math.max(0, Math.min(11, (m || 1) - 1)),
      day: Math.max(1, Math.min(31, d || 15)),
    };
  }, [value]);

  const [year, setYear] = useState(parsed.year);
  const [month, setMonth] = useState(parsed.month);
  const [day, setDay] = useState(parsed.day);
  const [showMonthGrid, setShowMonthGrid] = useState(false);
  const [showYearGrid, setShowYearGrid] = useState(false);

  // Sync to parent format YYYY-MM-DD
  const emitChange = (newYear: number, newMonth: number, newDay: number) => {
    const maxDays = daysInMonth(newYear, newMonth);
    const clampedDay = Math.min(newDay, maxDays);
    const mm = String(newMonth + 1).padStart(2, '0');
    const dd = String(clampedDay).padStart(2, '0');
    const iso = `${newYear}-${mm}-${dd}`;
    onChange(iso);
  };

  const handleYearChange = (newYear: number) => {
    playClickSound();
    setYear(newYear);
    emitChange(newYear, month, day);
  };

  const handleMonthChange = (newMonth: number) => {
    playClickSound();
    setMonth(newMonth);
    setShowMonthGrid(false);
    emitChange(year, newMonth, day);
  };

  const handleDayChange = (newDay: number) => {
    playClickSound();
    setDay(newDay);
    emitChange(year, month, newDay);
  };

  const currentMaxDays = daysInMonth(year, month);
  const safeDay = Math.min(day, currentMaxDays);

  // Calculate live age
  const age = useMemo(() => {
    const today = new Date();
    let calculatedAge = today.getFullYear() - year;
    const mDiff = today.getMonth() - month;
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < safeDay)) {
      calculatedAge--;
    }
    return calculatedAge;
  }, [year, month, safeDay]);

  const isoString = `${year}-${String(month + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
  const isAdult = isAtLeast18(isoString);

  // Quick decades for rapid jump
  const decades = [2005, 2000, 1995, 1990, 1985, 1980];

  return (
    <View style={styles.container} testID="dob-picker-container">
      {/* 3 Interactive Selector Cards: Day, Month, Year */}
      <View style={styles.pickerRow}>
        {/* Month Selector Box */}
        <Pressable
          testID="btn-dob-month-select"
          accessibilityRole="button"
          accessibilityLabel={`Month: ${FULL_MONTH_NAMES[month]}`}
          onPress={() => {
            playClickSound();
            setShowMonthGrid(!showMonthGrid);
            setShowYearGrid(false);
          }}
          style={({ pressed }) => [
            styles.selectorBox,
            styles.monthBox,
            {
              backgroundColor: colors.surface,
              borderColor: showMonthGrid ? colors.accent : colors.border,
              borderWidth: showMonthGrid ? 2 : 1,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Text style={[styles.boxLabel, { color: colors.textMuted }]}>Month</Text>
          <Text style={[styles.boxValue, { color: colors.text }]}>
            {FULL_MONTH_NAMES[month]}
          </Text>
          <Text style={[styles.boxHint, { color: colors.textMuted }]}>Tap to change</Text>
        </Pressable>

        {/* Day Stepper Box */}
        <View
          style={[
            styles.selectorBox,
            styles.dayBox,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.boxLabel, { color: colors.textMuted }]}>Day</Text>
          <View style={styles.stepperRow}>
            <Pressable
              testID="btn-dob-day-minus"
              accessibilityRole="button"
              accessibilityLabel="Decrease day"
              onPress={() => handleDayChange(safeDay <= 1 ? currentMaxDays : safeDay - 1)}
              style={({ pressed }) => [
                styles.stepperButton,
                { backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.7 : 1 },
              ]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={[styles.stepperButtonText, { color: colors.text }]}>−</Text>
            </Pressable>

            <Text style={[styles.stepperValue, { color: colors.text }]} testID="dob-day-value">
              {safeDay}
            </Text>

            <Pressable
              testID="btn-dob-day-plus"
              accessibilityRole="button"
              accessibilityLabel="Increase day"
              onPress={() => handleDayChange(safeDay >= currentMaxDays ? 1 : safeDay + 1)}
              style={({ pressed }) => [
                styles.stepperButton,
                { backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.7 : 1 },
              ]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={[styles.stepperButtonText, { color: colors.text }]}>+</Text>
            </Pressable>
          </View>
        </View>

        {/* Year Stepper Box */}
        <Pressable
          testID="btn-dob-year-select"
          accessibilityRole="button"
          accessibilityLabel={`Year: ${year}`}
          onPress={() => {
            playClickSound();
            setShowYearGrid(!showYearGrid);
            setShowMonthGrid(false);
          }}
          style={({ pressed }) => [
            styles.selectorBox,
            styles.yearBox,
            {
              backgroundColor: colors.surface,
              borderColor: showYearGrid ? colors.accent : colors.border,
              borderWidth: showYearGrid ? 2 : 1,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Text style={[styles.boxLabel, { color: colors.textMuted }]}>Year</Text>
          <View style={styles.stepperRow}>
            <Pressable
              testID="btn-dob-year-minus"
              accessibilityRole="button"
              accessibilityLabel="Decrease year"
              onPress={() => handleYearChange(year - 1)}
              style={({ pressed }) => [
                styles.stepperButton,
                { backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.7 : 1 },
              ]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={[styles.stepperButtonText, { color: colors.text }]}>−</Text>
            </Pressable>

            <Text style={[styles.stepperValue, { color: colors.text }]} testID="dob-year-value">
              {year}
            </Text>

            <Pressable
              testID="btn-dob-year-plus"
              accessibilityRole="button"
              accessibilityLabel="Increase year"
              onPress={() => handleYearChange(year + 1)}
              style={({ pressed }) => [
                styles.stepperButton,
                { backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.7 : 1 },
              ]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={[styles.stepperButtonText, { color: colors.text }]}>+</Text>
            </Pressable>
          </View>
        </Pressable>
      </View>

      {/* Month Selection Grid Modal/Sheet */}
      {showMonthGrid && (
        <View
          style={[
            styles.gridCard,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}
          testID="dob-month-grid"
        >
          <Text style={[styles.gridTitle, { color: colors.textMuted }]}>Select Month</Text>
          <View style={styles.monthChipsRow}>
            {MONTH_NAMES.map((mName, idx) => {
              const isSelected = month === idx;
              return (
                <Pressable
                  key={mName}
                  testID={`btn-dob-month-${mName}`}
                  accessibilityRole="button"
                  accessibilityLabel={FULL_MONTH_NAMES[idx]}
                  onPress={() => handleMonthChange(idx)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? colors.accent : colors.surface,
                      borderColor: isSelected ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: isSelected ? colors.onAccent : colors.text },
                      isSelected && styles.chipTextBold,
                    ]}
                  >
                    {mName}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Quick Decades / Years selection */}
      {showYearGrid && (
        <View
          style={[
            styles.gridCard,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}
          testID="dob-decade-grid"
        >
          <Text style={[styles.gridTitle, { color: colors.textMuted }]}>Quick Decade Jump</Text>
          <View style={styles.decadeChipsRow}>
            {decades.map((dec) => {
              const isSelected = Math.abs(year - dec) <= 2;
              return (
                <Pressable
                  key={dec}
                  testID={`btn-dob-decade-${dec}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Born around ${dec}`}
                  onPress={() => handleYearChange(dec)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? colors.accent : colors.surface,
                      borderColor: isSelected ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: isSelected ? colors.onAccent : colors.text },
                      isSelected && styles.chipTextBold,
                    ]}
                  >
                    {dec}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Live Calculated Age Card */}
      <View
        style={[
          styles.ageCard,
          {
            backgroundColor: isAdult ? colors.surfaceAlt : colors.surfaceAlt,
            borderColor: isAdult ? colors.border : colors.danger,
          },
        ]}
        testID="dob-live-age-badge"
      >
        <Text style={[styles.ageTitle, { color: colors.text }]}>
          {isAdult ? `🎂 ${age} years old` : `⚠️ ${age} years old`}
        </Text>
        <Text
          style={[
            styles.ageSubtitle,
            { color: isAdult ? colors.textMuted : colors.danger },
          ]}
        >
          {isAdult
            ? `Born ${FULL_MONTH_NAMES[month]} ${safeDay}, ${year} · Meets 18+ requirement`
            : t('onboarding.bodyStats.under18Error')}
        </Text>
      </View>

      {error ? (
        <Text style={[styles.errorText, { color: colors.danger }]} testID="error-dob">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  selectorBox: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 88,
    justifyContent: 'space-between',
  },
  monthBox: {
    flex: 1.4,
  },
  dayBox: {
    flex: 1.1,
  },
  yearBox: {
    flex: 1.3,
  },
  boxLabel: {
    fontSize: fontSize.sm - 2,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  boxValue: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  boxHint: {
    fontSize: fontSize.sm - 3,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    lineHeight: 18,
  },
  stepperValue: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  gridCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  gridTitle: {
    fontSize: fontSize.sm - 1,
    fontWeight: '600',
  },
  monthChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  decadeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: fontSize.sm - 1,
  },
  chipTextBold: {
    fontWeight: '700',
  },
  ageCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 2,
  },
  ageTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  ageSubtitle: {
    fontSize: fontSize.sm - 1,
    lineHeight: 18,
  },
  errorText: {
    fontSize: fontSize.sm - 1,
    fontWeight: '500',
  },
});
