import { CASE_SPOTS, CASE_SPOT_NAMES } from "./missions.ts";

/**
 * Secret mission (Milestone 3, "ภารกิจลับ"): every couple of minutes the server privately gives ONE team a short task: enough teammates must stand together at a landmark
 * before time runs out. Reward is small and there is no penalty for failing. Pure rules, so they can be unit-tested; the server only applies them.
 * Only teams with at least 2 connected non-ghost players are eligible.
 */
export const SECRET = { firstMs: 90_000, everyMs: 120_000, durationMs: 45_000, radius: 4, points: 40, shareNeeded: 0.75 };

export interface SecretMission { team: string; site: number; startedAt: number; until: number }
export interface SecretMember { id: string; x: number; z: number; connected: boolean; role: string }

export const secretSite = (i: number): { name: string; x: number; z: number } => ({ name: CASE_SPOT_NAMES[i], x: CASE_SPOTS[i].x, z: CASE_SPOTS[i].z });

/** How many eligible teammates must be at the site together: at least 2, at most everyone, about 75% in between. */
export const secretNeed = (eligible: number): number => Math.min(eligible, Math.max(2, Math.ceil(eligible * SECRET.shareNeeded)));

const eligibleMember = (m: SecretMember) => m.connected && m.role !== "ghost";

/** Picks a team (not the one that just had a mission, when there is a choice) and a landmark. `rnd` is a () => [0,1) function. Null when no team qualifies. */
export function pickSecretMission(rnd: () => number, eligibleTeams: readonly string[], lastTeam: string | null, now: number): SecretMission | null {
  if (!eligibleTeams.length) return null;
  const pool = eligibleTeams.length > 1 && lastTeam ? eligibleTeams.filter((t) => t !== lastTeam) : eligibleTeams;
  const team = pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
  const site = Math.min(CASE_SPOTS.length - 1, Math.floor(rnd() * CASE_SPOTS.length));
  return { team, site, startedAt: now, until: now + SECRET.durationMs };
}

export interface SecretProgress { eligible: number; need: number; insideIds: string[]; done: boolean }
/** Counts the eligible members of the mission's team standing within SECRET.radius of the site. */
export function secretProgress(m: SecretMission, members: readonly SecretMember[]): SecretProgress {
  const site = secretSite(m.site), els = members.filter(eligibleMember);
  const insideIds = els.filter((p) => Math.hypot(p.x - site.x, p.z - site.z) <= SECRET.radius).map((p) => p.id);
  const need = secretNeed(els.length);
  return { eligible: els.length, need, insideIds, done: els.length >= 2 && insideIds.length >= need };
}

export type SecretState = "running" | "done" | "expired";
export const secretState = (m: SecretMission, now: number, p: SecretProgress): SecretState => (p.done ? "done" : now >= m.until ? "expired" : "running");
