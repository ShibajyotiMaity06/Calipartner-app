import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ActivitySource } from '@calipartner/core';
import { dark, radius, space, type as typeTokens } from '@calipartner/ui';
import { t } from '@/i18n';

export interface FixStepCountingModalProps {
  visible: boolean;
  currentSource: ActivitySource | null;
  lastSyncedText?: string;
  onClose: () => void;
  onSelectSource?: (source: ActivitySource) => void;
  testID?: string;
}

type OEMBrand = 'xiaomi' | 'vivo' | 'oppo' | 'samsung';

interface OEMTip {
  brand: OEMBrand;
  title: string;
  steps: string[];
}

const OEM_TIPS: OEMTip[] = [
  {
    brand: 'xiaomi',
    title: 'Xiaomi / Redmi / POCO (MIUI & HyperOS)',
    steps: [
      'Open Settings > Apps > Manage apps > CaliPartner.',
      'Turn ON "Autostart".',
      'Tap "Battery saver" and select "No restrictions".',
    ],
  },
  {
    brand: 'vivo',
    title: 'Vivo / iQOO (Funtouch OS)',
    steps: [
      'Open Settings > Battery > Background power consumption management.',
      'Locate CaliPartner and select "Allow high background power consumption".',
      'Lock the app in the recent apps tray.',
    ],
  },
  {
    brand: 'oppo',
    title: 'OPPO / Realme / OnePlus (ColorOS & OxygenOS)',
    steps: [
      'Open Settings > Apps > App management > CaliPartner > Battery usage.',
      'Enable "Allow background activity" and "Allow auto-launch".',
      'Disable battery optimization for CaliPartner in battery settings.',
    ],
  },
  {
    brand: 'samsung',
    title: 'Samsung Galaxy (One UI)',
    steps: [
      'Open Settings > Battery > Background usage limits.',
      'Tap "Never sleeping apps" and add CaliPartner.',
      'Ensure "Physical activity" permission is allowed all the time.',
    ],
  },
];

