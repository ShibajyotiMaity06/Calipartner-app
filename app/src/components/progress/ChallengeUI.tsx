import { useTheme as useAppearance } from '@calipartner/ui/theme';
import { NavigationIcon } from '@calipartner/ui';
import { type as inputTypography } from '@calipartner/ui';
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  TextInput,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, dark, radius, space, type, challengeLayout, onboardingType } from '@calipartner/ui';
import { ct } from '@/i18n/challenges';
export const createCs = (dark: ReturnType<typeof useAppearance>['colors']) =>
  StyleSheet.create({
    root: { gap: space[5] },
    sharePreview: { width: '100%', aspectRatio: 1 },
    home: {
      gap: space[5],
      paddingHorizontal: space[5],
      paddingTop: space[5],
      paddingBottom: space[9],
    },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[3] },
    between: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space[3],
    },
    card: {
      backgroundColor: dark.s1,
      borderColor: dark.hairline,
      borderWidth: challengeLayout.stroke,
      borderRadius: radius.card,
      padding: space[5],
      gap: space[3],
    },
    title: {
      ...type.title1,
      fontFamily: onboardingType.title1.fontFamily,
      color: dark.textHi,
      maxWidth: '100%',
      flexShrink: 1,
    },
    heading: { ...type.heading, fontFamily: onboardingType.heading.fontFamily, color: dark.textHi },
    body: {
      ...type.body,
      fontFamily: onboardingType.body.fontFamily,
      color: dark.textMid,
      fontVariant: [...type.numeralM.fontVariant],
    },
    small: {
      ...type.label,
      fontFamily: onboardingType.label.fontFamily,
      color: dark.textMid,
      fontVariant: [...type.numeralM.fontVariant],
    },
    number: {
      ...type.numeralM,
      fontFamily: onboardingType.numeralM.fontFamily,
      fontVariant: [...type.numeralM.fontVariant],
      color: dark.textHi,
    },
    error: { ...type.bodyS, fontFamily: onboardingType.bodyS.fontFamily, color: dark.danger },
    button: {
      maxWidth: '100%',
      minHeight: challengeLayout.touch,
      minWidth: challengeLayout.touch,
      borderRadius: radius.control,
      paddingHorizontal: space[4],
      paddingVertical: space[3],
      backgroundColor: dark.s2,
      borderWidth: challengeLayout.stroke,
      borderColor: dark.hairline,
      justifyContent: 'center',
      alignItems: 'center',
    },
    brand: { backgroundColor: dark.apricot, borderColor: dark.apricot },
    buttonText: { ...type.bodyS, fontFamily: onboardingType.bodyS.fontFamily, color: dark.textHi },
    brandText: { color: dark.onBrand },
    muted: { opacity: 0.5 },
    selected: { borderColor: dark.iris, backgroundColor: dark.s3 },
    sheet: { flex: 1, backgroundColor: dark.bg0 },
    sheetContent: {
      flexGrow: 1,
      padding: space[5],
      gap: space[5],
      paddingBottom: space[8],
      width: '100%',
      maxWidth: challengeLayout.contentMax,
      alignSelf: 'center',
    },
    input: {
      ...type.body,
      fontFamily: onboardingType.body.fontFamily,
      color: dark.textHi,
      minHeight: challengeLayout.touch,
      borderWidth: challengeLayout.stroke,
      borderColor: dark.hairline,
      borderRadius: radius.control,
      padding: space[3],
    },
  });
export const cs = createCs(dark);
export function useCs() {
  const { colors } = useAppearance();
  return createCs(colors);
}

export function CButton({
  label,
  onPress,
  brand = false,
  disabled = false,
  selected = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  brand?: boolean;
  disabled?: boolean;
  selected?: boolean;
  testID: string;
}) {
  const { colors: dark } = useAppearance();
  const cs = createCs(dark);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={[cs.button, brand && cs.brand, selected && cs.selected, disabled && cs.muted]}
    >
      {/^(back|close)$/i.test(label) ? (
        <NavigationIcon action={label.toLowerCase() === 'back' ? 'back' : 'close'} />
      ) : (
        <Text style={[cs.buttonText, brand && cs.brandText]}>{label}</Text>
      )}
    </Pressable>
  );
}
export function CInput({
  label,
  testID,
  ...props
}: TextInputProps & { label: string; testID: string }) {
  const { colors: dark } = useAppearance();
  const cs = createCs(dark);

  return (
    <View style={cs.root}>
      <Text style={cs.small}>{label}</Text>
      <TextInput
        {...props}
        style={[cs.input, { fontFamily: inputTypography.body.fontFamily }]}
        accessibilityLabel={label}
        testID={testID}
        placeholderTextColor={dark.textLo}
      />
    </View>
  );
}
export function CSheet({
  visible,
  title,
  onClose,
  children,
  testID,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  testID: string;
}) {
  const { colors: dark } = useAppearance();
  const cs = createCs(dark);

  return (
    <Modal
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={cs.sheet} testID={testID}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={cs.sheetContent}>
          <View style={cs.between}>
            <Text style={cs.title} accessibilityRole="header">
              {title}
            </Text>
            <CButton label={ct('close')} onPress={onClose} testID={`${testID}-close`} />
          </View>
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
