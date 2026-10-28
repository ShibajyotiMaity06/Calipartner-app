import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@calipartner/ui';
import { PairStartView } from '@/components/onboarding/PairStartView';
import { useAuth } from '@/contexts/AuthContext';

export default function PairStartScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg0 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <PairStartView key={user?.id ?? 'guest'} />
      </ScrollView>
    </SafeAreaView>
  );
}
