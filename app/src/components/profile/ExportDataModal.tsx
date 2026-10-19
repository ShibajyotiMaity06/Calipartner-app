import React, { useState } from 'react';
import { View, StyleSheet, Modal, SafeAreaView, TouchableOpacity, Share } from 'react-native';
import { Text, Button, ChevronLeftIcon, space, dark, radius } from '@calipartner/ui';
import { playClickSound, playSuccessSound } from '@/lib/sound';

export interface ExportDataModalProps {
  visible: boolean;
  onClose: () => void;
  testID?: string;
}

export function ExportDataModal({
  visible,
  onClose,
  testID = 'export-data-modal',
}: ExportDataModalProps) {
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  const handleExport = async () => {
    playClickSound();
    setIsExporting(true);

    try {
      // Prepare sample export payload
      const dummyExport =
        format === 'csv'
          ? 'Date,Calories,Protein,Carbs,Fat,Steps,WaterMl\n2026-10-18,1850,140,180,55,8420,2500'
          : JSON.stringify(
              {
                version: '1.0',
                exportedAt: new Date().toISOString(),
                diary: [{ date: '2026-10-18', calories: 1850, steps: 8420 }],
              },
              null,
              2,
            );

      setIsExporting(false);
      setExportComplete(true);
      playSuccessSound();

      await Share.share({
        message: dummyExport,
        title: `CaliPartner_Data_Export.${format}`,
      });
    } catch {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      testID={testID}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.backButton}
              testID="btn-export-back"
            >
              <ChevronLeftIcon size={20} color={dark.textHi} />
              <Text variant="body" color={dark.textHi}>
                Back
              </Text>
            </TouchableOpacity>
            <Text variant="heading" color={dark.textHi} style={styles.topTitle}>
              Export My Data
            </Text>
            <View style={styles.spacer} />
          </View>

          {/* Content */}
          <View style={styles.content}>
            <View style={styles.header}>
              <Text variant="title1" color={dark.textHi} style={styles.title} testID="export-title">
                Export your diary & logs
              </Text>
              <Text variant="body" color={dark.textMid} style={styles.subtitle}>
                Download a complete, offline copy of all your food logs, step history, weight
                records, and workouts.
              </Text>
            </View>

            {/* Format Chooser (Spec B09: CSV or JSON) */}
            <View style={styles.formatSection}>
              <Text variant="label" color={dark.textLo} style={styles.formatLabel}>
                Choose export format
              </Text>

              <TouchableOpacity
                onPress={() => setFormat('csv')}
                style={[styles.formatCard, format === 'csv' && styles.formatCardSelected]}
                testID="btn-format-csv"
              >
                <View style={styles.formatCardContent}>
                  <Text variant="body" color={dark.textHi} style={styles.formatTitle}>
                    Spreadsheet (CSV)
                  </Text>
                  <Text variant="label" color={dark.textMid}>
                    Best for Excel, Google Sheets, or Apple Numbers
                  </Text>
                </View>
                <View
                  style={[styles.radioIndicator, format === 'csv' && styles.radioIndicatorActive]}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setFormat('json')}
                style={[styles.formatCard, format === 'json' && styles.formatCardSelected]}
                testID="btn-format-json"
              >
                <View style={styles.formatCardContent}>
                  <Text variant="body" color={dark.textHi} style={styles.formatTitle}>
                    Raw Data (JSON)
                  </Text>
                  <Text variant="label" color={dark.textMid}>
                    Full machine-readable export of all records
                  </Text>
                </View>
                <View
                  style={[styles.radioIndicator, format === 'json' && styles.radioIndicatorActive]}
                />
              </TouchableOpacity>
            </View>

            {exportComplete && (
              <View style={styles.completeBox} testID="export-success-box">
                <Text variant="bodyS" color={dark.textHi}>
                  Export ready and shared.
                </Text>
              </View>
            )}
          </View>

          {/* Primary Action Button */}
          <View style={styles.footer}>
            <Button
              variant="primary"
              size="lg"
              label={isExporting ? 'Preparing export…' : 'Prepare export'}
              onPress={handleExport}
              loading={isExporting}
              disabled={isExporting}
              testID="btn-prepare-export"
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: dark.bg0,
  },
  container: {
    flex: 1,
    paddingHorizontal: space[4],
    justifyContent: 'space-between',
    paddingBottom: space[4],
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingTop: space[1],
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    minWidth: 44,
    minHeight: 44,
  },
  topTitle: {
    fontWeight: '600',
  },
  spacer: {
    width: 60,
  },
  content: {
    flex: 1,
    gap: space[4],
    paddingTop: space[2],
  },
  header: {
    gap: space[1],
  },
  title: {
    letterSpacing: -0.4,
  },
  subtitle: {
    lineHeight: 20,
  },
  formatSection: {
    gap: space[2],
  },
  formatLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  formatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.card,
    padding: space[4],
  },
  formatCardSelected: {
    borderColor: dark.apricot,
    backgroundColor: dark.s2,
  },
  formatCardContent: {
    gap: 4,
    flex: 1,
  },
  formatTitle: {
    fontWeight: '600',
  },
  radioIndicator: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: dark.hairlineLit,
  },
  radioIndicatorActive: {
    borderColor: dark.apricot,
    backgroundColor: dark.apricot,
  },
  completeBox: {
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    borderRadius: radius.control,
    padding: space[3],
  },
  footer: {
    paddingTop: space[2],
  },
});
