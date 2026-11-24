import { makeRng, type Rng } from "./rng.ts";
import { solve } from "./solve.ts";
import { round } from "./calc.ts";
import type { Difficulty, Question, Topic } from "./types.ts";

type Draft = {
  topic: Topic; kind: string; params: Record<string, number>; decimals: number;
  text: string; solution: string[]; hints: string[];
};

const fmt = (x: number, d: number) => x.toFixed(d);

function draftFor(topic: Topic, diff: Difficulty, r: Rng): Draft {
  const lvl = { easy: 0, normal: 1, hard: 2, expert: 3 }[diff];
  switch (topic) {
    case "basic": {
      if (r.next() < 0.5) {
        const s = r.int(2, 12);
        return { topic, kind: "basic_dice_sum", params: { s }, decimals: 4,
          text: `ที่ตลาดสดมีเกมทอยลูกเต๋า 2 ลูก ผลรวมแต้มได้ ${s} จะได้รางวัล ความน่าจะเป็นที่ได้รางวัลคือเท่าไร`,
          solution: [`ผลลัพธ์ทั้งหมด 6×6 = 36 แบบ`, `จับคู่ที่รวมได้ ${s} มี ${Math.round(solve("basic_dice_sum", { s }) * 36)} แบบ`, `P = ${Math.round(solve("basic_dice_sum", { s }) * 36)}/36`],
          hints: ["ลองเขียนตารางคู่แต้มของลูกเต๋าทั้งสอง", "ผลลัพธ์ทั้งหมดมี 36 แบบ"] };
      }
      const red = r.int(2, 6 + lvl * 3), blue = r.int(2, 6 + lvl * 3);
      return { topic, kind: "basic_balls", params: { r: red, b: blue }, decimals: 4,
        text: `ในกล่องโคมไฟมีโคมแดง ${red} ดวง และโคมน้ำเงิน ${blue} ดวง สุ่มหยิบ 1 ดวง ความน่าจะเป็นที่ได้โคมแดงคือเท่าไร`,
        solution: [`โคมทั้งหมด ${red}+${blue} = ${red + blue} ดวง`, `P = ${red}/${red + blue}`],
        hints: ["P = จำนวนที่สนใจ ÷ จำนวนทั้งหมด"] };
    }
    case "expected": {
      const base = 10 * (lvl + 1);
      const v = [r.int(1, 5) * base, r.int(0, 3) * base, -r.int(0, 2) * base];
      const q1 = r.int(1, 5) * 10, q2 = r.int(1, 4) * 10, q3 = 100 - q1 - q2;
      return { topic, kind: "expected_value", params: { v1: v[0], v2: v[1], v3: v[2], q1, q2, q3 }, decimals: 2,
        text: `เกมวิ่งส่งของให้คะแนน ${v[0]} คะแนนด้วยโอกาส ${q1}%, ${v[1]} คะแนนด้วยโอกาส ${q2}%, และ ${v[2]} คะแนนด้วยโอกาส ${q3}% ค่าคาดหมายของคะแนนต่อรอบคือเท่าไร`,
        solution: [`E(X) = Σ x·P(x)`, `= (${v[0]}×${q1} + ${v[1]}×${q2} + ${v[2]}×${q3}) ÷ 100`],
        hints: ["คูณแต่ละค่ากับความน่าจะเป็นของมัน แล้วรวมกัน"] };
    }
    case "variance": {
      const a = r.int(2, 6 + lvl * 4), b = r.int(-3, 1), q = r.int(2, 8) * 10;
      return { topic, kind: "variance_two_point", params: { a, b, q }, decimals: 4,
        text: `ตัวแปรสุ่ม X เท่ากับ ${a} ด้วยโอกาส ${q}% และเท่ากับ ${b} ด้วยโอกาส ${100 - q}% ความแปรปรวน Var(X) คือเท่าไร`,
        solution: [`E(X) = ${a}(${q / 100}) + ${b}(${1 - q / 100})`, `E(X²) = ${a * a}(${q / 100}) + ${b * b}(${1 - q / 100})`, `Var(X) = E(X²) − [E(X)]²`],
        hints: ["ใช้สูตร Var(X) = E(X²) − [E(X)]²"] };
    }
    case "binomial": {
      const t = r.int(0, 2);
      const n = r.int(4, 6 + lvl * 3), p = r.pick([20, 25, 30, 40, 50, 60]);
      if (t === 0) {
        const k = r.int(1, n - 1);
        return { topic, kind: "binom_exact", params: { n, k, p }, decimals: 4,
          text: `ที่ทุ่งนา ชาวนายิงลูกเก็บเหรียญแม่นด้วยโอกาส ${p}% ต่อครั้ง ยิง ${n} ครั้งอิสระต่อกัน ความน่าจะเป็นที่ถูกพอดี ${k} ครั้งคือเท่าไร`,
          solution: [`X ~ Binomial(n=${n}, p=${p / 100})`, `P(X=${k}) = C(${n},${k})·p^${k}·(1−p)^${n - k}`],
          hints: ["ใช้สูตรทวินาม C(n,k)·p^k·(1−p)^(n−k)"] };
      }
      if (t === 1) {
        return { topic, kind: "binom_mean", params: { n, p }, decimals: 2,
          text: `ผู้เล่นตอบคำถามถูกด้วยโอกาส ${p}% ต่อข้อ ตอบ ${n} ข้อ จำนวนข้อที่ตอบถูกคาดหมายคือกี่ข้อ`,
          solution: [`X ~ Binomial(${n}, ${p / 100})`, `E(X) = np = ${n}×${p / 100}`], hints: ["ค่าคาดหมายของทวินามคือ np"] };
      }
      return { topic, kind: "binom_at_least_one", params: { n, p }, decimals: 4,
        text: `ไล่จับปลาในบ่อ โอกาสได้ปลา ${p}% ต่อครั้ง ลองทั้งหมด ${n} ครั้งอิสระต่อกัน ความน่าจะเป็นที่ได้ปลาอย่างน้อย 1 ตัวคือเท่าไร`,
        solution: [`P(อย่างน้อย 1) = 1 − P(X=0)`, `= 1 − (1−${p / 100})^${n}`], hints: ["ใช้ส่วนเติมเต็ม: 1 − P(ไม่ได้เลย)"] };
    }
    case "uniform": { // discrete uniform distribution: every value in {a..b} is equally likely
      const span = 4 + lvl * 4, a = r.int(1, 10), b = a + r.int(3, span + 2), n = b - a + 1;
      const t = r.int(0, 2);
      if (t === 0) {
        const c = r.int(a, b - 1), d = r.int(c, b);
        return { topic, kind: "unif_between", params: { a, b, c, d }, decimals: 4,
          text: `ตลาดสุ่มรับเลขบัตรคิวหนึ่งใบเท่าๆ กันจากเลข ${a} ถึง ${b} (การแจกแจงเอกรูปไม่ต่อเนื่อง) ความน่าจะเป็นที่ได้เลขตั้งแต่ ${c} ถึง ${d} คือเท่าไร`,
          solution: [`X มีค่าได้ ${n} ค่า ความน่าจะเป็นค่าละ 1/${n}`, `เลข ${c} ถึง ${d} มี ${d - c + 1} ค่า`, `P = ${d - c + 1}/${n}`],
          hints: ["แต่ละค่ามีโอกาสเท่ากัน นับว่าเลขที่ต้องการมีกี่ค่า", `ค่าทั้งหมดมี ${n} ค่า`] };
      }
      if (t === 1) {
        return { topic, kind: "unif_mean", params: { a, b }, decimals: 2,
          text: `ผีโคมไฟเลือกส่องแสงที่จุดหมายเลข ${a} ถึง ${b} จุดละเท่าๆ กัน (เอกรูปไม่ต่อเนื่อง) ค่าคาดหมายของหมายเลขจุดที่ส่องคือเท่าไร`,
          solution: [`E(X) = (a + b) / 2`, `= (${a} + ${b}) / 2`], hints: ["ค่าคาดหมายของเอกรูปคือค่ากึ่งกลางของค่าต่ำสุดและสูงสุด"] };
      }
      return { topic, kind: "unif_var", params: { a, b }, decimals: 4,
        text: `ผู้เล่นสุ่มหยิบลูกแก้วหมายเลข ${a} ถึง ${b} หมายเลขละ 1 ลูก ความน่าจะเป็นเท่ากัน (เอกรูปไม่ต่อเนื่อง) ความแปรปรวนของหมายเลขที่หยิบได้คือเท่าไร`,
        solution: [`จำนวนค่า n = ${b} − ${a} + 1 = ${n}`, `Var(X) = (n² − 1) / 12`, `= (${n}² − 1) / 12`], hints: ["ใช้สูตร Var(X) = (n² − 1)/12 เมื่อ n คือจำนวนค่าที่เป็นไปได้"] };
    }
    case "poisson": {
      const lambda = r.int(1, 3 + lvl * 2), k = r.int(0, lambda + 2);
      if (r.next() < 0.5) {
        return { topic, kind: "poisson_exact", params: { lambda, k }, decimals: 4,
          text: `เสียงปริศนาในบ้านพักเก่าดังเฉลี่ย ${lambda} ครั้งต่อคืน (การแจกแจงปัวซง) ความน่าจะเป็นที่ดังพอดี ${k} ครั้งคือเท่าไร`,
          solution: [`P(X=k) = e^(−λ)·λ^k / k!`, `λ=${lambda}, k=${k}`], hints: ["ใช้สูตรปัวซง e^(−λ)λ^k/k!"] };
      }
      return { topic, kind: "poisson_at_most", params: { lambda, k }, decimals: 4,
        text: `ผีโคมไฟปรากฏเฉลี่ย ${lambda} ครั้งต่อชั่วโมง (ปัวซง) ความน่าจะเป็นที่ปรากฏไม่เกิน ${k} ครั้งคือเท่าไร`,
        solution: [`P(X≤${k}) = Σ P(X=i) สำหรับ i=0..${k}`], hints: ["หา P(X=0), P(X=1), … แล้วบวกกัน"] };
    }
    case "normal": {
      const mu = r.int(50, 80), sigma = r.int(5, 12), z = r.pick([5, 10, 15, 20]);
      if (r.next() < 0.5) {
        const x = mu + (z / 10) * sigma;
        return { topic, kind: "normal_below", params: { z }, decimals: 4,
          text: `คะแนนสอบของนักเรียนโรงเรียนโนนสุขมีการแจกแจงปกติ ค่าเฉลี่ย ${mu} ส่วนเบี่ยงเบนมาตรฐาน ${sigma} ความน่าจะเป็นที่คะแนนน้อยกว่า ${x} คือเท่าไร`,
          solution: [`z = (${x} − ${mu}) / ${sigma} = ${z / 10}`, `P(Z < ${z / 10})`], hints: ["แปลงเป็นค่า z ก่อน"] };
      }
      const lo = mu - (z / 10) * sigma, hi = mu + (z / 10) * sigma;
      return { topic, kind: "normal_between", params: { z }, decimals: 4,
        text: `ความสูงต้นข้าวมีการแจกแจงปกติ ค่าเฉลี่ย ${mu} ส่วนเบี่ยงเบนมาตรฐาน ${sigma} ความน่าจะเป็นที่ความสูงอยู่ระหว่าง ${lo} ถึง ${hi} คือเท่าไร`,
        solution: [`z = ±${z / 10}`, `P(−${z / 10} < Z < ${z / 10})`], hints: ["แปลงขอบเขตเป็น z ทั้งสองด้าน"] };
    }
  }
}

