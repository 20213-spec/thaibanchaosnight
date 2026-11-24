/** Server is the only place these are applied. Clients may only display them. */
export const SCORE = {
  mission: 100,
  evidence: 20,
  puzzle: 50,
  helpTeammate: 30,
  specialMission: 150,
  teamworkBonus: 50,
} as const;

export const PUZZLE = {
  firstTryBonus: 25,
  hintBonusPenalty: 10, // per hint, only reduces the bonus
  wrongPenalty: 0,      // wrong answers never subtract points
} as const;

export function puzzleScore(attempts: number, hintsUsed: number): number {
  const bonus = attempts === 1 ? Math.max(0, PUZZLE.firstTryBonus - hintsUsed * PUZZLE.hintBonusPenalty) : 0;
  return SCORE.puzzle + bonus;
}
