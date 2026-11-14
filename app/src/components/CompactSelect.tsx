import { useTheme as useAppearance } from '@calipartner/ui/theme';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text, homeLayout, radius, space } from '@calipartner/ui';
import { t } from '@/i18n';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';

export interface CompactSelectOption<T extends string | number> {
  value: T;
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  description?: string;
}

/** One compact field, with labelled choices disclosed only when requested in a modal sheet. */
export function CompactSelect<T extends string | number>({
  label,
  options,
  selected,
  onSelect,
  testID,
  multiple = false,
  icon,
}: {
  label: string;
  options: CompactSelectOption<T>[];
  selected: T[];
  onSelect: (value: T) => void;
  testID: string;
  multiple?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  const { colors: dark } = useAppearance();
  const styles = createStyles(dark);

  const [open, setOpen] = useState(false);
  useBrowserModalBack(open, () => setOpen(false));

  const selectedOptions = options.filter((item) => selected.includes(item.value));
  const summary = selectedOptions.map((item) => item.label).join(', ');
  const activeIcon =
    selectedOptions.length === 1 && selectedOptions[0]?.icon ? selectedOptions[0].icon : icon;

  return (
    <View style={styles.container}>
      <Text variant="label" color={dark.textMid}>
        {label}
      </Text>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${summary || t('personalDay.choose')}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, { backgroundColor: pressed ? dark.s2 : dark.s1 }]}
      >
        <View style={styles.triggerLeft}>
          {activeIcon ? (
            <View style={styles.triggerIconBox}>
              <Ionicons name={activeIcon} size={18} color={dark.copper} />
            </View>
          ) : null}
          <Text
            variant="body"
            color={summary ? dark.textHi : dark.textLo}
            numberOfLines={1}
            style={styles.triggerText}
          >
            {summary || t('personalDay.choose')}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={dark.textMid} />
      </Pressable>

      {open && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setOpen(false)}
          testID={`${testID}-modal`}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={styles.scrim}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
              onPress={() => setOpen(false)}
            />
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  {icon ? (
                    <View style={styles.modalHeaderIconBox}>
                      <Ionicons name={icon} size={18} color={dark.copper} />
                    </View>
                  ) : null}
                  <Text variant="heading" color={dark.textHi}>
                    {label}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.cancel')}
                  style={styles.modalCloseBtn}
                  testID={`${testID}-close`}
                >
                  <Ionicons name="close" size={18} color={dark.textHi} />
                </Pressable>
              </View>

              <View style={styles.divider} />

              <ScrollView
                style={styles.optionsScroll}
                contentContainerStyle={styles.optionsList}
                keyboardShouldPersistTaps="handled"
              >
                {options.map((item) => {
                  const active = selected.includes(item.value);
                  return (
                    <Pressable
                      key={String(item.value)}
                      testID={`${testID}-${item.value}`}
                      accessibilityRole={multiple ? 'checkbox' : 'radio'}
                      accessibilityLabel={item.label}
                      accessibilityState={multiple ? { checked: active } : { selected: active }}
                      onPress={() => {
                        onSelect(item.value);
                        if (!multiple) setOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.optionRow,
                        active && styles.optionRowActive,
                        pressed && { backgroundColor: dark.s3 },
                      ]}
                    >
                      <View style={styles.optionLeft}>
                        {item.icon ? (
                          <View
                            style={[styles.optionIconBox, active && styles.optionIconBoxActive]}
                          >
                            <Ionicons
                              name={item.icon}
                              size={18}
                              color={active ? dark.copper : dark.textMid}
                            />
                          </View>
                        ) : null}
                        <View style={styles.optionTextCol}>
                          <Text
                            variant="body"
                            color={active ? dark.textHi : dark.textMid}
                            style={active ? styles.boldText : undefined}
                          >
                            {item.label}
                          </Text>
                          {item.description ? (
                            <Text variant="bodyS" color={dark.textLo}>
                              {item.description}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={20} color={dark.copper} />
                      ) : multiple ? (
                        <Ionicons name="square-outline" size={20} color={dark.textLo} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.modalFooter}>
                <Button
                  variant={multiple ? 'primary' : 'secondary'}
                  label={t('personalDay.done')}
                  onPress={() => setOpen(false)}
                  testID={`${testID}-done`}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const createStyles = (dark: ReturnType<typeof useAppearance>['colors']) =>
  StyleSheet.create({
    container: {
      gap: space[2],
    },
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: homeLayout.touchSize,
      paddingHorizontal: space[3],
      paddingVertical: space[2],
      borderWidth: 1,
      borderColor: dark.hairlineLit,
      borderRadius: radius.control,
    },
    triggerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
      gap: space[2],
    },
    triggerIconBox: {
      width: 28,
      height: 28,
      borderRadius: radius.control,
      backgroundColor: dark.s2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    triggerText: {
      flex: 1,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      padding: space[4],
    },
    scrim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
    },
    modalCard: {
      backgroundColor: dark.s1,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: dark.hairlineLit,
      maxHeight: 460,
      overflow: 'hidden',
      zIndex: 1,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space[4],
      paddingVertical: space[3],
    },
    modalTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[2],
      flex: 1,
      minWidth: 0,
    },
    modalHeaderIconBox: {
      width: 32,
      height: 32,
      borderRadius: radius.control,
      backgroundColor: dark.s2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: radius.full,
      backgroundColor: dark.s2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    divider: {
      height: 1,
      backgroundColor: dark.hairline,
    },
    optionsScroll: {
      maxHeight: 320,
    },
    optionsList: {
      padding: space[3],
      gap: space[2],
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: homeLayout.touchSize,
      paddingHorizontal: space[3],
      paddingVertical: space[2],
      backgroundColor: dark.s1,
      borderRadius: radius.control,
      borderWidth: 1,
      borderColor: dark.hairline,
      gap: space[3],
    },
    optionRowActive: {
      backgroundColor: dark.s2,
      borderColor: dark.hairlineLit,
    },
    optionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      flex: 1,
      minWidth: 0,
    },
    optionIconBox: {
      width: 32,
      height: 32,
      borderRadius: radius.control,
      backgroundColor: dark.s2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionIconBoxActive: {
      backgroundColor: dark.s3,
    },
    optionTextCol: {
      flex: 1,
      gap: 2,
    },
    boldText: {
      fontWeight: '600',
    },
    modalFooter: {
      padding: space[3],
      borderTopWidth: 1,
      borderTopColor: dark.hairline,
      backgroundColor: dark.s1,
    },
  });
