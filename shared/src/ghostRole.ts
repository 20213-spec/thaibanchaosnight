/** Playable ghost role. Harmless fun: ghosts only startle; humans lose nothing. */
export const GHOST_ABILITIES = {
  whisper: { cooldownMs: 8_000, radius: 14 },
  dim: { cooldownMs: 20_000, radius: 10, ms: 5_000 },
  boo: { cooldownMs: 12_000, radius: 2.5, points: 15 },
} as const;
export type AbilityName = keyof typeof GHOST_ABILITIES;
export const ABILITY_NAMES = Object.keys(GHOST_ABILITIES) as AbilityName[];

export const GHOST_POINT_CAP = 150; // a ghost can earn at most this many points per match

/** Balance: at most 1 ghost per 8 players (minimum 1 allowed so small test rooms work). */
export const maxGhosts = (players: number): number => Math.max(1, Math.floor(players / 8));

export function booPoints(alreadyEarned: number): number {
  return Math.max(0, Math.min(GHOST_ABILITIES.boo.points, GHOST_POINT_CAP - alreadyEarned));
}
