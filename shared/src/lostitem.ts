import { CASE_SPOTS, CASE_SPOT_NAMES, SEARCH_SPOTS, CRATE } from "./missions.ts";
import { ROUTE_SPOT } from "./route.ts";
import { DOORS } from "./doors.ts";
import { WORLD_HALF, POND, PUZZLE_ZONE, resolveCollisions } from "./world.ts";

/**
 * Lost item event (L3, "ของหาย"): the village head announces that a villager lost something near a landmark. The item lies somewhere in the ring
 * around that landmark; every team may look for it, and the first living player to pick it up gets a reward (a smaller one for the rest of the finder's team).
 * Nobody loses points; if nobody finds it in time it simply "turns up" again. The place of the item is public to everybody who gets the message,
 * it is a race of eyes and legs, not a secret. Pure rules for unit tests; the server only applies them.
 */
export const LOST = {
  firstMs: 130_000, everyMs: 200_000, durationMs: 60_000,
  minHumans: 2,
  minR: 6.2, maxR: 11,   // ring around the landmark; 6.2 keeps the item outside the 5.5 closed-area circle and the boss ring of any landmark
  reach: 2.5, reachServer: 4,
  reward: 25, teamReward: 10,
};
export const LOST_ITEMS = [
  { name: "ขันน้ำ", icon: "🪣" }, { name: "ร่มกันฝน", icon: "☂️" }, { name: "รองเท้าแตะ", icon: "🩴" },
  { name: "ตะกร้าผัก", icon: "🧺" }, { name: "พัดลมมือ", icon: "🪭" }, { name: "ไม้กวาด", icon: "🧹" },
] as const;

export interface LostItem { id: string; item: number; site: number; x: number; z: number; startedAt: number; until: number }
export interface LostMember { id: string; team: string; connected: boolean; role: string }

const otherSpots = (): { x: number; z: number }[] => [...SEARCH_SPOTS, CRATE, ROUTE_SPOT, PUZZLE_ZONE, POND, ...DOORS.map((d) => ({ x: d.x, z: d.z }))];
const free = (x: number, z: number): boolean => {
  if (Math.abs(x) > WORLD_HALF - 2 || Math.abs(z) > WORLD_HALF - 2) return false;
  const r = resolveCollisions(x, z, 0.6);
  if (Math.hypot(r.x - x, r.z - z) > 1e-9) return false;
  if (CASE_SPOTS.some((s) => Math.hypot(s.x - x, s.z - z) < LOST.minR)) return false;                  // away from every landmark circle
  return otherSpots().every((s) => Math.hypot(s.x - x, s.z - z) >= 3);                                  // and from other mission spots
};

/** A free place in the ring around landmark `site`: random tries first, then a fixed sweep, null when the ring has no room at all. */
export function pickLostSpot(rnd: () => number, site: number): { x: number; z: number } | null {
  const c = CASE_SPOTS[site];
  for (let i = 0; i < 80; i++) {
    const a = rnd() * Math.PI * 2, d = LOST.minR + 0.01 + rnd() * (LOST.maxR - LOST.minR - 0.02);
    const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
    if (free(x, z)) return { x, z };
  }
  for (let d = LOST.minR + 0.5; d <= LOST.maxR; d += 1) for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2, x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
    if (free(x, z)) return { x, z };
  }
  return null;
}

/** Starts an event: a random item at a random landmark that is not `lastSite` and not in `avoidSites` (boss/closure), when there is a choice. Null if there is no room anywhere. */
export function startLost(rnd: () => number, now: number, lastSite: number | null, avoidSites: readonly (number | null)[], seq: number): LostItem | null {
  const all = CASE_SPOTS.map((_, i) => i);
  let pool = all.filter((i) => i !== lastSite && !avoidSites.includes(i));
  if (!pool.length) pool = all.filter((i) => !avoidSites.includes(i));
  if (!pool.length) pool = all;
  for (let t = 0; t < pool.length; t++) {
    const site = pool[(Math.min(pool.length - 1, Math.floor(rnd() * pool.length)) + t) % pool.length];
    const spot = pickLostSpot(rnd, site);
    if (spot) return { id: `lost${seq}`, item: Math.min(LOST_ITEMS.length - 1, Math.floor(rnd() * LOST_ITEMS.length)), site, x: spot.x, z: spot.z, startedAt: now, until: now + LOST.durationMs };
  }
  return null;
}

export const lostLive = (it: LostItem | null | undefined, now: number): it is LostItem => !!it && now < it.until;
export const lostSiteName = (it: LostItem): string => CASE_SPOT_NAMES[it.site];

/** May this player pick the item up right now? `server` uses the looser reach. Living players only. */
export function canTakeLost(it: LostItem | null | undefined, now: number, p: { x: number; z: number; role: string; connected: boolean }, server: boolean): boolean {
  if (!lostLive(it, now) || !p.connected || p.role === "ghost") return false;
  const d = Math.hypot(p.x - it.x, p.z - it.z);
  return Number.isFinite(d) && d <= (server ? LOST.reachServer : LOST.reach);
}

/** Points: the finder gets `reward`, the other living connected members of the finder's team `teamReward`. Nobody else, nobody loses anything. */
export function lostRewards(finderId: string, members: readonly LostMember[]): Map<string, number> {
  const out = new Map<string, number>(), f = members.find((m) => m.id === finderId);
  if (!f) return out;
  out.set(f.id, LOST.reward);
  if (f.team) for (const m of members) if (m.id !== f.id && m.team === f.team && m.connected && m.role !== "ghost") out.set(m.id, LOST.teamReward);
  return out;
}
