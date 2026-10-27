import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dark, radius, space, type } from '@calipartner/ui';
import { t } from '@/i18n';

interface MondayRecapModalProps {
  visible: boolean;
  score?: number;
  scoreDiff?: number;
  loggedDays?: number;
  goalDays?: number;
  onClose: () => void;
  onSeeLeaderboard: () => void;
  testID?: string;
}

export function MondayRecapModal({
  visible,
  score = 84.5,
  scoreDiff = 4.2,
  loggedDays = 6,
  goalDays = 5,
  onClose,
  onSeeLeaderboard,
  testID = 'monday-recap-modal',
}: MondayRecapModalProps) {
  if (!visible) return null;

  const diffText =
    scoreDiff >= 0
      ? `+${scoreDiff.toFixed(1)} ${t('progress.recap.scoreChange', { diff: '' })}`
      : `${scoreDiff.toFixed(1)} ${t('progress.recap.scoreChange', { diff: '' })}`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close recap" />

        <View style={styles.sheet}>
          {/* Header pill handle */}
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.titleColumn}>
              <Text style={styles.title}>{t('progress.recap.title')}</Text>
              <Text style={styles.subtitle}>{t('progress.recap.subtitle')}</Text>
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

          {/* Large Score Card */}
          <View style={styles.scoreHero}>
            <Text style={styles.scoreNumeral} testID={`${testID}-score`}>
              {score.toFixed(1)}
            </Text>
            <Text style={styles.scoreCaption}>Weekly Consistency Score</Text>

            <View style={styles.diffPill}>
              <Ionicons
                name={scoreDiff >= 0 ? 'arrow-up' : 'arrow-down'}
                size={14}
                color={dark.apricot}
              />
              <Text style={styles.diffText}>{diffText}</Text>
            </View>
          </View>

          {/* Highlights Row */}
          <View style={styles.highlightCard}>
            <Ionicons name="information-circle-outline" size={20} color={dark.apricot} />
            <View style={styles.highlightContent}>
              <Text style={styles.highlightText}>{t('progress.recap.highlight')}</Text>
              <Text style={styles.statsDetail}>
                {loggedDays} of 7 days logged • {goalDays} of 7 days on goal
              </Text>
            </View>
          </View>

          {/* Tie breaker rule reminder */}
          <Text style={styles.tieBreakerText}>{t('progress.recap.tieBreaker')}</Text>

          {/* Pinned Action Button */}
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              onClose();
              onSeeLeaderboard();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('progress.recap.seeLeaderboard')}
            testID={`${testID}-see-leaderboard`}
          >
            <Text style={styles.primaryButtonText}>{t('progress.recap.seeLeaderboard')}</Text>
          </Pressable>
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
    marginBottom: space[4],
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
  scoreHero: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    paddingVertical: space[5],
    paddingHorizontal: space[4],
    marginBottom: space[4],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  scoreNumeral: {
    ...type.numeralXL,
    fontVariant: ['tabular-nums'] as any,
    color: dark.apricot,
  },
  scoreCaption: {
    ...type.label,
    color: dark.textMid,
    marginTop: space[1],
  },
  diffPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: dark.s3,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radius.full,
    marginTop: space[3],
  },
  diffText: {
    ...type.label,
    color: dark.textHi,
    fontVariant: ['tabular-nums'],
  },
  highlightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[3],
    marginBottom: space[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: dark.hairline,
  },
  highlightContent: {
    flex: 1,
  },
  highlightText: {
    ...type.bodyS,
    color: dark.textHi,
    fontWeight: '500',
    lineHeight: 20,
  },
  statsDetail: {
    ...type.label,
    color: dark.textLo,
    marginTop: 4,
  },
  tieBreakerText: {
    ...type.label,
    color: dark.textOff,
    textAlign: 'center',
    marginVertical: space[2],
    lineHeight: 18,
  },
  primaryButton: {
    height: 56,
    borderRadius: radius.button,
    backgroundColor: dark.apricot,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space[3],
  },
  primaryButtonText: {
    ...type.heading,
    color: dark.onBrand,
    fontWeight: '700',
  },
});
