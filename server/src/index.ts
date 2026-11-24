import http from "node:http";
import express from "express";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./GameRoom.ts";
import { adminRouter } from "./admin.ts";
import { history } from "./history.ts";
import { dailyTop, dayKey } from "../../shared/src/index.ts";
import { shopRouter } from "./shop.ts";

const port = Number(process.env.PORT ?? 2567);
const app = express();
app.set("trust proxy", 1); // behind Render/Fly/etc. so rate limits see the real client IP
app.get("/health", (_req, res) => res.json({ ok: true, uptimeSec: Math.round(process.uptime()), rssMB: Math.round(process.memoryUsage().rss / 1048576) }));
app.use("/admin", adminRouter());
app.use("/shop", shopRouter());
app.get("/history", (_req, res) => { // public: recent match results (team scores and top player names only)
  res.setHeader("Access-Control-Allow-Origin", process.env.ADMIN_ORIGIN ?? "*");
  const day = dayKey(Date.now()); // daily top (Thai time) from the last 100 matches already kept: names and scores only
  res.json({ matches: history.recent(10), daily: { day, top: dailyTop(history.recent(100), day) } });
});
const httpServer = http.createServer(app);
const server = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
server.define("game", GameRoom);
server.listen(port).then(() => {
  console.log(`[tbcn] server listening on ws://localhost:${port}`);
  console.log(process.env.ADMIN_TOKEN ? "[tbcn] admin API enabled" : "[tbcn] admin API disabled (set ADMIN_TOKEN to enable)");
});
