import React from 'react';
import {
  Modal,
  View,
  Pressable,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
  SafeAreaView,
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
}: SheetProps): React.JSX.Element {
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
          style={[styles.sheetSurface, getHeightStyle(), style]}
          accessibilityRole="none"
          accessibilityLabel={accessibilityLabel}
        >
          {showGrabber ? (
            <View style={styles.grabberWrap}>
              <View style={styles.grabber} />
            </View>
          ) : null}

          <SafeAreaView style={styles.safeContent}>{children}</SafeAreaView>
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
    backgroundColor: dark.s2,
    borderTopLeftRadius: radius.sheet, // 28
    borderTopRightRadius: radius.sheet, // 28
    borderWidth: 1,
    borderColor: dark.hairline,
    borderBottomWidth: 0,
    overflow: 'hidden',
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