/** Builds 4 distinct, unambiguous choices around the true answer. Returns null if it cannot. */
export function makeChoices(truth: number, kind: string, decimals: number, r: Rng): { choices: string[]; correct: string; correctIndex: number } | null {
  const correct = fmt(round(truth, decimals), decimals);
  const set = new Set<string>([correct]);
  const step = Math.pow(10, -decimals);
  const cands = [truth * 0.5, truth * 1.5, 1 - truth, truth + 0.1, truth * 2, truth - 0.1, truth + 1, truth * 0.75, truth + 0.05];
  for (const c of r.shuffle(cands)) {
    if (set.size >= 4) break;
    if (!Number.isFinite(c)) continue;
    if (kind.startsWith("basic") || kind.startsWith("binom_exact") || kind.startsWith("poisson") || kind.startsWith("normal") || kind === "unif_between" || kind === "binom_at_least_one") {
      if (c < 0 || c > 1) continue; // probabilities must stay in [0,1]
    }
    const s = fmt(round(c, decimals), decimals);
    if (Math.abs(Number(s) - Number(correct)) < step * 2) continue; // too close = ambiguous
    set.add(s);
  }
  if (set.size < 4) return null;
  const choices = r.shuffle([correct, ...[...set].filter((x) => x !== correct)]);
  return { choices, correct, correctIndex: choices.indexOf(correct) };
}

export const TOPICS: Topic[] = ["basic", "expected", "variance", "binomial", "poisson", "normal", "uniform"];

export function generateQuestion(topic: Topic, difficulty: Difficulty, seed: number): Question {
  for (let attempt = 0; attempt < 50; attempt++) {
    const r = makeRng(seed * 31 + attempt);
    const d = draftFor(topic, difficulty, r);
    const truth = solve(d.kind, d.params);
    const mc = makeChoices(truth, d.kind, d.decimals, r);
    if (!mc) continue;
    const { choices, correct: correctStr } = mc;
    return {
      id: `${topic}-${difficulty}-${seed}`, topic, kind: d.kind, params: d.params, difficulty,
      text: d.text, choices, correctIndex: choices.indexOf(correctStr), answer: truth, decimals: d.decimals,
      solution: [...d.solution, `คำตอบ = ${correctStr}`], hints: d.hints, source: "template", approved: true,
    };
  }
  throw new Error(`could not build a valid question for ${topic}/${difficulty}/${seed}`);
}
