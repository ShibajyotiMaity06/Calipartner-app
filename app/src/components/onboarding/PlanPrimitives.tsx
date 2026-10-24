import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import {
  CheckIcon,
  Text,
  onboardingLayout as layout,
  radius,
  space,
  onboardingType as typography,
  useTheme,
} from '@calipartner/ui';

export function PlanCard({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      style={[planStyles.card, { backgroundColor: colors.s1, borderColor: colors.hairline }]}
    >
      {children}
    </View>
  );
}

export function PlanTextField({ label, ...props }: TextInputProps & { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={planStyles.gap}>
      <Text fontSet="onboarding" variant="bodyS" color={colors.textMid}>
        {label}
      </Text>
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        placeholderTextColor={colors.textLo}
        selectionColor={colors.apricot}
        style={[
          planStyles.input,
          { color: colors.textHi, backgroundColor: colors.s2, borderColor: colors.hairlineLit },
        ]}
      />
    </View>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  testID,
  optional = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  testID: string;
  optional?: boolean;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState(value !== null && Number.isFinite(value) ? String(value) : '');
  useEffect(() => {
    if (value !== null && Number.isFinite(value))
      setText((previous) => (Number(previous) === value ? previous : String(value)));
    else if (value === null) setText('');
  }, [value]);
  return (
    <View style={planStyles.gap}>
      <Text fontSet="onboarding" variant="bodyS" color={colors.textMid} maxFontSizeMultiplier={2}>
        {label}
      </Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={text}
        keyboardType="decimal-pad"
        maxLength={10}
        placeholderTextColor={colors.textLo}
        selectionColor={colors.apricot}
        style={[
          planStyles.input,
          { color: colors.textHi, backgroundColor: colors.s2, borderColor: colors.hairlineLit },
        ]}
        onChangeText={(next) => {
          setText(next);
          const parsed = next.trim() && /^\d*\.?\d*$/.test(next) ? Number(next) : NaN;
          onChange(optional && !next.trim() ? null : parsed);
        }}
      />
    </View>
  );
}

export function PlanChoice({
  title,
  description,
  selected,
  disabled,
  onPress,
  testID,
}: {
  title: string;
  description?: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={[title, description].filter(Boolean).join('. ')}
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        planStyles.choice,
        {
          backgroundColor: selected || pressed ? colors.s2 : colors.s1,
          borderColor: selected ? colors.hairlineLit : colors.hairline,
          opacity: disabled ? 0.65 : 1,
        },
      ]}
    >
      <View style={planStyles.flex}>
        <Text
          fontSet="onboarding"
          variant="heading"
          color={colors.textHi}
          maxFontSizeMultiplier={2}
        >
          {title}
        </Text>
        {description ? (
          <Text
            fontSet="onboarding"
            variant="bodyS"
            color={colors.textMid}
            maxFontSizeMultiplier={2}
          >
            {description}
          </Text>
        ) : null}
      </View>
      <View
        style={[planStyles.radio, { borderColor: selected ? colors.textHi : colors.hairlineLit }]}
      >
        {selected ? <CheckIcon size={layout.icon} color={colors.textHi} /> : null}
      </View>
    </Pressable>
  );
}

export const planStyles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: layout.border, padding: space[4], gap: space[3] },
  gap: { gap: space[2] },
  section: { gap: space[4] },
  flex: { flex: 1, gap: space[2] },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[3] },
  input: {
    ...typography.heading,
    fontVariant: ['tabular-nums'],
    minHeight: layout.touch,
    padding: space[3],
    borderWidth: layout.border,
    borderRadius: radius.control,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: layout.touch,
    padding: space[4],
    borderWidth: layout.border,
    borderRadius: radius.card,
  },
  radio: {
    width: layout.touch,
    minHeight: layout.touch,
    borderWidth: layout.border,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: { minHeight: layout.touch, justifyContent: 'center', paddingVertical: space[3] },
  centered: { alignItems: 'center', gap: space[3] },
});
