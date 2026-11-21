import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';

interface BannerErrorProps {
  message: string;
  onRetry?: () => void;
  testID?: string;
}

export function BannerError({ message, onRetry, testID = 'banner-error' }: BannerErrorProps) {
  return (
    <View style={styles.banner} testID={testID}>
      <Ionicons name="alert-circle-outline" size={20} color={workoutTokens.danger} />
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
      {onRetry ? (
        <Pressable
          testID={`${testID}-retry`}
          accessibilityRole="button"
          accessibilityLabel="Retry"
          onPress={onRetry}
          style={styles.retryBtn}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: workoutTokens.card,
    borderWidth: 1,
    borderColor: workoutTokens.danger,
    borderRadius: workoutRadius.row,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginVertical: 8,
    gap: 10,
  },
  message: {
    flex: 1,
    color: workoutTokens.text,
    fontSize: 13,
  },
  retryBtn: {
    minHeight: 32,
    paddingHorizontal: 10,
    backgroundColor: workoutTokens.danger,
    borderRadius: workoutRadius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: workoutTokens.background,
    fontSize: 12,
    fontWeight: '700',
  },
});
