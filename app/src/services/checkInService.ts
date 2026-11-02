import { withOnlineSave } from './accountDataService';
import { generateClientUuid } from './foodService';
import { saveRemote, type LocalDb } from './accountDataService';

export type CheckInActivity = 'ate' | 'trained' | 'walked' | 'rest';
export interface SquadDayMember {
  user_id: string;
  nickname: string;
  is_self: boolean;
  checked_in: boolean | null;
  activities: CheckInActivity[];
  note: string | null;
  occurred_at: string | null;
}

export async function saveCheckIn(
  db: LocalDb,
  input: {
    userId: string;
    roomId: string;
    localDate: string;
    activities: CheckInActivity[];
    note: string;
    share: boolean;
    occurredAt: string;
  },
): Promise<void> {
  return withOnlineSave(db, async (db) => {
    if (
      !input.userId ||
      !input.roomId ||
      input.note.length > 500 ||
      input.activities.some((value) => !['ate', 'trained', 'walked', 'rest'].includes(value))
    )
      throw new Error('INVALID_CHECK_IN');
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM local_squad_check_ins WHERE user_id=? AND room_id=? AND local_date=?',
      [input.userId, input.roomId, input.localDate],
    );
    const id = existing?.id ?? generateClientUuid();
    const now = new Date().toISOString();
    const payload = {
      id,
      user_id: input.userId,
      room_id: input.roomId,
      local_date: input.localDate,
      activities: input.activities,
      note: input.note.trim(),
      share_with_squad: input.share,
      occurred_at: input.occurredAt,
      updated_at: now,
    };
    const write = async () => {
      await db.runAsync(
        `INSERT INTO local_squad_check_ins (id,user_id,room_id,local_date,activities,note,share_with_squad,occurred_at,updated_at,sync_state) VALUES (?,?,?,?,?,?,?,?,?,'synced') ON CONFLICT(id) DO UPDATE SET activities=excluded.activities,note=excluded.note,share_with_squad=excluded.share_with_squad,occurred_at=excluded.occurred_at,updated_at=excluded.updated_at,sync_state='synced'`,
        [
          id,
          input.userId,
          input.roomId,
          input.localDate,
          JSON.stringify(input.activities),
          payload.note,
          input.share ? 1 : 0,
          input.occurredAt,
          now,
        ],
      );
      await saveRemote(db, { id, entity: 'squad_check_ins', operation: 'upsert', payload });
    };
    if (db.withTransactionAsync) await db.withTransactionAsync(write);
    else await write();
  });
}
