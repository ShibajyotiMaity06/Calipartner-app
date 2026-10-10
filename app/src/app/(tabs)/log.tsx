import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { getMealSectionForTime, type MealSection } from '@calipartner/core';
import { FoodLogModal } from '@/components/diary/FoodLogModal';
import { useTheme } from '@/theme/useTheme';

export default function LogScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [visible, setVisible] = useState(true);
  const todayDate = new Date().toISOString().slice(0, 10);
  const currentSection: MealSection = getMealSectionForTime(new Date());

  const handleClose = () => {
    setVisible(false);
    // Return to Today tab
    router.replace('/today');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FoodLogModal
        visible={visible}
        defaultSection={currentSection}
        localDate={todayDate}
        onClose={handleClose}
        onLogged={() => {
          router.replace('/today');
        }}
      />
    </View>
  );
}
