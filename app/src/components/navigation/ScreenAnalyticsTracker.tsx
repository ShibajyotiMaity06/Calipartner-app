import { useEffect } from 'react';
import { usePathname, useSegments } from 'expo-router';
import { recordScreenTransition } from '@/services/analyticsService';

/**
 * Headless analytics component that monitors screen navigation changes in Expo Router,
 * automatically records screen views, and calculates dwell times between screens
 * to measure user drop-offs and feature engagement without modifying individual screens.
 */
export function ScreenAnalyticsTracker(): null {
  const pathname = usePathname();
  const segments = useSegments();

  useEffect(() => {
    if (!pathname) return;

    recordScreenTransition(pathname, {
      route_segment: segments?.length ? segments.join('/') : pathname,
    });
  }, [pathname, segments]);

  return null;
}
