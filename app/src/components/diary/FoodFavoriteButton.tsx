import { useTheme as useAppearance } from '@calipartner/ui/theme';
import React from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { homeLayout } from '@calipartner/ui';
import type { Food } from '@calipartner/core';
import type { useFoodLibrary } from '@/hooks/useFoodLibrary';
import { t } from '@/i18n';
export function FoodFavoriteButton({
  food,
  library,
}: {
  food: Food;
  library: ReturnType<typeof useFoodLibrary>;
}) {
  const { colors: dark } = useAppearance();

  const favorite = library.isFavorite(food);
  return (
    <Pressable
      onPress={(event) => {
        event.stopPropagation();
        void library.favorite(food, !favorite);
      }}
      disabled={library.busy}
      accessibilityRole="button"
      accessibilityState={{ selected: favorite, disabled: library.busy }}
      accessibilityLabel={t(favorite ? 'foodPolish.unfavorite' : 'foodPolish.favorite', {
        name: food.name,
      })}
      testID={`favorite-food-${food.id}`}
      style={{
        minWidth: homeLayout.touchSize,
        minHeight: homeLayout.touchSize,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons
        name={favorite ? 'heart' : 'heart-outline'}
        size={homeLayout.iconSize}
        color={favorite ? dark.apricot : dark.textMid}
      />
    </Pressable>
  );
}
