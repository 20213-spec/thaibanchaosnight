import { WORLD_HALF, TEMPLE, POND } from "./world.ts";

/** Top-down village map (north up, the team houses at the bottom): helpers shared by the client map and its unit tests. */
export function worldToMap(x: number, z: number, size: number): { x: number; y: number } {
  const k = size / (2 * WORLD_HALF);
  return { x: (x + WORLD_HALF) * k, y: (z + WORLD_HALF) * k };
}

export const MAP_PLACES = [
  { name: "โรงเรียน", icon: "🏫", x: 0, z: -28 },
  { name: "ตลาด", icon: "🛒", x: -22, z: 6 },
  { name: "วัด", icon: "🛕", x: TEMPLE.x, z: TEMPLE.z },
  { name: "บ่อน้ำ", icon: "💧", x: POND.x, z: POND.z },
  { name: "ทุ่งนา", icon: "🌾", x: 26, z: -8 },
  { name: "ป่า", icon: "🌲", x: -32, z: -29 },
  { name: "ล็อบบี้/ลานกลาง", icon: "⛲", x: 0, z: 12 },
  { name: "บ้านทีม", icon: "🏠", x: 0, z: 37 },
];