export function FixStepCountingModal({
  visible,
  currentSource,
  lastSyncedText = '2:14 pm',
  onClose,
  onSelectSource,
  testID = 'fix-step-counting-modal',
}: FixStepCountingModalProps) {
  const [selectedBrand, setSelectedBrand] = useState<OEMBrand>('xiaomi');
  const [checklist, setChecklist] = useState({
    autostart: true,
    battery: false,
    permissions: true,
  });

  if (!visible) return null;

  const currentTip = OEM_TIPS.find((tip) => tip.brand === selectedBrand) ?? OEM_TIPS[0]!;

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

        <View style={styles.sheet} testID="fix-step-sheet-container">
          <View style={styles.grabHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="construct-outline" size={20} color={dark.apricot} />
              </View>
              <View>
                <Text style={styles.title}>{t('trackers.steps.fixStepCounting')}</Text>
                <Text style={styles.lastSynced}>
                  {t('trackers.steps.lastSynced', { time: lastSyncedText })}
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
            {/* 1. Step Sources Selector */}
            <View style={styles.sectionCard} testID="step-sources-list">
              <Text style={styles.sectionTitle}>Step sources</Text>
              <Text style={styles.sectionSub}>
                Select where CaliPartner reads your physical activity.
              </Text>

              <View style={styles.sourcesList}>
                {/* Health Connect / Platform */}
                <Pressable
                  testID="source-option-health-platform"
                  style={[
                    styles.sourceRow,
                    currentSource === 'health_platform' && styles.sourceRowActive,
                  ]}
                  onPress={() => onSelectSource?.('health_platform')}
                  accessibilityRole="button"
                  accessibilityLabel="Health Connect or Apple Health"
                >
                  <View style={styles.sourceRowLeft}>
                    <Ionicons
                      name="heart-outline"
                      size={18}
                      color={currentSource === 'health_platform' ? dark.apricot : dark.textMid}
                    />
                    <View>
                      <Text style={styles.sourceName}>Health Connect / HealthKit</Text>
                      <Text style={styles.sourceDesc}>
                        Automatic background sync from platform health store
                      </Text>
                    </View>
                  </View>
                  {currentSource === 'health_platform' && (
                    <Ionicons name="checkmark-circle" size={18} color={dark.teal} />
                  )}
                </Pressable>

                {/* Phone Sensor (Pedometer) */}
                <Pressable
                  testID="source-option-pedometer"
                  style={[
                    styles.sourceRow,
                    currentSource === 'pedometer' && styles.sourceRowActive,
                  ]}
                  onPress={() => onSelectSource?.('pedometer')}
                  accessibilityRole="button"
                  accessibilityLabel="Phone sensor pedometer"
                >
                  <View style={styles.sourceRowLeft}>
                    <Ionicons
                      name="hardware-chip-outline"
                      size={18}
                      color={currentSource === 'pedometer' ? dark.apricot : dark.textMid}
                    />
                    <View>
                      <Text style={styles.sourceName}>Phone hardware sensor</Text>
                      <Text style={styles.sourceDesc}>
                        {t('trackers.steps.countingOnPhone')}
                      </Text>
                    </View>
                  </View>
                  {currentSource === 'pedometer' && (
                    <Ionicons name="checkmark-circle" size={18} color={dark.teal} />
                  )}
                </Pressable>

                {/* Manual */}
                <Pressable
                  testID="source-option-manual"
                  style={[
                    styles.sourceRow,
                    currentSource === 'manual' && styles.sourceRowActive,
                  ]}
                  onPress={() => onSelectSource?.('manual')}
                  accessibilityRole="button"
                  accessibilityLabel="Manual step entry"
                >
                  <View style={styles.sourceRowLeft}>
                    <Ionicons
                      name="create-outline"
                      size={18}
                      color={currentSource === 'manual' ? dark.apricot : dark.textMid}
                    />
                    <View>
                      <Text style={styles.sourceName}>Manual entry</Text>
                      <Text style={styles.sourceDesc}>
                        Log step counts directly each day
                      </Text>
                    </View>
                  </View>
                  {currentSource === 'manual' && (
                    <Ionicons name="checkmark-circle" size={18} color={dark.teal} />
                  )}
                </Pressable>
              </View>
            </View>

            {/* 2. Fix Step Counting Checklist */}
            <View style={styles.sectionCard} testID="step-troubleshooting-checklist">
              <Text style={styles.sectionTitle}>Troubleshooting checklist</Text>

              <Pressable
                style={styles.checkRow}
                onPress={() =>
                  setChecklist((prev) => ({ ...prev, autostart: !prev.autostart }))
                }
                accessibilityRole="checkbox"
                accessibilityState={{ checked: checklist.autostart }}
                accessibilityLabel="Allow CaliPartner to run in background"
              >
                <Ionicons
                  name={checklist.autostart ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={checklist.autostart ? dark.teal : dark.textLo}
                />
                <Text style={styles.checkLabel}>
                  Allow CaliPartner to run in the background
                </Text>
              </Pressable>

              <Pressable
                style={styles.checkRow}
                onPress={() =>
                  setChecklist((prev) => ({ ...prev, battery: !prev.battery }))
                }
                accessibilityRole="checkbox"
                accessibilityState={{ checked: checklist.battery }}
                accessibilityLabel="Disable aggressive battery saving"
              >
                <Ionicons
                  name={checklist.battery ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={checklist.battery ? dark.teal : dark.textLo}
                />
                <Text style={styles.checkLabel}>
                  Disable aggressive OS battery saving for this app
                </Text>
              </Pressable>

              <Pressable
                style={styles.checkRow}
                onPress={() =>
                  setChecklist((prev) => ({ ...prev, permissions: !prev.permissions }))
                }
                accessibilityRole="checkbox"
                accessibilityState={{ checked: checklist.permissions }}
                accessibilityLabel="Physical activity permission granted"
              >
                <Ionicons
                  name={checklist.permissions ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={checklist.permissions ? dark.teal : dark.textLo}
                />
                <Text style={styles.checkLabel}>
                  Physical activity permission granted in system settings
                </Text>
              </Pressable>
            </View>

            {/* 3. Android OEM Battery Optimization Guides */}
            <View style={styles.sectionCard} testID="oem-battery-guide">
              <Text style={styles.sectionTitle}>Device battery guides</Text>
              <Text style={styles.sectionSub}>
                Some phones stop background apps to save battery. Follow these steps:
              </Text>

              {/* Brand Selector Chips */}
              <View style={styles.brandChipsRow}>
                {OEM_TIPS.map((tip) => (
                  <Pressable
                    key={tip.brand}
                    testID={`btn-brand-${tip.brand}`}
                    style={[
                      styles.brandChip,
                      selectedBrand === tip.brand && styles.brandChipActive,
                    ]}
                    onPress={() => setSelectedBrand(tip.brand)}
                    accessibilityRole="button"
                    accessibilityLabel={tip.brand}
                  >
                    <Text
                      style={[
                        styles.brandChipText,
                        selectedBrand === tip.brand && styles.brandChipTextActive,
                      ]}
                    >
                      {tip.brand.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* OEM Steps Box */}
              <View style={styles.stepsBox}>
                <Text style={styles.oemTitle}>{currentTip.title}</Text>
                {currentTip.steps.map((st, idx) => (
                  <View key={idx} style={styles.stepItemRow}>
                    <View style={styles.stepNumberBadge}>
                      <Text style={styles.stepNumberText}>{idx + 1}</Text>
                    </View>
                    <Text style={styles.stepItemText}>{st}</Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Pinned Action */}
          <View style={styles.footer}>
            <Pressable
              testID="btn-fix-step-done"
              style={styles.doneBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.save')}
            >
              <Text style={styles.doneBtnText}>Done</Text>
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
    maxHeight: '90%',
    paddingBottom: space[4],
  },
  grabHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: dark.hairlineLit,
    alignSelf: 'center',
    marginVertical: space[2],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
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
  lastSynced: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  scrollArea: {
    paddingHorizontal: space[4],
  },
  scrollContent: {
    paddingVertical: space[3],
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
  sectionSub: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  sourcesList: {
    gap: space[2],
    marginTop: space[1],
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: dark.s3,
    padding: space[3],
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: dark.hairline,
    minHeight: 52,
  },
  sourceRowActive: {
    borderColor: dark.apricot,
  },
  sourceRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    flex: 1,
  },
  sourceName: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textHi,
    fontWeight: '600',
  },
  sourceDesc: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 44,
  },
  checkLabel: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textMid,
    flex: 1,
  },
  brandChipsRow: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[1],
    flexWrap: 'wrap',
  },
  brandChip: {
    paddingHorizontal: space[3],
    minHeight: 36,
    borderRadius: radius.full,
    backgroundColor: dark.s3,
    borderWidth: 1,
    borderColor: dark.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandChipActive: {
    backgroundColor: dark.apricot,
    borderColor: dark.apricot,
  },
  brandChipText: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textMid,
    fontWeight: '700',
  },
  brandChipTextActive: {
    color: dark.onBrand, // #1C1109
  },
  stepsBox: {
    backgroundColor: dark.s3,
    borderRadius: radius.control,
    padding: space[3],
    gap: space[2],
    marginTop: space[1],
  },
  oemTitle: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
    marginBottom: space[1],
  },
  stepItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
  },
  stepNumberBadge: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  stepItemText: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textMid,
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: space[4],
    paddingTop: space[3],
  },
  doneBtn: {
    minHeight: 48,
    borderRadius: radius.button,
    backgroundColor: dark.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.onBrand, // #1C1109
    fontWeight: '700',
  },
});
