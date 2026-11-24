/**
 * Team ping (M3.12): a player drops a marker at their own position and their teammates see a beacon there for a short time.
 * The server uses the sender's real position (the client never sends coordinates), enforces a cooldown, and relays only to the team.
 * Flavour/coordination only: no points. Pure.
 */
export const PING = { cooldownMs: 2500, ttlMs: 10_000, maxPerTeam: 3 };
export interface Mark { id: string; x: number; z: number; by: string; at: number }

/** May this player ping now? lastAt = their previous ping time (0 if never). */
export const markAllowed = (lastAt: number, now: number): boolean => now - lastAt >= PING.cooldownMs;
/** Markers that are still alive at `now`. */
export const markActive = (list: readonly Mark[], now: number): Mark[] => list.filter((m) => now - m.at < PING.ttlMs);
/** Adds a marker, drops expired ones and keeps only the newest PING.maxPerTeam. Never mutates the input. */
export function markAdd(list: readonly Mark[], m: Mark, now: number): Mark[] {
  const alive = markActive(list, now).filter((o) => o.id !== m.id);
  return [...alive, m].slice(-PING.maxPerTeam);
}
