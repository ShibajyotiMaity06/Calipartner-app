import React, { useState } from 'react';
import { View, TextInput, StyleSheet, type TextInputProps, type ViewStyle } from 'react-native';
import { dark } from '../tokens/colors';
import { radius } from '../tokens/radius';
import { space } from '../tokens/space';
import { type as typeTokens } from '../tokens/type';
import { Text } from './Text';

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  unitSuffix?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: ViewStyle;
}

export function Field({
  label,
  error,
  unitSuffix,
  leadingIcon,
  trailingIcon,
  containerStyle,
  inputStyle,
  onFocus,
  onBlur,
  editable = true,
  testID,
  ...inputProps
}: FieldProps): React.JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const hasError = Boolean(error);

  const getBorderColor = (): string => {
    if (hasError) return dark.danger;
    if (isFocused) return dark.apricot;
    return dark.hairlineLit;
  };

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? (
        <Text variant="label" color={hasError ? dark.danger : dark.textMid} style={styles.label}>
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.fieldContainer,
          {
            backgroundColor: dark.s2,
            borderColor: getBorderColor(),
          },
          !editable && styles.disabled,
          inputStyle,
        ]}
      >
        {leadingIcon ? <View style={styles.leadingIconWrap}>{leadingIcon}</View> : null}

        <TextInput
          editable={editable}
          placeholderTextColor={dark.textLo}
          selectionColor={dark.apricot}
          style={[styles.input, { color: editable ? dark.textHi : dark.textOff }]}
          testID={testID}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...inputProps}
        />

        {unitSuffix ? (
          <View style={styles.unitChip}>
            <Text variant="label" color={dark.textMid}>
              {unitSuffix}
            </Text>
          </View>
        ) : null}

        {trailingIcon ? <View style={styles.trailingIconWrap}>{trailingIcon}</View> : null}
      </View>

      {error ? (
        <Text
          variant="bodyS"
          color={dark.danger}
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
    marginBottom: space[3], // 12
  },
  label: {
    marginBottom: space[1] + 2, // 6
  },
  fieldContainer: {
    height: 56,
    minHeight: 56,
    borderRadius: radius.control, // 12
    borderWidth: 1,
    paddingHorizontal: space[4], // 16
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: typeTokens.body.fontFamily,
    fontSize: typeTokens.body.fontSize,
    padding: 0,
    outlineStyle: 'none' as never,
  },
  leadingIconWrap: {
    marginRight: space[2], // 8
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailingIconWrap: {
    marginLeft: space[2], // 8
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitChip: {
    backgroundColor: dark.s3,
    paddingHorizontal: space[2] + 2, // 10
    paddingVertical: space[1], // 4
    borderRadius: radius.control - 4, // 8
    marginLeft: space[2], // 8
  },
  errorText: {
    marginTop: space[1], // 4
  },
  disabled: {
    opacity: 0.6,
  },
});
