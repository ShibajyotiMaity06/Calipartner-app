import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import type { IScannerControls } from '@zxing/browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CheckIcon,
  CloseIcon,
  CubeIcon,
  FlashIcon,
  IconButton,
  LinkButton,
  PrimaryButton,
  SecondaryButton,
  Text,
  borders,
  colors,
  elevation,
  fonts,
  layout,
  radius,
  space,
} from '@calipartner/ui/v1';
import { scaleNutrients, type Food, type MealSection } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { ScanSweep } from '@/components/food_photo/ScanSweep';
import { t } from '@/i18n';
import { decodeBarcodeImage } from '@/services/barcodeImageService';
import { lookupBarcode } from '@/services/barcodeScanService';

export interface BarcodeScannerModalProps {
  visible: boolean;
  defaultSection?: MealSection;
  onSectionChange?: (section: MealSection) => void;
  onSwitchToPhoto?: () => void;
  onSwitchToLabel?: () => void;
  onClose: () => void;
  covered?: boolean;
  onFoodFound: (food: Food, initialPortion?: { quantity: number; unit: string }) => void;
  onCreateCustomFood: (barcode: string) => void;
}

const SECTIONS: readonly MealSection[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export function BarcodeScannerModal({
  visible,
  defaultSection = 'lunch',
  onSectionChange,
  onSwitchToPhoto,
  onSwitchToLabel,
  onClose,
  covered = false,
  onFoodFound,
  onCreateCustomFood,
}: BarcodeScannerModalProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraPaused, setCameraPaused] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundFood, setFoundFood] = useState<Food | null>(null);
  const [servings, setServings] = useState(1);
  const [section, setSection] = useState<MealSection>(defaultSection);
  const [mealMenuOpen, setMealMenuOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameraSession, setCameraSession] = useState(0);
  const [webCameraActive, setWebCameraActive] = useState(false);

  const scanLock = useRef(false);
  const generation = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const sectionName = t(`diary.sections.${section}` as Parameters<typeof t>[0]);

  const resetScan = () => {
    setCameraPaused(false);
    generation.current++;
    setSearching(false);
    setCameraSession((value) => value + 1);
    scanLock.current = false;
    setScanned(false);
    setScanError(null);
    setFoundFood(null);
    setServings(1);
  };

  const back = () => {
    if (covered) return;
    if (scanned || searching || foundFood || scanError) resetScan();
    else if (showManualInput || showMore) {
      setShowManualInput(false);
      setShowMore(false);
    } else onClose();
  };

  useBrowserModalBack(visible, onClose, {
    depth:
      Number(showManualInput || showMore) +
      Number(Boolean(scanned || searching || foundFood || scanError)),
    onDepthChange: back,
  });

  useEffect(() => {
    generation.current++;
    resetScan();
    if (!visible) {
      controlsRef.current?.stop();
      setWebCameraActive(false);
      setMealMenuOpen(false);
    } else {
      setSection(defaultSection);
    }
    return () => {
      generation.current++;
    };
  }, [visible, defaultSection]);

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
          setServings(1);
          controlsRef.current?.stop();
        } else {
          setManualCode(barcodeData);
          setScanError(t('capture.barcodeNotFound'));
        }
      } catch (error) {
        if (generation.current === current) {
          setScanError(error instanceof Error ? error.message : t('capture.barcodeError'));
        }
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
    if (!foundFood) return;
    if (servings === 1) {
      onFoodFound(foundFood);
      return;
    }
    const baseUnit = foundFood.serving_units?.[0]?.unit ?? 'serving';
    const baseGrams = foundFood.serving_units?.[0]?.grams ?? 100;
    const baseQty = baseUnit === 'g' || baseUnit === 'ml' ? baseGrams : 1;
    onFoodFound(foundFood, {
      quantity: Math.round(baseQty * servings * 100) / 100,
      unit: baseUnit,
    });
  };

  const handleTriggerBarcodePhoto = async (takePhoto = false) => {
    resetScan();
    controlsRef.current?.stop();
    setCameraPaused(true);
    setWebCameraActive(false);
    const current = generation.current;
    try {
      if (takePhoto) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
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
    if (!visible || covered || !webCameraActive || foundFood || Platform.OS !== 'web') return;
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
          const track = video?.srcObject?.getVideoTracks()[0];
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
  }, [visible, covered, webCameraActive, handleBarcodeScanned, cameraSession, foundFood]);

  const isCameraReady =
    !covered && (Platform.OS === 'web' ? webCameraActive : !!permission?.granted && !cameraPaused);

  if (!visible) return null;

  const baseUnit = foundFood?.serving_units?.[0]?.unit ?? 'serving';
  const baseGrams = foundFood?.serving_units?.[0]?.grams ?? 100;
  const baseQty = baseUnit === 'g' || baseUnit === 'ml' ? baseGrams : 1;
  const safeFoundFood = foundFood
    ? {
        ...foundFood,
        protein_per_100g: foundFood.protein_per_100g ?? 0,
        carbs_per_100g: foundFood.carbs_per_100g ?? 0,
        fat_per_100g: foundFood.fat_per_100g ?? 0,
        fiber_per_100g: foundFood.fiber_per_100g ?? 0,
        sugar_per_100g: foundFood.sugar_per_100g ?? 0,
        sodium_mg_per_100g: foundFood.sodium_mg_per_100g ?? 0,
        serving_units: foundFood.serving_units ?? [],
      }
    : null;
  const scaledNutrients = safeFoundFood
    ? scaleNutrients(safeFoundFood, baseQty * servings, baseUnit)
    : null;
  const servingSubtext = foundFood
    ? `${Math.round(baseGrams)} g${foundFood.brand ? ` · ${foundFood.brand}` : ' · 1 serving'}`
    : '';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={back}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Camera / Barcode Viewfinder Stage */}
        <View style={[styles.cameraStage, { paddingTop: insets.top + layout.topContentOffset }]}>
          {isCameraReady && Platform.OS === 'web' ? (
            React.createElement('video', {
              ref: videoRef,
              autoPlay: true,
              muted: true,
              playsInline: true,
              style: styles.webVideo,
            })
          ) : isCameraReady ? (
            <CameraView
              key={cameraSession}
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torchEnabled}
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
              }}
              onBarcodeScanned={scanned ? undefined : (e) => void handleBarcodeScanned(e.data)}
            />
          ) : null}

          {/* Top Bar */}
          <View style={styles.topBar}>
            <IconButton
              icon={<CloseIcon size={18} color={colors.textHi} />}
              variant="glass"
              onPress={back}
              accessibilityLabel={t('common.cancel')}
              testID="btn-close-scanner"
            />

            <View style={styles.dropdownAnchor}>
              <Pressable
                onPress={() => setMealMenuOpen((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel={sectionName}
                style={styles.sectionPill}
                testID="barcode-section-picker"
              >
                <Text variant="label" color="textHi">
                  {`${sectionName} ▾`}
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

            <IconButton
              icon={<FlashIcon size={18} color={torchEnabled ? colors.apricot : colors.textHi} />}
              variant="glass"
              onPress={() => setTorchEnabled((prev) => !prev)}
              accessibilityLabel={t('capture.flashlight')}
              testID="btn-toggle-torch"
            />
          </View>

          {/* Status Pill + Barcode Reticle */}
          <View style={styles.viewfinderCenter}>
            {foundFood ? (
              <View style={styles.detectedPill} testID="barcode-detected-pill">
                <CheckIcon size={14} color={colors.apricot} />
                <Text variant="buttonS" color="apricot">
                  {t('captureV1.barcodeDetected')}
                </Text>
              </View>
            ) : searching ? (
              <View style={styles.statusPill} testID="barcode-lookup-progress">
                <ActivityIndicator size="small" color={colors.apricot} />
                <Text variant="meta" color="textHi">
                  {t('captureV1.lookingUpProduct')}
                </Text>
              </View>
            ) : null}

            <View style={styles.reticleBox}>
              {isCameraReady && !foundFood ? <ScanSweep overlay /> : null}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              {/* Horizontal Apricot Laser Line */}
              <View style={styles.laserHalo} />
              <View style={styles.laserLine} />
            </View>
          </View>

          {/* Mode Pill Switcher */}
          <View style={styles.modeWrap}>
            <View style={styles.modePillBar}>
              <Pressable
                onPress={() => onSwitchToPhoto?.()}
                accessibilityRole="button"
                style={styles.modePillItem}
                testID="barcode-mode-photo"
              >
                <Text variant="buttonS" color="textLo" numberOfLines={1}>
                  {t('captureV1.modeScanFood')}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: true }}
                style={[styles.modePillItem, styles.modePillActive]}
                testID="barcode-mode-barcode"
              >
                <Text variant="buttonS" color="textHi" numberOfLines={1}>
                  {t('captureV1.modeBarcode')}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onSwitchToLabel?.()}
                accessibilityRole="button"
                style={styles.modePillItem}
                testID="barcode-mode-label"
              >
                <Text variant="buttonS" color="textLo" numberOfLines={1}>
                  {t('captureV1.modeLabel')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Elevated Bottom Sheet */}
        <View
          style={[
            styles.bottomSheet,
            elevation.sheet,
            { paddingBottom: Math.max(layout.ctaBottomMin, insets.bottom + space.sm) },
          ]}
        >
          <View style={styles.grabber} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
          >
            {foundFood && scaledNutrients ? (
              <View testID="card-scanned-food" style={styles.foundWrap}>
                <View style={styles.productHeaderRow}>
                  <View style={styles.cubeTile}>
                    <CubeIcon size={20} color={colors.apricot} />
                  </View>
                  <View style={styles.productCopy}>
                    <Text variant="rowTitle" color="textHi" numberOfLines={2}>
                      {foundFood.name}
                    </Text>
                    <Text variant="meta" color="textLo" numberOfLines={1}>
                      {servingSubtext}
                    </Text>
                  </View>
                  <View style={styles.kcalCol}>
                    <Text variant="numL" tabular color="textHi">
                      {String(Math.round(scaledNutrients.calories))}
                    </Text>
                    <Text variant="meta" color="textLo">
                      kcal
                    </Text>
                  </View>
                </View>

                <View style={styles.macroRow}>
                  <View style={styles.macroPill}>
                    <Text variant="meta" color="textMid" tabular>
                      {t('captureV1.proteinShort', { g: Math.round(scaledNutrients.protein) })}
                    </Text>
                  </View>
                  <View style={styles.macroPill}>
                    <Text variant="meta" color="textMid" tabular>
                      {t('captureV1.carbsShort', { g: Math.round(scaledNutrients.carbs) })}
                    </Text>
                  </View>
                  <View style={styles.macroPill}>
                    <Text variant="meta" color="textMid" tabular>
                      {t('captureV1.fatShort', { g: Math.round(scaledNutrients.fat) })}
                    </Text>
                  </View>
                </View>

                <View style={styles.servingsRow}>
                  <Text variant="rowTitle" color="textHi">
                    {t('captureV1.servingsLabel')}
                  </Text>
                  <View style={styles.stepperGroup}>
                    <Pressable
                      onPress={() => setServings((s) => Math.max(0.5, s - 0.5))}
                      accessibilityRole="button"
                      accessibilityLabel="Decrease servings"
                      testID="btn-servings-minus"
                      style={styles.stepperBtn}
                    >
                      <Text variant="buttonM" color="textHi">
                        −
                      </Text>
                    </Pressable>
                    <Text variant="rowTitle" tabular color="textHi" style={styles.servingsVal}>
                      {String(servings)}
                    </Text>
                    <Pressable
                      onPress={() => setServings((s) => Math.min(20, s + 0.5))}
                      accessibilityRole="button"
                      accessibilityLabel="Increase servings"
                      testID="btn-servings-plus"
                      style={styles.stepperBtn}
                    >
                      <Text variant="buttonM" color="textHi">
                        +
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <PrimaryButton
                  title={t('captureV1.logToSection', { section: sectionName })}
                  showArrow
                  onPress={handleConfirmFoundFood}
                  testID="btn-add-scanned-food"
                />

                <LinkButton
                  title={t('captureV1.wrongProductReport')}
                  variant="default"
                  onPress={() => {
                    setManualCode(foundFood.barcode ?? manualCode);
                    setShowManualInput(true);
                    resetScan();
                  }}
                  testID="btn-wrong-product"
                />
                {showManualInput ? (
                  <View style={styles.manualRow}>
                    <TextInput
                      testID="input-manual-barcode"
                      value={manualCode}
                      onChangeText={setManualCode}
                      placeholder={t('foodLog.scan.manualPlaceholder')}
                      placeholderTextColor={colors.textLo}
                      keyboardType="number-pad"
                      style={styles.manualInput}
                    />
                    <PrimaryButton
                      title={t('foodLog.scan.lookupButton')}
                      onPress={handleManualLookup}
                      testID="btn-lookup-manual-barcode"
                    />
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.idleSheetContent}>
                {scanError ? (
                  <View style={styles.errorCard}>
                    <Text
                      variant="meta"
                      color="danger"
                      accessibilityRole="alert"
                      testID="barcode-error"
                    >
                      {scanError}
                    </Text>
                    <View style={styles.errorActions}>
                      <PrimaryButton
                        title={t('capture.tryAgain')}
                        onPress={resetScan}
                        testID="barcode-retry"
                      />
                      <SecondaryButton
                        title={t('capture.createFood')}
                        onPress={() => onCreateCustomFood(manualCode || '')}
                        testID="barcode-create-food"
                      />
                    </View>
                  </View>
                ) : null}

                {!isCameraReady ? (
                  <PrimaryButton
                    title={t('capture.openScanner')}
                    onPress={() => void handleRequestCamera()}
                    testID="btn-grant-camera-permission"
                  />
                ) : null}

                <SecondaryButton
                  title={t('capture.typeBarcode')}
                  onPress={() => setShowManualInput((prev) => !prev)}
                  testID="btn-show-type-number"
                />

                {showManualInput ? (
                  <View style={styles.manualRow}>
                    <TextInput
                      testID="input-manual-barcode"
                      value={manualCode}
                      onChangeText={setManualCode}
                      placeholder={t('foodLog.scan.manualPlaceholder')}
                      placeholderTextColor={colors.textLo}
                      keyboardType="number-pad"
                      style={styles.manualInput}
                    />
                    <PrimaryButton
                      title={t('foodLog.scan.lookupButton')}
                      onPress={handleManualLookup}
                      testID="btn-lookup-manual-barcode"
                    />
                  </View>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showMore }}
                  accessibilityLabel={t('fastingRefresh.moreOptions')}
                  onPress={() => setShowMore((prev) => !prev)}
                  style={styles.moreOptionsBtn}
                  testID="barcode-more-options"
                >
                  <Text variant="buttonS" color="textMid">
                    {t('fastingRefresh.moreOptions')}
                  </Text>
                </Pressable>

                {showMore ? (
                  <View style={styles.moreActions}>
                    <SecondaryButton
                      title={t('fastingRefresh.takePhoto')}
                      onPress={() => void handleTriggerBarcodePhoto(true)}
                      testID="barcode-take-photo"
                    />
                    <SecondaryButton
                      title={t('fastingRefresh.choosePhoto')}
                      onPress={() => void handleTriggerBarcodePhoto(false)}
                      testID="barcode-choose-photo"
                    />
                  </View>
                ) : null}
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const RETICLE_W = 264;
const RETICLE_H = 152;
const CORNER_LEN = 24;
const CORNER_STROKE = 2.5;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg0,
  },
  cameraStage: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: space.md,
    position: 'relative',
  },
  webVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    alignItems: 'center',
    justifyContent: 'center',
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
  viewfinderCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  detectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: colors.glass,
    borderWidth: borders.width,
    borderColor: colors.apricot,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.glass,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
  },
  reticleBox: {
    width: RETICLE_W,
    height: RETICLE_H,
    borderRadius: radius.card,
    backgroundColor: colors.apricotGlowSoft,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_LEN,
    height: CORNER_LEN,
    borderColor: colors.apricot,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_STROKE,
    borderLeftWidth: CORNER_STROKE,
    borderTopLeftRadius: radius.control,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_STROKE,
    borderRightWidth: CORNER_STROKE,
    borderTopRightRadius: radius.control,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_STROKE,
    borderLeftWidth: CORNER_STROKE,
    borderBottomLeftRadius: radius.control,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_STROKE,
    borderRightWidth: CORNER_STROKE,
    borderBottomRightRadius: radius.control,
  },
  laserHalo: {
    position: 'absolute',
    left: 6,
    right: 6,
    height: 14,
    backgroundColor: colors.apricotGlow,
  },
  laserLine: {
    position: 'absolute',
    left: 6,
    right: 6,
    height: 2,
    backgroundColor: colors.apricot,
  },
  modeWrap: {
    alignItems: 'center',
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
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modePillActive: {
    backgroundColor: colors.s3,
  },
  bottomSheet: {
    backgroundColor: colors.s1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: borders.width,
    borderColor: colors.hairlineLit,
    paddingHorizontal: layout.sheetPaddingX,
    paddingTop: space.sm,
    maxHeight: '52%',
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: colors.hairline,
    alignSelf: 'center',
    marginBottom: space.md,
  },
  sheetContent: {
    gap: space.md,
    paddingBottom: space.xs,
  },
  foundWrap: {
    gap: space.md,
  },
  productHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  cubeTile: {
    width: 44,
    height: 44,
    borderRadius: radius.iconTile,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productCopy: {
    flex: 1,
    gap: 2,
  },
  kcalCol: {
    alignItems: 'flex-end',
  },
  macroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  macroPill: {
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.chip,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.xs,
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingsVal: {
    minWidth: 24,
    textAlign: 'center',
  },
  idleSheetContent: {
    gap: space.sm,
  },
  errorCard: {
    gap: space.sm,
    padding: space.md,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.danger,
    borderRadius: radius.card,
  },
  errorActions: {
    gap: space.sm,
  },
  manualRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: space.sm,
  },
  manualInput: {
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.input,
    paddingHorizontal: space.md,
    minHeight: 48,
    color: colors.textHi,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  moreActions: {
    gap: space.sm,
  },
  moreOptionsBtn: {
    minHeight: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
