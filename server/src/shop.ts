import express from "express";
import { SHOP_ITEMS, isValidPlayerKey } from "../../shared/src/index.ts";
import { wallets } from "./wallet.ts";

/** Public shop API. The caller proves who they are with a private random key (header x-player-key). Cosmetics only. */
export function shopRouter() {
  const r = express.Router();
  r.use(express.json({ limit: "2kb" }));
  r.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", process.env.ADMIN_ORIGIN ?? "*");
    res.setHeader("Access-Control-Allow-Headers", "content-type, x-player-key");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") return void res.sendStatus(204);
    next();
  });
  const hits = new Map<string, { n: number; t: number }>(); // 60 requests per minute per IP
  r.use((req, res, next) => {
    const ip = req.ip ?? "?", now = Date.now(), h = hits.get(ip);
    if (!h || now - h.t > 60_000) hits.set(ip, { n: 1, t: now });
    else if (++h.n > 60) return void res.status(429).json({ error: "rate_limited" });
    next();
  });
  r.use((req, res, next) => {
    const key = req.header("x-player-key");
    if (!isValidPlayerKey(key)) return void res.status(401).json({ error: "bad_key" });
    (req as any).playerKey = key;
    next();
  });
  r.get("/me", (req, res) => res.json({ wallet: wallets.peek((req as any).playerKey), items: SHOP_ITEMS }));
  r.post("/buy", (req, res) => {
    const out = wallets.buy((req as any).playerKey, String(req.body?.item));
    out.error ? res.status(400).json({ error: out.error, wallet: out.wallet }) : res.json({ wallet: out.wallet });
  });
  r.post("/equip", (req, res) => {
    const out = wallets.equip((req as any).playerKey, String(req.body?.item ?? ""));
    out.error ? res.status(400).json({ error: out.error, wallet: out.wallet }) : res.json({ wallet: out.wallet });
  });
  return r;
}
