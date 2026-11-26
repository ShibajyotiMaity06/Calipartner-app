import React from 'react';
import { Image, Modal, ScrollView, StyleSheet, View } from 'react-native';
import {
  CloseIcon,
  IconButton,
  Text,
  borders,
  colors,
  elevation,
  layout,
  radius,
  space,
} from '@calipartner/ui/v1';
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
  return (
    <Modal
      testID="modal-food-photo-analyzing"
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <ScrollView
          testID="card-food-photo-analyzing"
          accessibilityViewIsModal
          style={[styles.container, elevation.sheet]}
          contentContainerStyle={styles.content}
        >
          <View style={styles.topBar}>
            <Text variant="eyebrow" color="textLo">
              {t('captureV1.aiEstimateEyebrow')}
            </Text>
            {onCancel ? (
              <IconButton
                icon={<CloseIcon size={16} color={colors.textHi} />}
                size={36}
                inSheet
                onPress={onCancel}
                accessibilityLabel={t('common.cancel')}
                testID="btn-cancel-analyzing"
              />
            ) : null}
          </View>
          <View testID="food-photo-scan-preview" style={styles.preview}>
            <Image
              source={{ uri: imageUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              accessibilityLabel={t('foodLog.photo.cameraTitle')}
            />
            {visible ? <ScanSweep overlay /> : null}
          </View>
          <Text
            variant="titleM"
            color="textHi"
            accessibilityLiveRegion="polite"
            testID="text-analyzing-title"
          >
            {t('foodLog.photo.analyzingTitle')}
          </Text>
          <Text variant="body" color="textMid" testID="text-analyzing-subtitle">
            {t('foodLog.photo.analyzingSubtitle')}
          </Text>
          <Text variant="meta" color="textLo">
            {t('foodLog.photo.analyzingHint')}
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: layout.screenPaddingX,
  },
  container: {
    flexGrow: 0,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.s1,
    borderColor: colors.hairlineLit,
    borderWidth: borders.width,
    borderRadius: radius.sheet,
  },
  content: {
    padding: layout.sheetPaddingX,
    gap: space.md,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preview: {
    width: '100%',
    aspectRatio: 4 / 3,
    overflow: 'hidden',
    borderRadius: radius.card,
    backgroundColor: colors.bg0,
  },
});
