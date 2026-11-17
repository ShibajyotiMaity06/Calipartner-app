import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as StoreReview from 'expo-store-review';

/** The OS may suppress its review dialog. Never claim that a review was submitted. */
export async function requestStoreReview(): Promise<boolean> {
  if (Platform.OS !== 'web') {
    try {
      if (await StoreReview.isAvailableAsync()) {
        await StoreReview.requestReview();
        return true;
      }
    } catch {
      /* Try a configured store listing, otherwise show the real feedback form. */
    }
  }
  if (Platform.OS === 'android') {
    if (process.env.EXPO_PUBLIC_GOOGLE_PLAY_AVAILABLE !== 'true') return false;
    const id = Constants.expoConfig?.android?.package;
    if (!id) return false;
    try {
      await Linking.openURL('market://details?id=' + encodeURIComponent(id));
    } catch {
      await Linking.openURL(
        'https://play.google.com/store/apps/details?id=' + encodeURIComponent(id),
      );
    }
    return true;
  }
  if (Platform.OS === 'ios') {
    const id = process.env.EXPO_PUBLIC_APPLE_APP_ID;
    if (id && /^\d+$/.test(id)) {
      await Linking.openURL(`https://apps.apple.com/app/id${id}?action=write-review`);
      return true;
    }
  }
  return false;
}
