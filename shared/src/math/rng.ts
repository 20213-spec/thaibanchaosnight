/** Seeded PRNG (mulberry32) so the same seed always yields the same question. */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  const pick = <T>(arr: readonly T[]): T => arr[int(0, arr.length - 1)];
  const shuffle = <T>(arr: readonly T[]): T[] => {
    const a2 = [...arr];
    for (let i = a2.length - 1; i > 0; i--) {
      const j = int(0, i);
      [a2[i], a2[j]] = [a2[j], a2[i]];
    }
    return a2;
  };
  return { next, int, pick, shuffle };
}
export type Rng = ReturnType<typeof makeRng>;
