import fs from "node:fs";
import path from "node:path";

export interface MatchRecord {
  at: number;
  teams: { id: string; name: string; score: number; members: number }[];
  top: { name: string; team: string; score: number }[];
}
const FILE = process.env.HISTORY_FILE ?? path.join(process.cwd(), "data", "history.json");
let rows: MatchRecord[] = (() => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; } })();

export const history = {
  recent: (n = 20) => rows.slice(-n).reverse(),
  add(r: MatchRecord) {
    rows.push(r);
    rows = rows.slice(-100);
    try {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE + ".tmp", JSON.stringify(rows));
      fs.renameSync(FILE + ".tmp", FILE);
    } catch (e) { console.error("[tbcn] could not save history", e); }
  },
};
