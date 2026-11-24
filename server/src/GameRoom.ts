import { Room, Client } from "colyseus";
import { Player, Evidence, GhostView, GameState } from "./state.ts";
import { ChaosParty } from "./chaos.ts";
import { randomInt } from "node:crypto";
import { bank } from "./bank.ts";
import { history } from "./history.ts";
import { wallets } from "./wallet.ts";
import {
  MAX_PLAYERS, MAX_TEAM_SIZE, TEAMS, TOPICS, generateQuestion, validateQuestion, puzzleScore,
  SCORE, EVIDENCE_SPOTS, EVIDENCE_REACH_SERVER, EVIDENCE_RESPAWN_MS, GHOST, stepGhost, shouldScare,
  CRATE, CRATE_REACH_SERVER, DROP_REACH_SERVER, DELIVERY, SPECIAL, SPECIAL_SPOTS, HELP, recordTeamwork, dropZoneFor,
  stepGhostAI, initGhost, ghostsFor, type GhostAI,
  EMOTES, lobbySpawn, WEATHER, WEATHER_PLAN, LIGHTNING, WIND, nextWeather, weatherDurationMs, lightningStrike, type Weather, dailyTheme, dailyWeights, dayKey,
  CHAOS, chaosTotalSeconds, NIGHT, inSafeZone, shelterAwards, shelterPointsFor,
  cleanLook, DEFAULT_MATCH_SECONDS, isValidPlayerKey, earnBaht, canEquip, GHOST_ABILITIES, maxGhosts, booPoints,
  RUN_SPEED, PUZZLE_ZONE, PUZZLE_REACH, spawnFor, clampWorld,
  SECRET, secretSite, secretNeed, pickSecretMission, secretProgress, secretState, type SecretMission, type SecretMember, BOSS, startBoss, bossProgress, bossStep, bossState, bossRewards, bossSite, type BossEvent, type BossMember, LOST, LOST_ITEMS, startLost, canTakeLost, lostRewards, lostSiteName, type LostItem, CLOSURE, pickClosure, closureStep, closureActive, closureSite, type Closure, TRADE, checkTrade, inTradeReach, inAcceptReach, tradeOfferLive, tradePairKey, type TradeOffer, villageNews, NEWS_FIRST_MS, NEWS_EVERY_MS, noteFor, searchSpot, SEARCH_REACH_SERVER, SEARCH_SPOTS, GADGET, tripRules, deliveryPoints, bump, type Stats, type StatKey, CASE, makeCase, accuse, foundClue, newTeamCase, clueSpot, type Case, type TeamCase,
  doorById, doorToggle, doorIsOpen, pickEerie, eerieDelay, EERIE, PING, markAllowed, RACE, raceReward, raceDelay, raceRankOf, raceCanFinish, raceOver, ROUTE_SPOT, ROUTE_REACH_SERVER, ROUTE_COOLDOWN_MS, makeRoute, validateRoute, routeFlavorWrong, type RouteQuestion, DOOR_OPEN_MS, DOOR_REACH_SERVER, LOCK, pickLockDoor, lockDelay, lockNote,
  type Question, type Topic, type Difficulty,
} from "../../shared/src/index.ts";

interface Puzzle { q: Question; attempts: number; hints: number; solved: boolean }
const DIFFS: Difficulty[] = ["easy", "normal", "hard", "expert"];
const TEAM_IDS: string[] = TEAMS.map((t) => t.id);

/**
 * Server is authoritative: team limits, start rules, answers and scores are all decided here.
 * The correct answer index is never sent to a client until that client answers correctly.
 */
export class GameRoom extends Room<GameState> {
  maxClients = MAX_PLAYERS;
  private puzzles = new Map<string, Puzzle>();
  private buckets = new Map<string, { tokens: number; ts: number }>();
  private lastMove = new Map<string, number>();
  private lastScare = new Map<string, number>();
  private ghostAI = new Map<string, GhostAI>(); // server-only movement state of each AI ghost
  private nextEventAt = 0;
  private endAt = 0;
  private lobbySlot = 0; // next free spot in the lobby plaza
  private weatherUntil = 0; private lastSpell: Weather | null = null; private nextLightning = 0; private windMoveAt = 0;
  private chaos: ChaosParty | null = null;
  /** Ghost Hunt and Chaos Night share the hunt rules (evidence, puzzle, AI ghost, missions); Chaos Party does not. */
  private ghostMode() { return this.state.mode !== "chaos_party"; }
  private night = { phase: "idle" as "idle" | "warn" | "dark", until: 0 };
  private shelterPts = new Map<string, number>();
  private keys = new Map<string, string>(); // sessionId -> private player key (never sent to anyone)
  private twEvents = new Map<string, { id: string; t: number }[]>();
  private deliveries = new Map<string, { count: number; nextAt: number }>();
  private helpPts = new Map<string, number>();
  private scaredUntil = new Map<string, number>();
  private nextSpecialAt = 0;
  private specialUntil = 0;
  private abilityCd = new Map<string, number>();
  private ghostPts = new Map<string, number>();
  private theCase: Case | null = null; // detective case of this match: the culprit never leaves the server
  private caseTeams = new Map<string, TeamCase>();
  private caseRank = 0;
  private stats = new Map<string, Stats>();
  private noteSeed = 1;
  private nextNews = 0;
  private secret: SecretMission | null = null; // the running secret mission (one at a time, private to its team)
  private nextSecretAt = 0;
  private boss: BossEvent | null = null; // the running boss event "angry spirit" (I3): public, whole room together
  private tradeOffers = new Map<string, TradeOffer>(); // offerer sessionId -> pending clue swap offer (M3.10)
  private tradeCd = new Map<string, number>(); private tradeUsed = new Map<string, number>(); // cooldown per team pair / swaps used per team
  private closure: Closure | null = null; private nextClosureAt = 0; private lastClosureSite: number | null = null; // temporary closed area (M3.8)
  private lost: LostItem | null = null; private nextLostAt = 0; private lastLostSite: number | null = null; private lostSeq = 0; // lost item event (L3)
  private nextBossAt = 0; private lastBossSite: number | null = null; private bossSentAt = 0;
  private lastSecretTeam: string | null = null;
  private trips = new Map<string, number>();     // player -> time when the crate they carry is lost (trip time limit)
  private stunUntil = new Map<string, number>(); // player -> cannot pick a crate up before this time (hit by a gadget)
  private searched = new Map<string, Set<string>>(); // player -> object ids already searched
  private lockedDoors = new Set<string>();      // doors locked by the event; opened by solving a question (M6.2)
  private lockQ = new Map<string, { door: string; q: Question }>(); // player -> the question they are solving for a locked door
  private lockWrongAt = new Map<string, number>();
  private routeQ = new Map<string, RouteQuestion>(); // player -> crossroad question being answered (answer stays on the server)
  private routeAt = new Map<string, number>();         // player -> time of their last crossroad question (cooldown)
  private race: { q: Question; endAt: number; order: string[]; teams: string[] } | null = null; // running team math race (M6.3)
  private nextRace = 0;
  private raceWrongAt = new Map<string, number>();
  private markAt = new Map<string, number>(); // player -> last ping time (cooldown)
  private markSeq = 0;
  private nextLock = 0;
  private nextEerie = 0;                        // time of the next mysterious sound (0 = not scheduled yet)
  private lastEerie: string | null = null;
  private doorUntil = new Map<string, number>();  // door id -> time it closes by itself (absent = closed)
  private doorUsed = new Map<string, number>();   // door id -> last time someone used it (cooldown)
  private active() { return this.state.started && !this.state.ended; }

