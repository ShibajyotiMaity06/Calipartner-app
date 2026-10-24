import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Platform, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@calipartner/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SessionNavigationGuard } from '@/components/SessionNavigationGuard';
import { AccountDataResetGate } from '@/components/AccountDataResetGate';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { AuthProvider } from '@/contexts/AuthContext';
import { TargetsProvider } from '@/hooks/useTargets';
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
    const doc = (
      globalThis as unknown as {
        document?: {
          getElementById: (id: string) => unknown;
          createElement: (tag: string) => { id: string; rel: string; href: string };
          head: { appendChild: (node: unknown) => void };
        };
      }
    ).document;
    if (doc) {
      const existing = doc.getElementById('plus-jakarta-sans-font');
      if (!existing) {
        const link = doc.createElement('link');
        link.id = 'plus-jakarta-sans-font';
        link.rel = 'stylesheet';
        link.href =
          'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=swap';
        doc.head.appendChild(link);
      }

      const existingManifest = doc.getElementById('pwa-manifest');
      if (!existingManifest) {
        const manifestLink = doc.createElement('link');
        manifestLink.id = 'pwa-manifest';
        manifestLink.rel = 'manifest';
        manifestLink.href = '/manifest.json';
        doc.head.appendChild(manifestLink);

        const themeMeta = doc.createElement('meta') as unknown as {
          id: string;
          name: string;
          content: string;
        };
        themeMeta.id = 'theme-color-meta';
        themeMeta.name = 'theme-color';
        themeMeta.content = '#0E0B08';
        doc.head.appendChild(themeMeta as unknown);

        const mobileMeta = doc.createElement('meta') as unknown as {
          id: string;
          name: string;
          content: string;
        };
        mobileMeta.id = 'mobile-web-app-meta';
        mobileMeta.name = 'mobile-web-app-capable';
        mobileMeta.content = 'yes';
        doc.head.appendChild(mobileMeta as unknown);

        const appleMeta = doc.createElement('meta') as unknown as {
          id: string;
          name: string;
          content: string;
        };
        appleMeta.id = 'apple-mobile-web-app-meta';
        appleMeta.name = 'apple-mobile-web-app-capable';
        appleMeta.content = 'yes';
        doc.head.appendChild(appleMeta as unknown);
      }

      const existingIcons = doc.getElementById('ionicons-web-font');
      if (!existingIcons) {
        const style = doc.createElement('style') as unknown as {
          id: string;
          textContent: string;
        };
        style.id = 'ionicons-web-font';
        style.textContent = `
          @font-face {
            font-family: 'ionicons';
            src: url('https://cdn.jsdelivr.net/npm/@expo/vector-icons@14.0.0/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf') format('truetype');
          }
          @font-face {
            font-family: 'Ionicons';
            src: url('https://cdn.jsdelivr.net/npm/@expo/vector-icons@14.0.0/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf') format('truetype');
          }

          /* Ensure Plus Jakarta Sans is mapped to all token font aliases on web */
          @font-face {
            font-family: 'PlusJakartaSans_400';
            src: local('Plus Jakarta Sans'), local('PlusJakartaSans-Regular');
            font-weight: 400;
          }
          @font-face {
            font-family: 'PlusJakartaSans_500';
            src: local('Plus Jakarta Sans'), local('PlusJakartaSans-Medium');
            font-weight: 500;
          }
          @font-face {
            font-family: 'PlusJakartaSans_600';
            src: local('Plus Jakarta Sans'), local('PlusJakartaSans-SemiBold');
            font-weight: 600;
          }
          @font-face {
            font-family: 'PlusJakartaSans_700';
            src: local('Plus Jakarta Sans'), local('PlusJakartaSans-Bold');
            font-weight: 700;
          }
          @font-face {
            font-family: 'PlusJakartaSans_800';
            src: local('Plus Jakarta Sans'), local('PlusJakartaSans-ExtraBold');
            font-weight: 800;
          }
          @font-face {
            font-family: 'Bricolage_600';
            src: local('Plus Jakarta Sans'), local('PlusJakartaSans-SemiBold');
            font-weight: 600;
          }
          @font-face {
            font-family: 'Bricolage_700';
            src: local('Plus Jakarta Sans'), local('PlusJakartaSans-Bold');
            font-weight: 700;
          }
          @font-face {
            font-family: 'Figtree_400';
            src: local('Plus Jakarta Sans'), local('PlusJakartaSans-Regular');
            font-weight: 400;
          }
          @font-face {
            font-family: 'Figtree_500';
            src: local('Plus Jakarta Sans'), local('PlusJakartaSans-Medium');
            font-weight: 500;
          }
          @font-face {
            font-family: 'Figtree_600';
            src: local('Plus Jakarta Sans'), local('PlusJakartaSans-SemiBold');
            font-weight: 600;
          }

          /* Remove white browser focus ring and box-shadow from all inputs */
          input, textarea, select {
            outline: none !important;
            outline-style: none !important;
            box-shadow: none !important;
            -webkit-tap-highlight-color: transparent !important;
          }
          input:focus, textarea:focus, select:focus {
            outline: none !important;
            outline-style: none !important;
            box-shadow: none !important;
          }
          * {
            -webkit-tap-highlight-color: transparent;
          }
        `;
        doc.head.appendChild(style);
      }
    }
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
              <AccountDataResetGate>
                <TargetsProvider>
                  <HardwareBackHandler />
                  <SessionNavigationGuard />
                  <Stack screenOptions={{ headerShown: false }} />
                </TargetsProvider>
              </AccountDataResetGate>
            </AuthProvider>
          </AppInitializationGate>
        </SafeAreaProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

function HardwareBackHandler() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const onBackPress = () => {
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [router]);

  return null;
}
