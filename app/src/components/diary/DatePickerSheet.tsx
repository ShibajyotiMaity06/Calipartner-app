import { useTheme as useAppearance } from '@calipartner/ui/theme';
import { useCurrentLocalDate } from '@/hooks/useCurrentLocalDate';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet, Text, Button, controls, space, radius } from '@calipartner/ui';
import { getLocale, t } from '@/i18n';

export interface DatePickerSheetProps {
  visible: boolean;
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  onClose: () => void;
  confirmSelection?: boolean;
}

const monthStart = (date: string) => new Date(date.slice(0, 7) + '-01T12:00:00Z');

export function DatePickerSheet({
  visible,
  selectedDate,
  onSelectDate,
  onClose,
  confirmSelection = false,
}: DatePickerSheetProps) {
  const { colors } = useAppearance();
  const styles = createStyles(colors);
  const { localDate: today } = useCurrentLocalDate();
  const [monthDate, setMonthDate] = useState(() => monthStart(selectedDate));
  const [draft, setDraft] = useState(selectedDate);
  useEffect(() => {
    if (visible) {
      setMonthDate(monthStart(selectedDate));
      setDraft(selectedDate);
    }
  }, [selectedDate, visible]);
  useBrowserModalBack(visible, onClose);

  const year = monthDate.getUTCFullYear();
  const month = monthDate.getUTCMonth();
  const numberOfDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const offset = monthDate.getUTCDay();
  const currentMonth = monthDate.getTime() >= monthStart(today).getTime();
  const locale = getLocale();
  const dateLabel = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' });
  const weekdayLabel = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' });
  const choose = (date: string) => {
    if (date > today) return;
    if (confirmSelection) {
      setDraft(date);
    } else {
      onSelectDate(date);
      onClose();
    }
  };
  const changeMonth = (direction: -1 | 1) => {
    if (direction === 1 && currentMonth) return;
    setMonthDate(new Date(Date.UTC(year, month + direction, 1, 12)));
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      snapPoint={confirmSelection ? 'tall' : 'half'}
      testID="sheet-date-picker"
      accessibilityLabel={t('calendar.title')}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.navHeader}>
          <Button
            variant="tertiary"
            fullWidth={false}
            label={t('calendar.previousMonth')}
            iconOnly
            icon={<Ionicons name="chevron-back" size={controls.icon} color={colors.textHi} />}
            testID="btn-prev-month"
            onPress={() => changeMonth(-1)}
          />
          <Text variant="heading" color={colors.textHi} accessibilityLiveRegion="polite">
            {monthDate.toLocaleDateString(locale, {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </Text>
          <Button
            variant="tertiary"
            fullWidth={false}
            label={t('calendar.nextMonth')}
            iconOnly
            icon={
              <Ionicons
                name="chevron-forward"
                size={controls.icon}
                color={currentMonth ? colors.textLo : colors.textHi}
              />
            }
            testID="btn-next-month"
            onPress={() => changeMonth(1)}
            disabled={currentMonth}
          />
        </View>
        <View
          style={styles.weekdayRow}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {Array.from({ length: 7 }, (_, index) => (
            <View key={index} style={styles.dayCell}>
              <Text variant="label" color={colors.textLo}>
                {weekdayLabel.format(new Date(Date.UTC(year, month, 1 - offset + index, 12)))}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.grid}>
          {Array.from({ length: offset + numberOfDays }, (_, index) => {
            const day = index - offset + 1;
            if (day < 1) return <View key={index} style={styles.dayCell} />;
            const date = new Date(Date.UTC(year, month, day, 12));
            const key = date.toISOString().slice(0, 10);
            const selected = key === draft;
            const future = key > today;
            return (
              <Pressable
                key={index}
                accessibilityRole="button"
                accessibilityLabel={dateLabel.format(date)}
                accessibilityState={{ selected, disabled: future }}
                testID={`day-cell-${key}`}
                disabled={future}
                onPress={() => choose(key)}
                style={({ pressed }) => [
                  styles.dayCell,
                  selected && styles.selected,
                  !selected && key === today && styles.today,
                  pressed && !selected && styles.pressed,
                ]}
              >
                <Text
                  variant="label"
                  tabular
                  color={selected ? colors.onBrand : future ? colors.textOff : colors.textHi}
                >
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.footer}>
          <Button
            testID="btn-jump-today-sheet"
            variant={confirmSelection ? 'tertiary' : 'secondary'}
            label={t('calendar.today')}
            onPress={() => {
              setMonthDate(monthStart(today));
              choose(today);
            }}
          />
          {confirmSelection && (
            <Button
              testID="workout-calendar-confirm"
              label={t('calendar.ok')}
              disabled={draft > today}
              onPress={() => {
                if (draft > today) return;
                onSelectDate(draft);
                onClose();
              }}
            />
          )}
        </View>
      </ScrollView>
    </Sheet>
  );
}

const createStyles = (colors: ReturnType<typeof useAppearance>['colors']) =>
  StyleSheet.create({
    container: { paddingHorizontal: space[1], paddingBottom: space[3], gap: space[2] },
    navHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space[1],
    },
    weekdayRow: {
      flexDirection: 'row',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.hairline,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayCell: {
      width: '14.285%',
      minHeight: controls.touch,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.control,
    },
    selected: { backgroundColor: colors.apricot },
    today: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.apricot },
    pressed: { backgroundColor: colors.s3 },
    footer: { paddingHorizontal: space[3], gap: space[2] },
  });
