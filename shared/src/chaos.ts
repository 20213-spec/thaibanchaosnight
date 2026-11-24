import { COOK } from "./cooking.ts";
/** Mode "chaos_party": timed team mini-games. Points go to players (so leaderboards and Baht work as usual); a round winner bonus goes to the best team. */
export type PartyPhase = "intro" | "collect" | "quiz" | "relay" | "fishing" | "cooking" | "break";

export const CHAOS = {
  introS: 5,
  breakS: 8,
  collect: { seconds: 60, orbs: 24, points: 10, pickupRadius: 1.6 },
  quiz: { questions: 5, answerS: 20, revealS: 3, correct: 50, firstBonus: 25, difficulty: "normal" as const },
  relay: { seconds: 90, points: 60 },
  roundWinnerBonus: 50, // each member of the team that scored most in a round (ties: nobody)
};

export const CHAOS_ROUNDS = 5; // collect, quiz, relay, fishing, cooking

/** Fishing round: cast at the pond, wait for a bite, reel in during the short bite window. The server decides everything. */
export const FISHING = { seconds: 75, waitMin: 2_000, waitMax: 5_000, biteMs: 1_200, graceMs: 250, cooldownMs: 1_000, reach: 6 };
export const FISH = [
  { id: "tilapia", name: "ปลานิล", icon: "🐟", points: 10, weight: 50 },
  { id: "snakehead", name: "ปลาช่อน", icon: "🐠", points: 20, weight: 30 },
  { id: "catfish", name: "ปลาดุก", icon: "🐡", points: 30, weight: 15 },
  { id: "golden", name: "ปลาทองคำ", icon: "✨", points: 80, weight: 5 },
];
/** Weighted pick from r in [0,1). Pure, so the odds are unit-tested. */
export function pickFish(r: number): (typeof FISH)[number] {
  const total = FISH.reduce((s, f) => s + f.weight, 0);
  let x = Math.min(Math.max(Number.isFinite(r) ? r : 0, 0), 0.999999) * total;
  for (const f of FISH) { if (x < f.weight) return f; x -= f.weight; }
  return FISH[FISH.length - 1];
}

export const PHASE_TITLES: Record<PartyPhase, string> = {
  intro: "เตรียมตัว!", collect: "รอบเก็บลูกแก้ว", quiz: "รอบตอบคำถาม", relay: "รอบวิ่งส่งของ", fishing: "รอบตกปลา", cooking: "รอบทำอาหาร", break: "พักระหว่างรอบ",
};

export function chaosPlan(): { kind: PartyPhase; seconds: number }[] {
  return [
    { kind: "intro", seconds: CHAOS.introS },
    { kind: "collect", seconds: CHAOS.collect.seconds },
    { kind: "break", seconds: CHAOS.breakS },
    { kind: "quiz", seconds: CHAOS.quiz.questions * (CHAOS.quiz.answerS + CHAOS.quiz.revealS) },
    { kind: "break", seconds: CHAOS.breakS },
    { kind: "relay", seconds: CHAOS.relay.seconds },
    { kind: "break", seconds: CHAOS.breakS },
    { kind: "fishing", seconds: FISHING.seconds },
    { kind: "break", seconds: CHAOS.breakS },
    { kind: "cooking", seconds: COOK.seconds },
  ];
}
export const chaosTotalSeconds = (): number => chaosPlan().reduce((s, p) => s + p.seconds, 0);

/** Team with strictly the highest positive round score, or null on a tie / no points. */
export function roundWinner(scores: Record<string, number>): string | null {
  const e = Object.entries(scores).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (e.length === 0) return null;
  return e.length > 1 && e[0][1] === e[1][1] ? null : e[0][0];
}
