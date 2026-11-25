import { kgToLb, projectWeightPaths } from '@calipartner/core';
import type { OnboardingState } from '@/services/onboardingStateMachine';

export function formatTargetEtaDate(weeks: number, now: Date = new Date()): string {
  const safeWeeks = Math.max(1, Math.min(104, Math.round(weeks)));
  const eta = new Date(now.getTime() + safeWeeks * 7 * 24 * 60 * 60 * 1000);
  return eta.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatWeightForUnits(kg: number, units: OnboardingState['units']): string {
  const value = units === 'metric' ? kg : kgToLb(kg);
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function estimateWeeksToTarget(
  currentWeightKg: number,
  targetWeightKg: number | null,
  weeklyRateKg: number,
): number | null {
  if (targetWeightKg === null) return null;
  const diff = Math.abs(currentWeightKg - targetWeightKg);
  if (diff <= 0) return 1;
  const rate = weeklyRateKg > 0 ? weeklyRateKg : 0.5;
  return Math.max(1, Math.round(diff / rate));
}

export interface OnboardingRevealSummary {
  weeks: number;
  startKg: number;
  endKg: number;
  deltaKg: number;
  targetKcal: number;
  rateKg: number;
  etaLabel: string;
  curveWeightsKg: number[];
}

export function computeOnboardingRevealSummary(state: OnboardingState): OnboardingRevealSummary {
  const weightKg = state.weightKg > 0 ? state.weightKg : 70;
  const heightCm = state.heightCm > 0 ? state.heightCm : 175;
  const tdee = state.calculatedTargets?.tdee ?? 2200;
  const targetKcal = state.calculatedTargets?.targetKcal ?? 1800;
  const rateKg =
    state.calculatedTargets?.weeklyRateKg && state.calculatedTargets.weeklyRateKg > 0
      ? state.calculatedTargets.weeklyRateKg
      : state.weeklyRateKg > 0
        ? state.weeklyRateKg
        : 0.5;
  const direction = state.goal === 'bulk' ? 1 : state.goal === 'cut' ? -1 : 0;

  let points: { week: number; weight: number }[] = [];
  try {
    const paths = projectWeightPaths({
      weight: weightKg,
      height: heightCm,
      sex: state.sex,
      gymDays: state.gymDays,
      tdee,
      calories: targetKcal,
      goal: state.goal,
      rate: rateKg,
      targetWeight: state.targetWeightKg ?? undefined,
    });
    points = paths[1]?.points ?? paths[0]?.points ?? [];
  } catch {
    points = [];
  }

  const targetWeeks = estimateWeeksToTarget(weightKg, state.targetWeightKg, rateKg);
  const weeks = targetWeeks ?? Math.max(12, (points[points.length - 1]?.week ?? 12) || 12);
  const projectedEnd =
    points.length > 0 ? points[points.length - 1]!.weight : weightKg + direction * rateKg * weeks;
  const endKg =
    state.targetWeightKg !== null ? state.targetWeightKg : Math.round(projectedEnd * 10) / 10;
  const deltaKg = Math.round((endKg - weightKg) * 10) / 10;

  const curveWeightsKg =
    points.length >= 2
      ? points.map((pt) => pt.weight)
      : Array.from({ length: 13 }, (_, idx) => {
          const t = idx / 12;
          const eased = 1 - Math.pow(1 - t, 1.35);
          return Math.round((weightKg + (endKg - weightKg) * eased) * 100) / 100;
        });

  return {
    weeks,
    startKg: weightKg,
    endKg,
    deltaKg,
    targetKcal,
    rateKg,
    etaLabel: formatTargetEtaDate(weeks),
    curveWeightsKg,
  };
}
