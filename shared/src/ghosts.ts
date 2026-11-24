import { GHOST, stepGhost } from "./missions.ts";
import { TEMPLE } from "./world.ts";

/** AI ghost types. All are harmless: they only startle (see shouldScare). Behaviours differ so each feels different. */
export type GhostKind = "lantern" | "prankster" | "shadow" | "guardian";

export const GHOST_KINDS: Record<GhostKind, { name: string; speed: number; about: string }> = {
  lantern: { name: "ผีโคมไฟ", speed: GHOST.speed, about: "เดินเตร็ดเตร่ทั่วหมู่บ้าน" },
  prankster: { name: "ผีขาวจอมป่วน", speed: 3.0, about: "วาบมาโผล่ใกล้ผู้เล่นเป็นระยะ" },
  shadow: { name: "เงาปริศนา", speed: 1.6, about: "ค่อยๆ เดินตามผู้เล่นที่ใกล้สุด แต่เว้นระยะห่าง" },
  guardian: { name: "ผีเจ้าถิ่น", speed: 1.8, about: "เฝ้าลานหน้าวัด ใครผ่านไปเก็บหลักฐานอาจโดนทัก" },
};

export const PRANK = { everyMinMs: 10_000, everyMaxMs: 14_000, distMin: 9, distMax: 12 };
export const SHADOW_KEEP = 5;                                   // the shadow never comes closer than this (startle radius is 2.2)
export const GUARDIAN = { x: TEMPLE.x, z: TEMPLE.z + 9, r: 6 }; // patrol disc in front of the temple

export function ghostsFor(mode: string): GhostKind[] {
  if (mode === "chaos_night") return ["lantern", "prankster", "shadow", "guardian"];
  if (mode === "ghost_hunt") return ["lantern", "guardian"];
  return [];
}

export interface GhostAI { kind: GhostKind; x: number; z: number; tx: number; tz: number; timer: number }

const clampG = (x: number, z: number) => ({ x: Math.max(-GHOST.xHalf, Math.min(GHOST.xHalf, x)), z: Math.max(GHOST.zMin, Math.min(GHOST.zMax, z)) });

export function initGhost(kind: GhostKind, rnd: () => number): GhostAI {
  const p = kind === "guardian" ? { x: GUARDIAN.x, z: GUARDIAN.z } : clampG((rnd() * 2 - 1) * GHOST.xHalf, GHOST.zMin + rnd() * (GHOST.zMax - GHOST.zMin));
  return { kind, x: p.x, z: p.z, tx: p.x, tz: p.z, timer: PRANK.everyMinMs + rnd() * (PRANK.everyMaxMs - PRANK.everyMinMs) };
}

function moveToward(g: GhostAI, dt: number, speed: number, maxStep = Infinity): GhostAI {
  const dx = g.tx - g.x, dz = g.tz - g.z, d = Math.hypot(dx, dz);
  if (d < 1e-6) return g;
  const step = Math.min(d, speed * dt, maxStep);
  return { ...g, x: g.x + (dx / d) * step, z: g.z + (dz / d) * step };
}

/** One simulation tick (dtMs milliseconds) for any ghost kind. `humans` are the positions of non-ghost, connected players. Pure. */
export function stepGhostAI(g: GhostAI, dtMs: number, rnd: () => number, humans: { x: number; z: number }[], speedMul = 1): GhostAI {
  const dt = dtMs / 1000, sp = GHOST_KINDS[g.kind].speed * speedMul;
  switch (g.kind) {
    case "lantern": {
      const r = stepGhost({ x: g.x, z: g.z, tx: g.tx, tz: g.tz }, dt, rnd, speedMul);
      return { ...g, ...r };
    }
    case "guardian": {
      let { tx, tz } = g;
      if (Math.hypot(tx - g.x, tz - g.z) < 0.5) {
        const a = rnd() * Math.PI * 2, rr = rnd() * GUARDIAN.r;
        tx = GUARDIAN.x + Math.cos(a) * rr; tz = GUARDIAN.z + Math.sin(a) * rr;
      }
      return moveToward({ ...g, tx, tz }, dt, sp);
    }
    case "prankster": {
      let cur = g, timer = g.timer - dtMs;
      if (timer <= 0) {
        timer = PRANK.everyMinMs + rnd() * (PRANK.everyMaxMs - PRANK.everyMinMs);
        if (humans.length > 0) { // blink in near a random player
          const h = humans[Math.floor(rnd() * humans.length) % humans.length];
          const a = rnd() * Math.PI * 2, d = PRANK.distMin + rnd() * (PRANK.distMax - PRANK.distMin);
          const c = clampG(h.x + Math.cos(a) * d, h.z + Math.sin(a) * d);
          cur = { ...g, x: c.x, z: c.z, tx: c.x, tz: c.z };
        }
      }
      const r = stepGhost({ x: cur.x, z: cur.z, tx: cur.tx, tz: cur.tz }, dt, rnd, sp / GHOST.speed);
      return { ...cur, ...r, timer };
    }
    case "shadow": {
      let best: { x: number; z: number } | null = null, bd = Infinity;
      for (const h of humans) { const d = Math.hypot(h.x - g.x, h.z - g.z); if (d < bd) { bd = d; best = h; } }
      if (!best || bd <= SHADOW_KEEP) return g;
      return moveToward({ ...g, tx: best.x, tz: best.z }, dt, sp, bd - SHADOW_KEEP); // never step inside the keep-away distance
    }
  }
}
