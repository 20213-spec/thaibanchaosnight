import { TEMPLE, HUT, POND, PUZZLE_ZONE, STILT_HOUSES } from "./world.ts";

/**
 * Mysterious sounds (M3.8): now and then a strange noise drifts in from a named place in the village.
 * Pure flavour: no points, no danger, never tells where clues are or who the culprit is. About 70% funny, 30% mildly spooky.
 */
export const EERIE = { firstMs: 40_000, minMs: 45_000, maxMs: 80_000 };
export interface EerieSite { name: string; x: number; z: number }
export const EERIE_SITES: EerieSite[] = [
  { name: "ศาลาริมน้ำ", x: POND.x, z: POND.z }, { name: "วัด", x: TEMPLE.x, z: TEMPLE.z }, { name: "กระท่อมกลางนา", x: HUT.x, z: HUT.z },
  { name: "หน้าโรงเรียน", x: PUZZLE_ZONE.x, z: PUZZLE_ZONE.z }, { name: "ป่าท้ายหมู่บ้าน", x: -32, z: -29 },
  { name: "บ้านยกพื้นหลังเก่า", x: STILT_HOUSES[0].x, z: STILT_HOUSES[0].z },
];
export interface EerieKind { id: string; sfx: "whisper" | "tick" | "crack" | "pop"; funny: boolean; text: (place: string) => string }
export const EERIE_KINDS: EerieKind[] = [
  { id: "snore", sfx: "pop", funny: true, text: (p) => `ได้ยินเสียงกรนครอกฟี้ดังมาจาก${p} ใครแอบมานอน?` },
  { id: "hiccup", sfx: "pop", funny: true, text: (p) => `มีเสียงสะอึกเบาๆ ลอยมาจาก${p} ผีกินข้าวเหนียวเร็วเกินไปหรือเปล่า` },
  { id: "sing", sfx: "whisper", funny: true, text: (p) => `ใครสักคนฮัมหมอลำเพี้ยนๆ อยู่แถว${p}` },
  { id: "pot", sfx: "tick", funny: true, text: (p) => `เสียงเคาะหม้อกะละมังดังกึกกักจาก${p}` },
  { id: "sneeze", sfx: "pop", funny: true, text: (p) => `ได้ยินเสียงจามดังฮัดชิ้วจาก${p} แล้วก็เงียบไป` },
  { id: "knock", sfx: "crack", funny: false, text: (p) => `มีเสียงเคาะไม้ช้าๆ ดังมาจาก${p}` },
  { id: "whisper", sfx: "whisper", funny: false, text: (p) => `เสียงกระซิบแผ่วๆ ลอยมาจากทาง${p} พอหันไปก็ไม่เห็นใคร` },
];
export interface EerieEvent { kind: string; site: string; sfx: EerieKind["sfx"]; text: string; x: number; z: number }

/** Next sound. rnd is a () => [0,1) source (Math.random on the server, a seeded rng in tests). Never repeats the previous kind. Pure. */
export function pickEerie(rnd: () => number, lastKind: string | null): EerieEvent {
  const funny = rnd() < 0.7;
  const pool = EERIE_KINDS.filter((k) => k.funny === funny && k.id !== lastKind);
  const kind = pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
  const site = EERIE_SITES[Math.min(EERIE_SITES.length - 1, Math.floor(rnd() * EERIE_SITES.length))];
  return { kind: kind.id, site: site.name, sfx: kind.sfx, text: kind.text(site.name), x: site.x, z: site.z };
}
export const eerieDelay = (rnd: () => number) => EERIE.minMs + rnd() * (EERIE.maxMs - EERIE.minMs);
