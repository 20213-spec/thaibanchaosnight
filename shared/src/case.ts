import { makeRng } from "./math/rng.ts";
import { CASE_SPOTS, CASE_SPOT_NAMES } from "./missions.ts";

/**
 * Detective case (Milestone 3). Every match has one hidden culprit among five village ghosts.
 * Five clue spots each hold a true statement of the form "the culprit is NOT like suspect X" (X is described by one attribute only),
 * so players must match the clue against the suspect cards and eliminate suspects. Four clues are needed to name a single suspect
 * (the fifth repeats one elimination through another attribute). Nobody loses points: wrong accusations only start a short cooldown.
 * The server holds the case; clients only know SUSPECTS (public) and the clue texts their own team has found.
 */
export type ClueAttr = "place" | "item" | "sound";
export interface Suspect { id: string; name: string; place: string; item: string; sound: string }

// Every attribute value is unique per suspect, so any single attribute identifies one suspect.
export const SUSPECTS: readonly Suspect[] = [
  { id: "s0", name: "ผีกะละมัง", place: "ตลาด", item: "กะละมัง", sound: "ผิวปาก" },
  { id: "s1", name: "ผีโคมเขียว", place: "วัด", item: "โคมไฟ", sound: "กระซิบ" },
  { id: "s2", name: "ผีผ้าขาวม้า", place: "โรงเรียน", item: "ผ้าขาวม้า", sound: "เคาะไม้" },
  { id: "s3", name: "ผีเจ้าบ่อ", place: "บ่อน้ำ", item: "ร่ม", sound: "หัวเราะคิกคัก" },
  { id: "s4", name: "ผีหนองป่า", place: "ป่า", item: "ตะกร้า", sound: "ร้องเพลง" },
];
export const ATTR_LABEL: Record<ClueAttr, string> = { place: "ที่ซุ่ม", item: "ของติดตัว", sound: "เสียง" };

export const CASE = {
  cluePoints: 30,          // finder, once per clue per team
  solveFirst: 200,         // each connected human teammate when their team is the first to name the culprit
  solveLater: 100,         // later teams
  maxRemainingToAccuse: 2, // a team may accuse only after narrowing the list to 2 suspects (no blind guessing)
  accuseCooldownMs: 20_000,
  reach: 3, reachServer: 4.5,
};

export interface Clue { id: string; spot: number; attr: ClueAttr; eliminates: string; text: string }
export interface Case { culprit: string; clues: Clue[] }

export function clueText(spot: number, attr: ClueAttr, s: Suspect): string {
  const where = CASE_SPOT_NAMES[spot] ?? "หมู่บ้าน";
  const body = attr === "place" ? `ผีตนนี้ไม่ได้ซุ่มอยู่แถว${s.place}` : attr === "item" ? `ของที่ผีทิ้งไว้ไม่ใช่${s.item}` : `เสียงที่ได้ยินไม่ใช่เสียง${s.sound}`;
  return `${where}: ${body}`;
}

/** Pure and deterministic: the same seed gives the same case. */
export function makeCase(seed: number): Case {
  const rng = makeRng(seed);
  const culprit = SUSPECTS[rng.int(0, SUSPECTS.length - 1)];
  const attrs: ClueAttr[] = ["place", "item", "sound"];
  const picks = SUSPECTS.filter((s) => s.id !== culprit.id).map((s) => ({ s, attr: rng.pick(attrs) }));
  const dup = rng.pick(picks);                                   // one innocent is cleared a second time, through a different attribute
  picks.push({ s: dup.s, attr: rng.pick(attrs.filter((a) => a !== dup.attr)) });
  const spots = rng.shuffle(picks.map((_, i) => i));
  const clues = picks.map((p, i) => ({ id: "c" + spots[i], spot: spots[i], attr: p.attr, eliminates: p.s.id, text: clueText(spots[i], p.attr, p.s) }));
  clues.sort((a, b) => a.spot - b.spot);
  return { culprit: culprit.id, clues };
}

/** Suspects not yet cleared by the clues in `found` (clue ids). The culprit is never cleared. */
export function remainingSuspects(c: Case, found: Iterable<string>): string[] {
  const f = new Set(found), cleared = new Set(c.clues.filter((k) => f.has(k.id)).map((k) => k.eliminates));
  return SUSPECTS.map((s) => s.id).filter((id) => !cleared.has(id));
}

export const canAccuse = (c: Case, found: Iterable<string>): boolean => remainingSuspects(c, found).length <= CASE.maxRemainingToAccuse;
export const isCulprit = (c: Case, suspectId: string): boolean => c.culprit === suspectId;
/** rank = 1 for the first team that solves the case, 2+ for later teams. */
export const solvePoints = (rank: number): number => (rank <= 1 ? CASE.solveFirst : CASE.solveLater);
export const clueSpot = (id: string): { x: number; z: number } | null => { const i = /^c([0-4])$/.exec(id); return i ? CASE_SPOTS[Number(i[1])] : null; };

// ---- Per-team progress and the accusation referee (pure, so the server handler stays a thin wrapper) ----
export interface TeamCase { found: Set<string>; cdUntil: number; solved: boolean }
export const newTeamCase = (): TeamCase => ({ found: new Set<string>(), cdUntil: 0, solved: false });

/** A team finds a clue. Returns true only the first time this team finds it. */
export function foundClue(t: TeamCase, c: Case, clueId: string): boolean {
  if (t.solved || !c.clues.some((k) => k.id === clueId) || t.found.has(clueId)) return false;
  t.found.add(clueId);
  return true;
}

export type AccuseOutcome =
  | { kind: "ignored" }                       // unknown suspect or the team already solved it
  | { kind: "need_clues" }
  | { kind: "cooldown"; waitMs: number }
  | { kind: "wrong"; waitMs: number }
  | { kind: "solved"; rank: number; gained: number };

/** Judges one accusation and updates the team's state. `teamsSolvedBefore` = how many teams have already solved the case. */
export function accuse(c: Case, t: TeamCase, suspectId: string, now: number, teamsSolvedBefore: number): AccuseOutcome {
  if (t.solved || !SUSPECTS.some((s) => s.id === suspectId)) return { kind: "ignored" };
  if (!canAccuse(c, t.found)) return { kind: "need_clues" };
  if (now < t.cdUntil) return { kind: "cooldown", waitMs: t.cdUntil - now };
  if (!isCulprit(c, suspectId)) { t.cdUntil = now + CASE.accuseCooldownMs; return { kind: "wrong", waitMs: CASE.accuseCooldownMs }; }
  t.solved = true;
  const rank = teamsSolvedBefore + 1;
  return { kind: "solved", rank, gained: solvePoints(rank) };
}
