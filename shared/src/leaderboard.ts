/**
 * Daily leaderboard (M3.13): best single-match score per player name among today's matches (Thai time, UTC+7).
 * Built from the match history the server already keeps (last 100 matches, ten best players each), so it needs no new storage.
 * Names are not accounts (A9): two players can share a name and are merged. Pure.
 */
export const DAY_TZ_MIN = 420;   // minutes east of UTC (Thailand, no daylight saving)
export const BOARD_SIZE = 10;
export interface BoardMatch { at: number; top: { name: string; team: string; score: number }[] }
export interface BoardRow { name: string; team: string; best: number; matches: number }

/** Calendar day key "YYYY-MM-DD" of a timestamp in the given timezone. */
export function dayKey(ts: number, tzMin = DAY_TZ_MIN): string {
  const d = new Date(ts + tzMin * 60_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
/** Top players of one day: one row per name (case-insensitive, trimmed), best score first, then more matches, then name. Never mutates the input. */
export function dailyTop(rows: readonly BoardMatch[], day: string, n = BOARD_SIZE, tzMin = DAY_TZ_MIN): BoardRow[] {
  const by = new Map<string, BoardRow>();
  for (const m of rows) {
    if (!Number.isFinite(m.at) || dayKey(m.at, tzMin) !== day) continue;
    const seen = new Set<string>();                                  // a name counts once per match even if listed twice
    for (const t of m.top) {
      const name = String(t.name ?? "").trim().slice(0, 24), key = name.toLowerCase();
      if (!name || !Number.isFinite(t.score) || t.score <= 0 || seen.has(key)) continue;
      seen.add(key);
      const cur = by.get(key);
      if (!cur) by.set(key, { name, team: t.team, best: t.score, matches: 1 });
      else { cur.matches++; if (t.score > cur.best) { cur.best = t.score; cur.team = t.team; } }
    }
  }
  return [...by.values()].sort((a, b) => b.best - a.best || b.matches - a.matches || a.name.localeCompare(b.name)).slice(0, Math.max(0, n));
}
