// The owner supplied timeline and easing, in seconds. Geometry is in AnimatedLogoSplash.
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t: number, start: number, dur: number) => clamp((t - start) / dur);
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeOutBack = (x: number) => {
  const c1 = 1.70158,
    c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const easeInOutBack = (x: number) => {
  const c1 = 1.70158,
    c2 = c1 * 1.525;
  return x < 0.5
    ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
    : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
};
export const splashTimeline = {
  barsStart: 0.25,
  barStagger: 0.5,
  barDur: 0.55,
  enterStart: 1.95,
  enterDur: 0.7,
  pullStart: 3.05,
  pullDur: 1.1,
  pulseStart: 4.2,
  pulseDur: 0.5,
  end: 4.9,
};
export function splashFrame(t: number) {
  const T = splashTimeline;
  const e = easeOutCubic(seg(t, T.enterStart, T.enterDur));
  const slide = (1 - e) * 70;
  const p = easeInOutBack(seg(t, T.pullStart, T.pullDur));
  const theta = -14 * (1 - p);
  const r = (theta * Math.PI) / 180,
    vx = 213 - 328,
    vy = 139 - 200;
  const hand = {
    x: 328 + vx * Math.cos(r) - vy * Math.sin(r),
    y: 200 + vx * Math.sin(r) + vy * Math.cos(r),
  };
  return {
    bars: [0, 1, 2].map((i) => easeOutBack(seg(t, T.barsStart + i * T.barStagger, T.barDur))),
    opacity: e,
    figureB: `translate(${slide} 0) rotate(${theta} 328 200)`,
    figureA: `translate(${hand.x - 213 - slide} ${hand.y - 139})`,
    scale: 1 + 0.035 * Math.sin(Math.PI * seg(t, T.pulseStart, T.pulseDur)),
  };
}
