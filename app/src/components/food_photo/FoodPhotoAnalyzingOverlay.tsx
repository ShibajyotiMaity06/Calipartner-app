import React from 'react';
import { Image, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { controls, radius, space, Text, useTheme } from '@calipartner/ui';
import { ModalNavigation } from '@/components/ModalNavigation';
import { t } from '@/i18n';
import { ScanSweep } from './ScanSweep';

export interface FoodPhotoAnalyzingOverlayProps {
  visible: boolean;
  imageUri: string;
  onCancel?: () => void;
}

export function FoodPhotoAnalyzingOverlay({
  visible,
  imageUri,
  onCancel,
}: FoodPhotoAnalyzingOverlayProps) {
  const { colors } = useTheme();

  return (
    <Modal
      testID="modal-food-photo-analyzing"
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.modalScrim }]}>
        <ScrollView
          testID="card-food-photo-analyzing"
          accessibilityViewIsModal
          style={[styles.container, { backgroundColor: colors.s1, borderColor: colors.hairline }]}
          contentContainerStyle={styles.content}
        >
          <ModalNavigation onClose={onCancel} closeTestID="btn-cancel-analyzing" />
          <View testID="food-photo-scan-preview" style={styles.preview}>
            <Image
              source={{ uri: imageUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              accessibilityLabel={t('foodLog.photo.cameraTitle')}
            />
            {visible && <ScanSweep overlay />}
          </View>
          <Text variant="heading" accessibilityLiveRegion="polite" testID="text-analyzing-title">
            {t('foodLog.photo.analyzingTitle')}
          </Text>
          <Text variant="bodyS" testID="text-analyzing-subtitle">
            {t('foodLog.photo.analyzingSubtitle')}
          </Text>
          <Text variant="bodyS">{t('foodLog.photo.analyzingHint')}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space[4] },
  container: {
    flexGrow: 0,
    maxHeight: '90%',
    width: '100%',
    maxWidth: controls.dialogMaxWidth,
    borderRadius: radius.sheet,
    borderWidth: controls.border,
  },
  content: { padding: space[4], gap: space[3] },
  preview: { width: '100%', aspectRatio: 4 / 3, overflow: 'hidden', borderRadius: radius.card },
});
