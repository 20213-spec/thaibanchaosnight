import { TEMPLE, CHEDI } from "./world.ts";

/** Sound design data. The audio engine (client) turns these into Web Audio; everything here is pure and unit-tested. */
export type Surface = "dirt" | "grass" | "field" | "stone" | "wood";

/** What the player is walking on, for footstep sounds. */
export function surfaceAt(x: number, z: number): Surface {
  if (Math.hypot(x - CHEDI.x, z - CHEDI.z) < 4.5 || (Math.abs(x - TEMPLE.x) < 7 && Math.abs(z - (TEMPLE.z + 2)) < 7)) return "stone"; // temple yard
  if (Math.abs(x) < 9 && z > -26.5 && z < -22) return "stone";                                 // school steps and yard
  if (x > -31 && x < -13 && z > 3 && z < 9) return "wood";                                    // market stalls
  if ((Math.abs(x) < 3.2 && z > -24 && z < 34) || (x > -22 && x < 0 && Math.abs(z - 4) < 1.3) || (x > 0 && x < 34 && Math.abs(z + 22) < 1.3)) return "dirt"; // road and paths
  if (x > 14 && x < 38 && z > -23 && z < 7) return "field";                                    // rice field
  return "grass";
}

export type MusicMode = "lobby" | "day" | "night" | "party" | "event";
export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Pentatonic scales (Thai-flavoured: no semitone clashes), as MIDI pitch classes starting on C. */
export const MUSIC: Record<MusicMode, { bpm: number; scale: number[]; low: number; high: number; rest: number; wave: "sine" | "triangle" | "square"; vol: number; droneEvery: number }> = {
  lobby: { bpm: 84, scale: [0, 2, 4, 7, 9], low: 60, high: 79, rest: 0.25, wave: "triangle", vol: 0.1, droneEvery: 0 },
  day:   { bpm: 96, scale: [0, 2, 4, 7, 9], low: 60, high: 81, rest: 0.2,  wave: "triangle", vol: 0.1, droneEvery: 0 },
  night: { bpm: 60, scale: [0, 3, 5, 7, 10], low: 55, high: 76, rest: 0.45, wave: "sine",     vol: 0.12, droneEvery: 8 },
  party: { bpm: 124, scale: [0, 2, 4, 7, 9], low: 64, high: 84, rest: 0.1, wave: "square",   vol: 0.05, droneEvery: 0 },
  event: { bpm: 132, scale: [0, 3, 5, 6, 7, 10], low: 52, high: 72, rest: 0.15, wave: "square", vol: 0.06, droneEvery: 4 },
};

/** One step of the generative melody: which MIDI note (or a rest) and how many beats it lasts. rnd() returns [0,1). Pure. */
export function melodyNote(mode: MusicMode, step: number, rnd: () => number): { midi: number; beats: number; rest: boolean } {
  const m = MUSIC[mode];
  const pool: number[] = [];
  for (let n = m.low; n <= m.high; n++) if (m.scale.includes(((n % 12) + 12) % 12)) pool.push(n);
  const beats = [0.5, 0.5, 1, 1, 1.5, 2][Math.floor(rnd() * 6)];
  if (rnd() < m.rest) return { midi: 0, beats, rest: true };
  const accent = step % 4 === 0 ? 0 : 1; // bar starts lean on the lower half of the range
  const half = Math.floor(pool.length / 2);
  const i = accent === 0 ? Math.floor(rnd() * half) : Math.floor(rnd() * pool.length);
  return { midi: pool[i], beats, rest: false };
}

export const DEFAULT_VOLUME = { master: 0.8, sfx: 1, ambient: 0.7, music: 0.5 };
export type Volume = typeof DEFAULT_VOLUME;
