import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, PairRing, dark, radius, space, type } from '@calipartner/ui';
import { t } from '@/i18n';

export interface ChallengeDetailData {
  id: string;
  title: string;
  activity: string;
  icon: keyof typeof Ionicons.glyphMap;
  currentDay: number;
  totalDays: number;
  startDate: string;
  endDate: string;
  todaysTask: string;
  userProgressPct: number;
  partnerProgressPct: number;
  partnerNickname?: string;
  feed: { id: string; user: string; text: string; timeAgo: string }[];
}

interface ChallengeDetailModalProps {
  visible: boolean;
  challenge: ChallengeDetailData | null;
  onClose: () => void;
  onLeave: (challengeId: string) => void;
  testID?: string;
}

export function ChallengeDetailModal({
  visible,
  challenge,
  onClose,
  onLeave,
  testID = 'challenge-detail-modal',
}: ChallengeDetailModalProps) {
  if (!visible || !challenge) return null;

  const handleConfirmLeave = () => {
    Alert.alert(
      t('progress.challenges.leaveConfirmTitle'),
      t('progress.challenges.leaveConfirmMessage'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: t('progress.challenges.leaveChallenge'),
          style: 'destructive',
          onPress: () => {
            onLeave(challenge.id);
            onClose();
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} testID={testID}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close challenge detail" />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name={challenge.icon} size={22} color={dark.apricot} />
              </View>
              <View>
                <Text style={styles.title}>{challenge.title}</Text>
                <Text style={styles.subtitle}>
                  Day {challenge.currentDay} of {challenge.totalDays} · {challenge.startDate} - {challenge.endDate}
                </Text>
              </View>
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

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Paired or Group Progress: PairRing for two people */}
            <View style={styles.progressHero}>
              <PairRing
                userPercent={challenge.userProgressPct}
                partnerPercent={challenge.partnerProgressPct}
                size={120}
                userHue="iris"
                partnerHue="teal"
              />
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: dark.iris }]} />
                  <Text style={styles.legendText}>You ({Math.round(challenge.userProgressPct)}%)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: dark.teal }]} />
                  <Text style={styles.legendText}>
                    {challenge.partnerNickname ?? 'Partner'} ({Math.round(challenge.partnerProgressPct)}%)
                  </Text>
                </View>
              </View>
            </View>

            {/* Today's Task Card */}
            <View style={styles.taskCard}>
              <View style={styles.taskHeader}>
                <Ionicons name="checkbox-outline" size={20} color={dark.apricot} />
                <Text style={styles.taskTitle}>Today's Target</Text>
              </View>
              <Text style={styles.taskDetail}>{challenge.todaysTask}</Text>
            </View>

            {/* Activity Feed Section */}
            <View style={styles.feedSection}>
              <Text style={styles.sectionTitle}>Challenge Activity</Text>
              {challenge.feed.map((item) => (
                <View key={item.id} style={styles.feedRow}>
                  <Avatar name={item.user} size="sm" identityHue={item.user === 'You' ? 'iris' : 'teal'} />
                  <View style={styles.feedContent}>
                    <Text style={styles.feedUser}>{item.user}</Text>
                    <Text style={styles.feedText}>{item.text}</Text>
                  </View>
                  <Text style={styles.feedTime}>{item.timeAgo}</Text>
                </View>
              ))}
            </View>

            {/* Scoring Rule Footer Reminder */}
            <View style={styles.ruleCard}>
              <Ionicons name="information-circle-outline" size={16} color={dark.textLo} />
              <Text style={styles.ruleText}>{t('progress.challenges.scoringRule')}</Text>
            </View>

            {/* Leave Challenge Button */}
            <Pressable
              style={styles.leaveButton}
              onPress={handleConfirmLeave}
              accessibilityRole="button"
              accessibilityLabel={t('progress.challenges.leaveChallenge')}
              testID={`${testID}-leave-btn`}
            >
              <Text style={styles.leaveButtonText}>{t('progress.challenges.leaveChallenge')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
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
    alignItems: 'center',
    marginBottom: space[3],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    flex: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.control,
    backgroundColor: dark.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...type.title2,
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
  progressHero: {
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[4],
    alignItems: 'center',
    marginBottom: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  legendRow: {
    flexDirection: 'row',
    gap: space[4],
    marginTop: space[3],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  legendText: {
    ...type.label,
    color: dark.textMid,
  },
  taskCard: {
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[4],
    marginBottom: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginBottom: space[1],
  },
  taskTitle: {
    ...type.heading,
    color: dark.textHi,
  },
  taskDetail: {
    ...type.body,
    color: dark.apricot,
    fontWeight: '600',
  },
  feedSection: {
    marginBottom: space[3],
  },
  sectionTitle: {
    ...type.label,
    color: dark.textLo,
    marginBottom: space[2],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.hairline,
  },
  feedContent: {
    flex: 1,
  },
  feedUser: {
    ...type.label,
    color: dark.textHi,
    fontWeight: '600',
  },
  feedText: {
    ...type.bodyS,
    color: dark.textMid,
  },
  feedTime: {
    ...type.label,
    color: dark.textLo,
    fontSize: 11,
  },
  ruleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    padding: space[3],
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    marginVertical: space[3],
  },
  ruleText: {
    ...type.label,
    color: dark.textLo,
    flex: 1,
  },
  leaveButton: {
    height: 48,
    borderRadius: radius.button,
    backgroundColor: dark.s2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  leaveButtonText: {
    ...type.label,
    color: dark.danger,
    fontWeight: '600',
  },
});
