import { CASE_SPOTS, CASE_SPOT_NAMES } from "./missions.ts";

/**
 * Boss event "ผีเจ้าที่โกรธ" (I3): now and then the angry spirit of the village shows up at a landmark and the WHOLE room (every team together)
 * must calm it by standing close to it at the same time. Calm builds up only while enough living players are near; it never decays.
 * Everyone is told the place (it is public), nothing here is secret. Reward only: no one ever loses points, a failed event costs nothing.
 * Pure rules for unit tests; the server only applies them.
 */
export const BOSS = {
  firstMs: 150_000, everyMs: 240_000,   // delay before the first appearance and between appearances
  durationMs: 70_000,                   // time limit
  calmGoalMs: 20_000,                   // total time with enough people near that settles the spirit
  radius: 5,                            // how close counts as "near"
  shareNeeded: 0.5,                     // share of the living players that must be near together
  minHumans: 3,                         // below this the event never starts (too lonely to be a team effort)
  maxStepMs: 1_000,                     // a long gap between ticks never counts as more than this (no jumps)
  rewardAll: 20,                        // bonus for every living player when the spirit calms down
  rewardNear: 30,                       // extra for those standing near at that moment
};

export interface BossEvent { site: number; startedAt: number; until: number; calmMs: number; lastAt: number }
export interface BossMember { id: string; x: number; z: number; connected: boolean; role: string }

export const bossSite = (i: number): { name: string; x: number; z: number } => ({ name: CASE_SPOT_NAMES[i], x: CASE_SPOTS[i].x, z: CASE_SPOTS[i].z });
const eligibleMember = (m: BossMember) => m.connected && m.role !== "ghost";

/** How many living players must be near together: at least 2, at most everyone, about half in between. */
export const bossNeed = (eligible: number): number => Math.min(eligible, Math.max(2, Math.ceil(eligible * BOSS.shareNeeded)));

/** Starts an event at a random landmark (never the one of the last event when there is a choice). Null when there are too few living players. */
export function startBoss(rnd: () => number, members: readonly BossMember[], lastSite: number | null, now: number): BossEvent | null {
  if (members.filter(eligibleMember).length < BOSS.minHumans) return null;
  const all = CASE_SPOTS.map((_, i) => i), pool = lastSite !== null ? all.filter((i) => i !== lastSite) : all;
  const site = pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
  return { site, startedAt: now, until: now + BOSS.durationMs, calmMs: 0, lastAt: now };
}

export interface BossProgress { eligible: number; need: number; insideIds: string[]; eligibleIds: string[]; holding: boolean }
export function bossProgress(b: BossEvent, members: readonly BossMember[]): BossProgress {
  const s = bossSite(b.site), els = members.filter(eligibleMember);
  const insideIds = els.filter((p) => Math.hypot(p.x - s.x, p.z - s.z) <= BOSS.radius).map((p) => p.id);
  const need = bossNeed(els.length);
  return { eligible: els.length, need, insideIds, eligibleIds: els.map((p) => p.id), holding: els.length >= 2 && insideIds.length >= need };
}

/** Moves the clock of the event to `now` and adds calm time only if enough people were near. Returns a new object, never mutates. */
export function bossStep(b: BossEvent, now: number, holding: boolean): BossEvent {
  const dt = Math.min(BOSS.maxStepMs, Math.max(0, now - b.lastAt));
  return { ...b, lastAt: Math.max(b.lastAt, now), calmMs: Math.min(BOSS.calmGoalMs, b.calmMs + (holding ? dt : 0)) };
}

export type BossState = "running" | "calmed" | "expired";
export const bossState = (b: BossEvent, now: number): BossState => (b.calmMs >= BOSS.calmGoalMs ? "calmed" : now >= b.until ? "expired" : "running");

/** Points when the spirit calms down: every living player gets rewardAll, those near get rewardNear more. Ids not living get nothing. */
export function bossRewards(p: BossProgress): Map<string, number> {
  const out = new Map<string, number>(), near = new Set(p.insideIds);
  for (const id of p.eligibleIds) out.set(id, BOSS.rewardAll + (near.has(id) ? BOSS.rewardNear : 0));
  return out;
}
