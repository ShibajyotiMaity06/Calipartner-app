export async function isDeviceOffline(): Promise<boolean> {
  try {
    const navigatorState =
      typeof navigator === 'undefined'
        ? undefined
        : (navigator as unknown as { onLine?: boolean }).onLine;
    if (typeof navigatorState === 'boolean') return !navigatorState;
    const { default: NetInfo } = await import('@react-native-community/netinfo');
    const state = await NetInfo.fetch();
    return state.isConnected === false || state.isInternetReachable === false;
  } catch {
    return (
      typeof navigator !== 'undefined' &&
      (navigator as unknown as { onLine?: boolean }).onLine === false
    );
  }
}
