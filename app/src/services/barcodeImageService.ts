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
  // Try both orientations. A portrait label should not need manual rotation.
  for (const rotated of [false, true]) {
    let pixels = gray;
    let width = image.width,
      height = image.height;
    if (rotated) {
      pixels = new Uint8ClampedArray(gray.length);
      for (let y = 0; y < image.height; y++)
        for (let x = 0; x < image.width; x++)
          pixels[x * image.height + (image.height - 1 - y)] = gray[y * image.width + x]!;
      width = image.height;
      height = image.width;
    }
    try {
      const source = new zxing.RGBLuminanceSource(pixels, width, height);
      return reader.decode(new zxing.BinaryBitmap(new zxing.HybridBinarizer(source))).getText();
    } catch {
      /* Try the next orientation. */
    } finally {
      reader.reset();
    }
  }
  return null;
}
