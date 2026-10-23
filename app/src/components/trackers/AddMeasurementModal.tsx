import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dark, radius, space, type as typeTokens } from '@calipartner/ui';
import { t } from '@/i18n';

export interface AddMeasurementModalProps {
  visible: boolean;
  onClose: () => void;
  onSave?: (data: { location: string; value: number; unit: 'cm' | 'in'; date: string }) => void;
  testID?: string;
}

type MeasurementLocation = 'waist' | 'chest' | 'hips' | 'arms' | 'thighs' | 'neck';

const LOCATIONS: Array<{
  key: MeasurementLocation;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'waist', label: 'Waist', icon: 'body-outline' },
  { key: 'chest', label: 'Chest', icon: 'shirt-outline' },
  { key: 'hips', label: 'Hips', icon: 'walk-outline' },
  { key: 'arms', label: 'Arms', icon: 'barbell-outline' },
  { key: 'thighs', label: 'Thighs', icon: 'fitness-outline' },
  { key: 'neck', label: 'Neck', icon: 'ellipse-outline' },
];

export function AddMeasurementModal({
  visible,
  onClose,
  onSave,
  testID = 'add-measurement-modal',
}: AddMeasurementModalProps) {
  const [selectedLocation, setSelectedLocation] = useState<MeasurementLocation>('waist');
  const [valueText, setValueText] = useState('80');
  const [unit, setUnit] = useState<'cm' | 'in'>('cm');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]!);
  const [error, setError] = useState<string | null>(null);

  if (!visible) return null;

  const handleSave = () => {
    const parsed = parseFloat(valueText.trim());
    if (isNaN(parsed) || parsed <= 0 || parsed > 300) {
      setError('Please enter a valid measurement number.');
      return;
    }
    setError(null);
    onSave?.({
      location: selectedLocation,
      value: parsed,
      unit,
      date,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={t('common.cancel')}
        />

        <View style={styles.sheet} testID="add-measurement-sheet">
          <View style={styles.grabHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="ribbon-outline" size={20} color={dark.apricot} />
              </View>
              <View>
                <Text style={styles.title}>{t('trackers.weight.measurementsTitle')}</Text>
                <Text style={styles.privateBadge}>
                  <Ionicons name="lock-closed" size={11} color={dark.textLo} />
                  {' Only you can see these'}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Ionicons name="close" size={20} color={dark.textMid} />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            {/* Measurement location chips */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Measurement location</Text>
              <View style={styles.chipsRow}>
                {LOCATIONS.map((loc) => (
                  <Pressable
                    key={loc.key}
                    testID={`btn-meas-loc-${loc.key}`}
                    style={[styles.locChip, selectedLocation === loc.key && styles.locChipActive]}
                    onPress={() => setSelectedLocation(loc.key)}
                    accessibilityRole="button"
                    accessibilityLabel={loc.label}
                  >
                    <Ionicons
                      name={loc.icon}
                      size={15}
                      color={selectedLocation === loc.key ? dark.onBrand : dark.textMid}
                    />
                    <Text
                      style={[
                        styles.locChipText,
                        selectedLocation === loc.key && styles.locChipTextActive,
                      ]}
                    >
                      {loc.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Value & Unit Toggle */}
            <View style={styles.sectionCard}>
              <View style={styles.valueHeaderRow}>
                <Text style={styles.sectionTitle}>Value</Text>
                <View style={styles.unitToggle}>
                  <Pressable
                    testID="btn-meas-unit-cm"
                    style={[styles.unitToggleBtn, unit === 'cm' && styles.unitToggleBtnActive]}
                    onPress={() => setUnit('cm')}
                    accessibilityRole="button"
                    accessibilityLabel="Centimeters"
                  >
                    <Text
                      style={[styles.unitToggleText, unit === 'cm' && styles.unitToggleTextActive]}
                    >
                      cm
                    </Text>
                  </Pressable>
                  <Pressable
                    testID="btn-meas-unit-in"
                    style={[styles.unitToggleBtn, unit === 'in' && styles.unitToggleBtnActive]}
                    onPress={() => setUnit('in')}
                    accessibilityRole="button"
                    accessibilityLabel="Inches"
                  >
                    <Text
                      style={[styles.unitToggleText, unit === 'in' && styles.unitToggleTextActive]}
                    >
                      in
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.inputWrap}>
                <TextInput
                  testID="input-measurement-val"
                  style={styles.input}
                  value={valueText}
                  onChangeText={(val) => {
                    setValueText(val);
                    setError(null);
                  }}
                  keyboardType="numeric"
                  placeholder="e.g. 80"
                  placeholderTextColor={dark.textLo}
                  accessibilityLabel="Measurement value"
                />
                <Text style={styles.inputSuffix}>{unit}</Text>
              </View>
            </View>

            {/* Date field */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Date (YYYY-MM-DD)</Text>
              <TextInput
                testID="input-measurement-date"
                style={styles.dateInput}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={dark.textLo}
                accessibilityLabel="Measurement date"
              />
            </View>

            {/* Error Message */}
            {error && (
              <Text style={styles.errorText} testID="measurement-error">
                {error}
              </Text>
            )}

            {/* Privacy notice banner */}
            <View style={styles.privacyBanner}>
              <Ionicons name="shield-checkmark-outline" size={16} color={dark.teal} />
              <Text style={styles.privacyBannerText}>
                {t('trackers.weight.measurementsPrivateNotice')}
              </Text>
            </View>
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            <Pressable
              testID="btn-meas-cancel"
              style={styles.cancelBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </Pressable>

            <Pressable
              testID="btn-meas-save"
              style={styles.saveBtn}
              onPress={handleSave}
              accessibilityRole="button"
              accessibilityLabel={t('common.save')}
            >
              <Text style={styles.saveBtnText}>{t('common.save')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: dark.s1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    borderColor: dark.hairline,
    padding: space[4],
    gap: space[3],
    maxHeight: '90%',
  },
  grabHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: dark.hairlineLit,
    alignSelf: 'center',
    marginBottom: space[2],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  privateBadge: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    maxHeight: 400,
  },
  scrollContent: {
    gap: space[3],
  },
  sectionCard: {
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
    gap: space[2],
  },
  sectionTitle: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  locChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space[3],
    minHeight: 44,
    borderRadius: radius.control,
    backgroundColor: dark.s3,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  locChipActive: {
    backgroundColor: dark.apricot,
    borderColor: dark.apricot,
  },
  locChipText: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textMid,
    fontWeight: '600',
  },
  locChipTextActive: {
    color: dark.onBrand, // #1C1109
  },
  valueHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: dark.s3,
    borderRadius: radius.control,
    padding: 2,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  unitToggleBtn: {
    paddingHorizontal: space[3],
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.control - 2,
  },
  unitToggleBtnActive: {
    backgroundColor: dark.s2,
  },
  unitToggleText: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
    fontWeight: '700',
  },
  unitToggleTextActive: {
    color: dark.textHi,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.s3,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: dark.hairline,
    paddingHorizontal: space[3],
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.textHi,
    minHeight: 44,
  },
  inputSuffix: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textLo,
    fontWeight: '600',
  },
  dateInput: {
    backgroundColor: dark.s3,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: dark.hairline,
    paddingHorizontal: space[3],
    minHeight: 44,
    color: dark.textHi,
    fontSize: typeTokens.bodyS.fontSize,
  },
  errorText: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.danger,
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: dark.s2,
    padding: space[3],
    borderRadius: radius.control,
  },
  privacyBannerText: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[2],
  },
  cancelBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.button,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.textMid,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.button,
    backgroundColor: dark.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.onBrand, // #1C1109
    fontWeight: '700',
  },
});
