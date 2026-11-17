/** Persist bytes, never a temporary blob URL, in the browser's account-scoped database. */
export async function persistPhoto(_owner: string, _id: string, uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  if (!blob.type.startsWith('image/') || blob.size > 10000000) throw new Error('INVALID_PHOTO');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('PHOTO_READ_FAILED'));
    reader.readAsDataURL(blob);
  });
}
export function photoUri(_owner: string, stored: string): string {
  return stored;
}
export async function removePhoto(_owner: string, _stored: string): Promise<void> {
  /* Bytes are removed with the metadata row. */
}
