import type { LocalDb, RemoteWrite } from '@/services/accountDataService';
const writes = new WeakMap<LocalDb, Map<string, RemoteWrite>>();
export async function recordRemoteWrite(db: LocalDb, item: RemoteWrite) {
  let records = writes.get(db);
  if (!records) {
    records = new Map();
    writes.set(db, records);
  }
  records.set(item.id, structuredClone(item));
}
export async function recordedWrites(db: LocalDb): Promise<RemoteWrite[]> {
  return [...(writes.get(db)?.values() ?? [])];
}
