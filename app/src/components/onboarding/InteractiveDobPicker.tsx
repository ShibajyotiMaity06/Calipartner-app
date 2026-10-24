import React, { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { calculateAge, isAtLeast18 } from '@calipartner/core';
import {
  Text,
  onboardingLayout as layout,
  radius,
  space,
  onboardingType as typography,
  useTheme,
} from '@calipartner/ui';
import { t } from '@/i18n';

export function InteractiveDobPicker({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (dob: string) => void;
  error?: string;
}) {
  const { colors } = useTheme();
  const parts = value.split('-');
  const [day, setDay] = useState(parts[2] ?? '');
  const [month, setMonth] = useState(parts[1] ?? '');
  const [year, setYear] = useState(parts[0] ?? '');
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);
  const emit = (d: string, m: string, y: string) => {
    const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const date = new Date(`${iso}T00:00:00Z`);
    const valid =
      y.length === 4 &&
      Boolean(d && m) &&
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === iso;
    onChange(valid ? iso : '');
  };
  const complete = year.length === 4 && Boolean(day && month);
  return (
    <View style={styles.section} testID="dob-picker-container">
      <View style={styles.row}>
        {(['day', 'month', 'year'] as const).map((part) => (
          <View key={part} style={styles.field}>
            <Text fontSet="onboarding" variant="bodyS" color={colors.textMid}>
              {t(`setup.${part}`)}
            </Text>
            <TextInput
              ref={part === 'month' ? monthRef : part === 'year' ? yearRef : undefined}
              value={part === 'day' ? day : part === 'month' ? month : year}
              keyboardType="number-pad"
              maxLength={part === 'year' ? 4 : 2}
              accessibilityLabel={t(`setup.${part}Label`)}
              placeholder={t(`setup.${part}Placeholder`)}
              placeholderTextColor={colors.textLo}
              testID={`input-dob-${part}`}
              style={[
                styles.input,
                {
                  backgroundColor: colors.s2,
                  borderColor: colors.hairlineLit,
                  color: colors.textHi,
                },
              ]}
              onChangeText={(text) => {
                const clean = text.replace(/[^0-9]/g, '');
                if (part === 'day') {
                  setDay(clean);
                  emit(clean, month, year);
                  if (clean.length === 2) monthRef.current?.focus();
                }
                if (part === 'month') {
                  setMonth(clean);
                  emit(day, clean, year);
                  if (clean.length === 2) yearRef.current?.focus();
                }
                if (part === 'year') {
                  setYear(clean);
                  emit(day, month, clean);
                }
              }}
            />
          </View>
        ))}
      </View>
      {value && isAtLeast18(value) ? (
        <Text fontSet="onboarding" variant="bodyS" tabular color={colors.textMid}>
          {t('setup.age', { age: calculateAge(value) })}
        </Text>
      ) : null}
      {complete && (!value || !isAtLeast18(value)) ? (
        <Text
          fontSet="onboarding"
          accessibilityRole="alert"
          color={colors.danger}
          testID="under-18-notice"
        >
          {t(value ? 'profileSetup.under18Error' : 'setup.invalidDate')}
        </Text>
      ) : null}
      {error ? (
        <Text fontSet="onboarding" color={colors.danger}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: space[3] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  field: { flexGrow: 1, flexBasis: layout.touch, gap: space[2] },
  input: {
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
    fontVariant: ['tabular-nums'],
    minHeight: layout.touch,
    padding: space[3],
    borderWidth: layout.border,
    borderRadius: radius.control,
  },
});
