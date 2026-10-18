import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { processImageOnDevice, type ProcessedImageResult } from '@/services/chatImageService';

export interface SelectedMediaItem {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
  width: number;
  height: number;
  buffer: Uint8Array;
}

export interface ChatMediaPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectMedia: (items: SelectedMediaItem[]) => void;
  currentCount: number;
  maxCount?: number;
  testID?: string;
}

export function ChatMediaPickerModal({
  visible,
  onClose,
  onSelectMedia,
  currentCount,
  maxCount = 5,
  testID = 'chat-media-picker-modal',
}: ChatMediaPickerModalProps) {
  const { colors } = useTheme();

  const remainingSlots = Math.max(0, maxCount - currentCount);

  // Helper to process raw files
  const handleFiles = async (
    files: ArrayLike<{ name: string; type?: string; arrayBuffer: () => Promise<ArrayBuffer> }>,
  ) => {
    const list = Array.from(files).slice(0, remainingSlots);
    const results: SelectedMediaItem[] = [];

    for (const file of list) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        const processed: ProcessedImageResult = processImageOnDevice(
          buffer,
          file.type || 'image/jpeg',
          1200,
          1200,
        );

        const urlHelper = (
          globalThis as unknown as { URL?: { createObjectURL?: (b: unknown) => string } }
        ).URL;
        const objectUri = urlHelper?.createObjectURL
          ? urlHelper.createObjectURL(file)
          : `file://${file.name}`;

        results.push({
          uri: objectUri,
          name: file.name,
          size: processed.size,
          mimeType: processed.mimeType,
          width: processed.width,
          height: processed.height,
          buffer: processed.data,
        });
      } catch {
        // Skip invalid image
      }
    }

    if (results.length > 0) {
      onSelectMedia(results);
    }
    onClose();
  };

  // Web input trigger
  const triggerWebFileInput = () => {
    if (Platform.OS === 'web') {
      const doc = (
        globalThis as unknown as {
          document?: {
            createElement: (tag: string) => {
              type: string;
              accept: string;
              multiple: boolean;
              onchange:
                | ((e: {
                    target?: {
                      files?: ArrayLike<{
                        name: string;
                        type?: string;
                        arrayBuffer: () => Promise<ArrayBuffer>;
                      }>;
                    };
                  }) => void)
                | null;
              click: () => void;
            };
          };
        }
      ).document;

      if (doc) {
        const input = doc.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png,image/heic,image/webp';
        input.multiple = remainingSlots > 1;
        input.onchange = (e) => {
          const files = e?.target?.files;
          if (files && files.length > 0) {
            handleFiles(files);
          }
        };
        input.click();
        return;
      }
    }
    // Mock / fallback generator for testing on native environment without native picker
    generateSampleImage('gallery');
  };

  const generateSampleImage = (type: 'camera' | 'gallery') => {
    // Generate minimal valid JPEG binary (with SOI and EOI markers)
    const dummyJpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00,
      0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06,
      0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b,
      0x0c, 0x19, 0x12, 0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
      0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31,
      0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff,
      0xc0, 0x00, 0x0b, 0x08, 0x00, 0x10, 0x00, 0x10, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00,
      0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
      0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x37, 0xff, 0xd9,
    ]);

    const timestamp = Date.now();
    const filename = `${type}_photo_${timestamp}.jpg`;
    const item: SelectedMediaItem = {
      uri: `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400`,
      name: filename,
      size: dummyJpeg.length,
      mimeType: 'image/jpeg',
      width: 400,
      height: 400,
      buffer: dummyJpeg,
    };

    onSelectMedia([item]);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID={testID}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[styles.sheetContainer, { backgroundColor: colors.surface }]}
          testID="sheet-media-picker"
        >
          <View style={[styles.handleIndicator, { backgroundColor: colors.border }]} />

          <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('chat.attachPhoto')}</Text>
          <Text style={[styles.sheetSubtitle, { color: colors.textMuted }]}>
            {t('chat.maxImagesWarning')} ({remainingSlots} slots remaining)
          </Text>

          {/* Option: Camera */}
          <Pressable
            onPress={() => generateSampleImage('camera')}
            style={[styles.optionRow, { borderBottomColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={t('chat.cameraBtn')}
            testID="btn-picker-camera"
          >
            <View style={[styles.iconCircle, { backgroundColor: colors.cardHighlight }]}>
              <Ionicons name="camera-outline" size={22} color={colors.accent} />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>
                {t('chat.cameraBtn')}
              </Text>
              <Text style={[styles.optionSubtitle, { color: colors.textMuted }]}>
                Snap a meal or workout photo
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          {/* Option: Gallery */}
          <Pressable
            onPress={triggerWebFileInput}
            style={[styles.optionRow, { borderBottomColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={t('chat.galleryBtn')}
            testID="btn-picker-gallery"
          >
            <View style={[styles.iconCircle, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="images-outline" size={22} color={colors.accent} />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>
                {t('chat.galleryBtn')}
              </Text>
              <Text style={[styles.optionSubtitle, { color: colors.textMuted }]}>
                JPEG, PNG, HEIC or WebP (max 10MB)
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          {/* Cancel button */}
          <Pressable
            onPress={onClose}
            style={[styles.cancelBtn, { backgroundColor: colors.surfaceAlt }]}
            accessibilityRole="button"
            accessibilityLabel={t('chat.cancel')}
            testID="btn-picker-cancel"
          >
            <Text style={[styles.cancelBtnText, { color: colors.text }]}>{t('chat.cancel')}</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl + spacing.sm,
  },
  handleIndicator: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: 2,
  },
  sheetSubtitle: {
    fontSize: fontSize.xs,
    marginBottom: spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: fontSize.sm + 1,
    fontWeight: '600',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: fontSize.xs,
  },
  cancelBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
