import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { isAtLeast18 } from '@calipartner/core';
import { Text, space, dark, radius } from '@calipartner/ui';
import { playClickSound } from '@/lib/sound';

interface InteractiveDobPickerProps {
  value: string; // YYYY-MM-DD
  onChange: (dob: string) => void;
  error?: string;
}

export function InteractiveDobPicker({ value, onChange, error }: InteractiveDobPickerProps) {
  // Parse initial YYYY-MM-DD or default
  const parsed = useMemo(() => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return { year: '2000', month: '01', day: '15' };
    }
    const [y, m, d] = value.split('-');
    return {
      year: y || '2000',
      month: m || '01',
      day: d || '15',
    };
  }, [value]);

  const [dayText, setDayText] = useState(parsed.day);
  const [monthText, setMonthText] = useState(parsed.month);
  const [yearText, setYearText] = useState(parsed.year);

  const monthInputRef = useRef<TextInput>(null);
  const yearInputRef = useRef<TextInput>(null);

  useEffect(() => {
    setDayText(parsed.day);
    setMonthText(parsed.month);
    setYearText(parsed.year);
  }, [parsed]);

  const emitDob = (d: string, m: string, y: string) => {
    const dayNum = parseInt(d, 10);
    const monthNum = parseInt(m, 10);
    const yearNum = parseInt(y, 10);

    if (
      !isNaN(dayNum) &&
      !isNaN(monthNum) &&
      !isNaN(yearNum) &&
      y.length === 4 &&
      dayNum >= 1 &&
      dayNum <= 31 &&
      monthNum >= 1 &&
      monthNum <= 12
    ) {
      const mm = String(monthNum).padStart(2, '0');
      const dd = String(dayNum).padStart(2, '0');
      onChange(`${yearNum}-${mm}-${dd}`);
    }
  };

  const handleDayChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 2);
    setDayText(cleaned);
    emitDob(cleaned, monthText, yearText);

    // Auto-advance to month if 2 digits entered or if first digit > 3
    if (cleaned.length === 2 || (cleaned.length === 1 && parseInt(cleaned, 10) > 3)) {
      monthInputRef.current?.focus();
    }
  };

  const handleMonthChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 2);
    setMonthText(cleaned);
    emitDob(dayText, cleaned, yearText);

    // Auto-advance to year if 2 digits entered or if first digit > 1
    if (cleaned.length === 2 || (cleaned.length === 1 && parseInt(cleaned, 10) > 1)) {
      yearInputRef.current?.focus();
    }
  };

  const handleYearChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 4);
    setYearText(cleaned);
    emitDob(dayText, monthText, cleaned);
  };

  // Compute live validation & age
  const isoCurrent = `${yearText.padStart(4, '0')}-${monthText.padStart(2, '0')}-${dayText.padStart(2, '0')}`;
  const isDateComplete = yearText.length === 4 && monthText.length > 0 && dayText.length > 0;
  const isAdult = isDateComplete ? isAtLeast18(isoCurrent) : true;

  const calculatedAge = useMemo(() => {
    if (!isDateComplete) return null;
    const y = parseInt(yearText, 10);
    const m = parseInt(monthText, 10) - 1;
    const d = parseInt(dayText, 10);
    const today = new Date();
    let age = today.getFullYear() - y;
    const mDiff = today.getMonth() - m;
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < d)) {
      age--;
    }
    return age;
  }, [isDateComplete, yearText, monthText, dayText]);

  return (
    <View style={styles.container} testID="dob-picker-container">
      {/* 3 Auto-Advancing Numeric Fields (Spec A03) */}
      <View style={styles.fieldsRow}>
        {/* Day Field (DD) */}
        <View style={styles.fieldBox}>
          <Text variant="label" color={dark.textLo} style={styles.fieldLabel}>
            Day
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: dark.s2,
                borderColor: dark.hairline,
                color: dark.textHi,
              },
            ]}
            keyboardType="number-pad"
            maxLength={2}
            value={dayText}
            placeholder="DD"
            placeholderTextColor={dark.textOff}
            onChangeText={handleDayChange}
            testID="input-dob-day"
            accessibilityLabel="Birth day, two digits"
          />
        </View>

        {/* Month Field (MM) */}
        <View style={styles.fieldBox}>
          <Text variant="label" color={dark.textLo} style={styles.fieldLabel}>
            Month
          </Text>
          <TextInput
            ref={monthInputRef}
            style={[
              styles.input,
              {
                backgroundColor: dark.s2,
                borderColor: dark.hairline,
                color: dark.textHi,
              },
            ]}
            keyboardType="number-pad"
            maxLength={2}
            value={monthText}
            placeholder="MM"
            placeholderTextColor={dark.textOff}
            onChangeText={handleMonthChange}
            testID="input-dob-month"
            accessibilityLabel="Birth month, two digits"
          />
        </View>

        {/* Year Field (YYYY) */}
        <View style={[styles.fieldBox, styles.yearBox]}>
          <Text variant="label" color={dark.textLo} style={styles.fieldLabel}>
            Year
          </Text>
          <TextInput
            ref={yearInputRef}
            style={[
              styles.input,
              {
                backgroundColor: dark.s2,
                borderColor: dark.hairline,
                color: dark.textHi,
              },
            ]}
            keyboardType="number-pad"
            maxLength={4}
            value={yearText}
            placeholder="YYYY"
            placeholderTextColor={dark.textOff}
            onChangeText={handleYearChange}
            testID="input-dob-year"
            accessibilityLabel="Birth year, four digits"
          />
        </View>
      </View>

      {/* Reason Line (Spec A03) */}
      <Text variant="label" color={dark.textLo} style={styles.reasonLine}>
        We ask because CaliPartner is for adults.
      </Text>

      {/* Live Calculated Age Badge or Under-18 Blocked Screen Notice */}
      {isDateComplete && (
        <View style={styles.statusRow}>
          {isAdult ? (
            <View style={styles.agePill}>
              <Text variant="bodyS" color={dark.textHi}>
                {calculatedAge} years old
              </Text>
            </View>
          ) : (
            <View style={styles.under18Notice} testID="under-18-notice">
              <Text variant="body" color={dark.danger} style={styles.blockedTitle}>
                CaliPartner is designed for adults (18+).
              </Text>
              <Text variant="label" color={dark.textLo} style={styles.blockedBody}>
                For your safety, registration is paused. No personal data has been kept on this device.
              </Text>
            </View>
          )}
        </View>
      )}

      {error ? (
        <Text variant="label" color={dark.danger} style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space[2],
  },
  fieldsRow: {
    flexDirection: 'row',
    gap: space[2],
    alignItems: 'center',
  },
  fieldBox: {
    flex: 1,
    gap: space[1],
  },
  yearBox: {
    flex: 1.5,
  },
  fieldLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderRadius: radius.control,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  reasonLine: {
    lineHeight: 18,
    marginTop: 2,
  },
  statusRow: {
    marginTop: space[1],
  },
  agePill: {
    alignSelf: 'flex-start',
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    borderRadius: radius.full,
    paddingHorizontal: space[3],
    paddingVertical: 4,
  },
  under18Notice: {
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.danger,
    borderRadius: radius.card,
    padding: space[3],
    gap: 4,
  },
  blockedTitle: {
    fontWeight: '600',
  },
  blockedBody: {
    lineHeight: 18,
  },
  errorText: {
    marginTop: 2,
  },
});
