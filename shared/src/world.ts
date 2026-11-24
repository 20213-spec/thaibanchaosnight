import { TEAMS } from "./teams.ts";
import { EVIDENCE_SPOTS, SPECIAL_SPOTS, CASE_SPOTS, SEARCH_SPOTS, GADGET_SPOTS, CRATE } from "./missions.ts";
import { makeRng } from "./math/rng.ts";
import { COOK_STATION } from "./cooking.ts";

export const WORLD_HALF = 40;      // playable area is a square from -40..40 on x and z
export const WALK_SPEED = 4.5;     // units per second
export const RUN_SPEED = 8;
export const PUZZLE_ZONE = { x: 0, z: -18 };
export const PUZZLE_RADIUS = 5;    // client shows the "interact" prompt inside this
export const PUZZLE_REACH = 6.5;   // server accepts a puzzle request inside this (small slack for lag)

export function clampWorld(v: number): number {
  return Math.max(-WORLD_HALF, Math.min(WORLD_HALF, v));
}

/** Spawn point in front of the team's house. slot = order of the player inside the team. */
export function spawnFor(teamId: string, slot: number): { x: number; z: number } {
  const i = Math.max(0, TEAMS.findIndex((t) => t.id === teamId));
  return { x: (i - 2) * 14 + ((slot % 4) - 1.5) * 1.5, z: 30 + Math.floor(slot / 4) * 1.5 };
}

// ---- Solid objects (used by the client so players do not walk through buildings and trees) ----
// Collision is a client-side convenience. The server only enforces speed and map bounds, so it is not an anti-cheat wall.
export const PLAYER_RADIUS = 0.45;
export interface Box { x: number; z: number; hx: number; hz: number } // centre + half sizes
export interface Disc { x: number; z: number; r: number }

export const TEMPLE = { x: 30, z: -32 };        // วัด: main hall (box) + chedi (disc)
export const CHEDI = { x: 22, z: -32, r: 2.2 };
export const HUT = { x: 34, z: -18 };
export const POND = { x: -20, z: 17, r: 3.5 }; // บ่อน้ำ: fishing spot in Chaos Party, solid water in every mode           // กระท่อมนา in the rice field

// ---- Village dressing (Milestone 2): Thai stilt houses, lamp posts, signs ----
export const STILT_HOUSES = [{ x: -32, z: -8 }, { x: -8, z: -13 }, { x: 9, z: -10 }]; // บ้านทรงไทยยกพื้น (solid)
export const LAMPS: { x: number; z: number }[] = [-16, -5, 6, 17, 28].flatMap((z) => [{ x: -4.2, z }, { x: 4.2, z }]); // along the main road (decor, not solid)
export const SIGNS = [
  { text: "โรงเรียน", x: 4, z: -12 }, { text: "ตลาด", x: -12, z: 5 }, { text: "วัด", x: 14, z: -22 },
  { text: "บ่อน้ำ", x: -14, z: 20 }, { text: "ทุ่งนา", x: 13, z: -2 }, { text: "ป่าท้ายหมู่บ้าน", x: -26, z: -14 }, { text: "บ้านพักทีม", x: 0, z: 26 },
];

export const BOXES: Box[] = [
  ...STILT_HOUSES.map((h) => ({ x: h.x, z: h.z, hx: 2.4, hz: 2.4 })),
  { x: 0, z: -28, hx: 8, hz: 3.5 },                                   // school
  ...[-28, -22, -16].map((x) => ({ x, z: 6, hx: 2.3, hz: 1.2 })),    // market stalls
  ...TEAMS.map((_, i) => ({ x: (i - 2) * 14, z: 37, hx: 3, hz: 2 })), // team houses
  { x: TEMPLE.x, z: TEMPLE.z, hx: 5, hz: 3.5 },                       // temple hall
  { x: HUT.x, z: HUT.z, hx: 1.6, hz: 1.6 },                           // field hut
];

// ---- Walkable lobby: before the match everyone waits in the central plaza and can run around ----
export const LOBBY_CENTER = { x: 0, z: 12 };
/** Spawn spot for the n-th joiner: rings of 8 around the plaza centre (up to 40 players). Pure. */
export function lobbySpawn(slot: number): { x: number; z: number } {
  const s = ((Math.floor(slot) % 40) + 40) % 40, ring = Math.floor(s / 8), k = s % 8;
  const r = 3 + ring * 2.2, a = (k / 8) * Math.PI * 2 + ring * 0.4;
  return { x: LOBBY_CENTER.x + Math.cos(a) * r, z: LOBBY_CENTER.z + Math.sin(a) * r };
}

