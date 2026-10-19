import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import type { Food, MealSection } from '@calipartner/core';
import { Text, Button, dark, space, radius } from '@calipartner/ui';
import { lookupBarcode } from '@/services/barcodeScanService';
import { t } from '@/i18n';

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
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundFood, setFoundFood] = useState<Food | null>(null);

  const sectionName = t(`diary.sections.${defaultSection}` as Parameters<typeof t>[0]);

  const handleBarcodeScanned = async (barcodeData: string) => {
    if (scanned || searching) return;
    setScanned(true);
    setSearching(true);

    try {
      const res = await lookupBarcode(barcodeData);
      if (res.food) {
        setFoundFood(res.food);
      } else {
        Alert.alert(t('foodLog.scan.notFoundTitle'), t('foodLog.scan.notFoundBody'), [
          {
            text: t('common.cancel'),
            onPress: () => setScanned(false),
            style: 'cancel',
          },
          {
            text: t('foodLog.createCustomFood'),
            onPress: () => {
              onClose();
              onCreateCustomFood(barcodeData);
            },
          },
        ]);
      }
    } finally {
      setSearching(false);
    }
  };

  const handleManualLookup = () => {
    if (!manualCode.trim()) return;
    void handleBarcodeScanned(manualCode.trim());
  };

  const handleConfirmFoundFood = () => {
    if (!foundFood) return;
    onFoodFound(foundFood);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header bar */}
        <View style={styles.headerBar}>
          <Text variant="heading" color={dark.textHi}>
            {t('foodLog.scan.title')}
          </Text>
          <View style={styles.headerActions}>
            <Pressable
              testID="btn-toggle-torch"
              onPress={() => setTorchEnabled((prev) => !prev)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.iconButton}
              accessibilityLabel="Toggle flashlight"
            >
              <Ionicons
                name={torchEnabled ? 'flash' : 'flash-outline'}
                size={22}
                color={torchEnabled ? dark.apricot : dark.textHi}
              />
            </Pressable>

            <Pressable
              testID="btn-close-scanner"
              onPress={onClose}
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
          {!permission?.granted ? (
            <View style={styles.permissionBox}>
              <Ionicons name="camera-outline" size={54} color={dark.apricot} />
              <Text variant="body" color={dark.textHi} style={{ textAlign: 'center' }}>
                {t('foodLog.scan.cameraPermission')}
              </Text>
              <Button
                testID="btn-grant-camera-permission"
                variant="primary"
                label={t('foodLog.scan.grantPermission')}
                onPress={requestPermission}
              />
            </View>
          ) : (
            <View style={styles.cameraContainer}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                enableTorch={torchEnabled}
                onBarcodeScanned={
                  scanned ? undefined : (result) => handleBarcodeScanned(result.data)
                }
              />

              {/* D04: 260x160 Cutout with Apricot Corner Brackets Only */}
              <View style={styles.cutoutOverlay}>
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

                <Text variant="bodyS" color={dark.textHi} style={styles.cutoutHint}>
                  {t('foodLog.scan.instruction')}
                </Text>
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
                {foundFood.serving_units?.[0]?.unit ?? '100g'} · {foundFood.calories_per_100g} kcal
              </Text>
            </View>
            <Button
              testID="btn-add-scanned-food"
              variant="primary"
              label={`Add to ${sectionName.toLowerCase()}`}
              onPress={handleConfirmFoundFood}
            />
          </View>
        )}

        {/* Bottom "Type the number" link & Manual Input */}
        <View style={styles.bottomBar}>
          {!showManualInput ? (
            <Pressable
              testID="btn-show-type-number"
              onPress={() => setShowManualInput(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text variant="bodyS" color={dark.apricot} style={styles.typeNumberLink}>
                Type the number
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    padding: space[1],
  },
  cameraWrapper: {
    flex: 1,
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
    width: 260,
    height: 160,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    width: '100%',
  },
  manualTextInput: {
    flex: 1,
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
