import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { AuthProvider } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { createLogger } from '@/lib/logger';
import { useTheme } from '@/theme/useTheme';

const log = createLogger('root');

function DatabaseGate({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const init = useCallback(() => {
    setState('loading');
    getDb()
      .then(() => setState('ready'))
      .catch((e: unknown) => {
        log.error('local database failed to open', e instanceof Error ? e.message : String(e));
        setState('error');
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
  const { scheme } = useTheme();
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <DatabaseGate>
          <AuthProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </AuthProvider>
        </DatabaseGate>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
