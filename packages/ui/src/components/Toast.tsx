import React, { useEffect } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { dark } from '../tokens/colors';
import { radius } from '../tokens/radius';
import { space } from '../tokens/space';
import { Text } from './Text';

export interface ToastProps {
  message: string;
  visible: boolean;
  onDismiss?: () => void;
  onUndo?: () => void;
  undoLabel?: string;
  durationMs?: number;
  testID?: string;
  style?: ViewStyle;
}

export function Toast({
  message,
  visible,
  onDismiss,
  onUndo,
  undoLabel = 'Undo',
  durationMs = 4000,
  testID,
  style,
}: ToastProps): React.JSX.Element | null {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      onDismiss?.();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [visible, durationMs, onDismiss]);

  if (!visible) return null;

  return (
    <View
      style={[styles.container, style]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      testID={testID}
    >
      <View style={styles.toast}>
        <Text variant="bodyS" color={dark.textHi} style={styles.message} numberOfLines={2}>
          {message}
        </Text>

        {onUndo ? (
          <Pressable
            onPress={() => {
              onUndo();
              onDismiss?.();
            }}
            accessibilityRole="button"
            accessibilityLabel={undoLabel}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.undoBtn}
          >
            <Text variant="label" color={dark.apricot} style={styles.undoText}>
              {undoLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80, // Floats above bottom tab bar
    left: space[4], // 16
    right: space[4], // 16
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    height: 48,
    minHeight: 48,
    backgroundColor: dark.s3,
    borderRadius: radius.button, // 16
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4], // 16
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  message: {
    flex: 1,
  },
  undoBtn: {
    marginLeft: space[3], // 12
    paddingVertical: space[1], // 4
    paddingHorizontal: space[2], // 8
  },
  undoText: {
    fontWeight: '600',
  },
});
