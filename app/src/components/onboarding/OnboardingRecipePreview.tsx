import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text, controls, radius, space } from '@calipartner/ui';
import { useTheme } from '@calipartner/ui/theme';
import { OWNER_RECIPES } from '@/services/recipeService';
import { useAuth } from '@/contexts/AuthContext';
import { afterSetupDestination } from '@/services/pairOnboardingService';
import { PaywallModal } from '@/components/rooms/PaywallModal';
import { t } from '@/i18n';

const exampleNames = [
  'Chicken Teriyaki Rice Bowl',
  'Chicken Fajitas',
  'Turkey Meatballs in Marinara',
] as const;
const recipes = [
  OWNER_RECIPES.find((recipe) => recipe.title === 'Palak Paneer'),
  ...exampleNames.map((name) => OWNER_RECIPES.find((recipe) => recipe.title === name)),
].filter((recipe) => recipe != null);

export function OnboardingRecipePreview() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState(false);
  const [error, setError] = useState(false);
  const finish = async () => {
    setError(false);
    try {
      router.replace((user ? await afterSetupDestination(user.id) : '/onboarding') as never);
    } catch {
      setError(true);
    }
  };
  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.bg0 }]}
      testID="onboarding-recipe-preview"
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title1">{t('releaseUpdate.recipeTitle')}</Text>
        <Text>{t('releaseUpdate.recipeBody')}</Text>
        {recipes.map((recipe) => (
          <View
            key={recipe.id}
            style={[styles.recipe, { backgroundColor: colors.s1, borderColor: colors.hairlineLit }]}
          >
            <Ionicons name="restaurant-outline" size={controls.icon} color={colors.actionInk} />
            <View style={styles.recipeText}>
              <Text variant="heading">{recipe.title}</Text>
              <Text tabular variant="bodyS">
                {t('releaseUpdate.recipeDuration', {
                  minutes: recipe.prep_minutes + recipe.cook_minutes,
                })}
              </Text>
            </View>
          </View>
        ))}
        <Button
          label={t('releaseUpdate.recipePlans')}
          onPress={() => setPlans(true)}
          testID="recipe-preview-plans"
        />
        <Button
          variant="secondary"
          label={t('releaseUpdate.inviteReady')}
          onPress={() => void finish()}
          testID="recipe-preview-continue"
        />
        {error && <Text accessibilityRole="alert">{t('common.errorBody')}</Text>}
      </ScrollView>
      {plans && (
        <PaywallModal visible onClose={() => setPlans(false)} onSuccess={() => void finish()} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: space[5],
    gap: space[4],
    maxWidth: space[8] * 18,
    width: '100%',
    alignSelf: 'center',
  },
  recipe: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: space[3],
    gap: space[3],
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipeText: { flex: 1, gap: space[1] },
});
