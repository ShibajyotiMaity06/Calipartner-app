import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { PNG } from 'npm:pngjs@7.0.0';
import { fitAvatarPng } from './fit.ts';

for (const gender of ['f', 'm']) {
  Deno.test(
    `generated ${gender} avatar retains the actual base dimensions and every alpha pixel`,
    async () => {
      const bytes = await Deno.readFile(new URL(`./base_${gender}_form1.png`, import.meta.url));
      const template = PNG.sync.read(Buffer.from(bytes));
      const art = new PNG({ width: template.width, height: template.height });
      for (let offset = 0; offset < template.data.length; offset += 4) {
        const foreground = template.data[offset + 3] > 48;
        art.data.set(foreground ? [103, 61, 42, 255] : [255, 0, 255, 255], offset);
      }
      const normalized = PNG.sync.read(fitAvatarPng(PNG.sync.write(art), bytes));
      assert.equal(normalized.width, 768);
      assert.equal(normalized.height, 1376);
      for (let offset = 3; offset < normalized.data.length; offset += 4) {
        assert.equal(normalized.data[offset], template.data[offset]);
      }
      art.data.fill(255);
      assert.throws(() => fitAvatarPng(PNG.sync.write(art), bytes), /AVATAR_FIT_FAILED/);
    },
  );
}
