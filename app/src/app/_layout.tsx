import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@calipartner/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { AuthProvider } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { createLogger } from '@/lib/logger';
import { useTheme } from '@/theme/useTheme';
import { setupNotificationListeners } from '@/lib/deepLinks';
import { loadAppFonts, hideSplashScreen } from '@/theme/fontLoader';

const log = createLogger('root');

function AppInitializationGate({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const init = useCallback(() => {
    setState('loading');
    Promise.all([getDb(), loadAppFonts()])
      .then(() => {
        setState('ready');
        hideSplashScreen().catch(() => {});
      })
      .catch((e: unknown) => {
        log.error('app initialization failed', e instanceof Error ? e.message : String(e));
        setState('error');
        hideSplashScreen().catch(() => {});
      });
  }, []);

  useEffect(init, [init]);

  if (state === 'ready') return <>{children}</>;
  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
      {state === 'loading' ? <LoadingState /> : <ErrorState onRetry={init} />}
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    const cleanup = setupNotificationListeners();
    return cleanup;
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider initialTheme="dark">
        <SafeAreaProvider>
          <StatusBar style="light" />
          <AppInitializationGate>
            <AuthProvider>
              <Stack screenOptions={{ headerShown: false }} />
            </AuthProvider>
          </AppInitializationGate>
        </SafeAreaProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
