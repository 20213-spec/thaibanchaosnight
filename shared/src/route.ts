/**
 * Crossroad choice (M6.2): pick the route with the better chance of getting through, using independent-event probability.
 * Route X has two gates in a row (chance a% then b%), route Y has one gate (chance c%). The answer is computed by code, and a second,
 * independent validator (integer arithmetic) re-checks every generated question. No points are won or lost: a wrong pick just earns a
 * funny scene, a right pick earns a story note. Pure.
 */
export const ROUTE_SPOT = { x: 27, z: 0, name: "ทางแยกริมทุ่งนา" };
export const ROUTE_REACH = 3, ROUTE_REACH_SERVER = 4.5;
export const ROUTE_COOLDOWN_MS = 20_000; // per player, between questions
export const ROUTE_GATES = [50, 60, 70, 80, 90] as const; // percent per gate of the two-gate route
export const ROUTE_MIN_GAP = 4;                           // percentage points between the two routes, so the answer is clear

export interface RouteQuestion {
  text: string; choices: [string, string]; correctIndex: 0 | 1; solution: string[];
  twoGateIndex: 0 | 1;      // which choice is the two-gate route
  a: number; b: number; c: number; // percent chances
}
export const ROUTE_CHOICES: [string, string] = ["เส้นทาง ก", "เส้นทาง ข"];
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function makeRoute(rnd: () => number): RouteQuestion {
  const pick = <T,>(xs: readonly T[]) => xs[Math.min(xs.length - 1, Math.floor(rnd() * xs.length))];
  const a = pick(ROUTE_GATES), b = pick(ROUTE_GATES), prod = (a * b) / 100; // percent, always an integer for these gate values
  let c = 0;
  do { c = 20 + 5 * Math.floor(rnd() * 16); } while (Math.abs(c - prod) < ROUTE_MIN_GAP); // 20..95 step 5
  const twoGateIndex: 0 | 1 = rnd() < 0.5 ? 0 : 1, oneGateIndex = (1 - twoGateIndex) as 0 | 1;
  const two = ROUTE_CHOICES[twoGateIndex], one = ROUTE_CHOICES[oneGateIndex];
  const correctIndex: 0 | 1 = prod > c ? twoGateIndex : oneGateIndex;
  const text = `${ROUTE_SPOT.name}: ${two} ต้องผ่านประตูไม้ 2 ด่านติดกัน ด่านแรกผ่านได้ ${a}% ด่านที่สองผ่านได้ ${b}% (แต่ละด่านเป็นอิสระต่อกัน) ส่วน${one} ผ่านด่านเดียว ผ่านได้ ${c}% อยากไปถึงปลายทางให้ได้ ควรเลือกเส้นทางไหน?`;
  const solution = [
    `${two}: ต้องผ่านทั้งสองด่าน เหตุการณ์อิสระจึงคูณกัน P = ${a}/100 × ${b}/100 = ${fmt(prod)}%`,
    `${one}: ผ่านด่านเดียว P = ${c}%`,
    `เทียบกัน: ${fmt(prod)}% ${prod > c ? ">" : "<"} ${c}% จึงควรเลือก${ROUTE_CHOICES[correctIndex]}`,
  ];
  return { text, choices: ROUTE_CHOICES, correctIndex, solution, twoGateIndex, a, b, c };
}

/** Independent checker (integer maths only, does not reuse makeRoute's arithmetic). Returns a list of problems; empty = valid. */
export function validateRoute(r: RouteQuestion): string[] {
  const bad: string[] = [];
  if (!(ROUTE_GATES as readonly number[]).includes(r.a) || !(ROUTE_GATES as readonly number[]).includes(r.b)) bad.push("gate percent out of range");
  if (!Number.isInteger(r.c) || r.c < 20 || r.c > 95) bad.push("single-gate percent out of range");
  const twoScaled = r.a * r.b, oneScaled = r.c * 100;                // compare in units of 1/10000
  if (Math.abs(twoScaled - oneScaled) < ROUTE_MIN_GAP * 100) bad.push("routes too close");
  const expected = twoScaled > oneScaled ? r.twoGateIndex : 1 - r.twoGateIndex;
  if (r.correctIndex !== expected) bad.push("wrong correctIndex");
  if (r.choices.length !== 2 || r.choices[0] === r.choices[1]) bad.push("bad choices");
  for (const n of [r.a, r.b, r.c]) if (!r.text.includes(`${n}%`)) bad.push("text misses " + n);
  if (r.solution.length !== 3) bad.push("solution steps");
  return bad;
}

/** Funny result lines. Nobody loses anything. */
export const ROUTE_FLAVOR_WRONG = [
  "เลือกพลาดนิดหน่อย เจอแม่ไก่ฝูงใหญ่ไล่จิกอ้อมทุ่งนาไปไกลเลย แต่ไม่เป็นอะไร ลองใหม่ได้",
  "ประตูไม้บานที่สองฝืดมาก ต้องออกแรงดันจนเหนื่อย แต่สุดท้ายก็ได้ขนมติดมือมาห่อหนึ่ง",
  "เส้นทางนี้มีควายนอนขวางอยู่ ต้องรอให้ตื่นก่อน ไม่เสียอะไร แค่เสียเวลาเฝ้าดูควายหาว",
] as const;
export const routeFlavorWrong = (rnd: () => number) => ROUTE_FLAVOR_WRONG[Math.min(ROUTE_FLAVOR_WRONG.length - 1, Math.floor(rnd() * ROUTE_FLAVOR_WRONG.length))];
