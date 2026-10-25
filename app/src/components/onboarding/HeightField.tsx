import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { cmToFtIn, ftInToCm } from '@calipartner/core';
import { Text, useTheme } from '@calipartner/ui';
import { t } from '@/i18n';
import { NumberField, planStyles } from './PlanPrimitives';

/** Unit choice affects presentation only; saved height always remains centimetres. */
export function HeightField({
  value,
  onChange,
}: {
  value: number;
  onChange: (cm: number) => void;
}) {
  const { colors } = useTheme();
  const [unit, setUnit] = useState('cm');
  const converted = cmToFtIn(Number.isFinite(value) && value > 0 ? value : 0);
  const [feet, setFeet] = useState<number | null>(converted.feet);
  const [inches, setInches] = useState<number | null>(converted.inches);
  const updateImperial = (ft: number | null, inch: number | null) => {
    setFeet(ft);
    setInches(inch);
    onChange(
      ft !== null &&
        inch !== null &&
        Number.isInteger(ft) &&
        Number.isFinite(inch) &&
        inch >= 0 &&
        inch < 12
        ? ftInToCm(ft, inch)
        : NaN,
    );
  };
  return (
    <View style={planStyles.gap}>
      <View style={planStyles.row} accessibilityRole="radiogroup" testID="height-unit">
        {(['cm', 'ft'] as const).map((next) => (
          <Pressable
            key={next}
            testID={`height-unit-${next}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: unit === next }}
            accessibilityLabel={t(next === 'cm' ? 'setup.heightCm' : 'setup.heightFeet')}
            style={[
              planStyles.unitOption,
              {
                backgroundColor: unit === next ? colors.cream : colors.s2,
                borderColor: colors.hairlineLit,
              },
            ]}
            onPress={() => {
              if (next === 'ft') {
                const converted = cmToFtIn(Number.isFinite(value) ? value : 0);
                setFeet(converted.feet);
                setInches(converted.inches);
              }
              setUnit(next);
            }}
          >
            <Text
              fontSet="onboarding"
              variant="bodyS"
              color={unit === next ? colors.onBrand : colors.textHi}
            >
              {t(next === 'cm' ? 'setup.heightCm' : 'setup.heightFeet')}
            </Text>
          </Pressable>
        ))}
      </View>
      {unit === 'cm' ? (
        <NumberField
          label={t('setup.height')}
          value={value}
          onChange={(next) => onChange(next ?? NaN)}
          testID="input-height"
        />
      ) : (
        <View style={planStyles.row}>
          <View style={planStyles.flex}>
            <NumberField
              label={t('setup.feet')}
              value={feet}
              onChange={(next) => updateImperial(next, inches)}
              testID="input-height-ft"
            />
          </View>
          <View style={planStyles.flex}>
            <NumberField
              label={t('setup.inches')}
              value={inches}
              onChange={(next) => updateImperial(feet, next)}
              testID="input-height-in"
            />
          </View>
        </View>
      )}
    </View>
  );
}
