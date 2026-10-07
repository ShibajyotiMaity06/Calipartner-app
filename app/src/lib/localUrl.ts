/**
 * The Android emulator reaches the host machine at 10.0.2.2, not 127.0.0.1/localhost.
 * Only applied to local URLs so real hosted URLs are untouched.
 */
export function resolveLocalUrl(url: string, os: string): string {
  if (os !== 'android') return url;
  return url.replace(/\/\/(127\.0\.0\.1|localhost)(?=[:/]|$)/, '//10.0.2.2');
}
