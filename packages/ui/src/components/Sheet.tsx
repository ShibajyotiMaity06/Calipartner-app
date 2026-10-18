import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Pressable,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
  SafeAreaView,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { dark } from '../tokens/colors';
import { radius } from '../tokens/radius';
import { space } from '../tokens/space';

export type SheetSnapPoint = 'half' | 'tall' | 'full';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  snapPoint?: SheetSnapPoint;
  children: React.ReactNode;
  showGrabber?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  /** Only the Log sheet is allowed glass per CMP-04 */
  isGlass?: boolean;
  /** Force reduce transparency for testing / accessibility */
  reduceTransparency?: boolean;
}

/** Sheet stack depth context to enforce max 1 sheet over another */
export const SheetStackContext = createContext<number>(0);

export function useSheetDepth(): number {
  return useContext(SheetStackContext);
}

export function Sheet({
  visible,
  onClose,
  snapPoint = 'half',
  children,
  showGrabber = true,
  accessibilityLabel = 'Bottom sheet',
  testID,
  style,
  isGlass = false,
  reduceTransparency: forcedReduceTransparency,
}: SheetProps): React.JSX.Element | null {
  const currentDepth = useSheetDepth();
  const [reduceTransparency, setReduceTransparency] = useState<boolean>(
    forcedReduceTransparency ?? false,
  );

  useEffect(() => {
    if (forcedReduceTransparency !== undefined) {
      setReduceTransparency(forcedReduceTransparency);
      return;
    }

    if (AccessibilityInfo.isReduceTransparencyEnabled) {
      AccessibilityInfo.isReduceTransparencyEnabled()
        .then((enabled) => setReduceTransparency(enabled))
        .catch(() => {});
    }

    const sub = AccessibilityInfo.addEventListener?.('reduceTransparencyChanged', (enabled) => {
      setReduceTransparency(enabled);
    });

    return () => {
      sub?.remove?.();
    };
  }, [forcedReduceTransparency]);

  const getHeightStyle = (): ViewStyle => {
    switch (snapPoint) {
      case 'tall':
        return { height: '90%' };
      case 'full':
        return { height: '100%' };
      case 'half':
      default:
        return { height: '55%', maxHeight: '80%' };
    }
  };

  const isGlassActive = isGlass && !reduceTransparency;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
      accessibilityViewIsModal
    >
      <View style={styles.modalRoot}>
        {/* Scrim backdrop */}
        <Pressable
          style={styles.scrim}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss sheet"
        />

        {/* Sheet surface */}
        <View
          style={[
            styles.sheetSurface,
            isGlassActive ? styles.glassSurface : styles.opaqueSurface,
            getHeightStyle(),
            style,
          ]}
          accessibilityRole="none"
          accessibilityLabel={accessibilityLabel}
        >
          {showGrabber ? (
            <View style={styles.grabberWrap}>
              <View style={styles.grabber} />
            </View>
          ) : null}

          <SafeAreaView style={styles.safeContent}>
            <SheetStackContext.Provider value={currentDepth + 1}>
              {children}
            </SheetStackContext.Provider>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheetSurface: {
    borderTopLeftRadius: radius.sheet, // 28
    borderTopRightRadius: radius.sheet, // 28
    borderWidth: 1,
    borderColor: dark.hairline,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  opaqueSurface: {
    backgroundColor: dark.s2,
  },
  glassSurface: {
    backgroundColor: Platform.OS === 'web' ? 'rgba(36, 30, 24, 0.88)' : dark.s2,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        } as unknown as ViewStyle)
      : {}),
  },
  grabberWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: space[2], // 8
    paddingBottom: space[3], // 12
    width: '100%',
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: dark.hairlineLit,
  },
  safeContent: {
    flex: 1,
  },
});
