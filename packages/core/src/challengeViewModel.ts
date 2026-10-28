import type { ChallengeHome, ChallengeSnapshot } from './challengeTypes';
import type { ChallengeMetric } from './challengeEngine';
/** Server-derived navigation and presentation data; no device clock is trusted. */
export function buildChallengeHome(home: ChallengeHome) {
  const due = home.items.flatMap((item) =>
    item.self.status === 'joined' && item.challenge.status === 'active'
      ? (item.participants.find((p) => p.self)?.summary?.today_tasks ?? [])
          .filter((task) => task.percent < item.challenge.rules_snapshot.daily_cap_pct)
          .map((task) => ({ id: item.challenge.id, ...task }))
      : [],
  );
  const templates = home.catalog.templates
    .filter(
      (t) =>
        !t.season_id ||
        home.catalog.seasons.some(
          (s) =>
            s.id === t.season_id &&
            (s.ends_at > home.catalog.now ||
              home.items.some((i) => i.challenge.template_id === t.id)),
        ),
    )
    .sort((a, b) => {
      const aJoined = home.items.some((i) => i.challenge.template_id === a.id),
        bJoined = home.items.some((i) => i.challenge.template_id === b.id);
      if (aJoined !== bJoined) return aJoined ? -1 : 1;
      const sa = home.catalog.seasons.find((s) => s.id === a.season_id),
        sb = home.catalog.seasons.find((s) => s.id === b.season_id);
      if (!sa || !sb) return 0;
      const aOpen = sa.starts_at <= home.catalog.now,
        bOpen = sb.starts_at <= home.catalog.now;
      if (aOpen !== bOpen) return aOpen ? -1 : 1;
      return (aOpen ? sa.ends_at : sa.starts_at).localeCompare(bOpen ? sb.ends_at : sb.starts_at);
    });
  return { ...home, due, catalog: { ...home.catalog, templates } };
}
export function challengeDuelOutcome(snapshot: ChallengeSnapshot): {
  kind: 'private' | 'running' | 'tie' | 'leader';
  name?: string;
} {
  const playing = snapshot.participants.filter(
    (p) => !['left', 'declined', 'invited'].includes(p.status),
  );
  if (playing.some((p) => p.overall_percent === 'locked')) return { kind: 'private' };
  if (playing.some((p) => !['completed', 'finished'].includes(p.status)))
    return { kind: 'running' };
  if (playing.length < 2) return { kind: 'running' };
  const highest = Math.max(...playing.map((p) => Number(p.overall_percent)));
  const leaders = playing.filter((p) => p.overall_percent === highest);
  return leaders.length === 1
    ? { kind: 'leader', name: leaders[0]!.name ?? undefined }
    : { kind: 'tie' };
}
export function challengeLogRoute(metric: ChallengeMetric): string {
  return metric === 'focus_minutes'
    ? '/focus'
    : metric === 'workouts_count' || metric === 'workout_minutes'
      ? '/log?flow=workout'
      : metric === 'food_log_days' || metric === 'protein_in_range'
        ? '/log?flow=food'
        : metric === 'water_ml'
          ? '/log?flow=water'
          : metric === 'weigh_in_days'
            ? '/log?flow=weight'
            : '/today';
}
