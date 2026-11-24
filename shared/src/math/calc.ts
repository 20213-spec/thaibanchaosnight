/** Deterministic calculators. These are the source of truth for every answer. */
export function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}
export function binomPmf(n: number, k: number, p: number): number {
  return choose(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
}
export function poissonPmf(lambda: number, k: number): number {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}
/** Standard normal CDF (Abramowitz-Stegun 7.1.26 erf approximation, error < 1.5e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}
export function round(x: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.round(x * f) / f;
}
