import { weatherWeights, type Weather } from "./weather.ts";
import { TOPICS } from "./math/generate.ts";
import type { Topic } from "./math/types.ts";

/**
 * Daily event (I4): each Thai calendar day has one theme that tilts how often each weather spell comes up in the hunt modes.
 * Everyone sees the same theme on the same day (derived from the date key alone, no storage). It never touches points or rewards,
 * and it never adds or removes a kind of weather: it only changes the relative chances. Pure.
 */
export interface DailyTheme { id: string; icon: string; name: string; blurb: string; boost: Partial<Record<Weather, number>> }

export const DAILY_THEMES: DailyTheme[] = [
  { id: "calm", icon: "🌤️", name: "วันใจเย็น", blurb: "ฟ้าสงบ สภาพอากาศแปรปรวนน้อยกว่าปกติ", boost: { fog: 0.5, rain: 0.5, storm: 0.4, wind: 0.5 } },
  { id: "drizzle", icon: "🌧️", name: "วันฝนพรำ", blurb: "ฝนมาบ่อยกว่าปกติ ลูกแก้วหลักฐานเกิดใหม่เร็วขึ้นเมื่อฝนตก", boost: { rain: 2.5, storm: 1.5 } },
  { id: "mist", icon: "🌫️", name: "วันหมอกจัด", blurb: "หมอกลงบ่อย ระวังผีโผล่มาใกล้ๆ โดยไม่รู้ตัว", boost: { fog: 2.5 } },
  { id: "breeze", icon: "🍃", name: "วันลมโคมทอง", blurb: "ลมแรงบ่อย โคมทองอาจถูกพัดไปไกลกว่าที่คิด", boost: { wind: 3 } },
  { id: "thunder", icon: "⛈️", name: "วันฟ้าคะนอง", blurb: "พายุมาบ่อยขึ้น ฟ้าผ่าทำให้ตกใจแต่ไม่เสียคะแนน", boost: { storm: 4, rain: 1.5 } },
];

/** Whole days since 1970-01-01 of a "YYYY-MM-DD" key, or null if it is not a real calendar date. */
export function dayNumber(day: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3], t = Date.UTC(y, mo - 1, d);
  const c = new Date(t);
  if (c.getUTCFullYear() !== y || c.getUTCMonth() !== mo - 1 || c.getUTCDate() !== d) return null;
  return Math.floor(t / 86_400_000);
}

/** Theme of a day. Stepping by 3 through 5 themes means two consecutive days never share a theme and all five appear within five days. */
export function dailyTheme(day: string): DailyTheme {
  const n = dayNumber(day);
  if (n === null) return DAILY_THEMES[0];
  return DAILY_THEMES[(((n * 3) % DAILY_THEMES.length) + DAILY_THEMES.length) % DAILY_THEMES.length];
}

/** Spell weights for a mode under a theme. Modes without weather stay empty (always clear). Every base spell keeps a positive weight. */
export function dailyWeights(mode: string, theme: DailyTheme): Partial<Record<Weather, number>> {
  const base = weatherWeights(mode), out: Partial<Record<Weather, number>> = {};
  for (const k of Object.keys(base) as Weather[]) out[k] = Math.max(0.01, (base[k] ?? 0) * (theme.boost[k] ?? 1));
  return out;
}

/** Math Mystery topic of the day: only the default choice in the puzzle screen, players can still pick any topic. Same rotation idea as the theme (7 topics, step 2): consecutive days differ and all seven appear in seven days. */
export function dailyTopic(day: string): Topic {
  const n = dayNumber(day);
  if (n === null) return TOPICS[0];
  return TOPICS[(((n * 2 + 1) % TOPICS.length) + TOPICS.length) % TOPICS.length];
}
