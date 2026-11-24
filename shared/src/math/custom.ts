import { makeRng } from "./rng.ts";
import { solve } from "./solve.ts";
import { makeChoices } from "./generate.ts";
import { validateQuestion } from "./validate.ts";
import type { Difficulty, Question, Topic } from "./types.ts";

/** Allowed integer ranges per template kind. Anything outside is rejected, so odd AI output cannot reach players. */
export const PARAM_SPEC: Record<string, Record<string, [number, number]>> = {
  basic_dice_sum: { s: [2, 12] },
  basic_balls: { r: [1, 60], b: [1, 60] },
  expected_value: { v1: [-1000, 1000], v2: [-1000, 1000], v3: [-1000, 1000], q1: [0, 100], q2: [0, 100], q3: [0, 100] },
  variance_two_point: { a: [-100, 100], b: [-100, 100], q: [1, 99] },
  binom_exact: { n: [1, 30], k: [0, 30], p: [1, 99] },
  binom_mean: { n: [1, 1000], p: [1, 99] },
  binom_at_least_one: { n: [1, 30], p: [1, 99] },
  poisson_exact: { lambda: [1, 20], k: [0, 30] },
  poisson_at_most: { lambda: [1, 20], k: [0, 30] },
  unif_between: { a: [0, 50], b: [1, 100], c: [0, 100], d: [0, 100] },
  unif_mean: { a: [0, 50], b: [1, 100] },
  unif_var: { a: [0, 50], b: [1, 100] },
  normal_below: { z: [-35, 35] },   // z in tenths: 15 = 1.5 standard deviations
  normal_between: { z: [1, 35] },
};
export const KINDS = Object.keys(PARAM_SPEC);

const TOPIC_OF: Record<string, Topic> = {
  basic_dice_sum: "basic", basic_balls: "basic", expected_value: "expected", variance_two_point: "variance",
  binom_exact: "binomial", binom_mean: "binomial", binom_at_least_one: "binomial",
  poisson_exact: "poisson", poisson_at_most: "poisson", unif_between: "uniform", unif_mean: "uniform", unif_var: "uniform", normal_below: "normal", normal_between: "normal",
};
const DECIMALS: Record<string, number> = { expected_value: 2, binom_mean: 2, unif_mean: 2 };
const FORMULA: Record<string, string> = {
  basic_dice_sum: "P = จำนวนคู่แต้มที่รวมได้ตามที่กำหนด ÷ 36",
  basic_balls: "P = r ÷ (r + b)",
  expected_value: "E(X) = Σ x·P(x)",
  variance_two_point: "Var(X) = E(X²) − [E(X)]²",
  binom_exact: "P(X=k) = C(n,k)·p^k·(1−p)^(n−k)",
  binom_mean: "E(X) = np",
  binom_at_least_one: "P(อย่างน้อย 1) = 1 − (1−p)^n",
  unif_between: "P = จำนวนค่าที่ต้องการ ÷ จำนวนค่าทั้งหมด (เอกรูป: ทุกค่าโอกาสเท่ากัน)",
  unif_mean: "E(X) = (a + b) / 2",
  unif_var: "Var(X) = (n² − 1) / 12, n = b − a + 1",
  poisson_exact: "P(X=k) = e^(−λ)·λ^k / k!",
  poisson_at_most: "P(X≤k) = Σ P(X=i), i = 0..k",
  normal_below: "แปลงเป็น z แล้วหา P(Z < z)",
  normal_between: "P(−z < Z < z) = Φ(z) − Φ(−z)",
};

export function checkParams(kind: string, p: Record<string, number>): string[] {
  const spec = PARAM_SPEC[kind];
  if (!spec) return ["unknown kind: " + kind];
  const errs: string[] = [];
  for (const [k, [lo, hi]] of Object.entries(spec)) {
    const v = p?.[k];
    if (typeof v !== "number" || !Number.isInteger(v) || v < lo || v > hi) errs.push(`param ${k} must be an integer in [${lo}, ${hi}]`);
  }
  for (const k of Object.keys(p ?? {})) if (!(k in spec)) errs.push("unexpected param " + k);
  if (errs.length) return errs;
  if (kind === "binom_exact" && p.k > p.n) errs.push("k must be <= n");
  if (kind === "expected_value" && p.q1 + p.q2 + p.q3 !== 100) errs.push("q1+q2+q3 must equal 100");
  if (kind.startsWith("unif_") && !(p.a < p.b)) errs.push("a must be < b");
  if (kind === "unif_between" && !(p.a <= p.c && p.c <= p.d && p.d <= p.b)) errs.push("need a <= c <= d <= b");
  return errs;
}

/**
 * Turns an externally proposed (kind, params, text) into a full question.
 * The answer, choices and solution are always computed here, never taken from the proposer.
 */
export function buildCustom(kind: string, params: Record<string, number>, text: string, difficulty: Difficulty, seed: number): { question?: Question; errors: string[] } {
  const errors = checkParams(kind, params);
  if (typeof text !== "string" || text.trim().length < 10 || text.length > 600) errors.push("text must be 10-600 characters");
  if (errors.length) return { errors };
  if (!kind.startsWith("normal")) // numbers in the stem must match the parameters used for the answer
    for (const [k, v] of Object.entries(params)) if (!text.includes(String(Math.abs(v)))) errors.push(`text does not mention ${k}=${v}`);
  if (errors.length) return { errors };
  const decimals = DECIMALS[kind] ?? 4;
  const truth = solve(kind, params);
  const mc = makeChoices(truth, kind, decimals, makeRng(seed));
  if (!mc) return { errors: ["could not build distinct choices for this value"] };
  const q: Question = {
    id: `custom-${kind}-${seed}`, topic: TOPIC_OF[kind], kind, params, difficulty, text: text.trim(),
    choices: mc.choices, correctIndex: mc.correctIndex, answer: truth, decimals,
    solution: [FORMULA[kind], "ค่าที่ใช้: " + Object.entries(params).map(([k, v]) => `${k}=${v}`).join(", "), `คำตอบ = ${mc.correct}`],
    hints: [FORMULA[kind]], source: "ai", approved: false,
  };
  const v = validateQuestion(q);
  return v.length ? { errors: v } : { question: q, errors: [] };
}
