import fs from "node:fs";
import path from "node:path";
import { randomInt } from "node:crypto";
import { validateQuestion, type Question, type Topic, type Difficulty } from "../../shared/src/index.ts";

export type Status = "pending" | "approved" | "rejected";
export interface Entry { q: Question; status: Status; createdAt: number }

const FILE = process.env.BANK_FILE ?? path.join(process.cwd(), "data", "bank.json");

function load(): Entry[] {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; }
}
let entries: Entry[] = load();
function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE + ".tmp", JSON.stringify(entries));
  fs.renameSync(FILE + ".tmp", FILE);
}

/** Question bank. Only entries a human admin approved are ever served to players. */
export const bank = {
  list: () => entries,
  add(q: Question): Question {
    const errs = validateQuestion(q);
    if (errs.length) throw new Error("invalid question: " + errs.join("; "));
    const stored: Question = { ...q, id: `${q.id}-${Date.now().toString(36)}-${randomInt(1e6)}`, approved: false };
    entries.push({ q: stored, status: "pending", createdAt: Date.now() });
    save();
    return stored;
  },
  setStatus(id: string, status: Status): boolean {
    const e = entries.find((x) => x.q.id === id);
    if (!e) return false;
    e.status = status; e.q.approved = status === "approved";
    save();
    return true;
  },
  remove(id: string): boolean {
    const n = entries.length;
    entries = entries.filter((x) => x.q.id !== id);
    if (entries.length !== n) save();
    return entries.length !== n;
  },
  /** A random approved question for this topic and level, or null. Re-validated on every use. */
  pickApproved(topic: Topic, difficulty: Difficulty): Question | null {
    const pool = entries.filter((e) => e.status === "approved" && e.q.topic === topic && e.q.difficulty === difficulty && validateQuestion(e.q).length === 0);
    return pool.length ? { ...pool[randomInt(pool.length)].q } : null;
  },
};
