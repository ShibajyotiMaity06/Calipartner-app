import React from 'react';
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, dark, radius, space, Text } from '@calipartner/ui';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';

export interface SignOutSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirmSignOut: () => Promise<void> | void;
  onOpenDeleteAccount?: () => void;
  testID?: string;
}

export function SignOutSheet({
  visible,
  onClose,
  onConfirmSignOut,
  onOpenDeleteAccount,
  testID = 'sheet-sign-out-confirm',
}: SignOutSheetProps) {
  const handleSignOut = async () => {
    playClickSound();
    await onConfirmSignOut();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={styles.sheet}
          onPress={(e) => e.stopPropagation()}
          testID={testID}
          accessibilityRole="alert"
          accessibilityLabel={t('me.signOutSheet.title')}
        >
          <View style={styles.contentWrap}>
            <Text variant="title1" color={dark.textHi} style={styles.title}>
              {t('me.signOutSheet.title')}
            </Text>

            <Text variant="body" color={dark.textMid} style={styles.consequence}>
              {t('me.signOutSheet.consequence')}
            </Text>

            {/* Primary Cancel (Default focus per P05) */}
            <Button
              variant="secondary"
              label={t('me.signOutSheet.cancelBtn')}
              onPress={onClose}
              testID="btn-cancel-sign-out"
              style={styles.actionBtn}
            />

            {/* Destructive Sign Out */}
            <Button
              variant="destructive"
              label={t('me.signOutSheet.signOutBtn')}
              onPress={handleSignOut}
              testID="btn-confirm-sign-out"
              style={styles.actionBtn}
            />
          </View>
        </Pressable>
      </Pressable>
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
    backgroundColor: dark.s1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    borderColor: dark.hairline,
    padding: space[5],
    paddingBottom: space[7],
  },
  contentWrap: {
    alignItems: 'center',
  },
  title: {
    marginBottom: space[2],
    textAlign: 'center',
  },
  consequence: {
    marginBottom: space[5],
    textAlign: 'center',
    lineHeight: 22,
    color: dark.textMid,
  },
  actionBtn: {
    width: '100%',
    marginBottom: space[3],
  },
  deleteLinkWrap: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space[1],
  },
});
