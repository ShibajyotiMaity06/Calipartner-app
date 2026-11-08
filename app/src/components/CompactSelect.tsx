import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Button, Text, dark, homeLayout, radius, space } from '@calipartner/ui';
import { t } from '@/i18n';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';

/** One compact field, with labelled choices disclosed only when requested. */
export function CompactSelect<T extends string | number>({
  label,
  options,
  selected,
  onSelect,
  testID,
  multiple = false,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onSelect: (value: T) => void;
  testID: string;
  multiple?: boolean;
}) {
  const [open, setOpen] = useState(false);
  useBrowserModalBack(open, () => setOpen(false));
  const summary = options
    .filter((item) => selected.includes(item.value))
    .map((item) => item.label)
    .join(', ');
  const field = {
    minHeight: homeLayout.touchSize,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    borderRadius: radius.control,
  };
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="label">{label}</Text>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${summary || t('personalDay.choose')}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [field, { backgroundColor: pressed ? dark.s2 : dark.s1 }]}
      >
        <Text>{summary || t('personalDay.choose')} ▾</Text>
      </Pressable>
      {open && (
        <Modal visible transparent animationType="none" onRequestClose={() => setOpen(false)}>
          <SafeAreaView
            style={{
              flex: 1,
              justifyContent: 'center',
              padding: space[4],
              backgroundColor: dark.bg0,
            }}
          >
            <ScrollView
              contentContainerStyle={{ gap: space[2] }}
              keyboardShouldPersistTaps="handled"
            >
              <Text variant="heading">{label}</Text>
              {options.map((item) => {
                const active = selected.includes(item.value);
                return (
                  <Pressable
                    key={item.value}
                    testID={`${testID}-${item.value}`}
                    accessibilityRole={multiple ? 'checkbox' : 'radio'}
                    accessibilityLabel={item.label}
                    accessibilityState={multiple ? { checked: active } : { selected: active }}
                    onPress={() => {
                      onSelect(item.value);
                      if (!multiple) setOpen(false);
                    }}
                    style={({ pressed }) => [
                      field,
                      { backgroundColor: active || pressed ? dark.s3 : dark.s1 },
                    ]}
                  >
                    <Text>
                      {active ? '✓ ' : ''}
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
              <Button
                variant="secondary"
                label={t('personalDay.done')}
                onPress={() => setOpen(false)}
                testID={`${testID}-done`}
              />
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </View>
  );
}
