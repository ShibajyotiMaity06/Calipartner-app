import React, { useRef } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@calipartner/ui';
import { useAuth } from '@/contexts/AuthContext';
import { FoundersThanksView } from '@/components/onboarding/FoundersThanksView';
import { afterSetupDestination } from '@/services/pairOnboardingService';
import {
  finishOnboardingReview,
  reviewContinueDestination,
} from '@/services/onboardingReviewService';

export default function FoundersScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const currentOwner = useRef(user?.id);
  currentOwner.current = user?.id;
  const params = useLocalSearchParams<{ next?: string; room?: string }>();
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg0 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <FoundersThanksView
          key={user?.id ?? 'guest'}
          onContinue={async () => {
            if (!user) {
              router.replace('/onboarding');
              return;
            }
            await finishOnboardingReview(user.id);
            const destination =
              params.next === 'pair' || params.next === 'plan'
                ? await afterSetupDestination(user.id)
                : reviewContinueDestination(params.next, params.room);
            if (currentOwner.current !== user.id) return;
            router.replace(destination as never);
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
