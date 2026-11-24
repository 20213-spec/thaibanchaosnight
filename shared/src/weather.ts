import { WORLD_HALF } from "./world.ts";

/**
 * Weather is decided by the server and the same for everyone. Every kind changes how the hunt modes play (nothing takes points away):
 *  fog   ghosts startle from farther away (you cannot see them coming) and visibility is short
 *  rain  the ground is slippery (a little slower) but evidence respawns faster, so braving the rain pays
 *  storm rain + lightning that startles players nearby and sometimes cuts the power for a few seconds
 *  wind  the golden lantern gets blown to a new place every few seconds
 */
export type Weather = "clear" | "fog" | "rain" | "storm" | "wind";

export const WEATHER: Record<Weather, { name: string; icon: string; about: string; start: string; scareMul: number; respawnMul: number; walkMul: number }> = {
  clear: { name: "ฟ้าใส", icon: "☀️", about: "ไม่มีผลพิเศษ", start: "ฟ้าใสแล้ว", scareMul: 1, respawnMul: 1, walkMul: 1 },
  fog: { name: "หมอกลง", icon: "🌫️", about: "ทัศนวิสัยสั้น ผีหลอกได้จากระยะไกลขึ้น (รัศมีหลอก ×1.35)", start: "หมอกลงหนา! มองเห็นได้ใกล้ๆ และผีหลอกได้จากไกลขึ้น", scareMul: 1.35, respawnMul: 1, walkMul: 1 },
  rain: { name: "ฝนตก", icon: "🌧️", about: "พื้นลื่นเดินช้าลงเล็กน้อย (×0.93) แต่ลูกแก้วหลักฐานเกิดใหม่เร็วขึ้น (×0.6 ของเวลา)", start: "ฝนตกแล้ว พื้นลื่น แต่ลูกแก้วเกิดใหม่เร็วขึ้น", scareMul: 1, respawnMul: 0.6, walkMul: 0.93 },
  storm: { name: "พายุฝนฟ้าคะนอง", icon: "⛈️", about: "ฝนตก + ฟ้าผ่า: ฟ้าผ่าใกล้ตัว (ภายใน 5 หน่วย) ทำให้ตกใจ (ไม่เสียคะแนน) และบางครั้งไฟดับสั้นๆ", start: "พายุเข้า! ระวังฟ้าผ่า", scareMul: 1.15, respawnMul: 0.6, walkMul: 0.9 },
  wind: { name: "ลมแรง", icon: "🍃", about: "ลมพัดโคมทองให้ย้ายตำแหน่งทุก 12 วินาที (ถ้ามีโคมทองอยู่)", start: "ลมแรง! โคมทองอาจถูกพัดไปที่อื่น", scareMul: 1, respawnMul: 1, walkMul: 1 },
};

export const WEATHER_PLAN = { minMs: 45_000, maxMs: 90_000, clearMinMs: 20_000, clearMaxMs: 40_000, firstMs: 30_000 };
export const LIGHTNING = { everyMinMs: 10_000, everyMaxMs: 22_000, radius: 5, powerCutChance: 0.25, powerCutMs: 4_000 };
export const WIND = { moveEveryMs: 12_000 };

/** Relative chances of each non-clear spell. Chaos Party and the lobby never have weather. */
export function weatherWeights(mode: string): Partial<Record<Weather, number>> {
  if (mode === "chaos_night") return { fog: 30, rain: 25, storm: 15, wind: 15 };
  if (mode === "ghost_hunt") return { fog: 15, rain: 25, storm: 5, wind: 15 };
  return {};
}

/** After a spell the weather always clears for a while; after clear skies a spell is drawn by weight and never repeats the last one. rnd() in [0,1). */
export function nextWeather(mode: string, prev: Weather, rnd: () => number, lastSpell: Weather | null = null, weights?: Partial<Record<Weather, number>>): Weather {
  if (Object.keys(weatherWeights(mode)).length === 0) return "clear"; // modes without weather never get any, whatever the weights say
  const w = weights && Object.keys(weights).length > 0 ? weights : weatherWeights(mode);
  if (prev !== "clear") return "clear";
  const entries = (Object.entries(w) as [Weather, number][]).filter(([k]) => k !== lastSpell);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  let x = rnd() * total;
  for (const [k, v] of entries) { if (x < v) return k; x -= v; }
  return entries[entries.length - 1][0];
}

export function weatherDurationMs(kind: Weather, rnd: () => number): number {
  const [a, b] = kind === "clear" ? [WEATHER_PLAN.clearMinMs, WEATHER_PLAN.clearMaxMs] : [WEATHER_PLAN.minMs, WEATHER_PLAN.maxMs];
  return a + rnd() * (b - a);
}

export function lightningStrike(rnd: () => number): { x: number; z: number } {
  const lim = WORLD_HALF - 4;
  return { x: (rnd() * 2 - 1) * lim, z: (rnd() * 2 - 1) * lim };
}
