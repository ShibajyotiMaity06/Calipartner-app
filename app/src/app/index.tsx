import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@calipartner/ui';
import { useAuth } from '@/contexts/AuthContext';
import { isUserOnboarded } from '@/services/onboardingStatus';
import { ErrorState } from '@/components/ErrorState';
import { AnimatedLogoSplash } from '@/components/brand/AnimatedLogoSplash';

export default function LaunchScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [finished, setFinished] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (isLoading) return;
    let active = true;
    setDestination(null);
    const resolve = async () =>
      user && (await isUserOnboarded(user.id)) ? '/(tabs)/today' : '/onboarding';
    void resolve()
      .then((value) => {
        if (active) setDestination(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [user, isLoading, retry]);
  useEffect(() => {
    if (finished && destination && !isLoading && !error) router.replace(destination as never);
  }, [finished, destination, isLoading, error, router]);
  return (
    <View
      style={[styles.container, { backgroundColor: colors.splashBackground }]}
      testID="launch-screen"
    >
      <AnimatedLogoSplash onComplete={() => setFinished(true)} />
      {error ? (
        <ErrorState
          onRetry={() => {
            setError(false);
            setRetry((value) => value + 1);
          }}
        />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1 } });
