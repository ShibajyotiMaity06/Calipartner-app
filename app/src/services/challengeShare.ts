/** Native image sharing is handled by react-native-svg and expo-sharing in the share card. */
export async function shareChallengeImage(
  _title: string,
  _score: string,
  _summary: string,
  _id: string,
  _chapter?: string,
): Promise<void> {
  throw new Error('USE_NATIVE_SHARE_CARD');
}
