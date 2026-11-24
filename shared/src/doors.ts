import { STILT_HOUSES } from "./world.ts";
import { noteFor } from "./notes.ts";

/**
 * Village doors (M3.9): the front door of each stilt house can be opened by any player standing at the steps.
 * Purely cosmetic and shared: no points, no collision change, nothing is lost. A door closes by itself after a while.
 * The house mesh in Scenery.tsx is rotated by n * 0.5 rad, so the door position follows the same rule. Pure.
 */
export const DOOR_ROT_STEP = 0.5;          // must match the rotation used by <StiltHouses/>
export const DOOR_FRONT = 2.6;             // distance from the house centre to the foot of the steps
export const DOOR_REACH = 3, DOOR_REACH_SERVER = 4.5;
export const DOOR_OPEN_MS = 8000;          // auto-close time
export const DOOR_COOLDOWN_MS = 1200;      // per door, so nobody can spam it

export interface Door { id: string; house: number; x: number; z: number; rot: number }
export const DOORS: Door[] = STILT_HOUSES.map((h, n) => {
  const rot = n * DOOR_ROT_STEP;
  return { id: `d${n}`, house: n, rot, x: h.x + Math.sin(rot) * DOOR_FRONT, z: h.z + Math.cos(rot) * DOOR_FRONT };
});
export const doorById = (id: string): Door | null => DOORS.find((d) => d.id === id) ?? null;

/** Pure rule: may this player use the door now? `openUntil` = 0 means closed. Returns the next state or null if refused. */
export function doorToggle(openUntil: number, lastUsed: number, now: number, dist: number, reach = DOOR_REACH_SERVER): { open: boolean; openUntil: number } | null {
  if (!(dist <= reach)) return null;
  if (now - lastUsed < DOOR_COOLDOWN_MS) return null;
  const isOpen = openUntil > now;
  return isOpen ? { open: false, openUntil: 0 } : { open: true, openUntil: now + DOOR_OPEN_MS };
}
export const doorIsOpen = (openUntil: number, now: number) => openUntil > now;

// ---- Locked doors (M6.2): now and then one house door is locked; solving a Math Mystery question opens it for everybody ----
/** Reward is a story note from inside the house, never points or items, so it cannot unbalance anything. Wrong answers cost nothing. */
export const LOCK = {
  firstMs: 60_000, minMs: 60_000, maxMs: 100_000, // when the next lock happens
  maxLocked: 1,                                   // at most one locked door at a time
  topics: ["basic", "uniform", "expected"] as const, // gentle topics only; always the "easy" level
  difficulty: "easy" as const,
  wrongCooldownMs: 1500,                          // per player, between answers
};
/** Which door gets locked next (never one that is already locked or open). Returns null if the cap is reached or no door is free. Pure. */
export function pickLockDoor(rnd: () => number, locked: ReadonlySet<string>, open: ReadonlySet<string> = new Set()): string | null {
  if (locked.size >= LOCK.maxLocked) return null;
  const free = DOORS.filter((d) => !locked.has(d.id) && !open.has(d.id));
  return free.length ? free[Math.min(free.length - 1, Math.floor(rnd() * free.length))].id : null;
}
export const lockDelay = (rnd: () => number) => LOCK.minMs + rnd() * (LOCK.maxMs - LOCK.minMs);
/** Story note found inside a house once its door is unlocked. Index 10+ keeps it apart from the searchable-object notes. Pure. */
export const lockNote = (seed: number, house: number): string => noteFor(seed, 10 + house);
