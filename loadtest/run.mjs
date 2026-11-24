// Load test: N bot players join one room, pick teams, start a match and walk around at 10 moves/sec.
// Usage:  node loadtest/run.mjs --players=8 --seconds=60 --url=ws://localhost:2567
// Run the server first (use MATCH_SECONDS larger than --seconds + 30). Bots run on the machine you start this on.
import { Client } from "colyseus.js";
import fs from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const N = Math.max(1, Math.min(40, Number(args.players ?? 8)));
const SECS = Math.max(10, Number(args.seconds ?? 60));
const URL = args.url ?? "ws://localhost:2567";
const MODE = ["chaos_party", "chaos_night"].includes(args.mode) ? args.mode : "ghost_hunt"; // chaos_party lasts about 455 s: use --seconds=460 or more
const TEAMS = ["red", "blue", "green", "yellow", "purple"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (arr, p) => (arr.length ? [...arr].sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))] : null);

const stats = { joinFailures: 0, joinMs: [], disconnects: 0, errors: 0, rtts: [], patches: 0, moveSent: 0, snapBacks: 0 };
const bots = [];

async function makeBot(i, roomId) {
  const client = new Client(URL);
  const t0 = performance.now();
  const room = roomId ? await client.joinById(roomId, { name: "bot" + i }) : await client.create("game", { name: "bot" + i });
  stats.joinMs.push(performance.now() - t0);
  const bot = { i, room, heading: Math.random() * Math.PI * 2, alive: true };
  room.onStateChange(() => stats.patches++);
  room.onLeave((code) => { if (bot.alive) { stats.disconnects++; bot.alive = false; } });
  room.onMessage("error", () => stats.errors++);
  room.onMessage("correct", () => stats.snapBacks++);
  room.onMessage("pong", (m) => stats.rtts.push(performance.now() - m.t));
  for (const m of ["scare", "event", "collected", "ended", "party:orb", "round:result", "quiz:result", "quiz:end", "delivered", "picked"]) room.onMessage(m, () => {});
  room.onMessage("quiz:q", () => setTimeout(() => bot.alive && room.send("quiz:answer", { index: Math.floor(Math.random() * 4) }), 500 + Math.random() * 8000));
  return bot;
}

console.log(`Load test: ${N} bots -> ${URL}, mode ${MODE}, ${SECS}s of play`);
const host = await makeBot(0);
bots.push(host);
for (let i = 1; i < N; i++) {
  try { bots.push(await makeBot(i, host.room.roomId)); } catch (e) { stats.joinFailures++; console.error("join failed", i, e?.message ?? e); }
  await sleep(80);
}
console.log(`Joined ${bots.length}/${N}`);

for (const b of bots) { b.room.send("team", { team: TEAMS[b.i % TEAMS.length] }); await sleep(20); }
await sleep(300);
for (const b of bots) b.room.send("ready", { ready: true });
await sleep(500);
if (MODE !== "ghost_hunt") { host.room.send("mode", { mode: MODE }); await sleep(300); }
host.room.send("start");
for (let i = 0; i < 50 && !host.room.state.started; i++) await sleep(100);
if (!host.room.state.started) { console.error("FAIL: match did not start (teams full? someone not ready?)"); process.exit(1); }
console.log("Match started");

const pos = new Map();
for (const b of bots) { const p = b.room.state.players.get(b.room.sessionId); pos.set(b.i, { x: p.x, z: p.z }); }
const timers = [];
for (const b of bots) {
  timers.push(setInterval(() => { // 10 Hz walk: slowly turning heading at walking speed, bouncing off the map edge
    if (!b.alive) return;
    const p = pos.get(b.i);
    b.heading += (Math.random() - 0.5) * 0.4;
    let nx = p.x + Math.sin(b.heading) * 4.5 * 0.1 * 0.8, nz = p.z + Math.cos(b.heading) * 4.5 * 0.1 * 0.8;
    if (Math.abs(nx) > 38 || Math.abs(nz) > 38) { b.heading += Math.PI; nx = p.x; nz = p.z; }
    p.x = nx; p.z = nz;
    b.room.send("move", { x: +nx.toFixed(2), y: 0, z: +nz.toFixed(2), ry: +b.heading.toFixed(2) });
    stats.moveSent++;
  }, 100));
  timers.push(setInterval(() => b.alive && b.room.send("ping", { t: performance.now() }), 1000 + (b.i % 10) * 37));
}

await sleep(SECS * 1000);
timers.forEach(clearInterval);

let health = null;
try { health = await (await fetch(URL.replace(/^ws/, "http") + "/health")).json(); } catch {}
const result = {
  mode: MODE, players: N, joined: bots.length, seconds: SECS, url: URL, at: new Date().toISOString(),
  joinFailures: stats.joinFailures, disconnects: stats.disconnects, serverErrors: stats.errors, snapBacks: stats.snapBacks,
  joinMsP95: Math.round(pct(stats.joinMs, 0.95) ?? 0),
  rttMs: { p50: Math.round(pct(stats.rtts, 0.5) ?? 0), p95: Math.round(pct(stats.rtts, 0.95) ?? 0), max: Math.round(Math.max(0, ...stats.rtts)), samples: stats.rtts.length },
  stateUpdatesPerBotPerSec: +(stats.patches / bots.length / SECS).toFixed(1),
  movesSentPerSec: Math.round(stats.moveSent / SECS),
  serverHealth: health,
};
// Suggested pass criteria (my defaults, change them): no failed joins, no disconnects, p95 RTT under 150 ms on a LAN, few snap-backs.
result.verdict = result.joinFailures === 0 && result.disconnects === 0 && result.joined === N && result.rttMs.p95 < 150 && result.snapBacks <= N ? "PASS" : "FAIL";
console.log(JSON.stringify(result, null, 2));
fs.mkdirSync("loadtest/results", { recursive: true });
fs.writeFileSync(`loadtest/results/${N}-players-${Date.now()}.json`, JSON.stringify(result, null, 2));
for (const b of bots) { b.alive = false; try { b.room.leave(); } catch {} }
await sleep(300);
process.exit(result.verdict === "PASS" ? 0 : 2);
