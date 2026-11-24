/** Achievements (M3): badges only, no points, so they can never change the balance. Counters are kept by the server per match. */
export type StatKey = "evidence" | "delivery" | "help" | "puzzle" | "clue" | "solved" | "shelter" | "search";
export type Stats = Partial<Record<StatKey, number>>;
export interface Achievement { id: string; icon: string; name: string; about: string; stat: StatKey; need: number }

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "ev5", icon: "🔎", name: "นักเก็บหลักฐาน", about: "เก็บหลักฐาน 5 ชิ้น", stat: "evidence", need: 5 },
  { id: "dl3", icon: "📦", name: "ไรเดอร์โนนสุข", about: "ส่งของ 3 ครั้ง", stat: "delivery", need: 3 },
  { id: "hp2", icon: "🤝", name: "เพื่อนแท้", about: "ปลอบเพื่อนที่ตกใจ 2 ครั้ง", stat: "help", need: 2 },
  { id: "pz3", icon: "🧮", name: "เซียนความน่าจะเป็น", about: "ตอบโจทย์ Math Mystery ถูก 3 ข้อ", stat: "puzzle", need: 3 },
  { id: "cl1", icon: "🕵️", name: "สายสืบมือใหม่", about: "พบเบาะแสคดีแรก", stat: "clue", need: 1 },
  { id: "cl4", icon: "🧩", name: "ปะติดปะต่อ", about: "พบเบาะแสคดี 4 จุด", stat: "clue", need: 4 },
  { id: "sv1", icon: "🎯", name: "ไขคดีผี", about: "ทีมชี้ตัวการถูก", stat: "solved", need: 1 },
  { id: "se4", icon: "🗝️", name: "นักค้นบ้าน", about: "ค้นของในหมู่บ้านครบ 4 จุด", stat: "search", need: 4 },
  { id: "sh1", icon: "🏮", name: "หลบมืดทัน", about: "ทันกลับวงปลอดภัยก่อนไฟดับ", stat: "shelter", need: 1 },
];

/** Adds one to a counter and returns the achievements newly reached by that exact increment (each is reported once). Pure. */
export function bump(stats: Stats, key: StatKey): { stats: Stats; unlocked: Achievement[] } {
  const next = { ...stats, [key]: (stats[key] ?? 0) + 1 };
  return { stats: next, unlocked: ACHIEVEMENTS.filter((a) => a.stat === key && next[key]! === a.need) };
}
