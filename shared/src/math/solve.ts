import { binomPmf, poissonPmf, normalCdf } from "./calc.ts";

/** Independent recomputation from (kind, params). Used by generator AND validator. */
export function solve(kind: string, p: Record<string, number>): number {
  switch (kind) {
    case "basic_dice_sum": // P(sum of two dice = s)
      { let c = 0; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b === p.s) c++; return c / 36; }
    case "basic_balls": // P(draw red) = r/(r+b)
      return p.r / (p.r + p.b);
    case "expected_value": // values v1..v3 with probs q1..q3 (percent)
      return (p.v1 * p.q1 + p.v2 * p.q2 + p.v3 * p.q3) / 100;
    case "variance_two_point": // X=a w.p. q/100, else b
      { const q = p.q / 100; const m = p.a * q + p.b * (1 - q); return p.a * p.a * q + p.b * p.b * (1 - q) - m * m; }
    case "binom_exact":
      return binomPmf(p.n, p.k, p.p / 100);
    case "binom_mean":
      return p.n * (p.p / 100);
    case "binom_at_least_one":
      return 1 - Math.pow(1 - p.p / 100, p.n);
    case "poisson_exact":
      return poissonPmf(p.lambda, p.k);
    case "poisson_at_most":
      { let s = 0; for (let i = 0; i <= p.k; i++) s += poissonPmf(p.lambda, i); return s; }
    case "unif_between": // X uniform on {a..b}: P(c <= X <= d)
      return (p.d - p.c + 1) / (p.b - p.a + 1);
    case "unif_mean":    // E(X) = (a+b)/2
      return (p.a + p.b) / 2;
    case "unif_var":     // Var(X) = (n^2 - 1) / 12 with n = b-a+1 values
      { const n = p.b - p.a + 1; return (n * n - 1) / 12; }
    case "normal_below": // P(X < mu + z*sigma), z in tenths
      return normalCdf(p.z / 10);
    case "normal_between": // P(mu - z*sigma < X < mu + z*sigma)
      return normalCdf(p.z / 10) - normalCdf(-p.z / 10);
    default:
      throw new Error("unknown kind: " + kind);
  }
}
