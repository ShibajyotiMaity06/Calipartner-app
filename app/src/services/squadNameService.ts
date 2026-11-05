import { getSupabase } from '@/lib/supabase';
import { parseRoomError } from '@/types/rooms';

export type SquadNameChange = { room_id: string; name: string };
const listeners = new Set<(change: SquadNameChange) => void>();
export const squadNameEvents = {
  subscribe(listener: (change: SquadNameChange) => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export async function renameSquad(
  roomId: string,
  name: string,
  requestId: string,
): Promise<SquadNameChange> {
  const { data, error } = await getSupabase().rpc('rename_room', {
    p_client_id: requestId,
    p_room_id: roomId,
    p_name: name.trim(),
  });
  if (error) throw parseRoomError(error);
  if (
    data?.room_id !== roomId ||
    data?.request_id !== requestId ||
    typeof data?.name !== 'string' ||
    !data.name.trim()
  )
    throw new Error('RENAME_NOT_ACKNOWLEDGED');
  const change = { room_id: data.room_id, name: data.name };
  for (const listener of listeners) {
    try {
      listener(change);
    } catch {
      /* A view listener cannot undo an acknowledged save. */
    }
  }
  return change;
}
