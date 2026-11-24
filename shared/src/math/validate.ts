import { solve } from "./solve.ts";
import { round } from "./calc.ts";
import type { Question } from "./types.ts";

/** Second, independent check. Returns a list of problems; empty list = valid. */
export function validateQuestion(q: Question): string[] {
  const errs: string[] = [];
  if (!q.text?.trim()) errs.push("missing text");
  if (q.choices.length !== 4) errs.push("must have exactly 4 choices");
  if (q.correctIndex < 0 || q.correctIndex >= q.choices.length) errs.push("correctIndex out of range");
  if (new Set(q.choices).size !== q.choices.length) errs.push("duplicate choices");
  if (q.solution.length === 0) errs.push("missing solution");
  let truth: number | undefined;
  try { truth = solve(q.kind, q.params); } catch (e) { errs.push("cannot recompute: " + (e as Error).message); }
  if (truth !== undefined) {
    if (!Number.isFinite(truth)) errs.push("answer not finite");
    const expected = round(truth, q.decimals).toFixed(q.decimals);
    if (q.choices[q.correctIndex] !== expected) errs.push(`marked answer ${q.choices[q.correctIndex]} != recomputed ${expected}`);
    const step = Math.pow(10, -q.decimals);
    const matching = q.choices.filter((c) => Math.abs(Number(c) - Number(expected)) < step / 2);
    if (matching.length !== 1) errs.push("ambiguous: more than one choice equals the true answer");
    const isProb = /^(basic|binom_exact|binom_at_least_one|poisson|normal|unif_between)/.test(q.kind);
    if (isProb && q.choices.some((c) => Number(c) < 0 || Number(c) > 1)) errs.push("probability choice outside [0,1]");
  }
  return errs;
}
