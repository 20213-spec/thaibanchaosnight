/**
 * Chaos Party round 5: cooking. A different kind of play from the other rounds: nothing to walk to except the stove,
 * you tap ingredients in the right ORDER, quickly. The server checks every tap (order, minimum tap interval, distance to the stove).
 * A wrong tap only restarts the dish; nobody loses points.
 */
export const INGREDIENTS = [
  { id: "egg", name: "ไข่", icon: "🥚" }, { id: "rice", name: "ข้าว", icon: "🍚" }, { id: "chili", name: "พริก", icon: "🌶️" },
  { id: "garlic", name: "กระเทียม", icon: "🧄" }, { id: "tomato", name: "มะเขือเทศ", icon: "🍅" }, { id: "veg", name: "ผัก", icon: "🥬" },
  { id: "shrimp", name: "กุ้ง", icon: "🦐" }, { id: "lime", name: "มะนาว", icon: "🍋" }, { id: "onion", name: "หอม", icon: "🧅" }, { id: "fish", name: "ปลา", icon: "🐟" },
] as const;
export type IngredientId = (typeof INGREDIENTS)[number]["id"];
export const isIngredient = (id: unknown): id is IngredientId => INGREDIENTS.some((i) => i.id === id);

export interface Recipe { id: string; name: string; icon: string; steps: IngredientId[] }
export const RECIPES: Recipe[] = [
  { id: "omelet", name: "ไข่เจียว", icon: "🍳", steps: ["egg", "onion", "chili"] },
  { id: "somtam", name: "ส้มตำ", icon: "🥗", steps: ["garlic", "chili", "tomato"] },
  { id: "friedrice", name: "ข้าวผัด", icon: "🍛", steps: ["garlic", "rice", "egg"] },
  { id: "tomyum", name: "ต้มยำกุ้ง", icon: "🍲", steps: ["shrimp", "chili", "lime", "onion"] },
  { id: "krapao", name: "ผัดกะเพรา", icon: "🍽️", steps: ["garlic", "chili", "veg", "egg"] },
  { id: "steamedfish", name: "ปลานึ่งมะนาว", icon: "🐟", steps: ["fish", "garlic", "chili", "lime"] },
  { id: "shrimprice", name: "ข้าวผัดกุ้ง", icon: "🍤", steps: ["garlic", "shrimp", "rice", "egg", "onion"] },
  { id: "padthai", name: "ผัดไทย", icon: "🍜", steps: ["egg", "shrimp", "veg", "lime", "chili"] },
  { id: "laab", name: "ลาบปลา", icon: "🥘", steps: ["fish", "onion", "chili", "lime", "veg"] },
];

export const COOK = { seconds: 75, tapMinMs: 120, perStepLimitMs: 3500, pointsPerStep: 8, speedBonusPerStep: 4, reach: 6 };
export const COOK_STATION = { x: -26, z: 10 }; // beside the market, clear of stalls and trees

/** Dishes get longer as you cook more: 0-1 done -> 3 steps, 2-3 done -> 4 steps, 4+ -> 5 steps. */
export const recipeLength = (dishesDone: number): 3 | 4 | 5 => (dishesDone < 2 ? 3 : dishesDone < 4 ? 4 : 5);

/** Random recipe of the right length, never the same one twice in a row. rnd() in [0,1). */
export function pickRecipe(dishesDone: number, rnd: () => number, previousId?: string): Recipe {
  const len = recipeLength(dishesDone);
  const pool = RECIPES.filter((r) => r.steps.length === len && r.id !== previousId);
  return pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
}

export const cookLimitMs = (r: Recipe): number => r.steps.length * COOK.perStepLimitMs;

/** Points for one finished dish: a base per step plus a speed bonus that shrinks to 0 at the time limit. */
export function cookScore(length: number, elapsedMs: number): { base: number; bonus: number; total: number } {
  const limit = length * COOK.perStepLimitMs;
  const frac = Math.max(0, Math.min(1, (limit - Math.max(0, elapsedMs)) / limit));
  const base = length * COOK.pointsPerStep, bonus = Math.round(frac * length * COOK.speedBonusPerStep);
  return { base, bonus, total: base + bonus };
}

/** Result of tapping ingredient `ing` when `step` steps of the recipe are already done. */
export function cookStep(r: Recipe, step: number, ing: string): "ok" | "done" | "wrong" {
  if (step < 0 || step >= r.steps.length || r.steps[step] !== ing) return "wrong";
  return step + 1 === r.steps.length ? "done" : "ok";
}
