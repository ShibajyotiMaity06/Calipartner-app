import React from 'react';
import { View, StyleSheet, Modal, SafeAreaView, TouchableOpacity } from 'react-native';
import {
  Text,
  Button,
  Avatar,
  PairedCard,
  ChevronLeftIcon,
  space,
  dark,
  radius,
} from '@calipartner/ui';
import { playClickSound } from '@/lib/sound';

export interface InvitePreviewModalProps {
  visible: boolean;
  onClose: () => void;
  onJoin: () => void;
  inviterName?: string;
  streakDays?: number;
  isRoomFull?: boolean;
  isInvalidLink?: boolean;
  testID?: string;
}

export function InvitePreviewModal({
  visible,
  onClose,
  onJoin,
  inviterName = 'Rahul',
  streakDays = 14,
  isRoomFull = false,
  isInvalidLink = false,
  testID = 'invite-preview-modal',
}: InvitePreviewModalProps) {
  const handleJoin = () => {
    playClickSound();
    onJoin();
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
          {/* Top close button */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.backButton}
              testID="btn-invite-preview-back"
            >
              <ChevronLeftIcon size={20} color={dark.textHi} />
              <Text variant="body" color={dark.textHi}>
                Back
              </Text>
            </TouchableOpacity>
          </View>

          {/* Inviter Info Header (Spec A15) */}
          <View style={styles.header}>
            <Avatar name={inviterName} identityHue="teal" size="lg" testID="inviter-avatar" />
            <View style={styles.titleGroup}>
              <Text
                variant="title1"
                color={dark.textHi}
                style={styles.title}
                testID="inviter-heading"
              >
                {inviterName} is waiting for you.
              </Text>
              <Text variant="bodyS" color={dark.textMid} style={styles.streakLine}>
                Day {streakDays} streak together
              </Text>
            </View>
          </View>

          {/* Paired Card with empty half highlighted (Spec A15) */}
          <View style={styles.previewSection}>
            <PairedCard
              userName="You"
              userPercent={0}
              hasPartner={true}
              partnerName={inviterName}
              partnerHue="teal"
              partnerPercent={78}
              partnerSteps={7500}
              partnerMeals={{
                breakfast: { logged: true, name: 'Breakfast' },
                lunch: { logged: true, name: 'Lunch' },
                dinner: { logged: false },
                snacks: { logged: false },
              }}
              seamState="half-lit"
              finishedPerson="partner"
              streakDays={streakDays}
              testID="invite-paired-card-preview"
            />
          </View>

          {/* Error States or Action Area */}
          <View style={styles.bottomArea}>
            {isInvalidLink ? (
              <View style={styles.statusBox} testID="invite-invalid-box">
                <Text variant="body" color={dark.danger} style={styles.statusTitle}>
                  This invite isn&apos;t working.
                </Text>
                <Text variant="label" color={dark.textLo} style={styles.statusBody}>
                  Ask {inviterName} for a new invite link.
                </Text>
              </View>
            ) : isRoomFull ? (
              <View style={styles.statusBox} testID="room-full-box">
                <Text variant="body" color={dark.danger} style={styles.statusTitle}>
                  This room is full.
                </Text>
                <Text variant="label" color={dark.textLo} style={styles.statusBody}>
                  Ask {inviterName} to make space or join another room.
                </Text>
              </View>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  label={`Join ${inviterName}'s room`}
                  onPress={handleJoin}
                  testID="btn-join-room-invite"
                />

                <Text variant="label" color={dark.textLo} style={styles.freeNotice}>
                  Free to join. Your diary stays yours.
                </Text>
              </>
            )}
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
    minHeight: 44,
    justifyContent: 'center',
    paddingTop: space[1],
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    minWidth: 44,
    minHeight: 44,
  },
  header: {
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2],
  },
  titleGroup: {
    alignItems: 'center',
    gap: 4,
  },
  title: {
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  streakLine: {
    textAlign: 'center',
  },
  previewSection: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: space[2],
  },
  bottomArea: {
    gap: space[2],
    paddingTop: space[2],
  },
  freeNotice: {
    textAlign: 'center',
    lineHeight: 18,
  },
  statusBox: {
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    borderRadius: radius.card,
    padding: space[4],
    gap: 4,
    alignItems: 'center',
  },
  statusTitle: {
    fontWeight: '600',
    textAlign: 'center',
  },
  statusBody: {
    textAlign: 'center',
  },
});
