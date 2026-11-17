export interface RoutePoint {
  lat: number;
  lng: number;
}
export function haversineKm(a: RoutePoint, b: RoutePoint): number {
  const rad = Math.PI / 180,
    dLat = (b.lat - a.lat) * rad,
    dLng = (b.lng - a.lng) * rad;
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)));
}
/** Normalized route geometry for the web preview, including antimeridian crossings. */
export function routeGeometry(points: readonly RoutePoint[]): Array<{ x: number; y: number }> {
  if (!points.length) return [];
  const origin = points[0]!;
  const values = points.map((p) => ({
    x: (((p.lng - origin.lng + 540) % 360) - 180) * Math.cos((origin.lat * Math.PI) / 180),
    y: -p.lat,
  }));
  const minX = Math.min(...values.map((p) => p.x)),
    maxX = Math.max(...values.map((p) => p.x));
  const minY = Math.min(...values.map((p) => p.y)),
    maxY = Math.max(...values.map((p) => p.y));
  const span = Math.max(maxX - minX, maxY - minY, 0.00001);
  return values.map((p) => ({
    x: 50 + ((p.x - (minX + maxX) / 2) / span) * 80,
    y: 50 + ((p.y - (minY + maxY) / 2) / span) * 80,
  }));
}
