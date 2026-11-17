import { Directory, File, Paths } from 'expo-file-system';

function directory(owner: string) {
  if (!/^[a-z0-9-]+$/i.test(owner)) throw new Error('INVALID_OWNER');
  const folder = new Directory(Paths.document, 'progress-photos', owner);
  folder.create({ intermediates: true, idempotent: true });
  return folder;
}
export async function persistPhoto(owner: string, id: string, uri: string): Promise<string> {
  if (!/^[a-z0-9-]+$/i.test(id)) throw new Error('INVALID_ID');
  const name = id + '.jpg';
  const file = new File(directory(owner), name);
  if (!file.exists) await new File(uri).copy(file);
  return name;
}
export function photoUri(owner: string, stored: string): string {
  if (!/^[a-z0-9-]+\.jpg$/i.test(stored)) throw new Error('INVALID_PHOTO');
  return new File(directory(owner), stored).uri;
}
export async function removePhoto(owner: string, stored: string): Promise<void> {
  const file = new File(photoUri(owner, stored));
  if (file.exists) file.delete();
}
