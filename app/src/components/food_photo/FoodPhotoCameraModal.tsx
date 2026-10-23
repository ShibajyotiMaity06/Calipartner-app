import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface FoodPhotoCameraModalProps {
  visible: boolean;
  onClose: () => void;
  onPhotoCaptured: (photoPayload: { base64: string; mimeType: string }) => void;
  testMode?: boolean;
}

export function FoodPhotoCameraModal({
  visible,
  onClose,
  onPhotoCaptured,
  testMode = false,
}: FoodPhotoCameraModalProps) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [capturing, setCapturing] = useState(false);
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView | null>(null);

  // Auto-request permission when modal opens on device
  useEffect(() => {
    if (visible && !permission?.granted && Platform.OS !== 'web' && requestPermission) {
      void requestPermission();
    }
  }, [visible, permission?.granted, requestPermission]);

  const handleCapture = async () => {
    if (capturing) return;

    if (!cameraRef.current) {
      return;
    }

    try {
      setCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.95,
        skipProcessing: false,
      });

      if (photo?.base64) {
        setPreviewBase64(photo.base64);
        setPreviewUri(photo.uri);
      }
    } catch {
      // Capture error
    } finally {
      setCapturing(false);
    }
  };

  const handleConfirmPhoto = () => {
    if (previewBase64) {
      onPhotoCaptured({
        base64: previewBase64,
        mimeType: 'image/jpeg',
      });
      setPreviewBase64(null);
      setPreviewUri(null);
    }
  };

  const handleRetake = () => {
    setPreviewBase64(null);
    setPreviewUri(null);
  };

  const handleTriggerCameraOrUpload = async (mode: 'camera' | 'album' = 'camera') => {
    if (Platform.OS === 'web') {
      const g = globalThis as unknown as {
        document?: {
          getElementById: (id: string) => HTMLInputElement | null;
          createElement: (tag: string) => HTMLInputElement;
          body: { appendChild: (el: unknown) => void };
        };
        FileReader?: new () => {
          onload: (e: { target?: { result?: string } }) => void;
          readAsDataURL: (f: unknown) => void;
        };
      };
      if (g && g.document) {
        let input: any = g.document.getElementById('food-photo-web-input');
        if (!input) {
          input = g.document.createElement('input');
          input.id = 'food-photo-web-input';
          input.type = 'file';
          input.accept = 'image/*';
          input.style.display = 'none';
          g.document.body.appendChild(input);
        }
        input.value = '';
        if (mode === 'camera') {
          input.setAttribute('capture', 'environment');
          input.capture = 'environment';
        } else {
          input.removeAttribute('capture');
          delete input.capture;
        }

        input.onchange = (e: any) => {
          const target = e.target;
          const file = target?.files?.[0];
          if (file && g.FileReader) {
            const reader = new g.FileReader();
            reader.onload = (event: { target?: { result?: string } }) => {
              const dataUrl = event.target?.result;
              if (dataUrl) {
                const base64 = dataUrl.split(',')[1] || dataUrl;
                setPreviewBase64(base64);
                setPreviewUri(dataUrl);
              }
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
        return;
      }
    }

    if (requestPermission) {
      await requestPermission();
    }
  };

  return (
    <Modal
      testID="modal-food-photo-camera"
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.blackBackground}>
        {/* Permission Denied / Web Upload Screen */}
        {!permission?.granted && !testMode ? (
          <View style={styles.permissionContainer}>
            <View style={[styles.permissionIconWrap, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="camera-outline" size={44} color={colors.accent} />
            </View>
            <Text style={[styles.permissionTitle, { color: colors.text }]}>
              {t('foodLog.photo.cameraPermissionTitle')}
            </Text>
            <Text style={[styles.permissionBody, { color: colors.textMuted }]}>
              Camera access is required to take photos of your meals for instant AI nutrition
              analysis.
            </Text>

            <View
              style={[
                styles.permissionBtnRow,
                { flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320 },
              ]}
            >
              <Pressable
                testID="btn-grant-camera-permission"
                accessibilityRole="button"
                accessibilityLabel="Take Photo with Camera"
                onPress={() => handleTriggerCameraOrUpload('camera')}
                style={[styles.primaryBtn, { backgroundColor: colors.accent, width: '100%' }]}
              >
                <Ionicons
                  name="camera"
                  size={18}
                  color={colors.onAccent}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.primaryBtnText, { color: colors.onAccent }]}>
                  Take Photo with Camera
                </Text>
              </Pressable>

              <Pressable
                testID="btn-choose-from-gallery"
                accessibilityRole="button"
                accessibilityLabel="Choose from Photos"
                onPress={() => handleTriggerCameraOrUpload('album')}
                style={[
                  styles.primaryBtn,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: colors.border,
                    width: '100%',
                  },
                ]}
              >
                <Ionicons
                  name="images-outline"
                  size={18}
                  color={colors.text}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.primaryBtnText, { color: colors.text }]}>
                  Choose from Photos
                </Text>
              </Pressable>

              <Pressable
                testID="btn-close-camera-permission"
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
                onPress={onClose}
                style={[styles.cancelBtn, { alignSelf: 'center', marginTop: 4 }]}
              >
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                  {t('common.cancel')}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : previewBase64 ? (
          /* Preview State (Confirm / Retake) */
          <View testID="view-photo-preview" style={styles.previewContainer}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>{t('foodLog.photo.cameraTitle')}</Text>
              <Text style={styles.previewSub}>{t('foodLog.photo.subtitle')}</Text>
            </View>

            <View style={styles.previewFrame}>
              <Image
                source={{
                  uri:
                    previewUri ||
                    (previewBase64.startsWith('data:')
                      ? previewBase64
                      : `data:image/jpeg;base64,${previewBase64}`),
                }}
                style={{
                  width: '100%',
                  height: 320,
                  borderRadius: radius.md,
                }}
                resizeMode="cover"
              />
            </View>

            <View style={styles.previewActions}>
              <Pressable
                testID="btn-use-photo"
                accessibilityRole="button"
                accessibilityLabel={t('foodLog.photo.usePhoto')}
                onPress={handleConfirmPhoto}
                style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
              >
                <Ionicons name="sparkles" size={18} color={colors.onAccent} />
                <Text style={[styles.primaryBtnText, { color: colors.onAccent, marginLeft: 6 }]}>
                  {t('foodLog.photo.usePhoto')}
                </Text>
              </Pressable>

              <Pressable
                testID="btn-retake-photo"
                accessibilityRole="button"
                accessibilityLabel={t('foodLog.photo.retake')}
                onPress={handleRetake}
                style={[styles.secondaryBtn, { backgroundColor: colors.surfaceAlt }]}
              >
                <Ionicons name="refresh-outline" size={18} color={colors.text} />
                <Text style={[styles.secondaryBtnText, { color: colors.text, marginLeft: 6 }]}>
                  {t('foodLog.photo.retake')}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          /* Active Camera Screen */
          <View style={styles.cameraContainer}>
            <CameraView ref={cameraRef} facing={facing} style={StyleSheet.absoluteFill} />

            {/* Top Bar Controls */}
            <View style={styles.topBar}>
              <Pressable
                testID="btn-close-camera"
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
                onPress={onClose}
                style={styles.iconCircle}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </Pressable>

              <Text style={styles.topBarTitle}>{t('foodLog.photo.cameraTitle')}</Text>

              <Pressable
                testID="btn-flip-camera"
                accessibilityRole="button"
                accessibilityLabel="Flip camera"
                onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
                style={styles.iconCircle}
              >
                <Ionicons name="camera-reverse-outline" size={24} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* Meal Alignment Reticle Guide */}
            <View style={styles.reticleContainer}>
              <View style={styles.reticleFrame}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <Text style={styles.reticleText}>{t('foodLog.photo.cameraSubtitle')}</Text>
            </View>

            {/* Bottom Controls */}
            <View style={styles.bottomBar}>
              <View style={{ width: 60 }} />

              {/* Shutter Button */}
              <Pressable
                testID="btn-camera-shutter"
                accessibilityRole="button"
                accessibilityLabel={t('foodLog.photo.capture')}
                disabled={capturing}
                onPress={handleCapture}
                style={styles.shutterOuter}
              >
                <View style={styles.shutterInner}>
                  {capturing && <ActivityIndicator color="#000000" size="small" />}
                </View>
              </Pressable>

              <View style={{ width: 60 }} />
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  blackBackground: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0B0F19',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  permissionIconWrap: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
  },
  permissionBody: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 20,
  },
  permissionBtnRow: {
    width: '100%',
    maxWidth: 320,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cameraContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 54,
    zIndex: 10,
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  reticleFrame: {
    width: 260,
    height: 260,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#38BDF8',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 10,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 10,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 10,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 10,
  },
  reticleText: {
    color: '#FFFFFF',
    fontSize: fontSize.xs,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: 48,
  },
  sampleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  sampleChipText: {
    color: '#FFFFFF',
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#0B0F19',
    justifyContent: 'space-between',
    paddingTop: 54,
    paddingBottom: 48,
    paddingHorizontal: spacing.lg,
  },
  previewHeader: {
    alignItems: 'center',
    gap: 4,
  },
  previewTitle: {
    color: '#FFFFFF',
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  previewSub: {
    color: '#94A3B8',
    fontSize: fontSize.xs,
  },
  previewFrame: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.lg,
  },
  previewMockBox: {
    width: '100%',
    height: 280,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A364F',
  },
  previewActions: {
    gap: spacing.sm,
  },
  primaryBtn: {
    height: 48,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  secondaryBtn: {
    height: 46,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  cancelBtn: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
