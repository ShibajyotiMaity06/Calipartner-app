import { generateClientUuid } from './foodService';

const pending = new WeakMap<object, Map<string, { fingerprint: string; id: string }>>();
/** Keep the same UUID for an explicit retry after a network error; retain no images after success. */
export function aiRequestKey(client: object, feature: string, payload: unknown) {
  let requests = pending.get(client);
  if (!requests) {
    requests = new Map();
    pending.set(client, requests);
  }
  const fingerprint = JSON.stringify(payload);
  let request = requests.get(feature);
  if (request?.fingerprint !== fingerprint) {
    request = { fingerprint, id: generateClientUuid() };
    requests.set(feature, request);
  }
  const id = request!.id;
  return {
    id,
    acknowledge: () => {
      if (requests.get(feature)?.id === id) requests.delete(feature);
    },
  };
}
