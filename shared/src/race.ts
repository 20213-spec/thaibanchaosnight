/**
 * Team math race (M6.3): every so often a quick question is shown to everybody for a short time. The first member of each team to answer
 * correctly settles that team's rank; ranks pay a fixed bonus to every living member of the team. Wrong answers cost nothing.
 * The question comes from the normal generator + validator (the answer stays on the server until the race ends). Pure.
 */
export const RACE = {
  firstMs: 90_000, minMs: 120_000, maxMs: 180_000, // delay before the first race and between races
  durationMs: 25_000,                              // how long a race lasts
  rewards: [60, 40, 20] as readonly number[],      // bonus per member for finishing 1st / 2nd / 3rd (nobody loses points)
  topics: ["basic", "expected", "uniform"] as const,
  difficulty: "normal" as const,
  wrongCooldownMs: 1500,                           // per player, between answers
  minTeams: 2,                                     // a race needs at least two teams with someone able to answer
};
export const raceReward = (rank: number): number => (Number.isInteger(rank) && rank >= 1 ? RACE.rewards[rank - 1] ?? 0 : 0);
export const raceDelay = (rnd: () => number) => RACE.minMs + rnd() * (RACE.maxMs - RACE.minMs);
/** 1-based rank of a team in the finishing order, or 0 if it has not finished. */
export const raceRankOf = (order: readonly string[], team: string): number => { const i = order.indexOf(team); return i < 0 ? 0 : i + 1; };
/** May this team still score? Only the first correct answer of a team counts. */
export const raceCanFinish = (order: readonly string[], team: string): boolean => !order.includes(team);
/** The race is over when time is up or every taking-part team has finished. */
export const raceOver = (now: number, endAt: number, order: readonly string[], teams: readonly string[]): boolean =>
  now >= endAt || (teams.length > 0 && teams.every((t) => order.includes(t)));
