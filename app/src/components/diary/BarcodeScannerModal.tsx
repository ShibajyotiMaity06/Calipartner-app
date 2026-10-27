import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import type { Food, MealSection } from '@calipartner/core';
import { Text, Button, dark, space, radius, captureLayout } from '@calipartner/ui';
import { lookupBarcode } from '@/services/barcodeScanService';
import { t } from '@/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { decodeBarcodeImage } from '@/services/barcodeImageService';
import type { IScannerControls } from '@zxing/browser';

export interface BarcodeScannerModalProps {
  visible: boolean;
  defaultSection?: MealSection;
  onClose: () => void;
  onFoodFound: (food: Food) => void;
  onCreateCustomFood: (barcode: string) => void;
}

export function BarcodeScannerModal({
  visible,
  defaultSection = 'lunch',
  onClose,
  onFoodFound,
  onCreateCustomFood,
}: BarcodeScannerModalProps) {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraPaused, setCameraPaused] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundFood, setFoundFood] = useState<Food | null>(null);

  const sectionName = t(`diary.sections.${defaultSection}` as Parameters<typeof t>[0]);

  const scanLock = useRef(false);
  const generation = useRef(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameraSession, setCameraSession] = useState(0);
  const [webCameraActive, setWebCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const resetScan = () => {
    setCameraPaused(false);
    generation.current++;
    setSearching(false);
    setCameraSession((value) => value + 1);
    scanLock.current = false;
    setScanned(false);
    setScanError(null);
    setFoundFood(null);
  };
  useEffect(() => {
    generation.current++;
    resetScan();
    if (!visible) {
      controlsRef.current?.stop();
      setWebCameraActive(false);
    }
    return () => {
      generation.current++;
    };
  }, [visible]);
  const handleBarcodeScanned = useCallback(
    async (barcodeData: string) => {
      if (scanLock.current) return;
      scanLock.current = true;
      const current = generation.current;
      setScanned(true);
      setSearching(true);
      setScanError(null);
      try {
        const result = await lookupBarcode(barcodeData, undefined, isOnline !== false, user?.id);
        if (generation.current !== current) return;
        if (result.food) {
          setFoundFood(result.food);
          controlsRef.current?.stop();
        } else {
          setManualCode(barcodeData);
          setScanError(t('capture.barcodeNotFound'));
        }
      } catch (error) {
        if (generation.current === current)
          setScanError(error instanceof Error ? error.message : t('capture.barcodeError'));
      } finally {
        if (generation.current === current) setSearching(false);
      }
    },
    [isOnline, user?.id],
  );
  const handleManualLookup = () => {
    if (!manualCode.trim()) return;
    resetScan();
    void handleBarcodeScanned(manualCode.trim());
  };
  const handleConfirmFoundFood = () => {
    if (foundFood) {
      onFoodFound(foundFood);
      onClose();
    }
  };
  const handleTriggerBarcodePhoto = async (takePhoto = false) => {
    resetScan();
    controlsRef.current?.stop();
    setCameraPaused(true);
    setWebCameraActive(false);
    const current = generation.current;
    try {
      if (takePhoto) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setCameraPaused(false);
          setScanError(t('capture.cameraError'));
          return;
        }
      }
      const result = takePhoto
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
      const asset = result.canceled ? undefined : result.assets?.[0];
      if (!asset) {
        setCameraPaused(false);
        return;
      }
      if (current !== generation.current) return;
      setSearching(true);
      const resize =
        Math.max(asset.width, asset.height) > 2048
          ? [{ resize: asset.width >= asset.height ? { width: 2048 } : { height: 2048 } }]
          : [];
      const photo = await ImageManipulator.manipulateAsync(asset.uri, resize, {
        base64: true,
        compress: 0.95,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      const code = photo.base64 ? await decodeBarcodeImage(photo.base64) : null;
      if (current !== generation.current) return;
      if (code) await handleBarcodeScanned(code);
      else {
        setScanError(t('capture.barcodeMissing'));
        setShowManualInput(true);
      }
    } catch {
      if (current === generation.current) setScanError(t('capture.cameraError'));
    } finally {
      if (current === generation.current) setSearching(false);
    }
  };
  const handleRequestCamera = async () => {
    resetScan();
    if (Platform.OS === 'web') {
      setWebCameraActive(true);
      return;
    }
    try {
      await requestPermission();
    } catch {
      setScanError(t('capture.cameraError'));
    }
  };
  useEffect(() => {
    if (!visible || !webCameraActive || foundFood || Platform.OS !== 'web') return;
    let disposed = false;
    let controls: IScannerControls | undefined;
    void import('@zxing/browser')
      .then(async ({ BrowserMultiFormatReader }) => {
        const { DecodeHintType } = await import('@zxing/library');
        const hints = new Map([[DecodeHintType.TRY_HARDER, true]]);
        controls = await new BrowserMultiFormatReader(hints).decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          },
          videoRef.current ?? undefined,
          (result) => {
            if (!disposed && result) void handleBarcodeScanned(result.getText());
          },
        );
        if (disposed) controls.stop();
        else {
          controlsRef.current = controls;
          const video = videoRef.current as unknown as {
            srcObject?: {
              getVideoTracks(): Array<{
                getCapabilities?(): { focusMode?: string[] };
                applyConstraints(value: unknown): Promise<void>;
              }>;
            };
          } | null;
          const stream = video?.srcObject;
          const track = stream?.getVideoTracks()[0];
          const capabilities = track?.getCapabilities?.();
          if (capabilities?.focusMode?.includes('continuous')) {
            try {
              await track?.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
            } catch {
              /* Camera remains usable without focus controls. */
            }
          }
        }
      })
      .catch(() => {
        if (!disposed) {
          setWebCameraActive(false);
          setScanError(t('capture.cameraError'));
        }
      });
    return () => {
      disposed = true;
      controls?.stop();
      controlsRef.current = null;
    };
  }, [visible, webCameraActive, handleBarcodeScanned, cameraSession, foundFood]);

  const isCameraReady =
    Platform.OS === 'web' ? webCameraActive : !!permission?.granted && !cameraPaused;

  if (!visible) return null;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header bar */}
          <View style={styles.headerBar}>
            <Text variant="heading" color={dark.textHi}>
              {t('foodLog.scan.title')}
            </Text>
            <View style={styles.headerActions}>
              <Pressable
                testID="btn-toggle-torch"
                disabled={Platform.OS === 'web'}
                accessibilityState={{ disabled: Platform.OS === 'web' }}
                onPress={() => setTorchEnabled((prev: boolean) => !prev)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.iconButton}
                accessibilityLabel={t('capture.flashlight')}
              >
                <Ionicons
                  name={torchEnabled ? 'flash' : 'flash-outline'}
                  size={22}
                  color={torchEnabled ? dark.apricot : dark.textHi}
                />
              </Pressable>

              <Pressable
                testID="btn-close-scanner"
                onPress={() => {
                  controlsRef.current?.stop();
                  onClose();
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.iconButton}
                accessibilityLabel={t('common.cancel')}
              >
                <Ionicons name="close" size={26} color={dark.textHi} />
              </Pressable>
            </View>
          </View>

          {/* Camera Frame or Permission Screen */}
          <View style={styles.cameraWrapper}>
            {!isCameraReady ? (
              <View style={styles.permissionBox}>
                <Ionicons name="camera-outline" size={54} color={dark.apricot} />
                <Text variant="body" color={dark.textHi} style={{ textAlign: 'center' }}>
                  {t('foodLog.scan.cameraPermission')}
                </Text>
                <View style={{ gap: 10, width: '100%', maxWidth: 280, marginTop: 12 }}>
                  <Button
                    testID="btn-grant-camera-permission"
                    variant="primary"
                    label={t('capture.openScanner')}
                    onPress={handleRequestCamera}
                  />
                  <Button
                    testID="btn-barcode-photo-fallback"
                    variant="secondary"
                    label={t('capture.barcodePhoto')}
                    onPress={() => void handleTriggerBarcodePhoto()}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.cameraContainer}>
                {Platform.OS === 'web' ? (
                  React.createElement('video', {
                    ref: videoRef,
                    autoPlay: true,
                    playsInline: true,
                    muted: true,
                    style: { width: '100%', height: '100%', objectFit: 'contain' },
                  })
                ) : (
                  <CameraView
                    style={StyleSheet.absoluteFill}
                    key={cameraSession}
                    facing="back"
                    autofocus="off"
                    barcodeScannerSettings={{
                      barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
                    }}
                    onMountError={() => setScanError(t('capture.cameraError'))}
                    enableTorch={torchEnabled}
                    onBarcodeScanned={
                      scanned ? undefined : (result) => handleBarcodeScanned(result.data)
                    }
                  />
                )}

                {/* D04: 260x160 Cutout with Apricot Corner Brackets Only */}
                <View style={styles.cutoutOverlay} pointerEvents="none">
                  <View style={styles.cutoutFrame}>
                    {/* Top-Left Bracket */}
                    <View style={[styles.cornerBracket, styles.bracketTopLeft]} />
                    {/* Top-Right Bracket */}
                    <View style={[styles.cornerBracket, styles.bracketTopRight]} />
                    {/* Bottom-Left Bracket */}
                    <View style={[styles.cornerBracket, styles.bracketBottomLeft]} />
                    {/* Bottom-Right Bracket */}
                    <View style={[styles.cornerBracket, styles.bracketBottomRight]} />
                  </View>
                </View>

                {searching && (
                  <View style={styles.searchingOverlay}>
                    <ActivityIndicator size="large" color={dark.apricot} />
                    <Text variant="body" color={dark.textHi} style={{ fontWeight: '700' }}>
                      {t('foodLog.scan.scanning')}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          <Text variant="bodyS" color={dark.textHi} style={styles.cutoutHint}>
            {t('repairs.barcodeHelp')}
          </Text>
          {scanError && (
            <View style={styles.foundFoodCard} testID="barcode-error">
              <Text variant="bodyS" color={dark.textHi} accessibilityRole="alert">
                {scanError}
              </Text>
              <Button
                variant="secondary"
                label={t('capture.tryAgain')}
                onPress={handleRequestCamera}
                testID="barcode-retry"
              />
              <Button
                variant="secondary"
                label={t('capture.createFood')}
                onPress={() => {
                  onCreateCustomFood(manualCode);
                  onClose();
                }}
                testID="barcode-create-food"
              />
            </View>
          )}
          {/* Found Food Slide-up Card */}
          {foundFood && (
            <View style={styles.foundFoodCard} testID="card-scanned-food">
              <View style={styles.foundFoodInfo}>
                <Text
                  variant="body"
                  color={dark.textHi}
                  style={{ fontWeight: '700' }}
                  numberOfLines={1}
                >
                  {foundFood.name}
                </Text>
                <Text variant="bodyS" color={dark.textMid}>
                  {foundFood.serving_units?.[0]?.unit ?? '100g'} · {foundFood.calories_per_100g}{' '}
                  kcal
                </Text>
              </View>
              <Button
                testID="btn-add-scanned-food"
                variant="primary"
                label={t('repairs.addToMeal', { section: sectionName.toLowerCase() })}
                onPress={handleConfirmFoundFood}
              />
            </View>
          )}

          {/* Bottom "{t('capture.typeBarcode')}" link & Manual Input */}
          <View style={styles.bottomBar}>
            {!showManualInput ? (
              <Pressable
                testID="btn-show-type-number"
                onPress={() => setShowManualInput(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text variant="bodyS" color={dark.apricot} style={styles.typeNumberLink}>
                  {t('capture.typeBarcode')}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.manualInputRow}>
                <TextInput
                  testID="input-manual-barcode"
                  value={manualCode}
                  onChangeText={setManualCode}
                  keyboardType="number-pad"
                  placeholder={t('foodLog.scan.manualPlaceholder')}
                  placeholderTextColor={dark.textLo}
                  style={styles.manualTextInput}
                  autoFocus
                  accessibilityLabel={t('foodLog.scan.manualPlaceholder')}
                />
                <Button
                  testID="btn-lookup-manual-barcode"
                  variant="primary"
                  label={t('foodLog.scan.lookupButton')}
                  disabled={searching || !manualCode.trim()}
                  onPress={handleManualLookup}
                />
              </View>
            )}
          </View>
          <View style={styles.fallbackActions}>
            <Button
              testID="barcode-take-photo"
              variant="secondary"
              label={t('repairs.takeBarcodePhoto')}
              onPress={() => void handleTriggerBarcodePhoto(true)}
            />
            <Button
              testID="barcode-choose-photo"
              variant="secondary"
              label={t('capture.barcodePhoto')}
              onPress={() => void handleTriggerBarcodePhoto()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, paddingBottom: space[6] },
  fallbackActions: { padding: space[4], gap: space[3] },
  container: {
    flex: 1,
    backgroundColor: dark.bg0,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 54,
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    backgroundColor: dark.s1,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  iconButton: {
    minWidth: captureLayout.touch,
    minHeight: captureLayout.touch,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[1],
  },
  cameraWrapper: {
    flexGrow: 1,
    minHeight: captureLayout.cameraMinHeight,
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[6],
    gap: space[4],
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  cutoutOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
  },
  cutoutFrame: {
    width: '90%',
    maxWidth: captureLayout.cameraMaxWidth,
    height: captureLayout.guideHeight,
    position: 'relative',
  },
  cornerBracket: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: dark.apricot,
  },
  bracketTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: radius.control,
  },
  bracketTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: radius.control,
  },
  bracketBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: radius.control,
  },
  bracketBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: radius.control,
  },
  cutoutHint: {
    textAlign: 'center',
    marginHorizontal: space[4],
    backgroundColor: dark.s2,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  searchingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
  },
  foundFoodCard: {
    backgroundColor: dark.s1,
    padding: space[4],
    borderTopWidth: 1,
    borderTopColor: dark.hairline,
    gap: space[3],
  },
  foundFoodInfo: {
    gap: space[1],
  },
  bottomBar: {
    padding: space[4],
    backgroundColor: dark.s1,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: dark.hairline,
  },
  typeNumberLink: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  manualInputRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: space[3],
    width: '100%',
  },
  manualTextInput: {
    width: '100%',
    minHeight: captureLayout.touch,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    borderRadius: radius.control,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    color: dark.textHi,
    fontSize: 16,
  },
});
