import { CASE_SPOTS, CASE_SPOT_NAMES } from "./missions.ts";

/**
 * Temporary closed area (M3.8 "พื้นที่ปิดชั่วคราว"): now and then the village head closes the area around one landmark for a short time.
 * Living players cannot walk into the circle until it reopens; players already inside may still walk out. Ghost players are not blocked.
 * No penalty, no points: it only makes the crowd route around or wait. The server applies `closureStep` to every move, and the client runs the
 * very same function when predicting its own walk, so the two agree and nobody is rubber-banded. Pure rules for unit tests.
 */
export const CLOSURE = { firstMs: 100_000, everyMs: 180_000, durationMs: 30_000, radius: 5.5 };

export interface Closure { site: number; startedAt: number; until: number }

export const closureSite = (i: number): { name: string; x: number; z: number } => ({ name: CASE_SPOT_NAMES[i], x: CASE_SPOTS[i].x, z: CASE_SPOTS[i].z });
export const closureActive = (c: Closure | null | undefined, now: number): c is Closure => !!c && now < c.until;

/** Picks a landmark that is neither the last closed one nor `avoidSite` (e.g. where the boss spirit is), when there is a choice. */
export function pickClosure(rnd: () => number, lastSite: number | null, avoidSite: number | null, now: number): Closure {
  const all = CASE_SPOTS.map((_, i) => i);
  let pool = all.filter((i) => i !== lastSite && i !== avoidSite);
  if (!pool.length) pool = all.filter((i) => i !== avoidSite);
  if (!pool.length) pool = all;
  const site = pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
  return { site, startedAt: now, until: now + CLOSURE.durationMs };
}

/**
 * Where a living player ends up when trying to go from `prev` to `next`.
 * Outside -> trying to enter: slides along the edge (the point on the circle in the direction of `next`).
 * Already inside (closed while standing there): may move only away from the centre, otherwise stays put.
 */
export function closureStep(c: Closure, prev: { x: number; z: number }, next: { x: number; z: number }): { x: number; z: number } {
  const s = closureSite(c.site), r = CLOSURE.radius;
  const dN = Math.hypot(next.x - s.x, next.z - s.z);
  if (dN >= r) return { x: next.x, z: next.z };
  const dP = Math.hypot(prev.x - s.x, prev.z - s.z);
  if (dP >= r) {
    const ux = dN < 1e-9 ? prev.x - s.x : next.x - s.x, uz = dN < 1e-9 ? prev.z - s.z : next.z - s.z, len = Math.hypot(ux, uz) || 1;
    return { x: s.x + (ux / len) * (r + 1e-6), z: s.z + (uz / len) * (r + 1e-6) };
  }
  return dN >= dP ? { x: next.x, z: next.z } : { x: prev.x, z: prev.z };
}