function makeTrees(): Disc[] {
  const raw: { x: number; z: number }[] = [];
  for (let i = 0; i < 46; i++) { // village edge, deterministic scatter
    const a = i * 2.399963, r = 14 + ((i * 37) % 24);
    raw.push({ x: Math.cos(a) * r, z: Math.sin(a) * r * 0.9 - 4 });
  }
  for (let i = 0; i < 16; i++) { // ป่าท้ายหมู่บ้าน: dense cluster in the north-west
    const a = i * 2.399963 * 1.3, r = 1.5 + ((i * 5) % 8);
    raw.push({ x: -32 + Math.cos(a) * r, z: -29 + Math.sin(a) * r });
  }
  const keepClear = [...EVIDENCE_SPOTS, ...SPECIAL_SPOTS, ...CASE_SPOTS, ...SEARCH_SPOTS, ...GADGET_SPOTS, CRATE, COOK_STATION]; // trees keep clear of every interactive spot
  return raw
    .filter((t) => Math.abs(t.x) < 38 && Math.abs(t.z) < 38 && t.z < 24)
    .filter((t) => Math.hypot(t.x - PUZZLE_ZONE.x, t.z - PUZZLE_ZONE.z) > 9)
    .filter((t) => !(Math.abs(t.x) < 11 && t.z < -22))                    // school yard
    .filter((t) => Math.hypot(t.x - TEMPLE.x, t.z - TEMPLE.z) > 12 && Math.hypot(t.x - CHEDI.x, t.z - CHEDI.z) > 5)
    .filter((t) => Math.hypot(t.x - HUT.x, t.z - HUT.z) > 4)
    .filter((t) => STILT_HOUSES.every((h) => Math.hypot(t.x - h.x, t.z - h.z) > 5))
    .filter((t) => SIGNS.every((s) => Math.hypot(t.x - s.x, t.z - s.z) > 2))
    .filter((t) => LAMPS.every((l) => Math.hypot(t.x - l.x, t.z - l.z) > 1.5))
    .filter((t) => Math.hypot(t.x - POND.x, t.z - POND.z) > POND.r + 3)
    .filter((t) => Math.hypot(t.x - LOBBY_CENTER.x, t.z - LOBBY_CENTER.z) > 13) // keep the lobby plaza clear
    .filter((t) => keepClear.every((k) => Math.hypot(t.x - k.x, t.z - k.z) > 3.2))
    .map((t) => ({ x: t.x, z: t.z, r: 0.6 }));
}
export const TREES: Disc[] = makeTrees();
const DISCS: Disc[] = [...TREES, CHEDI, POND];

/** Pushes a circle (the player) out of every solid object. Pure, so it is unit-tested. */
export function resolveCollisions(x: number, z: number, r: number): { x: number; z: number } {
  for (let pass = 0; pass < 3; pass++) {
    for (const b of BOXES) {
      const dx = x - b.x, dz = z - b.z;
      const ox = b.hx + r - Math.abs(dx), oz = b.hz + r - Math.abs(dz);
      if (ox > 0 && oz > 0) { if (ox < oz) x += (dx >= 0 ? 1 : -1) * ox; else z += (dz >= 0 ? 1 : -1) * oz; }
    }
    for (const d of DISCS) {
      const dx = x - d.x, dz = z - d.z, dist = Math.hypot(dx, dz), min = d.r + r;
      if (dist < min) { if (dist < 1e-6) x += min; else { x = d.x + (dx / dist) * min; z = d.z + (dz / dist) * min; } }
    }
  }
  return { x, z };
}

/**
 * Deterministic scatter of small decorations (grass, flowers, bushes). Points stay out of solids (with a margin),
 * off the main road and out of the rice field, so the same seed gives the same village on every device. Pure.
 */
export function scatterPoints(seed: number, count: number, margin: number): { x: number; z: number }[] {
  const rnd = makeRng(seed).next, out: { x: number; z: number }[] = [];
  for (let tries = 0; out.length < count && tries < count * 25; tries++) {
    const x = (rnd() * 2 - 1) * (WORLD_HALF - 2), z = (rnd() * 2 - 1) * (WORLD_HALF - 2);
    if (Math.abs(x) < 3.4 && z > -24 && z < 34) continue;               // main road
    if (x > 14 && x < 38 && z > -23 && z < 7) continue;                 // rice field
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.8) continue;    // water
    const r = resolveCollisions(x, z, margin);
    if (Math.hypot(r.x - x, r.z - z) > 1e-9) continue;                  // inside or touching a solid
    out.push({ x, z });
  }
  return out;
}
