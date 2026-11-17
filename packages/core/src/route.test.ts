import { expect, it } from 'vitest';
import { haversineKm, routeGeometry } from './route';
it('keeps stationary distance zero and computes a known kilometre-scale route', () => {
  expect(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 0 })).toBe(0);
  expect(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.195, 2);
});
it('renders empty, single-point and antimeridian routes without invalid geometry', () => {
  expect(routeGeometry([])).toEqual([]);
  expect(routeGeometry([{ lat: 0, lng: 0 }])).toEqual([{ x: 50, y: 50 }]);
  const points = routeGeometry([
    { lat: 0, lng: 179.99 },
    { lat: 0, lng: -179.99 },
  ]);
  expect(points[0]!.x).toBeCloseTo(10);
  expect(points[1]!.x).toBeCloseTo(90);
});
