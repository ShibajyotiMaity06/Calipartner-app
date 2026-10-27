import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, dark, radius, space } from '@calipartner/ui';
import { playClickSound } from '@/lib/sound';

export interface FloatingAiCoachButtonProps {
  bottom?: number;
  right?: number;
  testID?: string;
}

export function FloatingAiCoachButton({
  bottom = 88,
  right = 16,
  testID = 'btn-floating-ai-coach',
}: FloatingAiCoachButtonProps) {
  const router = useRouter();

  const handlePress = () => {
    playClickSound();
    router.push('/coach' as never);
  };

  return (
    <View style={[styles.container, { bottom, right }]} pointerEvents="box-none">
      <TouchableOpacity
        onPress={handlePress}
        style={styles.floatingButton}
        accessibilityRole="button"
        accessibilityLabel="Chat with AI Coach"
        testID={testID}
        activeOpacity={0.85}
      >
        {/* Glow Background Pulse */}
        <View style={styles.glowHalo} />

        {/* Inner Content */}
        <View style={styles.innerContent}>
          <Ionicons name="information-circle-outline" size={20} color={dark.apricot} />
          <Text variant="micro" color={dark.textHi} style={styles.label}>
            AI Coach
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 999,
  },
  floatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E120A',
    borderWidth: 1.5,
    borderColor: dark.apricot,
    borderRadius: radius.full,
    paddingVertical: 10,
    paddingHorizontal: space[3],
    shadowColor: dark.apricot,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  glowHalo: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(235, 127, 43, 0.4)',
  },
  innerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
