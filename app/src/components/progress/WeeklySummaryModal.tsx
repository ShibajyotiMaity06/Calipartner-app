import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dark, radius, space, type } from '@calipartner/ui';
import { t } from '@/i18n';

interface WeeklySummaryModalProps {
  visible: boolean;
  onClose: () => void;
  loggedDays?: number;
  goalDays?: number;
  totalDays?: number;
  weightChangeKg?: number | null;
  workoutCount?: number;
  avgSteps?: number;
  consistencyScore?: number;
  testID?: string;
}

export function WeeklySummaryModal({
  visible,
  onClose,
  loggedDays = 6,
  goalDays = 5,
  totalDays = 7,
  weightChangeKg = -0.3,
  workoutCount = 3,
  avgSteps = 8420,
  consistencyScore = 82,
  testID = 'weekly-summary-modal',
}: WeeklySummaryModalProps) {
  const [includeWeight, setIncludeWeight] = useState(false);

  if (!visible) return null;

  const summaryParagraph = `You logged ${loggedDays} of ${totalDays} days and stayed within your calorie target on ${goalDays}. Your 7-day weight trend moved by ${
    weightChangeKg != null
      ? weightChangeKg > 0
        ? `+${weightChangeKg.toFixed(1)} kg`
        : `${weightChangeKg.toFixed(1)} kg`
      : 'steady pace'
  }, and you completed ${workoutCount} workouts.`;

  const handleShare = async () => {
    try {
      const shareMessage = `CaliPartner Weekly Progress:
• Consistency: ${consistencyScore}/100
• Logged: ${loggedDays}/${totalDays} days (${goalDays} on goal)
• Avg Steps: ${avgSteps.toLocaleString()} steps/day
• Workouts: ${workoutCount} sessions${
        includeWeight && weightChangeKg != null
          ? `\n• Weight Change: ${weightChangeKg > 0 ? '+' : ''}${weightChangeKg.toFixed(1)} kg`
          : ''
      }`;
      await Share.share({ message: shareMessage });
    } catch {
      // User cancelled or share failed
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
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close summary" />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.titleColumn}>
              <Text style={styles.title}>Weekly summary</Text>
              <Text style={styles.subtitle}>Generated from your verified entries</Text>
            </View>
            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              testID={`${testID}-close`}
            >
              <Ionicons name="close" size={20} color={dark.textMid} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Auto-generated Paragraph (M09, PRG-11) */}
            <View style={styles.paragraphCard}>
              <Text style={styles.paragraphText} testID={`${testID}-paragraph`}>
                {summaryParagraph}
              </Text>
            </View>

            {/* Key Metrics Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Consistency</Text>
                <Text style={styles.statValue}>{consistencyScore}</Text>
                <Text style={styles.statUnit}>/ 100 points</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Daily Steps</Text>
                <Text style={styles.statValue}>{avgSteps.toLocaleString()}</Text>
                <Text style={styles.statUnit}>avg / day</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Workouts</Text>
                <Text style={styles.statValue}>{workoutCount}</Text>
                <Text style={styles.statUnit}>sessions</Text>
              </View>
            </View>

            {/* M10 Share Card Preview & Privacy Switch */}
            <View style={styles.shareCard}>
              <View style={styles.shareHeader}>
                <Text style={styles.shareTitle}>Share progress card</Text>
                <Text style={styles.sharePrivacyHint}>
                  {includeWeight ? 'Showing weight change' : 'Weight hidden for privacy'}
                </Text>
              </View>

              <View style={styles.previewBox}>
                <Text style={styles.previewLogo}>CaliPartner</Text>
                <Text style={styles.previewHeadline}>{consistencyScore}% consistent this week</Text>
                <Text style={styles.previewMeta}>
                  {loggedDays} of {totalDays} days logged • {workoutCount} workouts
                </Text>
                {includeWeight && weightChangeKg != null ? (
                  <Text style={styles.previewWeight}>
                    Weight trend: {weightChangeKg > 0 ? '+' : ''}
                    {weightChangeKg.toFixed(1)} kg
                  </Text>
                ) : null}
              </View>

              <View style={styles.privacyRow}>
                <View style={styles.privacyTextCol}>
                  <Text style={styles.privacyLabel}>Include weight change</Text>
                  <Text style={styles.privacySub}>
                    Off by default. Shows change, never raw weight.
                  </Text>
                </View>
                <Switch
                  value={includeWeight}
                  onValueChange={setIncludeWeight}
                  trackColor={{ false: dark.s3, true: dark.apricot }}
                  thumbColor={dark.onBrand}
                  testID={`${testID}-weight-toggle`}
                />
              </View>

              <Pressable
                style={styles.shareButton}
                onPress={handleShare}
                accessibilityRole="button"
                accessibilityLabel="Share progress card"
                testID={`${testID}-share-btn`}
              >
                <Ionicons name="share-outline" size={18} color={dark.onBrand} />
                <Text style={styles.shareButtonText}>Share card</Text>
              </Pressable>
            </View>
          </ScrollView>
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
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    maxHeight: '90%',
    backgroundColor: dark.s1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space[4],
    paddingTop: space[3],
    paddingBottom: space[6],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: dark.hairline,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: dark.hairlineLit,
    alignSelf: 'center',
    marginBottom: space[3],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: space[3],
  },
  titleColumn: {
    flex: 1,
    paddingRight: space[3],
  },
  title: {
    ...type.title1,
    color: dark.textHi,
  },
  subtitle: {
    ...type.bodyS,
    color: dark.textLo,
    marginTop: 2,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    backgroundColor: dark.s2,
  },
  scrollContent: {
    paddingBottom: space[4],
  },
  paragraphCard: {
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[4],
    marginBottom: space[4],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  paragraphText: {
    ...type.body,
    color: dark.textHi,
    lineHeight: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: space[2],
    marginBottom: space[4],
  },
  statCard: {
    flex: 1,
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: dark.hairline,
  },
  statLabel: {
    ...type.label,
    color: dark.textLo,
  },
  statValue: {
    ...type.numeralM,
    fontVariant: ['tabular-nums'] as any,
    color: dark.apricot,
    marginTop: 4,
  },
  statUnit: {
    ...type.label,
    color: dark.textMid,
    fontSize: 11,
    marginTop: 2,
  },
  shareCard: {
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[4],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  shareHeader: {
    marginBottom: space[3],
  },
  shareTitle: {
    ...type.heading,
    color: dark.textHi,
  },
  sharePrivacyHint: {
    ...type.label,
    color: dark.textLo,
    marginTop: 2,
  },
  previewBox: {
    backgroundColor: dark.s3,
    borderRadius: radius.control,
    padding: space[4],
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    marginBottom: space[3],
  },
  previewLogo: {
    ...type.label,
    color: dark.apricot,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  previewHeadline: {
    ...type.title2,
    color: dark.textHi,
    marginTop: space[2],
  },
  previewMeta: {
    ...type.bodyS,
    color: dark.textMid,
    marginTop: 4,
  },
  previewWeight: {
    ...type.bodyS,
    color: dark.apricot,
    marginTop: 4,
    fontWeight: '600',
  },
  privacyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space[2],
    marginBottom: space[3],
  },
  privacyTextCol: {
    flex: 1,
    paddingRight: space[3],
  },
  privacyLabel: {
    ...type.bodyS,
    color: dark.textHi,
    fontWeight: '500',
  },
  privacySub: {
    ...type.label,
    color: dark.textLo,
    marginTop: 2,
  },
  shareButton: {
    height: 48,
    borderRadius: radius.button,
    backgroundColor: dark.apricot,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  shareButtonText: {
    ...type.heading,
    color: dark.onBrand,
    fontWeight: '700',
  },
});
