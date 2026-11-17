/** Presentation-only illustration supplied by the owner; never used as a health projection. */
export const growthSeries = [
  { id: 'none', f: (t: number) => 0.3 * (1 - Math.exp(-6 * t)) + 0.02 * t },
  { id: 'plus', f: (t: number) => 0.62 * (0.5 * t + 0.5 * t * t) + 0.015 * t * Math.sin(t * 9) },
  { id: 'pro', f: (t: number) => 0.4 * t + 0.6 * Math.pow(t, 1.9) + 0.02 * t * Math.sin(t * 8) },
] as const;
export const growthEase = (p: number) =>
  p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
export const growthX = (t: number) => 40 + t * 290;
export const growthY = (v: number) => 340 - 48 - (v / 1.12) * 248;
const f1 = (n: number) => Math.round(n * 10) / 10;
const points = growthSeries.map((s) =>
  Array.from({ length: 241 }, (_, i) => [growthX(i / 240), growthY(s.f(i / 240))] as const),
);
export function growthFrame(series: number, progress: number) {
  const pts = points[series]!;
  const idx = Math.max(0, Math.min(1, progress)) * 240,
    k = Math.floor(idx),
    fr = idx - k;
  let d = `M${f1(pts[0]![0])} ${f1(pts[0]![1])}`;
  for (let i = 1; i <= k && i <= 240; i++) d += `L${f1(pts[i]![0])} ${f1(pts[i]![1])}`;
  let [x, y] = pts[Math.min(k, 240)]!;
  if (k < 240) {
    const a = pts[k]!,
      b = pts[k + 1]!;
    x = a[0] + (b[0] - a[0]) * fr;
    y = a[1] + (b[1] - a[1]) * fr;
    d += `L${f1(x)} ${f1(y)}`;
  }
  return { d, area: `${d}L${f1(x)} ${f1(growthY(0))}L${f1(growthX(0))} ${f1(growthY(0))}Z`, x, y };
}
