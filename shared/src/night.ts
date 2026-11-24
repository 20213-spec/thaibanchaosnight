import { dropZoneFor } from "./missions.ts";

/**
 * Mode "chaos_night": Ghost Hunt rules at night, plus a safe point per team.
 * Nobody loses points: the lights-out alert only gives a bonus to teams that make it back in time.
 */
export const NIGHT = {
  firstMs: 40_000, everyMin: 35_000, everyMax: 55_000, // time between lights-out alerts
  warnMs: 10_000,          // warning before the lights go out
  darkMs: 6_000,           // how long it stays dark
  shelterPoints: 40,       // per player who is inside the safe ring when the lights come back
  shelterCap: 120,         // per player per match (stops camping in the ring all night)
  safeRadius: 4.5,
  ghostSpeedMul: 1.4,      // the AI lantern ghost is faster at night
};

/** The visible ring in front of each team house: AI ghosts cannot startle you here and startled players recover on entering. */
export function safeZoneFor(teamId: string): { x: number; z: number } {
  const d = dropZoneFor(teamId);
  return { x: d.x, z: d.z - 3 };
}
export function inSafeZone(teamId: string, x: number, z: number): boolean {
  const s = safeZoneFor(teamId);
  return Math.hypot(x - s.x, z - s.z) <= NIGHT.safeRadius;
}

/** A team is rewarded when at least half of its online members are inside the safe ring. Returns the ids to reward. */
export function shelterAwards(members: { id: string; inside: boolean }[]): string[] {
  if (members.length === 0) return [];
  const inside = members.filter((m) => m.inside);
  return inside.length >= Math.ceil(members.length / 2) ? inside.map((m) => m.id) : [];
}

export function shelterPointsFor(alreadyEarned: number): number {
  return Math.max(0, Math.min(NIGHT.shelterPoints, NIGHT.shelterCap - alreadyEarned));
}
