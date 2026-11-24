export const EVIDENCE_SPOTS = [
  { x: -24, z: 8 }, { x: -18, z: -4 }, { x: 20, z: -8 }, { x: 30, z: -14 },
  { x: -30, z: -20 }, { x: 12, z: 12 }, { x: -8, z: 24 }, { x: 26, z: 20 },
  { x: 30, z: -26 }, { x: -33, z: -32 }, // in front of the temple, deep in the forest
];
// Detective case (Milestone 3): five clue spots, one per landmark. Kept out of every solid object (checked by a unit test).
export const CASE_SPOTS = [{ x: -6, z: -21 }, { x: -22, z: 1.5 }, { x: 24, z: -25 }, { x: -15.5, z: 12.5 }, { x: -27, z: -26 }];
export const CASE_SPOT_NAMES = ["หน้าโรงเรียน", "ตลาด", "หน้าวัด", "ริมบ่อน้ำ", "ป่าท้ายหมู่บ้าน"] as const;
// Searchable village objects (Milestone 3, interactive world): each can be searched once per player per match for a short story note (no points).
export const SEARCH_SPOTS = [
  { id: "o0", name: "ตู้ลิ้นชักข้างบ้านยกพื้น", x: -12, z: -10 }, { id: "o1", name: "หีบไม้หลังบ้านยกพื้น", x: 12, z: -14 },
  { id: "o2", name: "ตู้ไปรษณีย์ร้างริมทุ่งนา", x: 30, z: -20 }, { id: "o3", name: "ลังไม้ข้างถนน", x: -4, z: 22 },
] as const;
export const SEARCH_REACH = 3, SEARCH_REACH_SERVER = 4.5;
export const EVIDENCE_REACH = 3;            // client shows the prompt inside this
export const EVIDENCE_REACH_SERVER = 4.5;   // server accepts a pickup inside this (lag slack)
export const EVIDENCE_RESPAWN_MS = 20_000;

/** The lantern ghost is harmless: it only startles. No damage, no score loss. */
export const GHOST = {
  speed: 2.2, scareRadius: 2.2, scareCooldownMs: 15_000,
  xHalf: 34, zMin: -34, zMax: 26, // stays away from the team houses
  eventMinMs: 25_000, eventMaxMs: 45_000, blackoutMs: 6_000,
};

export interface GhostBody { x: number; z: number; tx: number; tz: number }

/** One simulation tick of the wandering ghost. rnd() must return [0,1). Pure, so it is unit-tested. */
export function stepGhost(g: GhostBody, dt: number, rnd: () => number, speedMul = 1): GhostBody {
  const dx = g.tx - g.x, dz = g.tz - g.z, d = Math.hypot(dx, dz);
  if (d < 0.5) return { ...g, tx: (rnd() * 2 - 1) * GHOST.xHalf, tz: GHOST.zMin + rnd() * (GHOST.zMax - GHOST.zMin) };
  const step = Math.min(d, GHOST.speed * speedMul * dt);
  return { x: g.x + (dx / d) * step, z: g.z + (dz / d) * step, tx: g.tx, tz: g.tz };
}

export function shouldScare(gx: number, gz: number, px: number, pz: number, lastScareMs: number, nowMs: number, radiusMul = 1): boolean {
  return Math.hypot(gx - px, gz - pz) <= GHOST.scareRadius * radiusMul && nowMs - lastScareMs >= GHOST.scareCooldownMs;
}

import { TEAMS } from "./teams.ts";

// ---- Delivery mission (+SCORE.mission): carry a crate from the market to your team's house ----
export const CRATE = { x: -22, z: 9 };
export const CRATE_REACH = 3, CRATE_REACH_SERVER = 4.5;
export const DROP_REACH = 4, DROP_REACH_SERVER = 6;
// Delivery can be done any time and any number of times, but every trip has a time limit and every delivery a cooldown.
// Balance guard (a trip is ~10 s): the first `fullCount` deliveries pay SCORE.mission, later ones only `laterRate` of it.
export const DELIVERY = { fullCount: 4, laterRate: 0.4, cooldownMs: 30_000, tripMs: 45_000, expiredCooldownMs: 15_000 };
// Chaos Party relay: where throwable gadgets can lie during the relay and fishing rounds (kept clear of trees; a unit test checks they are reachable)
export const GADGET_SPOTS = [{ x: -8, z: 6 }, { x: 8, z: 6 }, { x: 15, z: 19 }, { x: -14, z: -4.5 }, { x: 18, z: -4.5 }, { x: 2, z: -10 }, { x: -26, z: -6 }, { x: 24, z: 10 }, { x: -2, z: 28 }, { x: -13, z: 16 }, { x: -16.5, z: 23 }, { x: -23.5, z: 23 }]; // the last three lie by the pond for the fishing round
export function dropZoneFor(teamId: string): { x: number; z: number } {
  const i = Math.max(0, TEAMS.findIndex((t) => t.id === teamId));
  return { x: (i - 2) * 14, z: 31 };
}

// ---- Special mission (+SCORE.specialMission): a golden lantern appears for a short time ----
export const SPECIAL = { firstMs: 90_000, everyMs: 180_000, lifetimeMs: 60_000 };
export const SPECIAL_SPOTS = [{ x: -34, z: -30 }, { x: 34, z: -26 }, { x: 34, z: 10 }, { x: -34, z: 20 }, { x: 0, z: -4 }, { x: 18, z: 24 }];

// ---- Helping a teammate (+SCORE.helpTeammate): calm a teammate who was startled ----
export const HELP = { reach: 3, reachServer: 4.5, scaredMs: 8_000, pointCap: 300 };

// ---- Teamwork bonus (+SCORE.teamworkBonus): 3 different teammates score within 60 s ----
export const TEAMWORK = { windowMs: 60_000, members: 3 };
export interface TeamEvent { id: string; t: number }
/** Pure: records that `id` scored at `now`. When enough different members scored inside the window, returns their ids to reward and resets. */
export function recordTeamwork(events: TeamEvent[], id: string, now: number): { events: TeamEvent[]; awarded: string[] } {
  const kept = [...events.filter((e) => now - e.t <= TEAMWORK.windowMs), { id, t: now }];
  const distinct = [...new Set(kept.map((e) => e.id))];
  return distinct.length >= TEAMWORK.members ? { events: [], awarded: distinct } : { events: kept, awarded: [] };
}