  onCreate() {
    this.setState(new GameState());
    EVIDENCE_SPOTS.forEach((sp, i) => {
      const e = new Evidence(); e.x = sp.x; e.z = sp.z; e.active = true;
      this.state.evidence.set("e" + i, e);
    });
    const sp = new Evidence(); sp.active = false; sp.special = true; // the special-mission lantern, hidden until it spawns
    this.state.evidence.set("sp", sp);
    this.setSimulationInterval((ms) => this.update(ms), 100);

    this.handle("emote", (client, msg) => { // quick reaction above the player; only whitelisted emojis are relayed
      const e = String(msg?.e);
      if ((EMOTES as readonly string[]).includes(e) && this.state.players.has(client.sessionId)) this.broadcast("emote", { id: client.sessionId, e });
    }, 3, 1);

    this.handle("ping", (client, msg) => client.send("pong", { t: Number(msg?.t) || 0 }), 5, 2); // used by the load test to measure round-trip time

    this.handle("acc", (client) => { // re-read the equipped cosmetic after the player changed it in the shop
      const p = this.state.players.get(client.sessionId), key = this.keys.get(client.sessionId);
      if (!p || !key || this.state.started) return;
      const w = wallets.peek(key);
      p.acc = canEquip(w, w.equipped) ? w.equipped : "";
    });

    this.handle("look", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || this.state.started || typeof msg !== "object" || msg === null) return;
      const cur = { skin: p.skin, hat: p.hat, hair: p.hair, hairColor: p.hairColor, top: p.top, bottom: p.bottom, bottomColor: p.bottomColor, shoes: p.shoes };
      const l = cleanLook({ ...cur, ...(msg as object) }); // partial updates keep the other fields
      if (l) Object.assign(p, l);
    });

    this.handle("mode", (client, msg) => { // host picks the game mode in the lobby
      const m = String(msg?.mode);
      if (client.sessionId !== this.state.hostId || this.state.started || (m !== "ghost_hunt" && m !== "chaos_party" && m !== "chaos_night")) return;
      this.state.mode = m;
      if (m === "chaos_party") this.state.players.forEach((p) => { p.role = "human"; }); // no ghost role in Chaos Party
    });

    this.handle("cook", (client, msg) => this.chaos?.cook(client, String(msg?.a), typeof msg?.ing === "string" ? msg.ing : undefined), 12, 8); // up to ~8 taps/s
    this.handle("fish:cast", (client) => this.chaos?.fish(client, "cast"));
    this.handle("fish:reel", (client) => this.chaos?.fish(client, "reel"));
    this.handle("quiz:answer", (client, msg) => this.chaos?.answer(client, Number(msg?.index)));

    this.handle("role", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || this.state.started) return;
      if (!this.ghostMode()) return client.send("error", { code: "no_ghost_here" });
      const want = Boolean(msg?.ghost);
      if (want === (p.role === "ghost")) return;
      if (want) {
        const ghosts = [...this.state.players.values()].filter((x) => x.role === "ghost").length;
        if (ghosts + 1 > maxGhosts(this.state.players.size)) return client.send("error", { code: "too_many_ghosts" });
      }
      p.role = want ? "ghost" : "human";
    });

    this.handle("team", (client, msg) => {
      const team = String(msg?.team);
      const p = this.state.players.get(client.sessionId);
      if (!p || this.state.started || !TEAM_IDS.includes(team) || p.team === team) return;
      if (this.counts()[team] >= MAX_TEAM_SIZE) return client.send("error", { code: "team_full" });
      p.team = team;
      p.ready = false;
    });

    this.handle("ready", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || this.state.started || !p.team) return;
      p.ready = Boolean(msg?.ready);
    });

    this.handle("start", (client) => {
      if (client.sessionId !== this.state.hostId || this.state.started) return;
      const all = [...this.state.players.values()];
      if (all.length === 0 || !all.every((p) => p.team && p.ready)) return client.send("error", { code: "not_ready" });
      const nGhost = this.ghostMode() ? all.filter((p) => p.role === "ghost").length : 0;
      if (nGhost >= all.length) return client.send("error", { code: "need_human" });
      if (nGhost > maxGhosts(all.length)) return client.send("error", { code: "too_many_ghosts" });
      this.state.started = true;
      this.lock();
      const slots: Record<string, number> = {};
      this.state.players.forEach((p, id) => {
        const sp = spawnFor(p.team, (slots[p.team] = (slots[p.team] ?? -1) + 1));
        p.x = sp.x; p.z = sp.z; p.y = 0;
        this.lastMove.set(id, Date.now());
      });
      this.nextEventAt = Date.now() + GHOST.eventMinMs;
      this.nextSpecialAt = Date.now() + SPECIAL.firstMs;
      const chaosMode = this.state.mode === "chaos_party";
      const secs = chaosMode ? chaosTotalSeconds() + 3 : Math.max(30, Math.min(3600, Number(process.env.MATCH_SECONDS) || DEFAULT_MATCH_SECONDS));
      this.endAt = Date.now() + secs * 1000;
      this.state.secondsLeft = secs;
      ghostsFor(this.state.mode).forEach((kind, i) => { // AI ghosts for this mode (none in Chaos Party)
        const ai = initGhost(kind, Math.random), gv = new GhostView();
        gv.kind = kind; gv.x = ai.x; gv.z = ai.z;
        this.state.ghosts.set("g" + i, gv);
        this.ghostAI.set("g" + i, ai);
      });
      if (!chaosMode) { this.theCase = makeCase(randomInt(1, 2_000_000_000)); this.noteSeed = randomInt(1, 2_000_000_000); }
      if (chaosMode) {
        this.state.evidence.forEach((e) => { e.active = false; }); // ghost-hunt items are off in Chaos Party
        this.chaos = new ChaosParty(this);
        this.chaos.start(Date.now());
      }
    });

    // Client-predicted movement, server-validated: reject teleports and speed hacks, clamp to the map.
    this.handle("move", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || this.state.ended) return; // walking is allowed in the lobby (before start) and during the match
      const x = Number(msg?.x), y = Number(msg?.y), z = Number(msg?.z), ry = Number(msg?.ry);
      if (![x, y, z, ry].every(Number.isFinite)) return;
      const now = Date.now();
      const dt = Math.min((now - (this.lastMove.get(client.sessionId) ?? now)) / 1000, 1);
      this.lastMove.set(client.sessionId, now);
      let nx = clampWorld(x), nz = clampWorld(z);
      if (Math.hypot(nx - p.x, nz - p.z) > RUN_SPEED * dt * 1.5 + 0.5) {
        client.send("correct", { x: p.x, z: p.z }); // snap the client back to the last valid spot
        return;
      }
      if (this.closure && p.role !== "ghost" && closureActive(this.closure, now)) { const c = closureStep(this.closure, { x: p.x, z: p.z }, { x: nx, z: nz }); if (Math.hypot(c.x - nx, c.z - nz) > 0.4) client.send("correct", { x: c.x, z: c.z }); /* a client that does not know about the closure (joined late) is pulled back */ nx = c.x; nz = c.z; } // closed area: same rule the client predicts with (shared/src/closure.ts)
      p.x = nx; p.z = nz; p.y = Math.max(0, Math.min(3, y)); p.ry = ry;
    }, 30, 20);

    this.handle("collect", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      const ev = this.state.evidence.get(String(msg?.id));
      if (!p || p.role === "ghost" || !ev || !ev.active || !this.active() || !this.ghostMode()) return;
      if (Math.hypot(p.x - ev.x, p.z - ev.z) > EVIDENCE_REACH_SERVER) return;
      ev.active = false;
      const gained = ev.special ? SCORE.specialMission : SCORE.evidence;
      p.score += gained;
      client.send("collected", { gained });
      if (!ev.special) this.stat(client.sessionId, "evidence");
      if (ev.special) this.nextSpecialAt = Date.now() + SPECIAL.everyMs;
      else this.clock.setTimeout(() => { ev.active = true; }, EVIDENCE_RESPAWN_MS * (WEATHER[this.state.weather as Weather]?.respawnMul ?? 1));
      this.teamwork(client.sessionId, p.team);
    });

    // Player ghost abilities: server checks role, cooldown and distance; points are capped per match.
    this.handle("ability", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      const name = String(msg?.name);
      const cfg: any = (GHOST_ABILITIES as any)[name];
      if (!p || p.role !== "ghost" || !cfg || !this.active() || !this.ghostMode()) return;
      const key = client.sessionId + ":" + name, now = Date.now();
      if ((this.abilityCd.get(key) ?? 0) > now) return client.send("ability:result", { name, ok: false, reason: "cooldown" });
      const humans = [...this.state.players.entries()].filter(([, x]) => x.role !== "ghost" && x.connected);
      const near = (x: Player, r: number) => Math.hypot(x.x - p.x, x.z - p.z) <= r;
      const tell = (id: string, type: string, m: object) => this.clients.find((c) => c.sessionId === id)?.send(type, m);
      let points = 0;
      if (name === "whisper") humans.filter(([, x]) => near(x, cfg.radius)).forEach(([id]) => tell(id, "event", { kind: "whisper" }));
      else if (name === "dim") humans.filter(([, x]) => near(x, cfg.radius)).forEach(([id]) => tell(id, "event", { kind: "blackout", ms: cfg.ms }));
      else {
        const t = humans.find(([id, x]) => x.team !== p.team && near(x, cfg.radius) && now - (this.lastScare.get(id) ?? 0) >= GHOST.scareCooldownMs && !(this.state.mode === "chaos_night" && inSafeZone(x.team, x.x, x.z)));
        if (!t) return client.send("ability:result", { name, ok: false, reason: "no_target" });
        this.lastScare.set(t[0], now);
        this.markScared(t[0], t[1]);
        tell(t[0], "scare", {});
        const have = this.ghostPts.get(client.sessionId) ?? 0;
        points = booPoints(have);
        this.ghostPts.set(client.sessionId, have + points);
        p.score += points;
      }
      this.abilityCd.set(key, now + cfg.cooldownMs);
      client.send("ability:result", { name, ok: true, cooldownMs: cfg.cooldownMs, points });
    }, 10, 3);

    this.handle("pickup", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.role === "ghost" || p.carrying || !this.active()) return;
      const party = this.state.mode === "chaos_party";
      if (party && !this.chaos?.inRelay) return; // in Chaos Party crates exist only during the relay round
      const now = Date.now();
      if (now < (this.stunUntil.get(client.sessionId) ?? 0)) return; // just hit by a gadget
      let loose = "";
      if (party) this.state.crates.forEach((c, id) => { if (!loose && c.active && Math.hypot(p.x - c.x, p.z - c.z) <= GADGET.pickReachServer) loose = id; });
      if (loose) this.state.crates.delete(loose); // a knocked-off crate: anyone may grab it, the cooldown does not apply
      else {
        if (Math.hypot(p.x - CRATE.x, p.z - CRATE.z) > CRATE_REACH_SERVER) return;
        const d = this.deliveries.get(client.sessionId) ?? { count: 0, nextAt: 0 };
        if (now < d.nextAt) return client.send("error", { code: "delivery_wait", waitMs: d.nextAt - now }); // a new trip from the market waits for the cooldown
      }
      const rules = tripRules(party);
      p.carrying = true;
      this.trips.set(client.sessionId, now + rules.tripMs);
      client.send("picked", { tripMs: rules.tripMs, loose: !!loose });
    });

    this.handle("deliver", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !p.carrying || !this.active()) return;
      const z = dropZoneFor(p.team);
      if (Math.hypot(p.x - z.x, p.z - z.z) > DROP_REACH_SERVER) return;
      const party = this.state.mode === "chaos_party", rules = tripRules(party), now = Date.now();
      const d = this.deliveries.get(client.sessionId) ?? { count: 0, nextAt: 0 };
      if (party) { // relay round: every delivery scores for the team, unlimited, but each one starts a short cooldown
        if (!this.chaos?.inRelay) return;
        p.carrying = false; this.trips.delete(client.sessionId);
        this.deliveries.set(client.sessionId, { count: d.count, nextAt: now + rules.cooldownMs });
        p.score += CHAOS.relay.points;
        this.chaos.addRound(p.team, CHAOS.relay.points);
        return void client.send("delivered", { gained: CHAOS.relay.points, cooldownMs: rules.cooldownMs });
      }
      const n = d.count + 1, gained = deliveryPoints(n); // any number of deliveries; only the first few pay in full
      p.carrying = false; this.trips.delete(client.sessionId);
      this.deliveries.set(client.sessionId, { count: n, nextAt: now + rules.cooldownMs });
      p.delivered = n;
      p.score += gained;
      client.send("delivered", { gained, cooldownMs: rules.cooldownMs });
      this.stat(client.sessionId, "delivery");
      this.teamwork(client.sessionId, p.team);
    });

    this.handle("gadget:take", (client, msg) => this.chaos?.takeGadget(client, String(msg?.id)), 6, 3);
    this.handle("gadget:use", (client) => this.chaos?.useGadget(client), 4, 2);

    this.handle("help", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      const id = String(msg?.id), t = this.state.players.get(id);
      if (!p || !t || p.role === "ghost" || id === client.sessionId || !t.scared || t.team !== p.team || !this.active() || !this.ghostMode()) return;
      if (Math.hypot(p.x - t.x, p.z - t.z) > HELP.reachServer) return;
      const have = this.helpPts.get(client.sessionId) ?? 0;
      if (have >= HELP.pointCap) return client.send("error", { code: "help_cap" });
      t.scared = false; this.scaredUntil.delete(id);
      this.helpPts.set(client.sessionId, have + SCORE.helpTeammate);
      p.score += SCORE.helpTeammate;
      client.send("helped", { gained: SCORE.helpTeammate });
      this.stat(client.sessionId, "help");
    });

    // ---- Detective case (M3): clues are private to the finder's team, the culprit is revealed only to a team that names it ----
    this.handle("case:sync", (client) => { // (re)send this team's board, e.g. after a reconnect
      const p = this.state.players.get(client.sessionId);
      if (!p || !p.team || !this.theCase || !this.state.started || !this.ghostMode()) return;
      client.send("case:board", this.caseBoard(p.team));
    }, 3, 1);

    this.handle("case:collect", (client, msg) => {
      const p = this.state.players.get(client.sessionId), c = this.theCase;
      if (!p || !c || p.role === "ghost" || !p.team || !this.active() || !this.ghostMode()) return;
      const clue = c.clues.find((k) => k.id === String(msg?.id)), spot = clue ? clueSpot(clue.id) : null;
      if (!clue || !spot || Math.hypot(p.x - spot.x, p.z - spot.z) > CASE.reachServer) return;
      const t = this.caseTeam(p.team);
      if (!foundClue(t, c, clue.id)) return void client.send("case:board", this.caseBoard(p.team)); // a teammate already found it: just refresh
      p.score += CASE.cluePoints;
      this.stat(client.sessionId, "clue");
      this.toTeam(p.team, "case:clue", { id: clue.id, attr: clue.attr, text: clue.text, byId: client.sessionId, by: p.name, gained: CASE.cluePoints });
      this.teamwork(client.sessionId, p.team);
    }, 5, 2);

    this.handle("case:accuse", (client, msg) => {
      const p = this.state.players.get(client.sessionId), c = this.theCase;
      if (!p || !c || p.role === "ghost" || !p.team || !this.active() || !this.ghostMode()) return;
      const out = accuse(c, this.caseTeam(p.team), String(msg?.suspect), Date.now(), this.caseRank); // the referee is pure and unit-tested (shared/src/case.ts)
      if (out.kind === "need_clues") client.send("case:result", { ok: false, reason: "need_clues" });
      else if (out.kind === "cooldown") client.send("case:result", { ok: false, reason: "cooldown", waitMs: out.waitMs });
      else if (out.kind === "wrong") this.toTeam(p.team, "case:result", { ok: false, reason: "wrong", suspect: String(msg?.suspect), by: p.name, waitMs: out.waitMs }); // no points are lost
      else if (out.kind === "solved") {
        this.caseRank = out.rank;
        this.state.players.forEach((m, mid) => { if (m.team === p.team && m.connected && m.role !== "ghost") { m.score += out.gained; this.stat(mid, "solved"); } });
        this.toTeam(p.team, "case:result", { ok: true, culprit: c.culprit, gained: out.gained, rank: out.rank, by: p.name });
        this.broadcast("case:solved", { team: p.team, rank: out.rank }); // other teams learn that a team solved it, not who the culprit is
      }
    }, 3, 1);

    // ---- Cross-team clue swap (M3.10): two nearby players of different teams agree to swap one clue each; rules in shared/src/trade.ts ----
    this.handle("trade:offer", (client, msg) => {
      const p = this.state.players.get(client.sessionId), id = String(msg?.id), t = this.state.players.get(id), c = this.theCase, now = Date.now();
      if (!p || !t || !c || id === client.sessionId || p.role === "ghost" || t.role === "ghost" || !t.connected || !p.team || !t.team || !this.active() || !this.ghostMode()) return;
      if (!inTradeReach(Math.hypot(p.x - t.x, p.z - t.z), true)) return void client.send("trade:fail", { reason: "far" });
      const pre = this.tradeCheckNow(p.team, t.team, now);
      if (!pre.ok) return void client.send("trade:fail", this.tradeFail(pre.reason, p.team, t.team, now));
      const back = this.tradeOffers.get(id);
      if (tradeOfferLive(back, now) && back.to === client.sessionId) return void this.doTrade(id, client.sessionId, now, false); // they had offered me already: that is a yes
      this.tradeOffers.set(client.sessionId, { from: client.sessionId, to: id, until: now + TRADE.offerMs });
      client.send("trade:sent", { to: t.name });
      this.clients.find((x) => x.sessionId === id)?.send("trade:invite", { from: client.sessionId, name: p.name, ms: TRADE.offerMs });
    }, 4, 2);
    this.handle("trade:accept", (client, msg) => {
      const id = String(msg?.id), o = this.tradeOffers.get(id), now = Date.now();
      if (!tradeOfferLive(o, now) || o.to !== client.sessionId) return void client.send("trade:fail", { reason: "expired" });
      this.doTrade(id, client.sessionId, now, true);
    }, 4, 2);
    this.handle("trade:decline", (client, msg) => {
      const id = String(msg?.id), o = this.tradeOffers.get(id);
      if (!o || o.to !== client.sessionId) return;
      this.tradeOffers.delete(id);
      this.clients.find((x) => x.sessionId === id)?.send("trade:fail", { reason: "declined" });
    }, 4, 2);

    // ---- Lost item (L3): first living player to reach the item takes it; rules in shared/src/lostitem.ts ----
    this.handle("lost:take", (client) => {
      const p = this.state.players.get(client.sessionId), it = this.lost, now = Date.now();
      if (!p || !it || !this.active() || !this.ghostMode() || !canTakeLost(it, now, p, true)) return;
      this.lost = null; // set first: two players pressing in the same instant, only the first message wins
      const members: { id: string; team: string; connected: boolean; role: string }[] = [];
      this.state.players.forEach((q, id) => { members.push({ id, team: q.team, connected: q.connected, role: q.role }); });
      lostRewards(client.sessionId, members).forEach((pts, id) => { const q = this.state.players.get(id); if (q) q.score += pts; });
      const info = LOST_ITEMS[it.item];
      this.broadcast("lost:end", { result: "found", id: it.id, by: p.name, team: p.team, name: info.name, icon: info.icon, reward: LOST.reward, teamReward: LOST.teamReward });
    }, 4, 2);

    // ---- Interactive world (M3): search village objects for a story note; once per player per object, no points ----
    this.handle("search", (client, msg) => {
      const p = this.state.players.get(client.sessionId), o = searchSpot(String(msg?.id));
      if (!p || !o || p.role === "ghost" || !this.active() || !this.ghostMode()) return;
      if (Math.hypot(p.x - o.x, p.z - o.z) > SEARCH_REACH_SERVER) return;
      const done = this.searched.get(client.sessionId) ?? new Set<string>();
      this.searched.set(client.sessionId, done);
      const first = !done.has(o.id);
      done.add(o.id);
      client.send("note", { id: o.id, name: o.name, text: noteFor(this.noteSeed, SEARCH_SPOTS.findIndex((x) => x.id === o.id)) });
      if (first) this.stat(client.sessionId, "search");
    }, 4, 2);

    // ---- Village doors (M3.9): any living player at the steps opens/closes a house door for everyone. Cosmetic, no points. ----
    this.handle("door", (client, msg) => {
      const p = this.state.players.get(client.sessionId), d = doorById(String(msg?.id));
      if (!p || !d || p.role === "ghost" || !this.active() || !this.ghostMode()) return;
      if (this.lockedDoors.has(d.id)) return; // a locked door only opens by solving its question (lock:new)
      const now = Date.now();
      const next = doorToggle(this.doorUntil.get(d.id) ?? 0, this.doorUsed.get(d.id) ?? 0, now, Math.hypot(p.x - d.x, p.z - d.z));
      if (!next) return;
      this.doorUsed.set(d.id, now);
      if (next.open) this.doorUntil.set(d.id, next.openUntil); else this.doorUntil.delete(d.id);
      this.broadcast("door", { id: d.id, open: next.open });
    }, 4, 2);

    // ---- Crossroad (M6.2): choose the route with the better chance (independent events). No points either way; right = story note, wrong = funny scene ----
    this.handle("route:new", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.role === "ghost" || !this.active() || !this.ghostMode()) return;
      if (Math.hypot(p.x - ROUTE_SPOT.x, p.z - ROUTE_SPOT.z) > ROUTE_REACH_SERVER) return client.send("error", { code: "too_far" });
      const now = Date.now(), wait = ROUTE_COOLDOWN_MS - (now - (this.routeAt.get(client.sessionId) ?? 0));
      if (wait > 0 && !this.routeQ.has(client.sessionId)) return client.send("route:wait", { ms: wait });
      let q = this.routeQ.get(client.sessionId); // asking again while a question is open returns the same one
      if (!q) {
        q = makeRoute(Math.random);
        if (validateRoute(q).length) return client.send("error", { code: "bad_question" });
        this.routeQ.set(client.sessionId, q); this.routeAt.set(client.sessionId, now);
      }
      client.send("route:question", { text: q.text, choices: q.choices }); // never includes correctIndex or the solution
    }, 3, 1);

    this.handle("route:answer", (client, msg) => {
      const p = this.state.players.get(client.sessionId), q = this.routeQ.get(client.sessionId), index = Number(msg?.index);
      if (!p || !q || p.role === "ghost" || !this.active() || !this.ghostMode() || (index !== 0 && index !== 1)) return;
      this.routeQ.delete(client.sessionId);
      const correct = index === q.correctIndex;
      if (correct) this.stat(client.sessionId, "puzzle");
      client.send("route:result", { correct, correctIndex: q.correctIndex, solution: q.solution,
        text: correct ? noteFor(this.noteSeed, 20 + randomInt(0, 6)) : routeFlavorWrong(Math.random) });
    }, 4, 1);

    // ---- Team math race (M6.3): first correct answer per team sets its rank; rank pays a bonus to each living member. Wrong answers cost nothing. ----
    this.handle("race:answer", (client, msg) => {
      const p = this.state.players.get(client.sessionId), r = this.race, index = Number(msg?.index), now = Date.now();
      if (!p || !r || p.role === "ghost" || !p.connected || !this.active() || !this.ghostMode() || now >= r.endAt) return;
      if (!Number.isInteger(index) || index < 0 || index > 3 || !r.teams.includes(p.team) || !raceCanFinish(r.order, p.team)) return;
      if (now - (this.raceWrongAt.get(client.sessionId) ?? 0) < RACE.wrongCooldownMs) return;
      if (index !== r.q.correctIndex) { this.raceWrongAt.set(client.sessionId, now); return client.send("race:result", { correct: false }); }
      r.order.push(p.team);
      const rank = raceRankOf(r.order, p.team), gained = raceReward(rank);
      if (gained > 0) this.state.players.forEach((m) => { if (m.team === p.team && m.connected && m.role !== "ghost") m.score += gained; }); // scores only change in server handlers
      this.stat(client.sessionId, "puzzle");
      client.send("race:result", { correct: true, rank, gained });
      this.broadcast("race:team", { team: p.team, rank, by: p.name, gained });
    }, 4, 2);

    // ---- Team ping (M3.12): marker at the sender's own position, relayed to their team only; the client never sends coordinates ----
    this.handle("mark", (client) => {
      const p = this.state.players.get(client.sessionId), now = Date.now();
      if (!p || p.role === "ghost" || !p.connected || !this.active() || !markAllowed(this.markAt.get(client.sessionId) ?? 0, now)) return;
      this.markAt.set(client.sessionId, now);
      this.toTeam(p.team, "mark", { id: `m${++this.markSeq}`, x: p.x, z: p.z, by: p.name, ttl: PING.ttlMs });
    }, 3, 1);

    this.handle("lock:new", (client, msg) => { // ask for the question that unlocks a locked door (M6.2)
      const p = this.state.players.get(client.sessionId), d = doorById(String(msg?.id));
      if (!p || !d || p.role === "ghost" || !this.active() || !this.ghostMode() || !this.lockedDoors.has(d.id)) return;
      if (Math.hypot(p.x - d.x, p.z - d.z) > DOOR_REACH_SERVER) return;
      const topic = LOCK.topics[randomInt(0, LOCK.topics.length)];
      const q = generateQuestion(topic, LOCK.difficulty, randomInt(1, 2_000_000_000));
      if (validateQuestion(q).length) return client.send("error", { code: "bad_question" });
      this.lockQ.set(client.sessionId, { door: d.id, q });
      client.send("lock:question", { id: d.id, text: q.text, choices: q.choices }); // the answer never leaves the server until it is solved
    }, 3, 1);

    this.handle("lock:answer", (client, msg) => {
      const p = this.state.players.get(client.sessionId), lq = this.lockQ.get(client.sessionId), index = Number(msg?.index);
      if (!p || !lq || p.role === "ghost" || !this.active() || !this.ghostMode() || !Number.isInteger(index) || index < 0 || index > 3) return;
      const now = Date.now();
      if (!this.lockedDoors.has(lq.door)) { this.lockQ.delete(client.sessionId); return client.send("lock:result", { gone: true }); } // someone else was faster
      if (now - (this.lockWrongAt.get(client.sessionId) ?? 0) < LOCK.wrongCooldownMs) return;
      const d = doorById(lq.door); if (!d) return;
      if (index !== lq.q.correctIndex) { this.lockWrongAt.set(client.sessionId, now); return client.send("lock:result", { correct: false }); } // no penalty
      this.lockQ.delete(client.sessionId);
      this.lockedDoors.delete(d.id);
      this.doorUntil.set(d.id, now + DOOR_OPEN_MS); this.doorUsed.set(d.id, now);
      this.stat(client.sessionId, "puzzle");
      client.send("lock:result", { correct: true, correctIndex: lq.q.correctIndex, solution: lq.q.solution, note: lockNote(this.noteSeed, d.house) });
      this.broadcast("lock", { id: d.id, locked: false, by: p.name });
      this.broadcast("door", { id: d.id, open: true });
    }, 6, 2);

    this.handle("puzzle:new", (client, msg) => {
      const me = this.state.players.get(client.sessionId);
      if (!this.active() || !this.ghostMode() || !me || me.role === "ghost") return;
      if (Math.hypot(me.x - PUZZLE_ZONE.x, me.z - PUZZLE_ZONE.z) > PUZZLE_REACH) return client.send("error", { code: "too_far" });
      const topic = String(msg?.topic) as Topic;
      const difficulty = String(msg?.difficulty) as Difficulty;
      if (!TOPICS.includes(topic) || !DIFFS.includes(difficulty)) return;
      // Half the time use a human-approved question from the bank (if any), otherwise a template one.
      const banked = Math.random() < 0.5 ? bank.pickApproved(topic, difficulty) : null;
      const q = banked ?? generateQuestion(topic, difficulty, randomInt(1, 2_000_000_000));
      if (validateQuestion(q).length) return client.send("error", { code: "bad_question" });
      this.puzzles.set(client.sessionId, { q, attempts: 0, hints: 0, solved: false });
      client.send("puzzle:question", { text: q.text, choices: q.choices, topic, difficulty, hintCount: q.hints.length });
    });

    this.handle("puzzle:answer", (client, msg) => {
      const pz = this.puzzles.get(client.sessionId);
      const p = this.state.players.get(client.sessionId);
      const index = Number(msg?.index);
      if (!pz || !p || p.role === "ghost" || this.state.ended || !this.ghostMode() || pz.solved || !Number.isInteger(index) || index < 0 || index > 3) return;
      pz.attempts++;
      if (index === pz.q.correctIndex) {
        pz.solved = true;
        const gained = puzzleScore(pz.attempts, pz.hints);
        p.score += gained; // scores only change inside server handlers like this one
        this.teamwork(client.sessionId, p.team);
        this.stat(client.sessionId, "puzzle");
        client.send("puzzle:result", { correct: true, gained, correctIndex: pz.q.correctIndex, solution: pz.q.solution, firstTry: pz.attempts === 1 });
      } else {
        client.send("puzzle:result", { correct: false, gained: 0 });
      }
    });

    this.handle("puzzle:hint", (client) => {
      const pz = this.puzzles.get(client.sessionId);
      if (!pz || pz.solved) return;
      if (pz.hints < pz.q.hints.length) client.send("puzzle:hint", { text: pz.q.hints[pz.hints++] });
      else client.send("puzzle:hint", { text: "" });
    });
  }

  /** Starts a team math race if at least two teams have someone who can answer. The answer stays on the server until the race ends. */
  private startRace(now: number) {
    const teams = [...new Set([...this.state.players.values()].filter((m) => m.connected && m.role !== "ghost").map((m) => m.team))];
    if (teams.length < RACE.minTeams) return;
    const q = generateQuestion(RACE.topics[randomInt(0, RACE.topics.length)], RACE.difficulty, randomInt(1, 2_000_000_000));
    if (validateQuestion(q).length) return;
    this.race = { q, endAt: now + RACE.durationMs, order: [], teams };
    this.raceWrongAt.clear();
    this.broadcast("race:start", { text: q.text, choices: q.choices, ms: RACE.durationMs });
  }
  private endRace() {
    const r = this.race; if (!r) return;
    this.race = null;
    this.broadcast("race:end", { order: r.order, correctIndex: r.q.correctIndex, solution: r.q.solution });
  }

  /** Message handler wrapper with a per-client token bucket (burst 10, refill 5/sec). */
  private handle(name: string, fn: (client: Client, msg: any) => void, burst = 10, perSec = 5) {
    this.onMessage(name, (client, msg) => {
      const now = Date.now();
      const key = client.sessionId + ":" + name;
      const b = this.buckets.get(key) ?? { tokens: burst, ts: now };
      b.tokens = Math.min(burst, b.tokens + ((now - b.ts) / 1000) * perSec);
      b.ts = now;
      this.buckets.set(key, b);
      if (b.tokens < 1) return;
      b.tokens -= 1;
      try { fn(client, msg); } catch (e) { console.error("[tbcn] handler error", name, e); }
    });
  }

  /** AI ghost: wanders, startles nearby players (no damage), and triggers occasional harmless events. */
  private update(ms: number) {
    if (!this.active()) return;
    const now = Date.now();
    this.expireTrips(now);
    this.doorUntil.forEach((until, id) => { if (!doorIsOpen(until, now)) { this.doorUntil.delete(id); this.broadcast("door", { id, open: false }); } }); // doors close by themselves
    const left = Math.max(0, Math.ceil((this.endAt - now) / 1000));
    if (left !== this.state.secondsLeft) this.state.secondsLeft = left;
    if (!this.ghostMode()) { this.chaos?.update(now); if (left === 0 && !this.state.ended) this.finish(); return; }
    if (left === 0) return this.finish();
    if (this.theCase) { // the headman's news: where unfound clues are glimmering, plus village gossip (never spoils the case)
      if (!this.nextNews) this.nextNews = now + NEWS_FIRST_MS;
      else if (now >= this.nextNews) {
        this.nextNews = now + NEWS_EVERY_MS;
        const any = new Set<string>(); this.caseTeams.forEach((t) => t.found.forEach((id) => any.add(id)));
        this.broadcast("news", { text: villageNews(this.theCase, any, this.caseRank, Math.random) });
      }
    }
    if (this.theCase) { // locked doors (M6.2): one house door at a time asks for a calculation
      if (!this.nextLock) this.nextLock = now + LOCK.firstMs;
      else if (now >= this.nextLock) {
        this.nextLock = now + lockDelay(Math.random);
        const open = new Set<string>(); this.doorUntil.forEach((u, id) => { if (doorIsOpen(u, now)) open.add(id); });
        const id = pickLockDoor(Math.random, this.lockedDoors, open);
        if (id) { this.lockedDoors.add(id); this.broadcast("lock", { id, locked: true }); }
      }
    }
    if (!this.nextEerie) this.nextEerie = now + EERIE.firstMs; // mysterious sounds (M3.8): flavour only, no points
    else if (now >= this.nextEerie) {
      this.nextEerie = now + eerieDelay(Math.random);
      const e = pickEerie(Math.random, this.lastEerie); this.lastEerie = e.kind;
      this.broadcast("eerie", { kind: e.kind, site: e.site, sfx: e.sfx, text: e.text });
    }
    if (this.race) { if (raceOver(now, this.race.endAt, this.race.order, this.race.teams)) this.endRace(); } // team math race (M6.3)
    else if (!this.nextRace) this.nextRace = now + RACE.firstMs;
    else if (now >= this.nextRace) { this.nextRace = now + raceDelay(Math.random); this.startRace(now); }
    if (this.theCase) this.tickSecret(now);
    this.tickBoss(now);
    this.tickClosure(now);
    this.tickLost(now);
    const humansPos = [...this.state.players.values()].filter((p) => p.connected && p.role !== "ghost").map((p) => ({ x: p.x, z: p.z }));
    const mul = this.state.mode === "chaos_night" ? NIGHT.ghostSpeedMul : 1;
    this.state.ghosts.forEach((gv, gid) => {
      const ai = this.ghostAI.get(gid);
      if (!ai) return;
      const nxt = stepGhostAI(ai, ms, Math.random, humansPos, mul);
      this.ghostAI.set(gid, nxt);
      gv.x = nxt.x; gv.z = nxt.z;
      this.state.players.forEach((p, id) => {
        if (!p.connected || p.role === "ghost" || (this.state.mode === "chaos_night" && inSafeZone(p.team, p.x, p.z)) || !shouldScare(gv.x, gv.z, p.x, p.z, this.lastScare.get(id) ?? 0, now, WEATHER[this.state.weather as Weather]?.scareMul ?? 1)) return;
        this.lastScare.set(id, now); // one shared cooldown per player, whichever ghost startled them
        this.markScared(id, p);
        this.clients.find((c) => c.sessionId === id)?.send("scare", { by: nxt.kind });
        if (nxt.kind === "guardian") return; // the guardian keeps to its patch
        for (let i = 0; i < 10; i++) { // drift away so it does not keep scaring the same spot
          const nx = (Math.random() * 2 - 1) * GHOST.xHalf, nz = GHOST.zMin + Math.random() * (GHOST.zMax - GHOST.zMin);
          if (Math.hypot(nx - p.x, nz - p.z) > 15) { gv.x = nx; gv.z = nz; this.ghostAI.set(gid, { ...nxt, x: nx, z: nz, tx: nx, tz: nz }); break; }
        }
      });
    });
    if (this.state.mode === "chaos_night") this.state.players.forEach((pl, id) => { // safe ring: startled players recover at once
      if (pl.scared && inSafeZone(pl.team, pl.x, pl.z)) { pl.scared = false; this.scaredUntil.delete(id); }
    });
    this.scaredUntil.forEach((until, id) => { // scared lasts a few seconds unless a teammate calms the player first
      if (now >= until) { const pl = this.state.players.get(id); if (pl) pl.scared = false; this.scaredUntil.delete(id); }
    });
    const spEv = this.state.evidence.get("sp");
    if (spEv) {
      if (!spEv.active && now >= this.nextSpecialAt) {
        const spot = SPECIAL_SPOTS[Math.floor(Math.random() * SPECIAL_SPOTS.length)];
        spEv.x = spot.x; spEv.z = spot.z; spEv.active = true;
        this.specialUntil = now + SPECIAL.lifetimeMs;
        this.broadcast("event", { kind: "special", seconds: SPECIAL.lifetimeMs / 1000 });
      } else if (spEv.active && now >= this.specialUntil) {
        spEv.active = false;
        this.nextSpecialAt = now + SPECIAL.everyMs;
      }
    }
    this.weatherTick(now);
    if (this.state.mode === "chaos_night") this.nightTick(now);
    if (now >= this.nextEventAt) {
      this.nextEventAt = now + GHOST.eventMinMs + Math.random() * (GHOST.eventMaxMs - GHOST.eventMinMs);
      if (this.state.mode !== "chaos_night" && Math.random() < 0.5) this.broadcast("event", { kind: "blackout", ms: GHOST.blackoutMs });
      else this.broadcast("event", { kind: "whisper" });
    }
  }

  /** Chaos Night: warn, lights out, then reward the teams whose members made it back to the safe ring. Nobody loses points. */
  private nightTick(now: number) {
    const n = this.night;
    if (n.until === 0) n.until = now + NIGHT.firstMs;
    if (n.phase === "idle" && now >= n.until) {
      n.phase = "warn"; n.until = now + NIGHT.warnMs;
      this.broadcast("event", { kind: "nightfall", seconds: NIGHT.warnMs / 1000 });
    } else if (n.phase === "warn" && now >= n.until) {
      n.phase = "dark"; n.until = now + NIGHT.darkMs;
      this.broadcast("event", { kind: "blackout", ms: NIGHT.darkMs });
    } else if (n.phase === "dark" && now >= n.until) {
      this.evaluateShelter();
      n.phase = "idle"; n.until = now + NIGHT.everyMin + Math.random() * (NIGHT.everyMax - NIGHT.everyMin);
    }
  }

  private evaluateShelter() {
    for (const t of TEAMS) {
      const members: { id: string; inside: boolean }[] = [];
      this.state.players.forEach((p, id) => {
        if (p.team === t.id && p.connected && p.role !== "ghost") members.push({ id, inside: inSafeZone(p.team, p.x, p.z) });
      });
      for (const id of shelterAwards(members)) {
        const p = this.state.players.get(id), have = this.shelterPts.get(id) ?? 0, gained = shelterPointsFor(have);
        if (!p || gained <= 0) continue;
        this.shelterPts.set(id, have + gained);
        p.score += gained;
        this.clients.find((c) => c.sessionId === id)?.send("sheltered", { gained });
        this.stat(id, "shelter");
      }
    }
  }

  /** Weather: scheduled by the server, identical for everyone. Effects are described in shared/weather.ts and never take points away. */
  private weatherTick(now: number) {
    if (!this.ghostMode()) { if (this.state.weather !== "clear") this.state.weather = "clear"; return; } // Chaos Party stays clear
    const w = this.state.weather as Weather;
    if (this.weatherUntil === 0) this.weatherUntil = now + WEATHER_PLAN.firstMs;
    if (now >= this.weatherUntil) {
      const nxt = nextWeather(this.state.mode, w, Math.random, this.lastSpell, dailyWeights(this.state.mode, dailyTheme(dayKey(Date.now())))); // daily theme only tilts the odds (I4)
      if (nxt !== "clear") this.lastSpell = nxt;
      this.state.weather = nxt;
      this.weatherUntil = now + weatherDurationMs(nxt, Math.random);
      this.nextLightning = now + 5_000; this.windMoveAt = now + WIND.moveEveryMs;
      this.broadcast("weather", { kind: nxt });
      return;
    }
    if (w === "storm" && now >= this.nextLightning) {
      const strike = lightningStrike(Math.random);
      this.nextLightning = now + LIGHTNING.everyMinMs + Math.random() * (LIGHTNING.everyMaxMs - LIGHTNING.everyMinMs);
      this.broadcast("lightning", strike);
      this.state.players.forEach((p, id) => { // players close to the strike are startled (no point loss); the safe ring protects at night
        if (!p.connected || p.role === "ghost" || Math.hypot(p.x - strike.x, p.z - strike.z) > LIGHTNING.radius) return;
        if (this.state.mode === "chaos_night" && inSafeZone(p.team, p.x, p.z)) return;
        this.lastScare.set(id, now); this.markScared(id, p);
        this.clients.find((c) => c.sessionId === id)?.send("scare", { by: "lightning" });
      });
      if (Math.random() < LIGHTNING.powerCutChance) this.broadcast("event", { kind: "blackout", ms: LIGHTNING.powerCutMs });
    }
    if (w === "wind" && now >= this.windMoveAt) { // the wind carries the golden lantern somewhere else
      this.windMoveAt = now + WIND.moveEveryMs;
      const sp = this.state.evidence.get("sp");
      if (sp?.active) {
        const others = SPECIAL_SPOTS.filter((s) => Math.hypot(s.x - sp.x, s.z - sp.z) > 1);
        const spot = others[Math.floor(Math.random() * others.length)];
        sp.x = spot.x; sp.z = spot.z;
        this.broadcast("event", { kind: "windmove" });
      }
    }
  }

  /** Counts an event for a player and tells them about any badge reached (badges give no points). */
  private stat(id: string, key: StatKey) {
    const r = bump(this.stats.get(id) ?? {}, key);
    this.stats.set(id, r.stats);
    if (r.unlocked.length) this.clients.find((c) => c.sessionId === id)?.send("achv", { list: r.unlocked.map((a) => ({ id: a.id, icon: a.icon, name: a.name })) });
  }

  /** Secret missions (Ghost Hunt / Chaos Night): a team is told privately to gather at a landmark within a time limit. Small reward, no penalty. */
  private tickSecret(now: number) {
    if (!this.nextSecretAt) { this.nextSecretAt = now + SECRET.firstMs; return; }
    const membersOf = (team: string) => { const a: SecretMember[] = []; this.state.players.forEach((p, id) => { if (p.team === team) a.push({ id, x: p.x, z: p.z, connected: p.connected, role: p.role }); }); return a; };
    if (!this.secret) {
      if (now < this.nextSecretAt) return;
      this.nextSecretAt = now + SECRET.everyMs;
      const teams = TEAMS.map((t) => t.id).filter((t) => membersOf(t).filter((m) => m.connected && m.role !== "ghost").length >= 2);
      const m = pickSecretMission(Math.random, teams, this.lastSecretTeam, now);
      if (!m) return;
      this.secret = m; this.lastSecretTeam = m.team;
      const eligible = membersOf(m.team).filter((x) => x.connected && x.role !== "ghost").length;
      this.toTeam(m.team, "secret:mission", { site: secretSite(m.site).name, ms: SECRET.durationMs, need: secretNeed(eligible), points: SECRET.points });
      return;
    }
    const m = this.secret, prog = secretProgress(m, membersOf(m.team)), st = secretState(m, now, prog);
    if (st === "running") return;
    this.secret = null;
    if (st === "done") {
      prog.insideIds.forEach((id) => { const p = this.state.players.get(id); if (p) p.score += SECRET.points; });
      this.toTeam(m.team, "secret:done", { points: SECRET.points });
    } else this.toTeam(m.team, "secret:fail", {}); // no penalty
  }

  /** Can these two teams swap a clue right now? Wraps the pure rule in shared/src/trade.ts with this room's counters. */
  private tradeCheckNow(teamA: string, teamB: string, now: number) {
    return checkTrade(this.theCase!, teamA, teamB, this.caseTeam(teamA), this.caseTeam(teamB), { a: this.tradeUsed.get(teamA) ?? 0, b: this.tradeUsed.get(teamB) ?? 0 }, this.tradeCd.get(tradePairKey(teamA, teamB)) ?? 0, now);
  }

  /** Payload of a refusal; a cooldown also says how many seconds are left so the player knows when to try again. */
  private tradeFail(reason: string, teamA: string, teamB: string, now: number) {
    return reason === "cooldown" ? { reason, waitS: Math.max(1, Math.ceil(((this.tradeCd.get(tradePairKey(teamA, teamB)) ?? 0) - now) / 1000)) } : { reason };
  }

  /** Applies an agreed swap: re-checks everything (the world may have changed since the offer), gives each team one clue, pays the two players. */
  private doTrade(aId: string, bId: string, now: number, accepting: boolean) {
    this.tradeOffers.delete(aId); this.tradeOffers.delete(bId);
    const a = this.state.players.get(aId), b = this.state.players.get(bId), c = this.theCase;
    const ca = this.clients.find((x) => x.sessionId === aId), cb = this.clients.find((x) => x.sessionId === bId);
    if (!a || !b || !c || a.role === "ghost" || b.role === "ghost" || !a.connected || !b.connected || !this.active()) return;
    const dist = Math.hypot(a.x - b.x, a.z - b.z);
    if (!(accepting ? inAcceptReach(dist) : inTradeReach(dist, true))) { ca?.send("trade:fail", { reason: "far" }); cb?.send("trade:fail", { reason: "far" }); return; }
    const r = this.tradeCheckNow(a.team, b.team, now);
    if (!r.ok) { ca?.send("trade:fail", this.tradeFail(r.reason, a.team, b.team, now)); cb?.send("trade:fail", this.tradeFail(r.reason, b.team, a.team, now)); return; }
    const ta = this.caseTeam(a.team), tb = this.caseTeam(b.team);
    foundClue(ta, c, r.forA); foundClue(tb, c, r.forB);
    this.tradeCd.set(tradePairKey(a.team, b.team), now + TRADE.cooldownMs);
    this.tradeUsed.set(a.team, (this.tradeUsed.get(a.team) ?? 0) + 1); this.tradeUsed.set(b.team, (this.tradeUsed.get(b.team) ?? 0) + 1);
    a.score += TRADE.points; b.score += TRADE.points; // no one ever loses points; only the two who agreed are paid
    const teamName = (t: string) => TEAMS.find((x) => x.id === t)?.name ?? "";
    const give = (team: string, other: string, clueId: string, byId: string) => {
      const k = c.clues.find((x) => x.id === clueId)!;
      this.toTeam(team, "trade:done", { id: k.id, attr: k.attr, text: k.text, withTeam: teamName(other), byId, gained: TRADE.points });
    };
    give(a.team, b.team, r.forA, aId); give(b.team, a.team, r.forB, bId);
  }

  /** Temporary closed area (M3.8): a landmark is closed for a short time. Only walking is limited (see the move handler); no points are touched. */
  private tickClosure(now: number) {
    if (!this.nextClosureAt) { this.nextClosureAt = now + CLOSURE.firstMs; return; }
    if (this.closure) {
      if (closureActive(this.closure, now)) return;
      this.closure = null; this.broadcast("closure:end", {});
      return;
    }
    if (now < this.nextClosureAt) return;
    this.nextClosureAt = now + CLOSURE.everyMs;
    const c = pickClosure(Math.random, this.lastClosureSite, this.boss ? this.boss.site : null, now);
    this.closure = c; this.lastClosureSite = c.site;
    const site = closureSite(c.site);
    this.broadcast("closure:start", { id: c.site, site: site.name, x: site.x, z: site.z, r: CLOSURE.radius, ms: CLOSURE.durationMs });
  }

  /** Lost item event (L3): announce an item near a landmark, expire it after a minute. Reward only, no penalty. */
  private tickLost(now: number) {
    if (!this.nextLostAt) { this.nextLostAt = now + LOST.firstMs; return; }
    const cur = this.lost;
    if (cur) {
      if (cur.until > now) return;
      const it = cur; this.lost = null;
      this.broadcast("lost:end", { result: "gone", id: it.id, name: LOST_ITEMS[it.item].name, icon: LOST_ITEMS[it.item].icon }); // nobody found it: it "turns up" by itself
      return;
    }
    if (now < this.nextLostAt) return;
    this.nextLostAt = now + LOST.everyMs;
    let humans = 0; this.state.players.forEach((q) => { if (q.connected && q.role !== "ghost") humans++; });
    if (humans < LOST.minHumans) return;
    const it = startLost(Math.random, now, this.lastLostSite, [this.boss ? this.boss.site : null, this.closure ? this.closure.site : null], ++this.lostSeq);
    if (!it) return;
    this.lost = it; this.lastLostSite = it.site;
    const info = LOST_ITEMS[it.item];
    this.broadcast("lost:start", { id: it.id, name: info.name, icon: info.icon, site: lostSiteName(it), x: it.x, z: it.z, ms: LOST.durationMs, reward: LOST.reward });
  }

  /** Boss event "ผีเจ้าที่โกรธ" (I3): the whole room must stand near the spirit together to calm it. Reward only, a failed event costs nothing. */
  private tickBoss(now: number) {
    const members = (): BossMember[] => { const a: BossMember[] = []; this.state.players.forEach((p, id) => { a.push({ id, x: p.x, z: p.z, connected: p.connected, role: p.role }); }); return a; };
    if (!this.nextBossAt) { this.nextBossAt = now + BOSS.firstMs; return; }
    if (!this.boss) {
      if (now < this.nextBossAt) return;
      this.nextBossAt = now + BOSS.everyMs;
      const b = startBoss(Math.random, members(), this.lastBossSite, now);
      if (!b) return;
      if (closureActive(this.closure, now) && this.closure.site === b.site) { this.nextBossAt = now + 5_000; return; } // never on top of a closed area: try again shortly
      this.boss = b; this.lastBossSite = b.site; this.bossSentAt = now;
      const site = bossSite(b.site), pr = bossProgress(b, members());
      this.broadcast("boss:start", { site: site.name, x: site.x, z: site.z, ms: BOSS.durationMs, goalMs: BOSS.calmGoalMs, need: pr.need, radius: BOSS.radius });
      return;
    }
    const pr = bossProgress(this.boss, members());
    this.boss = bossStep(this.boss, now, pr.holding);
    const st = bossState(this.boss, now);
    if (st === "running") {
      if (now - this.bossSentAt >= 1000) { this.bossSentAt = now; this.broadcast("boss:progress", { calmMs: this.boss.calmMs, inside: pr.insideIds.length, need: pr.need }); }
      return;
    }
    this.boss = null;
    if (st === "calmed") {
      bossRewards(pr).forEach((pts, id) => { const p = this.state.players.get(id); if (p) p.score += pts; });
      this.broadcast("boss:end", { result: "calmed", all: BOSS.rewardAll, near: BOSS.rewardNear });
    } else this.broadcast("boss:end", { result: "expired" }); // no penalty
  }

  /** A crate carried for too long is lost; the player must wait out a short cooldown before the next trip from the market. */
  private expireTrips(now: number) {
    this.trips.forEach((until, id) => {
      const p = this.state.players.get(id);
      if (!p || !p.carrying) return void this.trips.delete(id);
      if (now < until) return;
      const d = this.deliveries.get(id) ?? { count: 0, nextAt: 0 };
      this.deliveries.set(id, { count: d.count, nextAt: now + tripRules(this.state.mode === "chaos_party").expiredCooldownMs });
      p.carrying = false; this.trips.delete(id);
      this.clients.find((c) => c.sessionId === id)?.send("trip:expired", {});
    });
  }
  /** Used by the Chaos Party controller. */
  dropCarry(id: string) { const p = this.state.players.get(id); if (p) p.carrying = false; this.trips.delete(id); }
  stun(id: string, ms: number) { this.stunUntil.set(id, Date.now() + ms); }
  resetCarry() { this.state.players.forEach((p) => { p.carrying = false; }); this.trips.clear(); this.stunUntil.clear(); }

  private caseTeam(team: string) {
    let t = this.caseTeams.get(team);
    if (!t) { t = newTeamCase(); this.caseTeams.set(team, t); }
    return t;
  }

  /** What a team may know about the case: its own found clues, and the culprit only once the team has named it. */
  private caseBoard(team: string) {
    const t = this.caseTeam(team), c = this.theCase!;
    return { clues: c.clues.filter((k) => t.found.has(k.id)).map((k) => ({ id: k.id, attr: k.attr, text: k.text })), solved: t.solved, culprit: t.solved ? c.culprit : "" };
  }

  private toTeam(team: string, type: string, msg: object) {
    this.state.players.forEach((m, id) => { if (m.team === team && m.connected) this.clients.find((c) => c.sessionId === id)?.send(type, msg); });
  }

  private markScared(id: string, p: Player) {
    p.scared = true;
    this.scaredUntil.set(id, Date.now() + HELP.scaredMs);
  }

  /** Teamwork bonus: three different teammates scoring within a minute are each rewarded once. */
  private teamwork(id: string, team: string) {
    const r = recordTeamwork(this.twEvents.get(team) ?? [], id, Date.now());
    this.twEvents.set(team, r.events);
    for (const pid of r.awarded) {
      const pl = this.state.players.get(pid);
      if (!pl) continue;
      pl.score += SCORE.teamworkBonus;
      this.clients.find((c) => c.sessionId === pid)?.send("teamwork", { gained: SCORE.teamworkBonus });
    }
  }

  finish() {
    this.state.ended = true;
    const ps = [...this.state.players.values()];
    const teams = TEAMS.map((t) => {
      const m = ps.filter((p) => p.team === t.id);
      return { id: t.id, name: t.name, score: m.reduce((a, p) => a + p.score, 0), members: m.length };
    }).sort((a, b) => b.score - a.score);
    const top = ps.map((p) => ({ name: p.name, team: p.team, score: p.score })).sort((a, b) => b.score - a.score).slice(0, 10);
    history.add({ at: Date.now(), teams, top });
    // Baht for playing: only in rooms with 2+ players (set ALLOW_SOLO_EARN=1 to test alone). Amount comes from the server-side score.
    if (this.state.players.size >= 2 || process.env.ALLOW_SOLO_EARN === "1") {
      this.state.players.forEach((p, id) => {
        const key = this.keys.get(id);
        if (!key) return;
        const baht = earnBaht(p.score);
        wallets.earn(key, baht);
        this.clients.find((c) => c.sessionId === id)?.send("earned", { baht });
      });
    }
    this.broadcast("ended", {});
  }

  private counts(): Record<string, number> {
    const c: Record<string, number> = {};
    TEAM_IDS.forEach((t) => (c[t] = 0));
    this.state.players.forEach((p) => { if (p.team) c[p.team]++; });
    return c;
  }

  onJoin(client: Client, options: any) {
    if (this.state.started) throw new Error("game already started");
    const p = new Player();
    p.name = String(options?.name ?? "").trim().slice(0, 16) || "ผู้เล่น";
    const look = cleanLook(options); // chosen on the character page before joining (extra fields such as name are ignored)
    if (look) Object.assign(p, look);
    if (isValidPlayerKey(options?.key)) {
      this.keys.set(client.sessionId, options.key);
      const w = wallets.peek(options.key);
      p.acc = canEquip(w, w.equipped) ? w.equipped : "";
    }
    const sp = lobbySpawn(this.lobbySlot++); // everyone starts in the lobby plaza and can walk around while waiting
    p.x = sp.x; p.z = sp.z;
    this.lastMove.set(client.sessionId, Date.now());
    this.state.players.set(client.sessionId, p);
    if (!this.state.hostId) this.state.hostId = client.sessionId;
  }

  async onLeave(client: Client, consented: boolean) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    if (this.state.started && !consented) {
      p.connected = false;
      try {
        await this.allowReconnection(client, 30);
        p.connected = true;
        return;
      } catch { /* timed out */ }
    }
    this.state.players.delete(client.sessionId);
    this.puzzles.delete(client.sessionId);
    this.lastMove.delete(client.sessionId);
    this.lastScare.delete(client.sessionId);
    this.ghostPts.delete(client.sessionId);
    this.deliveries.delete(client.sessionId);
    this.trips.delete(client.sessionId);
    this.stunUntil.delete(client.sessionId);
    this.shelterPts.delete(client.sessionId);
    this.stats.delete(client.sessionId);
    this.searched.delete(client.sessionId);
    this.lockQ.delete(client.sessionId);
    this.lockWrongAt.delete(client.sessionId);
    this.routeQ.delete(client.sessionId);
    this.routeAt.delete(client.sessionId);
    this.raceWrongAt.delete(client.sessionId);
    this.markAt.delete(client.sessionId);
    this.keys.delete(client.sessionId);
    this.helpPts.delete(client.sessionId);
    this.scaredUntil.delete(client.sessionId);
    for (const k of [...this.abilityCd.keys()]) if (k.startsWith(client.sessionId + ":")) this.abilityCd.delete(k);
    for (const k of [...this.buckets.keys()]) if (k.startsWith(client.sessionId + ":")) this.buckets.delete(k);
    if (this.state.hostId === client.sessionId) {
      const next = this.state.players.keys().next();
      this.state.hostId = next.done ? "" : next.value;
    }
  }
}
