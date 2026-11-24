import express, { type Request, type Response, type NextFunction } from "express";
import { createHash, timingSafeEqual, randomInt } from "node:crypto";
import { TOPICS, generateQuestion, buildCustom, type Difficulty, type Topic, type Question } from "../../shared/src/index.ts";
import { bank, type Status } from "./bank.ts";
import { aiConfigured, proposeFromContent } from "./ai.ts";

const DIFFS: Difficulty[] = ["easy", "normal", "hard", "expert"];
const KEYWORDS: [Topic, RegExp][] = [
  ["binomial", /ทวินาม|binomial/i], ["poisson", /ปัวซง|poisson/i], ["normal", /ปกติ|normal/i], ["uniform", /เอกรูป|uniform/i],
  ["variance", /แปรปรวน|variance/i], ["expected", /ค่าคาดหมาย|expected/i], ["basic", /ความน่าจะเป็น|probability/i],
];
const sha = (s: string) => createHash("sha256").update(s).digest();

export function adminRouter() {
  const r = express.Router();
  r.use(express.json({ limit: "100kb" }));

  // CORS: set ADMIN_ORIGIN to your deployed client origin in production.
  r.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", process.env.ADMIN_ORIGIN ?? "*");
    res.setHeader("Access-Control-Allow-Headers", "content-type, x-admin-token");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    if (req.method === "OPTIONS") return void res.sendStatus(204);
    next();
  });

  // Simple per-IP limit: 60 requests per minute.
  const hits = new Map<string, { n: number; t: number }>();
  r.use((req, res, next) => {
    const ip = req.ip ?? "?", now = Date.now(), h = hits.get(ip);
    if (!h || now - h.t > 60_000) hits.set(ip, { n: 1, t: now });
    else if (++h.n > 60) return void res.status(429).json({ error: "rate_limited" });
    next();
  });

  r.use((req: Request, res: Response, next: NextFunction) => {
    const token = process.env.ADMIN_TOKEN;
    if (!token) return void res.status(503).json({ error: "admin_disabled", hint: "set ADMIN_TOKEN on the server" });
    if (!timingSafeEqual(sha(String(req.header("x-admin-token") ?? "")), sha(token))) return void res.status(401).json({ error: "unauthorized" });
    next();
  });

  r.get("/status", (_req, res) => res.json({ ai: aiConfigured() }));
  r.get("/questions", (_req, res) => res.json({ entries: bank.list() }));

  r.post("/generate", async (req, res) => {
    const { mode, topic, difficulty, content } = req.body ?? {};
    const count = Math.max(1, Math.min(20, Number(req.body?.count) || 5));
    if (!DIFFS.includes(difficulty)) return void res.status(400).json({ error: "bad_difficulty" });
    if (mode !== "template" && mode !== "content") return void res.status(400).json({ error: "bad_mode" });
    const added: Question[] = [], rejected: string[] = [];
    let aiUsed = false;
    try {
      const fromTemplates = (topics: Topic[]) => {
        for (let i = 0; i < count; i++) added.push(bank.add(generateQuestion(topics[i % topics.length], difficulty, randomInt(1, 2e9))));
      };
      if (mode === "template") {
        if (topic !== "all" && !TOPICS.includes(topic)) return void res.status(400).json({ error: "bad_topic" });
        fromTemplates(topic === "all" ? TOPICS : [topic]);
      } else {
        if (typeof content !== "string" || content.trim().length < 20 || content.length > 8000) return void res.status(400).json({ error: "content_must_be_20_to_8000_chars" });
        if (aiConfigured()) {
          aiUsed = true;
          for (const p of await proposeFromContent(content, count, difficulty)) {
            const b = buildCustom(p.kind, p.params, p.text, difficulty, randomInt(1, 2e9));
            if (b.question) added.push(bank.add(b.question)); else rejected.push(`${p.kind}: ${b.errors.join("; ")}`);
          }
        } else { // no API key: detect topics by keyword and use the template generator
          const found = KEYWORDS.filter(([, re]) => re.test(content)).map(([t]) => t);
          fromTemplates(found.length ? found : TOPICS);
        }
      }
      res.json({ added, rejected, aiUsed });
    } catch (e: any) {
      console.error("[tbcn] generate failed", e);
      res.status(500).json({ error: "generate_failed", detail: String(e?.message ?? e), added, rejected });
    }
  });

  r.post("/questions/:id/status", (req, res) => {
    const status = req.body?.status as Status;
    if (!["pending", "approved", "rejected"].includes(status)) return void res.status(400).json({ error: "bad_status" });
    bank.setStatus(req.params.id, status) ? res.json({ ok: true }) : res.status(404).json({ error: "not_found" });
  });
  r.delete("/questions/:id", (req, res) => (bank.remove(req.params.id) ? res.json({ ok: true }) : res.status(404).json({ error: "not_found" })));
  return r;
}
