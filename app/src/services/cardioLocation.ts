import { Platform } from 'react-native';
import * as Location from 'expo-location';

export type CardioPosition = {
  coords: { latitude: number; longitude: number; accuracy: number | null };
  timestamp: number;
};

interface BrowserLocation {
  watchPosition(
    success: (position: CardioPosition) => void,
    failure: (error: { code: number; PERMISSION_DENIED: number }) => void,
    options: { enableHighAccuracy: boolean; maximumAge: number; timeout: number },
  ): number;
  clearWatch(id: number): void;
}

export async function watchCardioLocation(
  onPosition: (position: CardioPosition) => void,
  onLoss: (denied: boolean) => void,
) {
  if (Platform.OS === 'web') {
    const provider = (globalThis.navigator as { geolocation?: BrowserLocation } | undefined)
      ?.geolocation;
    if (!provider) throw new Error('GPS_UNAVAILABLE');
    const id = provider.watchPosition(
      onPosition,
      (error) => onLoss(error.code === error.PERMISSION_DENIED),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    return { remove: () => provider.clearWatch(id) };
  }

  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('LOCATION_PERMISSION');
  return Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 3000 },
    onPosition,
    () => onLoss(false),
  );
}
