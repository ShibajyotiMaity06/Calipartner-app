import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { RecipeBrowseView } from '@/components/recipes';
import { useTheme } from '@/theme/useTheme';

export default function RecipesScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <RecipeBrowseView showBackOrClose={true} onBackOrClose={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 48,
  },
});
