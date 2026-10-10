import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import type { Food } from '@calipartner/core';
import { lookupBarcode } from '@/services/barcodeScanService';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onFoodFound: (food: Food) => void;
  onCreateCustomFood: (barcode: string) => void;
}

export function BarcodeScannerModal({
  visible,
  onClose,
  onFoodFound,
  onCreateCustomFood,
}: BarcodeScannerModalProps) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [searching, setSearching] = useState(false);

  const handleBarcodeScanned = async (barcodeData: string) => {
    if (scanned || searching) return;
    setScanned(true);
    setSearching(true);

    try {
      const res = await lookupBarcode(barcodeData);
      if (res.food) {
        onFoodFound(res.food);
        onClose();
      } else {
        Alert.alert(
          t('foodLog.scan.notFoundTitle'),
          t('foodLog.scan.notFoundBody'),
          [
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
          ],
        );
      }
    } finally {
      setSearching(false);
    }
  };

  const handleManualLookup = () => {
    if (!manualCode.trim()) return;
    void handleBarcodeScanned(manualCode.trim());
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        {/* Header bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 54,
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.sm,
            backgroundColor: 'rgba(0,0,0,0.8)',
            zIndex: 10,
          }}
        >
          <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: '#FFFFFF' }}>
            {t('foodLog.scan.title')}
          </Text>
          <Pressable
            testID="btn-close-scanner"
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Camera Frame or Permission Screen */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          {!permission?.granted ? (
            <View
              style={{
                padding: spacing.xl,
                alignItems: 'center',
                gap: spacing.md,
                maxWidth: 320,
              }}
            >
              <Ionicons name="camera-outline" size={54} color={colors.accent} />
              <Text
                style={{
                  fontSize: fontSize.md,
                  color: '#FFFFFF',
                  textAlign: 'center',
                  fontWeight: '600',
                }}
              >
                {t('foodLog.scan.cameraPermission')}
              </Text>
              <Pressable
                testID="btn-grant-camera-permission"
                onPress={requestPermission}
                style={{
                  backgroundColor: colors.accent,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: 12,
                  borderRadius: radius.md,
                }}
              >
                <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: fontSize.md }}>
                  {t('foodLog.scan.grantPermission')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ flex: 1, width: '100%', position: 'relative' }}>
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                onBarcodeScanned={scanned ? undefined : (result) => handleBarcodeScanned(result.data)}
              />

              {/* Viewfinder overlay rectangle */}
              <View
                style={{
                  position: 'absolute',
                  top: '30%',
                  left: '12%',
                  right: '12%',
                  height: 220,
                  borderWidth: 2,
                  borderColor: colors.accent,
                  borderRadius: radius.lg,
                  backgroundColor: 'transparent',
                }}
              />

              <View
                style={{
                  position: 'absolute',
                  top: '22%',
                  left: 0,
                  right: 0,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: fontSize.sm,
                    fontWeight: '600',
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: radius.pill,
                  }}
                >
                  {t('foodLog.scan.instruction')}
                </Text>
              </View>

              {searching && (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  }}
                >
                  <ActivityIndicator size="large" color={colors.accent} />
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: fontSize.md }}>
                    {t('foodLog.scan.scanning')}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Bottom manual barcode fallback bar */}
        <View
          style={{
            padding: spacing.md,
            backgroundColor: 'rgba(15,23,42,0.95)',
            gap: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: '#334155',
          }}
        >
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TextInput
              testID="input-manual-barcode"
              value={manualCode}
              onChangeText={setManualCode}
              keyboardType="number-pad"
              placeholder={t('foodLog.scan.manualPlaceholder')}
              placeholderTextColor="#94A3B8"
              style={{
                flex: 1,
                backgroundColor: '#1E293B',
                color: '#FFFFFF',
                borderRadius: radius.sm,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: fontSize.md,
              }}
            />
            <Pressable
              testID="btn-lookup-manual-barcode"
              disabled={searching || !manualCode.trim()}
              onPress={handleManualLookup}
              style={{
                backgroundColor: colors.accent,
                paddingHorizontal: spacing.md,
                justifyContent: 'center',
                borderRadius: radius.sm,
              }}
            >
              <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: fontSize.sm }}>
                {t('foodLog.scan.lookupButton')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
