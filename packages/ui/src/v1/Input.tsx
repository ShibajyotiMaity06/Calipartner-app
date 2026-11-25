/**
 * CaliPartner Design System v1 — Input Primitives
 * Single source of truth: docs/ui/DESIGN_SYSTEM_V1.md (Section 6.4)
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Text } from './Text';
import { borders, colors, fonts, radius, space } from './theme';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  fieldStyle?: StyleProp<ViewStyle>;
}

/** Standard Design System v1 Input: h 56, radius 18, s1 fill, 1 hairline, px 18. */
export function Input({
  label,
  error,
  leadingIcon,
  trailingIcon,
  containerStyle,
  fieldStyle,
  editable = true,
  onFocus,
  onBlur,
  testID,
  ...rest
}: InputProps): React.JSX.Element {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);
  const borderColor = hasError ? colors.danger : focused ? colors.hairlineLit : colors.hairline;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? (
        <Text variant="label" color={hasError ? 'danger' : 'textMid'} style={styles.label}>
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.field,
          {
            borderColor,
            opacity: editable ? 1 : 0.5,
          },
          fieldStyle,
        ]}
      >
        {leadingIcon ? <View style={styles.leading}>{leadingIcon}</View> : null}

        <TextInput
          editable={editable}
          placeholderTextColor={colors.textLo}
          selectionColor={colors.apricot}
          cursorColor={colors.apricot}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          testID={testID}
          style={[styles.input, { color: editable ? colors.textHi : colors.textOff }]}
          {...rest}
        />

        {trailingIcon ? <View style={styles.trailing}>{trailingIcon}</View> : null}
      </View>

      {error ? (
        <Text
          variant="meta"
          color="danger"
          accessibilityLiveRegion="polite"
          style={styles.errorText}
          testID={testID ? `${testID}-error` : undefined}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export interface BigNameFieldProps extends Omit<TextInputProps, 'style'> {
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

/** Big name field (onboarding): Fraunces 52, bottom border 1.5 hairlineLit only, apricot caret. */
export function BigNameField({
  error,
  containerStyle,
  testID,
  ...rest
}: BigNameFieldProps): React.JSX.Element {
  return (
    <View style={[styles.wrapper, containerStyle]}>
      <TextInput
        placeholderTextColor={colors.textOff}
        selectionColor={colors.apricot}
        cursorColor={colors.apricot}
        testID={testID}
        style={[
          styles.bigNameInput,
          {
            borderBottomColor: error ? colors.danger : colors.hairlineLit,
          },
        ]}
        {...rest}
      />
      {error ? (
        <Text
          variant="meta"
          color="danger"
          accessibilityLiveRegion="polite"
          style={styles.errorText}
          testID={testID ? `${testID}-error` : undefined}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  label: {
    marginBottom: space.sm,
  },
  field: {
    height: 56,
    minHeight: 56,
    borderRadius: radius.input,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    paddingHorizontal: space.optical18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  leading: {
    marginRight: space.md,
  },
  trailing: {
    marginLeft: space.md,
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 20,
    padding: 0,
  },
  errorText: {
    marginTop: space.sm,
    fontSize: 13,
  },
  bigNameInput: {
    fontFamily: fonts.display,
    fontSize: 52,
    lineHeight: 60,
    letterSpacing: -1.5,
    color: colors.textHi,
    borderBottomWidth: borders.selectedWidth,
    paddingVertical: space.sm,
    paddingHorizontal: 0,
  },
});
