import type { Case, TeamCase } from "./case.ts";

/**
 * Cross-team clue swap (M3.10, "แลกเบาะแสข้ามทีม"): two players from different teams who stand close can agree to swap ONE clue each.
 * The swap is fair (both teams must have a clue the other lacks, so nobody only gives), voluntary (the other player must accept),
 * limited (a few swaps per team, a cooldown per pair of teams) and it never costs points. Only the two players who agreed get a small bonus.
 * A team that already solved the case does not trade. Pure rules for unit tests; the server only applies them.
 */
export const TRADE = { reach: 4.5, reachServer: 6, acceptReach: 9, offerMs: 25_000, cooldownMs: 90_000, maxPerTeam: 2, points: 15 };

export interface TradeOffer { from: string; to: string; until: number }
export const tradeOfferLive = (o: TradeOffer | undefined, now: number): o is TradeOffer => !!o && now < o.until;
export const inTradeReach = (dist: number, server: boolean): boolean => Number.isFinite(dist) && dist <= (server ? TRADE.reachServer : TRADE.reach);
/** Accepting is more forgiving than offering: the offer was made while close, and the other player may have walked a few steps by the time they press the button. */
export const inAcceptReach = (dist: number): boolean => Number.isFinite(dist) && dist <= TRADE.acceptReach;
export const tradePairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

export type TradeCheck =
  | { ok: true; forA: string; forB: string }
  | { ok: false; reason: "no_team" | "same_team" | "solved" | "limit" | "cooldown" | "nothing_to_swap" };

/** Can team A and team B swap right now? `forA` is a clue B has and A lacks, `forB` the other way round (lowest id first, so it is deterministic). */
export function checkTrade(c: Case, teamA: string, teamB: string, a: TeamCase, b: TeamCase, used: { a: number; b: number }, pairCdUntil: number, now: number): TradeCheck {
  if (!teamA || !teamB) return { ok: false, reason: "no_team" };
  if (teamA === teamB) return { ok: false, reason: "same_team" };
  if (a.solved || b.solved) return { ok: false, reason: "solved" };
  if (used.a >= TRADE.maxPerTeam || used.b >= TRADE.maxPerTeam) return { ok: false, reason: "limit" };
  if (now < pairCdUntil) return { ok: false, reason: "cooldown" };
  const real = new Set(c.clues.map((k) => k.id));
  const lacks = (x: TeamCase, y: TeamCase) => [...y.found].filter((id) => real.has(id) && !x.found.has(id)).sort();
  const forA = lacks(a, b)[0], forB = lacks(b, a)[0];
  if (!forA || !forB) return { ok: false, reason: "nothing_to_swap" };
  return { ok: true, forA, forB };
}
