/** Decode a prepared JPEG on native or web; no browser-only BarcodeDetector dependency. */
export async function decodeBarcodeImage(base64: string): Promise<string | null> {
  const [{ decode }, zxing] = await Promise.all([import('jpeg-js'), import('@zxing/library')]);
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const image = decode(bytes, { useTArray: true, maxMemoryUsageInMB: 64 });
  const gray = new Uint8ClampedArray(image.width * image.height);
  for (let i = 0; i < gray.length; i++)
    gray[i] = (image.data[i * 4]! + 2 * image.data[i * 4 + 1]! + image.data[i * 4 + 2]!) / 4;
  const reader = new zxing.MultiFormatReader();
  reader.setHints(new Map([[zxing.DecodeHintType.TRY_HARDER, true]]));
  try {
    const source = new zxing.RGBLuminanceSource(gray, image.width, image.height);
    return reader.decode(new zxing.BinaryBitmap(new zxing.HybridBinarizer(source))).getText();
  } catch {
    return null;
  } finally {
    reader.reset();
  }
}
