import { expect, it, vi } from 'vitest';
vi.mock('./foodService', () => ({
  generateClientUuid: vi.fn().mockImplementation(() => crypto.randomUUID()),
}));
import { aiRequestKey } from './aiRequestKey';
it('retains a request ID after failure and rotates it only after an acknowledged result or changed input', () => {
  const client = {};
  const first = aiRequestKey(client, 'coach', { message: 'Help with lunch' });
  expect(aiRequestKey(client, 'coach', { message: 'Help with lunch' }).id).toBe(first.id);
  first.acknowledge();
  expect(aiRequestKey(client, 'coach', { message: 'Help with lunch' }).id).not.toBe(first.id);
  const changed = aiRequestKey(client, 'coach', { message: 'Help with training' });
  expect(changed.id).not.toBe(first.id);
  expect(aiRequestKey({}, 'coach', { message: 'Help with training' }).id).not.toBe(changed.id);
});
