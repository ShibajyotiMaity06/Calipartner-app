import { describe, expect, it } from 'vitest';
import { encode } from 'jpeg-js';
import { decodeBarcodeImage } from './barcodeImageService';
describe('barcode images', () => {
  it.each([false, true])(
    'decodes a real JPEG EAN-13, rotated=%s, without BarcodeDetector',
    async (rotated) => {
      const width = 700,
        height = 300;
      // Published EAN-13 example 4006381333931, with quiet zones around the 95 modules.
      const bits = [
        '101',
        '0001101',
        '0100111',
        '0101111',
        '0111101',
        '0001001',
        '0110011',
        '01010',
        '1000010',
        '1000010',
        '1000010',
        '1110100',
        '1000010',
        '1100110',
        '101',
      ].join('');
      const data = new Uint8Array(width * height * 4);
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const module = Math.floor((x - 112) / 5);
          const value = y > 20 && y < height - 20 && module >= 0 && bits[module] === '1' ? 0 : 255;
          data[i] = value;
          data[i + 1] = value;
          data[i + 2] = value;
          data[i + 3] = 255;
        }
      let pixels = data;
      if (rotated) {
        pixels = new Uint8Array(data.length);
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++) {
            const from = (y * width + x) * 4,
              to = (x * height + height - 1 - y) * 4;
            pixels.set(data.subarray(from, from + 4), to);
          }
      }
      const jpeg = encode(
        {
          data: Buffer.from(pixels),
          width: rotated ? height : width,
          height: rotated ? width : height,
        },
        95,
      );
      expect(await decodeBarcodeImage(jpeg.data.toString('base64'))).toBe('4006381333931');
    },
  );
  it('returns no match for an image without a barcode', async () => {
    const jpeg = encode({ data: Buffer.alloc(100 * 100 * 4, 255), width: 100, height: 100 }, 95);
    expect(await decodeBarcodeImage(jpeg.data.toString('base64'))).toBeNull();
  });
});
