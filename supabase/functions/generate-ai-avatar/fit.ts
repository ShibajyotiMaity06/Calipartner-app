import { PNG } from 'npm:pngjs@7.0.0';
import { Buffer } from 'node:buffer';

const width = 768;
const height = 1376;

type Bitmap = { width: number; height: number; data: Uint8Array };
type Bounds = { left: number; top: number; right: number; bottom: number };

function foreground(data: Uint8Array, index: number) {
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const alpha = data[index + 3];
  return (
    alpha > 48 && !(red > 160 && blue > 155 && green < 100 && red - green > 85 && blue - green > 85)
  );
}

function bounds(image: Bitmap, visible: (data: Uint8Array, index: number) => boolean): Bounds {
  const box = { left: image.width, top: image.height, right: -1, bottom: -1 };
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (!visible(image.data, 4 * (y * image.width + x))) continue;
      box.left = Math.min(box.left, x);
      box.top = Math.min(box.top, y);
      box.right = Math.max(box.right, x);
      box.bottom = Math.max(box.bottom, y);
    }
  }
  return box;
}

/** The render uses the shipping base's exact alpha, including its wardrobe anchors. */
export function fitAvatarPng(generated: Uint8Array, reference: Uint8Array) {
  const header = new DataView(generated.buffer, generated.byteOffset, generated.byteLength);
  if (
    generated.byteLength < 24 ||
    header.getUint32(0) !== 0x89504e47 ||
    header.getUint32(16) > 2048 ||
    header.getUint32(20) > 2048
  )
    throw new Error('AVATAR_FIT_FAILED');
  const source: Bitmap = PNG.sync.read(Buffer.from(generated));
  const template: Bitmap = PNG.sync.read(Buffer.from(reference));
  if (template.width !== width || template.height !== height)
    throw new Error('INVALID_AVATAR_TEMPLATE');
  const body = bounds(source, foreground);
  const target = bounds(template, (data, index) => data[index + 3] > 48);
  if (
    body.bottom - body.top < source.height / 2 ||
    body.right - body.left < source.width / 10 ||
    body.top < 2 ||
    body.bottom > source.height - 3 ||
    body.left < 2 ||
    body.right > source.width - 3
  )
    throw new Error('AVATAR_FIT_FAILED');

  const output: Bitmap = new PNG({ width, height });
  let matched = 0;
  let visible = 0;
  let excess = 0;
  for (let y = target.top; y <= target.bottom; y++) {
    const sourceY = Math.round(
      body.top + ((y - target.top) * (body.bottom - body.top)) / (target.bottom - target.top),
    );
    for (let x = target.left; x <= target.right; x++) {
      const index = (y * width + x) * 4;
      const sourceX = Math.round(
        body.left + ((x - target.left) * (body.right - body.left)) / (target.right - target.left),
      );
      const pixel = (sourceY * source.width + sourceX) * 4;
      const generatedBody = foreground(source.data, pixel);
      if (template.data[index + 3] > 48) {
        visible++;
        if (generatedBody) matched++;
      } else if (generatedBody) excess++;
      if (generatedBody) {
        output.data.set(source.data.subarray(pixel, pixel + 3), index);
        output.data[index + 3] = 255;
      }
    }
  }
  if (matched / visible < 0.78 || excess / visible > 0.26) throw new Error('AVATAR_FIT_FAILED');
  for (let index = 0; index < template.data.length; index += 4) {
    if (!template.data[index + 3]) {
      output.data.fill(0, index, index + 4);
      continue;
    }
    if (!output.data[index + 3]) {
      output.data.set(template.data.subarray(index, index + 3), index);
    }
    output.data[index + 3] = template.data[index + 3];
  }
  return PNG.sync.write(output);
}
