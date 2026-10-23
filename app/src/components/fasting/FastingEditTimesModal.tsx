import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FastingSession } from '@calipartner/core';
import { dark, radius, space, type as typeTokens } from '@calipartner/ui';
import { t } from '@/i18n';

export interface FastingEditTimesModalProps {
  visible: boolean;
  session: FastingSession | null;
  onSave: (params: { startAt: string; endAt?: string | null }) => Promise<void>;
  onClose: () => void;
  testID?: string;
}

export function FastingEditTimesModal({
  visible,
  session,
  onSave,
  onClose,
  testID = 'fasting-edit-times-modal',
}: FastingEditTimesModalProps) {
  const initialStartDate = session?.start_at ? new Date(session.start_at) : new Date();
  const initialEndDate = session?.end_at ? new Date(session.end_at) : null;

  const [dateStr, setDateStr] = useState(initialStartDate.toISOString().slice(0, 10));
  const [startHour, setStartHour] = useState(
    initialStartDate.getHours().toString().padStart(2, '0'),
  );
  const [startMinute, setStartMinute] = useState(
    initialStartDate.getMinutes().toString().padStart(2, '0'),
  );

  const [hasEndTime, setHasEndTime] = useState(Boolean(initialEndDate));
  const [endHour, setEndHour] = useState(
    initialEndDate ? initialEndDate.getHours().toString().padStart(2, '0') : '12',
  );
  const [endMinute, setEndMinute] = useState(
    initialEndDate ? initialEndDate.getMinutes().toString().padStart(2, '0') : '00',
  );

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible && session) {
      const sDate = new Date(session.start_at);
      setDateStr(sDate.toISOString().slice(0, 10));
      setStartHour(sDate.getHours().toString().padStart(2, '0'));
      setStartMinute(sDate.getMinutes().toString().padStart(2, '0'));

      if (session.end_at) {
        const eDate = new Date(session.end_at);
        setHasEndTime(true);
        setEndHour(eDate.getHours().toString().padStart(2, '0'));
        setEndMinute(eDate.getMinutes().toString().padStart(2, '0'));
      } else {
        setHasEndTime(false);
      }
      setErrorMsg(null);
    }
  }, [visible, session]);

  if (!visible) return null;

  const handleSave = async () => {
    try {
      setSaving(true);
      setErrorMsg(null);

      const parsedStartH = parseInt(startHour, 10);
      const parsedStartM = parseInt(startMinute, 10);
      if (
        isNaN(parsedStartH) ||
        parsedStartH < 0 ||
        parsedStartH > 23 ||
        isNaN(parsedStartM) ||
        parsedStartM < 0 ||
        parsedStartM > 59
      ) {
        setErrorMsg('Please enter a valid start time (00:00 to 23:59).');
        setSaving(false);
        return;
      }

      const startDateTime = new Date(`${dateStr}T00:00:00.000Z`);
      startDateTime.setUTCHours(parsedStartH, parsedStartM, 0, 0);

      let endIso: string | null = null;
      if (hasEndTime) {
        const parsedEndH = parseInt(endHour, 10);
        const parsedEndM = parseInt(endMinute, 10);
        if (
          isNaN(parsedEndH) ||
          parsedEndH < 0 ||
          parsedEndH > 23 ||
          isNaN(parsedEndM) ||
          parsedEndM < 0 ||
          parsedEndM > 59
        ) {
          setErrorMsg('Please enter a valid end time (00:00 to 23:59).');
          setSaving(false);
          return;
        }

        const endDateTime = new Date(`${dateStr}T00:00:00.000Z`);
        endDateTime.setUTCHours(parsedEndH, parsedEndM, 0, 0);
        if (endDateTime.getTime() <= startDateTime.getTime()) {
          endDateTime.setDate(endDateTime.getDate() + 1);
        }
        endIso = endDateTime.toISOString();
      }

      await onSave({
        startAt: startDateTime.toISOString(),
        endAt: endIso,
      });

      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Failed to save fast times.');
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
              <Text style={styles.title} testID="edit-times-title">
                {t('fasting.editTimes')}
              </Text>
              <Text style={styles.subtitle}>Back-dating allowed. Timers use UTC.</Text>
            </View>
            <Pressable
              testID="button-close-edit-times"
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={dark.textMid} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.form}>
            {errorMsg && (
              <View style={styles.errorBox} testID="edit-times-error">
                <Ionicons name="alert-circle-outline" size={16} color={dark.danger} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {/* Date Row */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
              <TextInput
                testID="input-fast-date"
                style={styles.input}
                value={dateStr}
                onChangeText={setDateStr}
                placeholder="2026-10-19"
                placeholderTextColor={dark.textLo}
                maxLength={10}
              />
            </View>

            {/* Start Time Group */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('fasting.startTime')} (24h format)</Text>
              <View style={styles.timeInputsRow}>
                <TextInput
                  testID="input-start-hour"
                  style={styles.timeInput}
                  value={startHour}
                  onChangeText={setStartHour}
                  placeholder="20"
                  placeholderTextColor={dark.textLo}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={styles.timeColon}>:</Text>
                <TextInput
                  testID="input-start-minute"
                  style={styles.timeInput}
                  value={startMinute}
                  onChangeText={setStartMinute}
                  placeholder="00"
                  placeholderTextColor={dark.textLo}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            </View>

            {/* End Time Toggle & Group */}
            <View style={styles.fieldGroup}>
              <View style={styles.toggleRow}>
                <Text style={styles.fieldLabel}>{t('fasting.endTime')} (24h format)</Text>
                <Pressable
                  testID="toggle-end-time"
                  onPress={() => setHasEndTime(!hasEndTime)}
                  style={styles.checkboxRow}
                >
                  <Ionicons
                    name={hasEndTime ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={hasEndTime ? dark.apricot : dark.textLo}
                  />
                  <Text style={styles.checkboxLabel}>Fast is ended</Text>
                </Pressable>
              </View>

              {hasEndTime && (
                <View style={styles.timeInputsRow}>
                  <TextInput
                    testID="input-end-hour"
                    style={styles.timeInput}
                    value={endHour}
                    onChangeText={setEndHour}
                    placeholder="12"
                    placeholderTextColor={dark.textLo}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={styles.timeColon}>:</Text>
                  <TextInput
                    testID="input-end-minute"
                    style={styles.timeInput}
                    value={endMinute}
                    onChangeText={setEndMinute}
                    placeholder="00"
                    placeholderTextColor={dark.textLo}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer Save Button */}
          <View style={styles.footer}>
            <Pressable
              testID="button-save-fast-times"
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.buttonPressed,
                saving && styles.buttonDisabled,
              ]}
              onPress={handleSave}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={t('fasting.saveTimes')}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving…' : t('fasting.saveTimes')}
              </Text>
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
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: space[4],
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
  form: {
    gap: space[4],
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
  fieldGroup: {
    gap: space[1],
  },
  fieldLabel: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textMid,
  },
  input: {
    height: 48,
    backgroundColor: dark.s1,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: dark.hairline,
    paddingHorizontal: space[3],
    color: dark.textHi,
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
  },
  timeInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  timeInput: {
    width: 72,
    height: 48,
    backgroundColor: dark.s1,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: dark.hairline,
    textAlign: 'center',
    color: dark.textHi,
    fontSize: typeTokens.title2.fontSize,
    fontFamily: typeTokens.title2.fontFamily,
  },
  timeColon: {
    fontSize: typeTokens.title2.fontSize,
    color: dark.textMid,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingVertical: 4,
  },
  checkboxLabel: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textMid,
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
