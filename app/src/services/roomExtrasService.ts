import { getSupabase } from '@/lib/supabase';

export interface SharedWorkout {
  id: string;
  sender: string;
  name: string | null;
  type: string;
  duration_minutes: number;
  local_date: string;
  exercises: Array<{
    name: string;
    sets: Array<{
      reps: number | null;
      weight_kg: number | null;
      duration_seconds: number | null;
      distance_meters: number | null;
    }>;
  }>;
}
export interface PairChallenge {
  id: string;
  creator_id: string;
  partner_id: string;
  status: 'pending' | 'active' | 'declined' | 'completed';
  started_at: string | null;
  days: Array<{ user_id: string; name: string; logged_days: number | 'locked' }>;
}

export async function loadRoomExtras(roomId: string) {
  const client = getSupabase();
  const [shares, challenges, workouts] = await Promise.all([
    client.rpc('get_room_workout_shares', { p_room_id: roomId }),
    client.rpc('get_pair_challenges', { p_room_id: roomId }),
    client
      .from('workouts')
      .select('id,name,local_date')
      .is('deleted_at', null)
      .order('local_date', { ascending: false })
      .limit(20),
  ]);
  if (shares.error || challenges.error || workouts.error)
    throw new Error('Could not load room extras');
  return {
    shares: (shares.data ?? []) as SharedWorkout[],
    challenges: (challenges.data ?? []) as PairChallenge[],
    workouts: (workouts.data ?? []) as Array<{
      id: string;
      name: string | null;
      local_date: string;
    }>,
  };
}
export async function shareRoomWorkout(clientId: string, roomId: string, workoutId: string) {
  const { error } = await getSupabase().rpc('share_room_workout', {
    p_client_id: clientId,
    p_room_id: roomId,
    p_workout_id: workoutId,
  });
  if (error) throw error;
}
export async function createPairChallenge(clientId: string, roomId: string, partnerId: string) {
  const { error } = await getSupabase().rpc('create_pair_challenge', {
    p_client_id: clientId,
    p_room_id: roomId,
    p_partner_id: partnerId,
  });
  if (error) throw error;
}
export async function respondPairChallenge(challengeId: string, accept: boolean) {
  const { error } = await getSupabase().rpc('respond_pair_challenge', {
    p_challenge_id: challengeId,
    p_accept: accept,
  });
  if (error) throw error;
}
