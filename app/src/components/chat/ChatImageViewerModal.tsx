import React, { useEffect, useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { dark, onboardingLayout as layout } from '@calipartner/ui';
import { ChatVideo } from './ChatVideo';
import { Ionicons } from '@expo/vector-icons';
import type { ChatAttachment } from '@/types/chat';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';

export interface ChatImageViewerModalProps {
  visible: boolean;
  attachment: ChatAttachment | null;
  onClose: () => void;
  testID?: string;
}

export function ChatImageViewerModal({
  visible,
  attachment,
  onClose,
  testID = 'chat-image-viewer-modal',
}: ChatImageViewerModalProps) {
  const [scale, setScale] = useState(1);
  const [openError, setOpenError] = useState(false);

  useEffect(() => {
    setScale(1);
    setOpenError(false);
  }, [attachment?.id]);
  if (!attachment) return null;

  const imageUri = attachment.signed_url || attachment.local_uri || '';

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.5, 1));
  };

  const handleSaveToGallery = async () => {
    setOpenError(false);
    try {
      await Linking.openURL(imageUri);
    } catch {
      setOpenError(true);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.darkBackdrop}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header Controls */}
          <View style={styles.headerRow}>
            <Pressable
              onPress={onClose}
              style={styles.circleBtn}
              accessibilityRole="button"
              accessibilityLabel={t('chat.closeViewer')}
              testID="btn-close-viewer"
            >
              <Ionicons name="close" size={24} color={dark.textHi} />
            </Pressable>

            {/* Zoom Controls */}
            {!attachment.mime_type.startsWith('video/') ? (
              <View style={styles.zoomControlsRow}>
                <Pressable
                  onPress={handleZoomOut}
                  disabled={scale <= 1}
                  style={[styles.zoomBtn, scale <= 1 && styles.btnDisabled]}
                  accessibilityRole="button"
                  accessibilityLabel="Zoom out"
                  testID="btn-zoom-out"
                >
                  <Ionicons name="remove" size={18} color={dark.textHi} />
                </Pressable>

                <Text style={styles.scaleText}>{Math.round(scale * 100)}%</Text>

                <Pressable
                  onPress={handleZoomIn}
                  disabled={scale >= 3}
                  style={[styles.zoomBtn, scale >= 3 && styles.btnDisabled]}
                  accessibilityRole="button"
                  accessibilityLabel="Zoom in"
                  testID="btn-zoom-in"
                >
                  <Ionicons name="add" size={18} color={dark.textHi} />
                </Pressable>
              </View>
            ) : null}

            {/* Save to Gallery Button */}
            <Pressable
              onPress={handleSaveToGallery}
              style={styles.circleBtn}
              accessibilityRole="button"
              accessibilityLabel={t('chatAudit.openMedia')}
              testID="btn-save-image"
            >
              <Ionicons name="open-outline" size={22} color={dark.textHi} />
            </Pressable>
          </View>

          {openError ? (
            <Text accessibilityRole="alert">{t('chatAudit.mediaUnavailable')}</Text>
          ) : null}

          {/* Image Canvas with Scroll Zoom */}
          <ScrollView
            contentContainerStyle={styles.imageScrollContent}
            maximumZoomScale={3}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            {imageUri && attachment.mime_type.startsWith('video/') ? (
              <ChatVideo uri={imageUri} />
            ) : imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={[
                  styles.fullImage,
                  {
                    transform: [{ scale }],
                  },
                ]}
                resizeMode="contain"
                accessibilityLabel="Full size chat image"
              />
            ) : (
              <View style={styles.noImageWrap}>
                <Ionicons name="image-outline" size={64} color={dark.textLo} />
              </View>
            )}
          </ScrollView>

          {/* Footer Metadata */}
          <View style={styles.footerInfoRow}>
            <Text style={styles.footerText}>
              {attachment.width && attachment.height
                ? `${attachment.width} × ${attachment.height} px`
                : ''}
              {attachment.size ? ` • ${(attachment.size / (1024 * 1024)).toFixed(1)} MB` : ''}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  darkBackdrop: {
    flex: 1,
    backgroundColor: dark.bg0,
  },
  safeArea: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    zIndex: 10,
  },
  circleBtn: {
    width: layout.touch,
    height: layout.touch,
    borderRadius: radius.pill,
    backgroundColor: dark.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.s2,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    gap: 8,
  },
  zoomBtn: {
    width: layout.touch,
    height: layout.touch,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  scaleText: {
    color: dark.textHi,
    fontSize: fontSize.xs,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'center',
  },
  toastNotice: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    backgroundColor: '#1E293B',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  toastText: {
    color: dark.textHi,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  imageScrollContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  noImageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerInfoRow: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  footerText: {
    color: dark.textMid,
    fontSize: fontSize.xs,
  },
});
