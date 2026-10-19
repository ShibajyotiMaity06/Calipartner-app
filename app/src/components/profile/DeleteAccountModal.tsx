import React, { useState } from 'react';
import { View, StyleSheet, Modal, SafeAreaView, TextInput, TouchableOpacity } from 'react-native';
import { Text, Button, ChevronLeftIcon, space, dark, radius } from '@calipartner/ui';
import { playClickSound } from '@/lib/sound';

export interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirmDelete: () => Promise<void>;
  testID?: string;
}

export function DeleteAccountModal({
  visible,
  onClose,
  onConfirmDelete,
  testID = 'delete-account-modal',
}: DeleteAccountModalProps) {
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canConfirm = deleteInput.trim().toUpperCase() === 'DELETE';

  const handleDelete = async () => {
    if (!canConfirm) return;
    playClickSound();
    setIsDeleting(true);
    setErrorMsg(null);
    try {
      await onConfirmDelete();
      setIsDeleting(false);
      setIsComplete(true);
    } catch (e: unknown) {
      setIsDeleting(false);
      setErrorMsg(e instanceof Error ? e.message : 'Failed to delete account');
    }
  };

  const handleFinish = () => {
    setIsComplete(false);
    setDeleteInput('');
    onClose();
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
            {!isComplete && (
              <TouchableOpacity
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={styles.backButton}
                testID="btn-delete-cancel"
              >
                <ChevronLeftIcon size={20} color={dark.textHi} />
                <Text variant="body" color={dark.textHi}>
                  Cancel
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* STEP B08: Deletion Complete */}
          {isComplete ? (
            <View style={styles.completeView} testID="deletion-complete-view">
              <Text variant="title1" color={dark.textHi} style={styles.title}>
                Your data has been removed.
              </Text>
              <Text variant="body" color={dark.textMid} style={styles.subtitle}>
                Your account, rooms, and local database records have been deleted.
              </Text>
              <View style={styles.completeButtonWrapper}>
                <Button
                  variant="primary"
                  size="lg"
                  label="Done"
                  onPress={handleFinish}
                  testID="btn-deletion-complete-done"
                />
              </View>
            </View>
          ) : (
            /* STEP B07: Delete Account Warning & Confirm */
            <View style={styles.content}>
              <View style={styles.header}>
                <Text
                  variant="title1"
                  color={dark.textHi}
                  style={styles.title}
                  testID="delete-account-title"
                >
                  Delete your account
                </Text>
                <Text variant="body" color={dark.textMid} style={styles.subtitle}>
                  This action is permanent and cannot be undone.
                </Text>
              </View>

              {/* Warning Card */}
              <View style={styles.warningCard} testID="delete-warning-card">
                <Text variant="body" color={dark.danger} style={styles.warningTitle}>
                  What will be deleted:
                </Text>
                <Text variant="bodyS" color={dark.textMid} style={styles.bulletPoint}>
                  • All food, workout, step, and fasting history
                </Text>
                <Text variant="bodyS" color={dark.textMid} style={styles.bulletPoint}>
                  • Your room memberships and shared partner streaks
                </Text>
                <Text variant="bodyS" color={dark.textMid} style={styles.bulletPoint}>
                  • Your profile and reserved @username
                </Text>

                <View style={styles.storeNoticeBox}>
                  <Text variant="label" color={dark.textLo} style={styles.storeNotice}>
                    Active store subscription: Google Play or Apple App Store subscriptions must be
                    cancelled in your phone store settings to stop recurring billing.
                  </Text>
                </View>
              </View>

              {/* Type DELETE Input */}
              <View style={styles.inputSection}>
                <Text variant="label" color={dark.textLo} style={styles.inputLabel}>
                  Type DELETE to confirm:
                </Text>
                <TextInput
                  testID="input-confirm-delete"
                  style={styles.textInput}
                  placeholder="DELETE"
                  placeholderTextColor={dark.textOff}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  value={deleteInput}
                  onChangeText={setDeleteInput}
                />
              </View>

              {errorMsg && (
                <Text variant="label" color={dark.danger}>
                  {errorMsg}
                </Text>
              )}

              {/* Destructive Delete Button */}
              <Button
                variant="destructive"
                size="lg"
                label={isDeleting ? 'Deleting account…' : 'Permanently delete account'}
                onPress={handleDelete}
                disabled={!canConfirm || isDeleting}
                loading={isDeleting}
                testID="btn-confirm-delete-account"
              />
            </View>
          )}
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
  content: {
    flex: 1,
    gap: space[4],
    justifyContent: 'space-between',
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
  warningCard: {
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[2],
  },
  warningTitle: {
    fontWeight: '600',
  },
  bulletPoint: {
    lineHeight: 18,
  },
  storeNoticeBox: {
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    padding: space[2],
    marginTop: space[1],
  },
  storeNotice: {
    lineHeight: 18,
  },
  inputSection: {
    gap: space[2],
  },
  inputLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  textInput: {
    height: 48,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: dark.hairline,
    backgroundColor: dark.s2,
    color: dark.textHi,
    paddingHorizontal: space[3],
    fontSize: 16,
    fontWeight: '600',
  },
  completeView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
  },
  completeButtonWrapper: {
    width: '100%',
    marginTop: space[6],
  },
});
