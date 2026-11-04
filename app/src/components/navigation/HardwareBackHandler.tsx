import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useRouter } from 'expo-router';

export function HardwareBackHandler() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const onBackPress = () => {
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      // With no previous page, stay here instead of exiting the app.
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [router]);

  return null;
}
