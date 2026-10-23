import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FASTING_PROTOCOLS, type FastingProtocol } from '@calipartner/core';
import { dark, radius, space, type as typeTokens } from '@calipartner/ui';
import { t } from '@/i18n';

export interface FastingProtocolModalProps {
  visible: boolean;
  currentProtocol: FastingProtocol;
  currentCustomHours?: number | null;
  eatingWindowStart?: string;
  eatingWindowEnd?: string;
  onSelectProtocol: (
    protocol: FastingProtocol,
    customHours?: number,
    start?: string,
    end?: string,
  ) => Promise<void>;
  onClose: () => void;
  testID?: string;
}

const AVAILABLE_PROTOCOLS: FastingProtocol[] = ['12:12', '14:10', '16:8', '18:6', '20:4', 'custom'];

export function FastingProtocolModal({
  visible,
  currentProtocol,
  currentCustomHours = 16,
  eatingWindowStart = '12:00',
  eatingWindowEnd = '20:00',
  onSelectProtocol,
  onClose,
  testID = 'fasting-protocol-modal',
}: FastingProtocolModalProps) {
  const [selectedProtocol, setSelectedProtocol] = useState<FastingProtocol>(currentProtocol);
  const [customHours, setCustomHours] = useState<number>(currentCustomHours ?? 16);
  const [windowStart, setWindowStart] = useState<string>(eatingWindowStart);
  const [windowEnd, setWindowEnd] = useState<string>(eatingWindowEnd);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible) {
      setSelectedProtocol(currentProtocol);
      setCustomHours(currentCustomHours ?? 16);
      setWindowStart(eatingWindowStart);
      setWindowEnd(eatingWindowEnd);
      setErrorMsg(null);
    }
  }, [visible, currentProtocol, currentCustomHours, eatingWindowStart, eatingWindowEnd]);

  if (!visible) return null;

  const handleSave = async () => {
    try {
      setSaving(true);
      setErrorMsg(null);

      if (selectedProtocol === 'custom') {
        if (customHours < 1 || customHours > 20) {
          setErrorMsg('Custom fasts must be between 1 and 20 hours.');
          setSaving(false);
          return;
        }
      }

      await onSelectProtocol(
        selectedProtocol,
        selectedProtocol === 'custom' ? customHours : undefined,
        windowStart,
        windowEnd,
      );

      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Failed to update protocol.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID={`${testID}-content`}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title} testID="protocol-modal-title">
                {t('fasting.chooseProtocol')}
              </Text>
              <Text style={styles.subtitle}>
                Choose a sustainable daily eating and fasting schedule.
              </Text>
            </View>
            <Pressable
              testID="button-close-protocol-modal"
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={dark.textMid} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {errorMsg && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={dark.danger} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {/* Protocols List */}
            {AVAILABLE_PROTOCOLS.map((protoKey) => {
              const proto = FASTING_PROTOCOLS[protoKey];
              const isSelected = selectedProtocol === protoKey;

              return (
                <Pressable
                  key={protoKey}
                  testID={`protocol-option-${protoKey}`}
                  style={({ pressed }) => [
                    styles.protocolCard,
                    isSelected && styles.protocolCardSelected,
                    pressed && styles.protocolCardPressed,
                  ]}
                  onPress={() => setSelectedProtocol(protoKey)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={styles.protocolHeader}>
                    <View style={styles.protocolTitleRow}>
                      <Text style={[styles.protocolLabel, isSelected && styles.textApricot]}>
                        {proto.label}
                      </Text>
                      <View style={styles.badgeRow}>
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{proto.fastingHours}h fast</Text>
                        </View>
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{proto.eatingHours}h eat</Text>
                        </View>
                      </View>
                    </View>

                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={isSelected ? dark.apricot : dark.textLo}
                    />
                  </View>

                  <Text style={styles.protocolDesc}>{proto.description}</Text>

                  {/* Custom hours stepper */}
                  {protoKey === 'custom' && isSelected && (
                    <View style={styles.customStepperBox} testID="custom-hours-stepper">
                      <Text style={styles.customStepperLabel}>Custom Fast Duration</Text>
                      <View style={styles.stepperRow}>
                        <Pressable
                          testID="button-custom-hours-minus"
                          style={styles.stepperBtn}
                          onPress={() => setCustomHours(Math.max(1, customHours - 1))}
                          accessibilityRole="button"
                          accessibilityLabel="Decrease custom hours"
                        >
                          <Ionicons name="remove" size={18} color={dark.textHi} />
                        </Pressable>

                        <Text style={styles.stepperValue} testID="custom-hours-value">
                          {customHours} h
                        </Text>

                        <Pressable
                          testID="button-custom-hours-plus"
                          style={styles.stepperBtn}
                          onPress={() => setCustomHours(Math.min(20, customHours + 1))}
                          accessibilityRole="button"
                          accessibilityLabel="Increase custom hours"
                        >
                          <Ionicons name="add" size={18} color={dark.textHi} />
                        </Pressable>
                      </View>
                      <Text style={styles.stepperNotice}>
                        Maximum planned fast is 20 hours for health safety.
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}

            {/* Eating Window Times Section */}
            <View style={styles.windowSection}>
              <Text style={styles.windowSectionTitle}>Scheduled Daily Eating Window</Text>
              <Text style={styles.windowSectionSubtitle}>
                Reminders and scheduled mode use these times.
              </Text>

              <View style={styles.windowInputsRow}>
                <View style={styles.windowInputCol}>
                  <Text style={styles.inputLabel}>{t('fasting.startTime')}</Text>
                  <TextInput
                    testID="input-window-start"
                    style={styles.windowInput}
                    value={windowStart}
                    onChangeText={setWindowStart}
                    placeholder="12:00"
                    placeholderTextColor={dark.textLo}
                    maxLength={5}
                  />
                </View>

                <View style={styles.windowArrow}>
                  <Ionicons name="arrow-forward" size={18} color={dark.textLo} />
                </View>

                <View style={styles.windowInputCol}>
                  <Text style={styles.inputLabel}>{t('fasting.endTime')}</Text>
                  <TextInput
                    testID="input-window-end"
                    style={styles.windowInput}
                    value={windowEnd}
                    onChangeText={setWindowEnd}
                    placeholder="20:00"
                    placeholderTextColor={dark.textLo}
                    maxLength={5}
                  />
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable
              testID="button-save-protocol"
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.buttonPressed,
                saving && styles.buttonDisabled,
              ]}
              onPress={handleSave}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Save Protocol"
            >
              <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save Protocol'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: dark.s2,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: space[4],
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: space[3],
  },
  title: {
    fontSize: typeTokens.title2.fontSize,
    fontFamily: typeTokens.title2.fontFamily,
    color: dark.textHi,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textMid,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: dark.s1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    gap: space[2],
    paddingBottom: space[3],
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    padding: space[3],
    borderRadius: radius.control,
    gap: space[2],
  },
  errorText: {
    flex: 1,
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.danger,
  },
  protocolCard: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  protocolCardSelected: {
    borderColor: dark.apricot,
    backgroundColor: 'rgba(255, 179, 138, 0.05)',
  },
  protocolCardPressed: {
    opacity: 0.85,
  },
  protocolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  protocolTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  protocolLabel: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    fontWeight: '700',
    color: dark.textHi,
  },
  textApricot: {
    color: dark.apricot,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: space[1],
  },
  badge: {
    backgroundColor: dark.s2,
    paddingHorizontal: space[1],
    paddingVertical: 2,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textLo,
  },
  protocolDesc: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textMid,
    lineHeight: 18,
  },
  customStepperBox: {
    marginTop: space[2],
    paddingTop: space[2],
    borderTopWidth: 1,
    borderTopColor: dark.hairline,
  },
  customStepperLabel: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textMid,
    marginBottom: space[1],
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: dark.s2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  stepperValue: {
    fontSize: typeTokens.title2.fontSize,
    fontFamily: typeTokens.title2.fontFamily,
    color: dark.textHi,
    minWidth: 50,
    textAlign: 'center',
  },
  stepperNotice: {
    fontSize: 11,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textLo,
    marginTop: space[1],
  },
  windowSection: {
    marginTop: space[3],
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  windowSectionTitle: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    fontWeight: '700',
    color: dark.textHi,
    marginBottom: 2,
  },
  windowSectionSubtitle: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textMid,
    marginBottom: space[3],
  },
  windowInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  windowInputCol: {
    flex: 1,
  },
  inputLabel: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textLo,
    marginBottom: 2,
  },
  windowInput: {
    height: 44,
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: dark.hairline,
    paddingHorizontal: space[3],
    color: dark.textHi,
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    textAlign: 'center',
  },
  windowArrow: {
    paddingTop: 16,
  },
  footer: {
    marginTop: space[3],
    paddingTop: space[3],
    borderTopWidth: 1,
    borderTopColor: dark.hairline,
  },
  saveButton: {
    height: 48,
    backgroundColor: dark.apricot,
    borderRadius: radius.button,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    fontWeight: '700',
    color: dark.onBrand,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
