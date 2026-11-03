export interface SquadNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
export interface SquadMember extends SquadNutrition {
  user_id: string;
  username: string;
  nickname: string;
  avatar_url: string | null;
  is_self: boolean;
  role: 'host' | 'member';
  status: string;
  goal: 'cut' | 'bulk' | 'maintain' | null;
  local_date: string;
  steps: number;
  targets: (SquadNutrition & { steps: number }) | null;
  height_cm: number | null;
  weight_kg: number | null;
}
export interface RankedSquadMember extends SquadMember {
  score: number | null;
  rank: number | null;
}
export interface SquadToday {
  room_id: string;
  members: RankedSquadMember[];
}
export interface SquadMeal extends SquadNutrition {
  section: 'breakfast' | 'lunch' | 'dinner' | 'snacks' | 'extra';
  items: { id: string; name: string; quantity: number; unit: string }[];
}
export interface SquadWorkout {
  id: string;
  name: string;
  type: string;
  duration_minutes: number;
  exercises: {
    id: string;
    name: string;
    sets: {
      set_number: number;
      reps: number | null;
      weight_kg: number | null;
      duration_seconds: number | null;
      distance_meters: number | null;
    }[];
  }[];
}
export interface SquadMemberDetails {
  meals: SquadMeal[];
  workouts: SquadWorkout[];
}
export interface SquadMention {
  message_id: string;
  sender_id: string;
  nickname: string;
  text: string;
  created_at: string;
}
export interface SquadMentions {
  count: number;
  locked: boolean;
  mentions: SquadMention[];
  has_more: boolean;
}

/** No bonus for eating above a target. Missing or invalid targets are unranked. */
export function squadGoalCompletion(
  actual: SquadNutrition,
  targets: SquadNutrition | null,
): number | null {
  if (!targets) return null;
  const keys = ['calories', 'protein', 'carbs', 'fat'] as const;
  if (
    keys.some(
      (key) =>
        !Number.isFinite(targets[key]) ||
        targets[key] < 0 ||
        !Number.isFinite(actual[key]) ||
        actual[key] < 0,
    ) ||
    targets.calories === 0
  )
    return null;
  // A deliberately zero macro target is complete without requiring someone to eat it.
  const total = keys.reduce(
    (sum, key) => sum + (targets[key] === 0 ? 1 : Math.min(1, actual[key] / targets[key])),
    0,
  );
  return Math.round((total / keys.length) * 1000) / 10;
}

/** Equal scores share a rank; stable IDs break presentation ties without using raw intake. */
export function rankSquadMembers(members: SquadMember[]): RankedSquadMember[] {
  const ranked = members
    .map((member) => ({
      ...member,
      score: squadGoalCompletion(member, member.targets),
      rank: null as number | null,
    }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.user_id.localeCompare(b.user_id));
  let previous: number | null = null,
    rank = 0;
  return ranked.map((member, index) => {
    if (member.score === null) return member;
    if (member.score !== previous) rank = index + 1;
    previous = member.score;
    return { ...member, rank };
  });
}
