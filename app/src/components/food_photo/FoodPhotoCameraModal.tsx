import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CameraIcon,
  CheckIcon,
  CloseIcon,
  EditIcon,
  FeedImageIcon,
  FlashIcon,
  IconButton,
  PrimaryButton,
  SecondaryButton,
  Text,
  borders,
  colors,
  layout,
  radius,
  space,
} from '@calipartner/ui/v1';
import type { MealSection } from '@calipartner/core';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { t } from '@/i18n';

export interface FoodPhotoCameraModalProps {
  visible: boolean;
  onClose: () => void;
  onPhotoCaptured: (photoPayload: { base64: string; mimeType: string }) => void;
  onPhotoUri?: (uri: string | null) => void;
  testMode?: boolean;
  defaultSection?: MealSection;
  onSectionChange?: (section: MealSection) => void;
  onSwitchToBarcode?: () => void;
  onSwitchToDescribe?: () => void;
}

const SECTIONS: readonly MealSection[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export function FoodPhotoCameraModal({
  visible,
  onClose,
  onPhotoCaptured,
  onPhotoUri,
  testMode = false,
  defaultSection = 'dinner',
  onSectionChange,
  onSwitchToBarcode,
  onSwitchToDescribe,
}: FoodPhotoCameraModalProps) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flashOn, setFlashOn] = useState(false);
  const [scanMode, setScanMode] = useState<'food' | 'label'>('food');
  const [section, setSection] = useState<MealSection>(defaultSection);
  const [mealMenuOpen, setMealMenuOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const showPreparedPhoto = async (asset: { uri: string; width?: number; height?: number }) => {
    const size = Math.max(asset.width ?? 0, asset.height ?? 0);
    const resize =
      size > 1600
        ? [
            {
              resize:
                (asset.width ?? 0) >= (asset.height ?? 0) ? { width: 1600 } : { height: 1600 },
            },
          ]
        : [];
    const prepared = await ImageManipulator.manipulateAsync(asset.uri, resize, {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (!prepared.base64) throw new Error('PHOTO_ENCODING_FAILED');
    setPreviewBase64(prepared.base64);
    setPreviewUri(prepared.uri);
  };

  useEffect(() => {
    if (!visible) {
      setPreviewBase64(null);
      setPreviewUri(null);
      setCameraError(null);
      setCameraReady(false);
      setMealMenuOpen(false);
    } else {
      setSection(defaultSection);
    }
  }, [visible, defaultSection]);

  useEffect(() => {
    if (
      visible &&
      permission?.status === 'undetermined' &&
      Platform.OS !== 'web' &&
      requestPermission
    ) {
      void requestPermission().catch(() => setCameraError(t('capture.cameraError')));
    }
  }, [visible, permission?.status, requestPermission]);

  const handleCapture = async () => {
    if (capturing || !cameraRef.current) return;
    try {
      setCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.95,
        skipProcessing: false,
      });
      if (!photo?.uri) throw new Error('CAPTURE_FAILED');
      await showPreparedPhoto(photo);
    } catch {
      setCameraError(t('capture.cameraError'));
    } finally {
      setCapturing(false);
    }
  };

  const handleConfirmPhoto = () => {
    if (!previewBase64) return;
    const resolvedUri =
      previewUri ??
      (previewBase64.startsWith('data:')
        ? previewBase64
        : `data:image/jpeg;base64,${previewBase64}`);
    onPhotoUri?.(resolvedUri);
    onPhotoCaptured({
      base64: previewBase64,
      mimeType: 'image/jpeg',
    });
    setPreviewBase64(null);
    setPreviewUri(null);
  };

  const handleRetake = () => {
    setPreviewBase64(null);
    setPreviewUri(null);
    setCameraReady(false);
  };

  const back = () => {
    if (capturing) return;
    if (previewBase64) handleRetake();
    else onClose();
  };

  useBrowserModalBack(visible, onClose, {
    depth: Number(Boolean(previewBase64)),
    onDepthChange: back,
  });

  const handleTriggerCameraOrUpload = async (mode: 'camera' | 'album' = 'camera') => {
    setCameraError(null);
    if (mode === 'album') {
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });
        const asset = result.canceled ? undefined : result.assets?.[0];
        if (asset) await showPreparedPhoto(asset);
      } catch {
        setCameraError(t('capture.cameraError'));
      }
      return;
    }
    try {
      const result = await requestPermission();
      if (!result.granted) setCameraError(t('capture.cameraError'));
    } catch {
      setCameraError(t('capture.cameraError'));
    }
  };

  if (!visible) return null;

  const sectionLabel = t(`diary.sections.${section}` as Parameters<typeof t>[0]);

  return (
    <Modal
      testID="modal-food-photo-camera"
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={back}
    >
      <View style={styles.root}>
        {cameraError ? (
          <View style={[styles.errorBanner, { top: insets.top + space.xxxl }]}>
            <Text
              variant="meta"
              color="danger"
              accessibilityRole="alert"
              testID="food-camera-error"
            >
              {cameraError}
            </Text>
          </View>
        ) : null}

        {!permission?.granted && !testMode && !previewBase64 ? (
          <SafeAreaView style={styles.permissionScreen}>
            <View style={styles.permissionTopBar}>
              <IconButton
                icon={<CloseIcon size={18} color={colors.textHi} />}
                onPress={onClose}
                accessibilityLabel={t('common.cancel')}
                testID="btn-close-camera-permission"
              />
            </View>
            <ScrollView contentContainerStyle={styles.permissionContainer}>
              <View style={styles.permissionIconTile}>
                <CameraIcon size={34} color={colors.apricot} />
              </View>
              <Text variant="titleM" color="textHi" style={styles.centeredText}>
                {t('foodLog.photo.cameraPermissionTitle')}
              </Text>
              <Text variant="body" color="textMid" style={styles.centeredText}>
                {t('capture.cameraReason')}
              </Text>
              <View style={styles.permissionActions}>
                <PrimaryButton
                  title={t('capture.takePhoto')}
                  onPress={() => void handleTriggerCameraOrUpload('camera')}
                  testID="btn-grant-camera-permission"
                />
                <SecondaryButton
                  title={t('capture.choosePhoto')}
                  onPress={() => void handleTriggerCameraOrUpload('album')}
                  testID="btn-choose-from-gallery"
                />
              </View>
            </ScrollView>
          </SafeAreaView>
        ) : previewBase64 ? (
          <SafeAreaView testID="view-photo-preview" style={styles.previewContainer}>
            <View style={styles.previewTopBar}>
              <IconButton
                icon={<CloseIcon size={18} color={colors.textHi} />}
                onPress={handleRetake}
                accessibilityLabel={t('common.cancel')}
                testID="btn-close-photo-preview"
              />
              <Text variant="rowTitle" color="textHi">
                {t('foodLog.photo.cameraTitle')}
              </Text>
              <View style={styles.spacer44} />
            </View>
            <ScrollView contentContainerStyle={styles.previewContent}>
              <Text variant="meta" color="textLo" style={styles.centeredText}>
                {t('foodLog.photo.subtitle')}
              </Text>
              <View style={styles.previewFrame}>
                <Image
                  source={{
                    uri:
                      previewUri ||
                      (previewBase64.startsWith('data:')
                        ? previewBase64
                        : `data:image/jpeg;base64,${previewBase64}`),
                  }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.previewActions}>
                <PrimaryButton
                  title={t('foodLog.photo.usePhoto')}
                  onPress={handleConfirmPhoto}
                  testID="btn-use-photo"
                />
                <SecondaryButton
                  title={t('foodLog.photo.retake')}
                  onPress={handleRetake}
                  testID="btn-retake-photo"
                />
              </View>
            </ScrollView>
          </SafeAreaView>
        ) : (
          <View style={styles.cameraContainer}>
            <CameraView
              ref={cameraRef}
              facing={facing}
              enableTorch={flashOn}
              onCameraReady={() => setCameraReady(true)}
              onMountError={() => setCameraError(t('capture.cameraError'))}
              style={StyleSheet.absoluteFill}
            />

            {/* Soft dark ambient plate outline when idle / behind viewfinder */}
            <View pointerEvents="none" style={styles.plateBackdrop}>
              <View style={styles.plateOuterRing} />
            </View>

            {/* Top Overlay Controls */}
            <View style={[styles.topBar, { paddingTop: insets.top + layout.topContentOffset }]}>
              <IconButton
                icon={<CloseIcon size={18} color={colors.textHi} />}
                onPress={back}
                accessibilityLabel={t('common.cancel')}
                testID="btn-close-camera"
                style={styles.glassCircle}
              />

              <View style={styles.dropdownAnchor}>
                <Pressable
                  onPress={() => setMealMenuOpen((prev) => !prev)}
                  accessibilityRole="button"
                  accessibilityLabel={sectionLabel}
                  style={styles.sectionPill}
                  testID="camera-meal-section-picker"
                >
                  <Text variant="label" color="textHi">
                    {`${sectionLabel} ▾`}
                  </Text>
                </Pressable>

                {mealMenuOpen ? (
                  <View style={styles.dropdownMenu}>
                    {SECTIONS.map((sec, idx) => {
                      const active = sec === section;
                      return (
                        <Pressable
                          key={sec}
                          onPress={() => {
                            setSection(sec);
                            onSectionChange?.(sec);
                            setMealMenuOpen(false);
                          }}
                          style={[
                            styles.dropdownItem,
                            idx < SECTIONS.length - 1 ? styles.dropdownDivider : null,
                          ]}
                          testID={`camera-meal-option-${sec}`}
                        >
                          <Text variant="label" color={active ? 'apricot' : 'textHi'}>
                            {t(`diary.sections.${sec}` as Parameters<typeof t>[0])}
                          </Text>
                          {active ? <CheckIcon size={14} color={colors.apricot} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>

              <View style={styles.topRightPair}>
                <IconButton
                  icon={<FlashIcon size={18} color={flashOn ? colors.apricot : colors.textHi} />}
                  onPress={() => setFlashOn((prev) => !prev)}
                  accessibilityLabel={t('captureV1.flashToggle')}
                  testID="btn-toggle-flash"
                  style={[styles.glassCircle, flashOn ? styles.glassCircleActive : null]}
                />
                <Pressable
                  onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
                  accessibilityRole="button"
                  accessibilityLabel={t('capture.flipCamera')}
                  testID="btn-flip-camera"
                  style={styles.microFlipBtn}
                >
                  <CameraIcon size={14} color={colors.textMid} />
                </Pressable>
              </View>
            </View>

            {/* Center Viewfinder Reticle & Instruction */}
            <View style={styles.reticleContainer} pointerEvents="none">
              <View style={styles.reticleFrame}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <View style={styles.hintPill}>
                <Text variant="meta" color="textHi">
                  {scanMode === 'label'
                    ? t('captureV1.centerLabelHint')
                    : t('captureV1.centerMealHint')}
                </Text>
              </View>
            </View>

            {/* Bottom Mode Switcher & Shutter */}
            <View
              style={[
                styles.bottomSection,
                { paddingBottom: Math.max(layout.ctaBottomMin, insets.bottom + space.sm) },
              ]}
            >
              <View style={styles.modePillBar}>
                <Pressable
                  onPress={() => setScanMode('food')}
                  accessibilityRole="button"
                  accessibilityState={{ selected: scanMode === 'food' }}
                  style={[styles.modePillItem, scanMode === 'food' ? styles.modePillActive : null]}
                  testID="camera-mode-food"
                >
                  <Text
                    variant="buttonS"
                    color={scanMode === 'food' ? 'textHi' : 'textLo'}
                    numberOfLines={1}
                  >
                    {t('captureV1.modeScanFood')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => onSwitchToBarcode?.()}
                  accessibilityRole="button"
                  style={styles.modePillItem}
                  testID="camera-mode-barcode"
                >
                  <Text variant="buttonS" color="textLo" numberOfLines={1}>
                    {t('captureV1.modeBarcode')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setScanMode('label')}
                  accessibilityRole="button"
                  accessibilityState={{ selected: scanMode === 'label' }}
                  style={[styles.modePillItem, scanMode === 'label' ? styles.modePillActive : null]}
                  testID="camera-mode-label"
                >
                  <Text
                    variant="buttonS"
                    color={scanMode === 'label' ? 'textHi' : 'textLo'}
                    numberOfLines={1}
                  >
                    {t('captureV1.modeLabel')}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.shutterRow}>
                <Pressable
                  onPress={() => void handleTriggerCameraOrUpload('album')}
                  accessibilityRole="button"
                  accessibilityLabel={t('capture.choosePhoto')}
                  testID="food-camera-gallery"
                  style={styles.sideActionTile}
                >
                  <FeedImageIcon size={20} color={colors.textHi} />
                </Pressable>

                <Pressable
                  testID="btn-camera-shutter"
                  accessibilityRole="button"
                  accessibilityLabel={t('foodLog.photo.capture')}
                  disabled={capturing || !cameraReady}
                  onPress={() => void handleCapture()}
                  style={styles.shutterOuter}
                >
                  <View style={styles.shutterInner}>
                    {capturing ? <ActivityIndicator color={colors.onBrand} size="small" /> : null}
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (onSwitchToDescribe) onSwitchToDescribe();
                    else setFacing(facing === 'back' ? 'front' : 'back');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('captureV1.describeMeal')}
                  testID="camera-describe-meal"
                  style={styles.sideActionTile}
                >
                  <EditIcon size={20} color={colors.textHi} />
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const RETICLE_SIZE = 248;
const CORNER_LEN = 26;
const CORNER_WIDTH = 2.5;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg0,
  },
  errorBanner: {
    position: 'absolute',
    left: layout.screenPaddingX,
    right: layout.screenPaddingX,
    zIndex: 50,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.danger,
    borderRadius: radius.banner,
    padding: space.md,
  },
  permissionScreen: {
    flex: 1,
    backgroundColor: colors.bg0,
  },
  permissionTopBar: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space.md,
    alignItems: 'flex-start',
  },
  permissionContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.screenPaddingX,
    gap: space.md,
  },
  permissionIconTile: {
    width: 72,
    height: 72,
    borderRadius: radius.heroCard,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredText: {
    textAlign: 'center',
  },
  permissionActions: {
    width: '100%',
    maxWidth: 320,
    gap: space.sm,
    marginTop: space.md,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: colors.bg0,
  },
  previewTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingX,
    paddingVertical: space.md,
  },
  spacer44: {
    width: 44,
  },
  previewContent: {
    padding: layout.screenPaddingX,
    gap: space.lg,
    alignItems: 'center',
  },
  previewFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.heroCard,
    overflow: 'hidden',
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewActions: {
    width: '100%',
    gap: space.sm,
  },
  cameraContainer: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: colors.bg0,
  },
  plateBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateOuterRing: {
    width: 210,
    height: 210,
    borderRadius: radius.full,
    borderWidth: borders.width,
    borderColor: colors.s2,
    backgroundColor: colors.apricotGlowSoft,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingX,
    zIndex: 20,
  },
  glassCircle: {
    backgroundColor: colors.glass,
    borderColor: colors.hairline,
  },
  glassCircleActive: {
    borderColor: colors.apricot,
  },
  dropdownAnchor: {
    position: 'relative',
    alignItems: 'center',
  },
  sectionPill: {
    backgroundColor: colors.glass,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.full,
    paddingHorizontal: space.lg,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 46,
    minWidth: 160,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairlineLit,
    borderRadius: radius.card,
    paddingVertical: space.xs,
    zIndex: 30,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minHeight: 40,
  },
  dropdownDivider: {
    borderBottomWidth: borders.width,
    borderBottomColor: colors.s2,
  },
  topRightPair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  microFlipBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.glass,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xl,
  },
  reticleFrame: {
    width: RETICLE_SIZE,
    height: RETICLE_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_LEN,
    height: CORNER_LEN,
    borderColor: colors.textHi,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
  },
  hintPill: {
    backgroundColor: colors.glass,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.full,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  bottomSection: {
    paddingHorizontal: layout.screenPaddingX,
    alignItems: 'center',
    gap: space.lg,
  },
  modePillBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.tabBar,
    padding: space.xs,
    gap: space.xs,
  },
  modePillItem: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  modePillActive: {
    backgroundColor: colors.s3,
  },
  shutterRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  sideActionTile: {
    width: 48,
    height: 48,
    borderRadius: radius.iconTile,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: radius.full,
    borderWidth: 3,
    borderColor: colors.textHi,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg0,
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: radius.full,
    backgroundColor: colors.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
