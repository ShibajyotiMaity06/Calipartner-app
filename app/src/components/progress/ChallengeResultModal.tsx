import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dark, radius, space, type } from '@calipartner/ui';
import { t } from '@/i18n';

interface ChallengeResultModalProps {
  visible: boolean;
  onClose: () => void;
  onShareToChat: () => void;
  onStartAnother: () => void;
  challengeTitle?: string;
  completedDays?: number;
  totalDays?: number;
  testID?: string;
}

export function ChallengeResultModal({
  visible,
  onClose,
  onShareToChat,
  onStartAnother,
  challengeTitle = 'Step Up Week',
  completedDays = 7,
  totalDays = 7,
  testID = 'challenge-result-modal',
}: ChallengeResultModalProps) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close result" />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>{t('progress.challenges.result.title')}</Text>
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

          {/* Cream check mark icon (No medals, no trophies) */}
          <View style={styles.resultHero}>
            <View style={styles.checkCircle}>
              <Ionicons name="checkmark" size={40} color={dark.cream} />
            </View>
            <Text style={styles.challengeTitle}>{challengeTitle}</Text>
            <Text style={styles.completionSubtitle}>
              {completedDays} of {totalDays} days completed
            </Text>
            <Text style={styles.plainSentence}>
              You stayed consistent all week with your partner.
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <Pressable
              style={styles.shareBtn}
              onPress={() => {
                onClose();
                onShareToChat();
              }}
              accessibilityRole="button"
              accessibilityLabel={t('progress.challenges.result.shareChat')}
              testID={`${testID}-share-chat-btn`}
            >
              <Ionicons name="chatbubble-outline" size={18} color={dark.textHi} />
              <Text style={styles.shareBtnText}>{t('progress.challenges.result.shareChat')}</Text>
            </Pressable>

            <Pressable
              style={styles.anotherBtn}
              onPress={() => {
                onClose();
                onStartAnother();
              }}
              accessibilityRole="button"
              accessibilityLabel={t('progress.challenges.result.startAnother')}
              testID={`${testID}-start-another-btn`}
            >
              <Text style={styles.anotherBtnText}>
                {t('progress.challenges.result.startAnother')}
              </Text>
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
  title: {
    ...type.title2,
    color: dark.textHi,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    backgroundColor: dark.s2,
  },
  resultHero: {
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
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: dark.s3,
    borderWidth: 2,
    borderColor: dark.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[3],
  },
  challengeTitle: {
    ...type.title1,
    color: dark.textHi,
    textAlign: 'center',
  },
  completionSubtitle: {
    ...type.numeralM,
    fontVariant: ['tabular-nums'] as any,
    color: dark.apricot,
    marginTop: space[1],
  },
  plainSentence: {
    ...type.body,
    color: dark.textMid,
    textAlign: 'center',
    marginTop: space[2],
    lineHeight: 22,
  },
  actionRow: {
    gap: space[2],
  },
  shareBtn: {
    height: 52,
    borderRadius: radius.button,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  shareBtnText: {
    ...type.heading,
    color: dark.textHi,
  },
  anotherBtn: {
    height: 56,
    borderRadius: radius.button,
    backgroundColor: dark.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anotherBtnText: {
    ...type.heading,
    color: dark.onBrand,
    fontWeight: '700',
  },
});
