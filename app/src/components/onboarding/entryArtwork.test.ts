import { expect, it } from 'vitest';
import { splashFrame, splashTimeline } from '../brand/splashTimeline';
import { growthFrame, growthSeries, growthX, growthY } from './growthArtwork';
it('preserves the staggered bar entrance, joined-hand pull and exact final pose', () => {
  expect(splashTimeline.end).toBe(4.9);
  const initial = splashFrame(0);
  expect(initial.opacity).toBe(0);
  initial.bars.forEach((value) => expect(value).toBeCloseTo(0));
  const first = splashFrame(0.8);
  expect(first.bars[0]).toBeCloseTo(1);
  expect(first.bars[2]).toBeCloseTo(0);
  const final = splashFrame(4.9);
  expect(final.bars).toEqual([1, 1, 1]);
  expect(final.opacity).toBe(1);
  expect(final.figureA).toBe('translate(0 0)');
  expect(final.scale).toBe(1);
});
it('interpolates the supplied curves without NaN or overshooting endpoints', () => {
  growthSeries.forEach((series, i) => {
    const start = growthFrame(i, 0),
      end = growthFrame(i, 1);
    expect(start.x).toBe(growthX(0));
    expect(start.y).toBe(growthY(0));
    expect(end.x).toBe(growthX(1));
    expect(end.y).toBeCloseTo(growthY(series.f(1)));
    expect(end.area.endsWith('Z')).toBe(true);
    expect((end.d.match(/L/g) ?? []).length).toBe(240);
    expect(growthFrame(i, 0.503).x).toBeCloseTo(growthX(0.503));
    expect(growthFrame(i, 0.503).d).not.toMatch(/NaN|Infinity/);
  });
});
