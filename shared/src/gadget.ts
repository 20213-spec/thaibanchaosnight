import { DELIVERY, GADGET_SPOTS } from "./missions.ts";
import { SCORE } from "./scoring.ts";
import { PLAYER_RADIUS, clampWorld, resolveCollisions } from "./world.ts";

/**
 * Delivery trips and the Chaos Party "gadget" (a thrown sepak-takraw ball). All decisions are pure so they can be unit-tested; the server only applies them.
 * - Any mode: deliver any time, any number of times, but each trip has a time limit and each delivery a cooldown.
 * - Chaos Party relay and fishing rounds: gadgets lie on the map; one thrown at a rival knocks the crate out of their hands (relay) or spoils their line (fishing).
 */
export const GADGET = {
  name: "ลูกตะกร้อ", icon: "🏐",
  range: 5,                // throw range in metres, to the nearest rival that can be hit
  max: 5,                  // gadgets lying on the map at once
  respawnMs: 10_000,       // a missing gadget reappears after this long
  pickReach: 2.5, pickReachServer: 4,
  stunMs: 1_500,           // a carrier who was hit cannot pick a crate up for this long
  fisherLockMs: 3_000,     // a fisher who was hit cannot cast for this long
  hitPoints: 10,           // small reward for the thrower; also counts for the round score
  looseCrateMs: 12_000,    // a knocked-off crate stays on the ground this long for anyone to grab
};

export interface TripRules { tripMs: number; cooldownMs: number; expiredCooldownMs: number }
/** The relay round is a short race, so its trip limit and cooldown are shorter than in the hunt modes. */
export const tripRules = (party: boolean): TripRules =>
  party ? { tripMs: 30_000, cooldownMs: 8_000, expiredCooldownMs: 8_000 } : { tripMs: DELIVERY.tripMs, cooldownMs: DELIVERY.cooldownMs, expiredCooldownMs: DELIVERY.expiredCooldownMs };

/** Points of the n-th delivery of a player (1-based) in the hunt modes. */
export const deliveryPoints = (n: number): number => (n <= DELIVERY.fullCount ? SCORE.mission : Math.round(SCORE.mission * DELIVERY.laterRate));

export type Rival = { id: string; x: number; z: number; team: string; connected: boolean; role: string; carrying: boolean; fishing: boolean };
/** Nearest rival within range that can be hit in this round ("relay": must be carrying a crate; "fishing": must have a line in the water). */
export function pickRivalTarget(me: { x: number; z: number; team: string }, others: readonly Rival[], round: "relay" | "fishing", range: number = GADGET.range): Rival | null {
  let best: Rival | null = null, bd = Infinity;
  for (const o of others) {
    if (!o.connected || o.role === "ghost" || o.team === me.team) continue;
    if (round === "relay" ? !o.carrying : !o.fishing) continue;
    const d = Math.hypot(o.x - me.x, o.z - me.z);
    if (d <= range && d < bd) { best = o; bd = d; }
  }
  return best;
}

/** Where a knocked-off crate lands: 1.2 to 2.4 m from the carrier, never inside a solid. `rnd` is a () => [0,1) function. */
export function landingSpot(x: number, z: number, rnd: () => number): { x: number; z: number } {
  const a = rnd() * Math.PI * 2, d = 1.2 + rnd() * 1.2;
  const r = resolveCollisions(clampWorld(x + Math.cos(a) * d), clampWorld(z + Math.sin(a) * d), PLAYER_RADIUS + 0.4);
  return { x: r.x, z: r.z };
}

/** A free gadget spot (not within 1 m of a gadget already lying there), or null when all are taken. With `near`, spots within that radius are preferred. */
export function chooseGadgetSpot(occupied: readonly { x: number; z: number }[], rnd: () => number, near?: { x: number; z: number; r: number }): { x: number; z: number } | null {
  let free = GADGET_SPOTS.filter((s) => !occupied.some((o) => Math.hypot(o.x - s.x, o.z - s.z) < 1));
  if (near) { const close = free.filter((s) => Math.hypot(s.x - near.x, s.z - near.z) <= near.r); if (close.length) free = close; } // prefer spots near a point (the pond), fall back to any
  return free.length ? free[Math.min(free.length - 1, Math.floor(rnd() * free.length))] : null;
}
