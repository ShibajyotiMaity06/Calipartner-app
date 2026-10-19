import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet, Text, Button, dark, space, radius } from '@calipartner/ui';

export interface DatePickerSheetProps {
  visible: boolean;
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  onClose: () => void;
}

export function DatePickerSheet({
  visible,
  selectedDate,
  onSelectDate,
  onClose,
}: DatePickerSheetProps) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [currentMonthDate, setCurrentMonthDate] = useState(() => new Date(selectedDate));

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth(); // 0-indexed

  // Month navigation
  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    const nextMonth = new Date(year, month + 1, 1);
    const now = new Date();
    if (
      nextMonth.getFullYear() > now.getFullYear() ||
      (nextMonth.getFullYear() === now.getFullYear() && nextMonth.getMonth() > now.getMonth())
    ) {
      return;
    }
    setCurrentMonthDate(nextMonth);
  };

  // Build calendar days
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayWeekday = new Date(year, month, 1).getDay(); // 0 is Sunday

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayWeekday; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }

  const monthNames = [
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

  const handleSelectDay = (day: number) => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dateStr = `${year}-${mm}-${dd}`;
    if (dateStr > todayStr) return; // Future days disabled
    onSelectDate(dateStr);
    onClose();
  };

  const isCurrentMonthFuture = () => {
    const now = new Date();
    return year === now.getFullYear() && month >= now.getMonth();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      snapPoint="half"
      testID="sheet-date-picker"
      accessibilityLabel="Calendar Date Picker"
    >
      <View style={styles.container}>
        {/* Month Navigation */}
        <View style={styles.navHeader}>
          <Pressable
            testID="btn-prev-month"
            onPress={handlePrevMonth}
            style={styles.navArrow}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Previous month"
          >
            <Ionicons name="chevron-back" size={20} color={dark.textHi} />
          </Pressable>

          <Text variant="heading" color={dark.textHi}>
            {monthNames[month]} {year}
          </Text>

          <Pressable
            testID="btn-next-month"
            onPress={handleNextMonth}
            disabled={isCurrentMonthFuture()}
            style={[styles.navArrow, isCurrentMonthFuture() && styles.navArrowDisabled]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Next month"
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={isCurrentMonthFuture() ? dark.textLo : dark.textHi}
            />
          </Pressable>
        </View>

        {/* Weekday Labels */}
        <View style={styles.weekdayRow}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, idx) => (
            <View key={idx} style={styles.dayCell}>
              <Text variant="label" color={dark.textLo}>
                {w}
              </Text>
            </View>
          ))}
        </View>

        {/* Days Grid */}
        <View style={styles.grid}>
          {days.map((day, idx) => {
            if (day === null) {
              return <View key={`empty-${idx}`} style={styles.dayCell} />;
            }

            const mm = String(month + 1).padStart(2, '0');
            const dd = String(day).padStart(2, '0');
            const dateStr = `${year}-${mm}-${dd}`;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const isFuture = dateStr > todayStr;

            return (
              <Pressable
                key={`day-${day}`}
                testID={`day-cell-${dateStr}`}
                disabled={isFuture}
                onPress={() => handleSelectDay(day)}
                style={[
                  styles.dayCell,
                  styles.dayButton,
                  isSelected && styles.dayButtonSelected,
                  isToday && !isSelected && styles.dayButtonToday,
                  isFuture && styles.dayButtonFuture,
                ]}
              >
                <Text
                  variant="bodyS"
                  color={isSelected ? dark.onBrand : isFuture ? dark.textOff : dark.textHi}
                  style={isSelected ? { fontWeight: '700' } : undefined}
                >
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Quick Jump to Today */}
        <View style={styles.footer}>
          <Button
            testID="btn-jump-today-sheet"
            variant="secondary"
            label="Jump to Today"
            onPress={() => {
              onSelectDate(todayStr);
              onClose();
            }}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space[4],
    gap: space[3],
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[1],
  },
  navArrow: {
    padding: space[2],
  },
  navArrowDisabled: {
    opacity: 0.3,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
    paddingBottom: space[2],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButton: {
    borderRadius: radius.full,
  },
  dayButtonSelected: {
    backgroundColor: dark.apricot,
  },
  dayButtonToday: {
    borderWidth: 1.5,
    borderColor: dark.apricot,
  },
  dayButtonFuture: {
    opacity: 0.3,
  },
  footer: {
    paddingTop: space[2],
  },
});
