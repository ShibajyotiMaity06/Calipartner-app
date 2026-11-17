import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as StoreReview from 'expo-store-review';

/** Explicit Rate buttons open the store because native dialogs can be suppressed. */
export async function openStoreReviewPage(): Promise<boolean> {
  const androidId = Constants.expoConfig?.android?.package;
  const playAvailable = process.env.EXPO_PUBLIC_GOOGLE_PLAY_AVAILABLE === 'true';
  if ((Platform.OS === 'android' || Platform.OS === 'web') && playAvailable && androidId) {
    const query = 'id=' + encodeURIComponent(androidId) + '&showAllReviews=true';
    if (Platform.OS === 'android') {
      try {
        await Linking.openURL('market://details?' + query);
        return true;
      } catch {
        /* Use the same listing on the web if no market handler is installed. */
      }
    }
    await Linking.openURL('https://play.google.com/store/apps/details?' + query);
    return true;
  }
  if (Platform.OS === 'ios' || Platform.OS === 'web') {
    const appleId = process.env.EXPO_PUBLIC_APPLE_APP_ID;
    if (appleId && /^\d+$/.test(appleId)) {
      await Linking.openURL(`https://apps.apple.com/app/id${appleId}?action=write-review`);
      return true;
    }
  }
  return false;
}

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
