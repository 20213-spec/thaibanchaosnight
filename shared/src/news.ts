import { SUSPECTS, type Case } from "./case.ts";
import { CASE_SPOT_NAMES } from "./missions.ts";

export const NEWS_FIRST_MS = 60_000, NEWS_EVERY_MS = 75_000;
const GOSSIP = [
  "ป้าแม้นบอกว่าเมื่อคืนได้ยินเสียงอะไรแปลกๆ แต่ก็อาจเป็นแค่หมาเห่า",
  "ผู้ใหญ่บ้านเตือนว่า อย่าเดินไปคนเดียวตอนมืด และอย่าลืมดูแลเพื่อนในทีม",
  "ลุงพรเล่าว่าเห็นเงาวูบหนึ่งผ่านตลาด แต่พอหันไปก็ไม่มีอะไร",
  "เด็กๆ ในหมู่บ้านลือกันว่า ผีตนนี้ขี้อาย ไม่ชอบเจอคนเยอะ",
] as const;

/**
 * The village headman's news. It only points at WHERE unfound clues are, never says what a clue means, and never names a suspect, so it cannot spoil the case.
 * `foundByAny` = clue ids found by at least one team. Pure given `rnd` (a () => [0,1) function).
 */
export function villageNews(c: Case, foundByAny: ReadonlySet<string>, teamsSolved: number, rnd: () => number): string {
  const unfound = c.clues.filter((k) => !foundByAny.has(k.id));
  const r = rnd();
  if (teamsSolved > 0 && r < 0.3) return "ข่าวด่วน! มีทีมชี้ตัวผีได้ถูกแล้ว ทีมอื่นยังไขคดีได้และรับคะแนนเช่นกัน";
  if (unfound.length > 0 && r < 0.75) {
    const k = unfound[Math.min(unfound.length - 1, Math.floor(rnd() * unfound.length))];
    return `มีคนเห็นแสงสีม่วงวูบวาบแถว${CASE_SPOT_NAMES[k.spot]} ลองไปดูสิ`;
  }
  return GOSSIP[Math.min(GOSSIP.length - 1, Math.floor(rnd() * GOSSIP.length))];
}
export const spoilerWords = (): string[] => SUSPECTS.flatMap((s) => [s.name, s.place, s.item, s.sound]);

/** Where the village head (NPC "ผู้ใหญ่บ้าน", M3.8) stands. Decoration only: he never moves, is not solid and gives no points; he "speaks" (shows a megaphone) whenever the village makes an announcement. Kept clear of every solid, landmark and mission spot (unit-tested). */
export const VILLAGE_HEAD = { x: 0, z: 4, name: "ผู้ใหญ่บ้าน" };
