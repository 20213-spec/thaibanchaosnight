import { randomInt } from "node:crypto";
import type { Client } from "colyseus";
import type { GameRoom } from "./GameRoom.ts";
import { Evidence } from "./state.ts";
import { bank } from "./bank.ts";
import { COOK, COOK_STATION, pickRecipe, cookScore, cookStep, cookLimitMs, isIngredient, type Recipe } from "../../shared/src/index.ts";
import {
  CHAOS, FISHING, POND, GADGET, pickRivalTarget, landingSpot, chooseGadgetSpot, type Rival, pickFish, PHASE_TITLES, chaosPlan, roundWinner, TOPICS, TEAMS, generateQuestion, validateQuestion, resolveCollisions, PLAYER_RADIUS,
  type Question, type PartyPhase,
} from "../../shared/src/index.ts";

interface QuizState { q: Question; index: number; answered: Set<string>; firstDone: boolean; asking: boolean; until: number }

/**
 * Chaos Party controller: runs the round plan (intro, collect, quiz, relay) on top of the shared room state.
 * Server-authoritative: orbs are picked up by server-known positions, quiz answers are checked here, scores change only here.
 */
export class ChaosParty {
  private plan = chaosPlan();
  private idx = -1;
  private phaseEnd = 0;
  private roundScores: Record<string, number> = {};
  private quiz: QuizState | null = null;
  private gadgetSeq = 0; private crateSeq = 0; private gadgetNextAt = 0;
  private crateUntil = new Map<string, number>();
  private fishers = new Map<string, { state: "idle" | "waiting" | "bite"; biteAt: number; biteEnd: number; cdUntil: number }>();

  constructor(private room: GameRoom) {}
  private get kind(): PartyPhase | undefined { return this.plan[this.idx]?.kind; }

  start(now: number) { this.next(now); }

  /** Called by the room for relay deliveries. */
  addRound(team: string, pts: number) { this.roundScores[team] = (this.roundScores[team] ?? 0) + pts; }
  get inRelay() { return this.kind === "relay"; }
  private get gadgetRound(): "relay" | "fishing" | null { const k = this.kind; return k === "relay" || k === "fishing" ? k : null; }

  private next(now: number) {
    this.exit();
    this.idx++;
    if (this.idx >= this.plan.length) { this.room.finish(); return; }
    const ph = this.plan[this.idx], st = this.room.state;
    st.phase = ph.kind; st.roundTitle = PHASE_TITLES[ph.kind];
    this.phaseEnd = now + ph.seconds * 1000;
    if (ph.kind === "collect" || ph.kind === "quiz" || ph.kind === "relay" || ph.kind === "fishing" || ph.kind === "cooking") { st.round++; this.roundScores = {}; }
    if (ph.kind === "fishing") this.fishers.clear();
    if (ph.kind === "cooking") this.cooks.clear();
    if (ph.kind === "collect") this.spawnOrbs();
    if (ph.kind === "quiz") this.ask(now, 0);
    if (ph.kind === "relay") this.room.resetCarry();
    if (ph.kind === "relay" || ph.kind === "fishing") { for (let i = 0; i < GADGET.max; i++) this.spawnGadget(); this.gadgetNextAt = now + GADGET.respawnMs; }
  }

  private exit() {
    const k = this.kind, st = this.room.state;
    if (!k) return;
    if (k === "collect") st.orbs.clear();
    if (k === "relay" || k === "fishing") this.clearGadgets();
    if (k === "relay") this.room.resetCarry();
    if (k === "quiz") this.quiz = null;
    if (k === "fishing") { this.fishers.clear(); st.players.forEach((p) => { p.fishing = false; }); }
    if (k === "cooking") this.cooks.clear();
    if (k === "collect" || k === "quiz" || k === "relay" || k === "fishing" || k === "cooking") {
      const winner = roundWinner(this.roundScores);
      if (winner) st.players.forEach((p) => { if (p.team === winner) p.score += CHAOS.roundWinnerBonus; });
      this.room.broadcast("round:result", {
        round: st.round, title: PHASE_TITLES[k], winner,
        teams: TEAMS.map((t) => ({ id: t.id, name: t.name, points: this.roundScores[t.id] ?? 0 })),
        bonus: CHAOS.roundWinnerBonus,
      });
    }
  }

  update(now: number) {
    const st = this.room.state;
    if (st.ended) return;
    st.phaseLeft = Math.max(0, Math.ceil((this.phaseEnd - now) / 1000));
    if (this.kind === "collect") this.pickOrbs();
    if (this.kind === "quiz" && this.quiz) this.tickQuiz(now);
    if (this.kind === "fishing") this.tickFishing(now);
    if (this.gadgetRound) this.tickGadgets(now);
    if (now >= this.phaseEnd) this.next(now);
  }

  // ---- collect round ----
  private spawnOrbs() {
    const orbs = this.room.state.orbs;
    orbs.clear();
    for (let i = 0; i < CHAOS.collect.orbs; i++) {
      let x = 0, z = 0;
      for (let tries = 0; tries < 30; tries++) { // pick a spot that is not inside a building or tree
        x = randomInt(-34, 35); z = randomInt(-30, 25);
        const r = resolveCollisions(x, z, PLAYER_RADIUS + 0.4);
        if (Math.hypot(r.x - x, r.z - z) < 1e-9) break;
      }
      const o = new Evidence(); o.x = x; o.z = z; o.active = true;
      orbs.set("o" + i, o);
    }
  }

  private pickOrbs() {
    const { players, orbs } = this.room.state, R = CHAOS.collect.pickupRadius;
    players.forEach((p, id) => {
      if (!p.connected) return;
      orbs.forEach((o) => {
        if (!o.active || Math.hypot(p.x - o.x, p.z - o.z) > R) return;
        o.active = false;
        p.score += CHAOS.collect.points;
        this.addRound(p.team, CHAOS.collect.points);
        this.room.clients.find((c) => c.sessionId === id)?.send("party:orb", { gained: CHAOS.collect.points });
      });
    });
  }

  // ---- quiz round ----
  private ask(now: number, index: number) {
    const topic = TOPICS[randomInt(TOPICS.length)];
    const banked = Math.random() < 0.5 ? bank.pickApproved(topic, CHAOS.quiz.difficulty) : null;
    let q = banked ?? generateQuestion(topic, CHAOS.quiz.difficulty, randomInt(1, 2_000_000_000));
    if (validateQuestion(q).length) q = generateQuestion(topic, CHAOS.quiz.difficulty, randomInt(1, 2_000_000_000));
    this.quiz = { q, index, answered: new Set(), firstDone: false, asking: true, until: now + CHAOS.quiz.answerS * 1000 };
    this.room.broadcast("quiz:q", { index, total: CHAOS.quiz.questions, text: q.text, choices: q.choices, seconds: CHAOS.quiz.answerS });
  }

  private tickQuiz(now: number) {
    const z = this.quiz!;
    const humans = [...this.room.state.players.entries()].filter(([, p]) => p.connected);
    if (z.asking && (now >= z.until || (humans.length > 0 && humans.every(([id]) => z.answered.has(id))))) {
      z.asking = false; z.until = now + CHAOS.quiz.revealS * 1000;
      this.room.broadcast("quiz:end", { index: z.index, correctIndex: z.q.correctIndex, solution: z.q.solution });
    } else if (!z.asking && now >= z.until && z.index + 1 < CHAOS.quiz.questions) {
      this.ask(now, z.index + 1);
    }
  }

  answer(client: Client, index: number) {
    const z = this.quiz, p = this.room.state.players.get(client.sessionId);
    if (!z || !p || !z.asking || this.kind !== "quiz" || z.answered.has(client.sessionId) || !Number.isInteger(index) || index < 0 || index > 3) return;
    z.answered.add(client.sessionId);
    if (index !== z.q.correctIndex) return void client.send("quiz:result", { correct: false, gained: 0 });
    const first = !z.firstDone; z.firstDone = true;
    const gained = CHAOS.quiz.correct + (first ? CHAOS.quiz.firstBonus : 0);
    p.score += gained;
    this.addRound(p.team, gained);
    client.send("quiz:result", { correct: true, gained, first });
  }

  // ---- gadgets (relay and fishing rounds): a thrown ball that knocks a crate out of a rival's hands or spoils a rival's fishing line ----
  /** In the fishing round at least 2 gadgets are kept lying close to the pond so fishers can reach one. */
  private spawnGadget(): boolean {
    const st = this.room.state, lying: { x: number; z: number }[] = [];
    st.gadgets.forEach((g) => lying.push({ x: g.x, z: g.z }));
    const pondNear = { x: POND.x, z: POND.z, r: 12 };
    const needNear = this.kind === "fishing" && lying.filter((g) => Math.hypot(g.x - pondNear.x, g.z - pondNear.z) <= pondNear.r).length < 2;
    const spot = chooseGadgetSpot(lying, Math.random, needNear ? pondNear : undefined);
    if (!spot) return false;
    const e = new Evidence(); e.x = spot.x; e.z = spot.z; e.active = true;
    st.gadgets.set("g" + ++this.gadgetSeq, e);
    return true;
  }

  private clearGadgets() {
    const st = this.room.state;
    st.gadgets.clear(); st.crates.clear(); this.crateUntil.clear();
    st.players.forEach((p) => { p.gadget = false; });
  }

  private tickGadgets(now: number) {
    const st = this.room.state;
    this.crateUntil.forEach((until, id) => { if (now >= until) { st.crates.delete(id); this.crateUntil.delete(id); } });
    if (st.gadgets.size < GADGET.max && now >= this.gadgetNextAt) { this.spawnGadget(); this.gadgetNextAt = now + GADGET.respawnMs; }
  }

  takeGadget(client: Client, id: string) {
    const p = this.room.state.players.get(client.sessionId), g = this.room.state.gadgets.get(id);
    if (!p || !g || !g.active || !p.connected || p.role === "ghost" || p.gadget || !this.gadgetRound) return;
    if (Math.hypot(p.x - g.x, p.z - g.z) > GADGET.pickReachServer) return;
    this.room.state.gadgets.delete(id);
    p.gadget = true;
    client.send("gadget:got", {});
  }

  /** Throws the held gadget at the nearest rival who can be hit: a crate carrier in the relay round, an active fisher in the fishing round. */
  useGadget(client: Client) {
    const round = this.gadgetRound, st = this.room.state, p = st.players.get(client.sessionId);
    if (!round || !p || !p.connected || p.role === "ghost" || !p.gadget) return;
    const others: Rival[] = [];
    st.players.forEach((q, id) => { if (id !== client.sessionId) others.push({ id, x: q.x, z: q.z, team: q.team, connected: q.connected, role: q.role, carrying: q.carrying, fishing: q.fishing }); });
    const t = pickRivalTarget({ x: p.x, z: p.z, team: p.team }, others, round);
    const victim = t ? st.players.get(t.id) : null;
    if (!t || !victim) return void client.send("gadget:result", { ok: false, reason: "no_target" }); // nothing is used up
    p.gadget = false;
    const now = Date.now(), vc = this.room.clients.find((c) => c.sessionId === t.id);
    if (round === "relay") {
      this.room.dropCarry(t.id);
      this.room.stun(t.id, GADGET.stunMs);
      const l = landingSpot(victim.x, victim.z, Math.random), e = new Evidence(), k = "k" + ++this.crateSeq;
      e.x = l.x; e.z = l.z; e.active = true;
      st.crates.set(k, e); this.crateUntil.set(k, now + GADGET.looseCrateMs);
    } else {
      const f = this.fishers.get(t.id);
      if (f) { f.state = "idle"; f.cdUntil = now + GADGET.fisherLockMs; }
      victim.fishing = false;
      vc?.send("fish:result", { caught: false, reason: "disrupted" });
    }
    p.score += GADGET.hitPoints;
    this.addRound(p.team, GADGET.hitPoints);
    vc?.send("gadget:hit", { by: p.name, what: round === "relay" ? "crate" : "line" });
    client.send("gadget:result", { ok: true, hit: victim.name, gained: GADGET.hitPoints, what: round === "relay" ? "crate" : "line" });
    this.room.broadcast("gadget:fx", { by: p.name, to: victim.name, what: round === "relay" ? "crate" : "line" });
  }

  // ---- fishing round ----
  /** "cast": throw the line (player must be at the pond). "reel": pull it in. Only a reel inside the bite window catches a fish. */
  fish(client: Client, action: "cast" | "reel") {
    const p = this.room.state.players.get(client.sessionId);
    if (!p || !p.connected || this.kind !== "fishing") return;
    if (Math.hypot(p.x - POND.x, p.z - POND.z) > FISHING.reach) return; // server-known position
    const now = Date.now();
    const f = this.fishers.get(client.sessionId) ?? { state: "idle" as const, biteAt: 0, biteEnd: 0, cdUntil: 0 };
    this.fishers.set(client.sessionId, f);
    if (action === "cast") {
      if (f.state !== "idle" || now < f.cdUntil) return;
      f.state = "waiting"; p.fishing = true;
      f.biteAt = now + FISHING.waitMin + Math.random() * (FISHING.waitMax - FISHING.waitMin);
      return void client.send("fish:state", { state: "waiting" });
    }
    if (f.state === "waiting") { // pulled too early: no penalty, the fish just gets away
      f.state = "idle"; f.cdUntil = now + FISHING.cooldownMs; p.fishing = false;
      return void client.send("fish:result", { caught: false, reason: "early" });
    }
    if (f.state !== "bite") return;
    f.state = "idle"; f.cdUntil = now + FISHING.cooldownMs; p.fishing = false;
    if (now > f.biteEnd + FISHING.graceMs) return void client.send("fish:result", { caught: false, reason: "late" });
    const fish = pickFish(Math.random());
    p.score += fish.points;
    this.addRound(p.team, fish.points);
    client.send("fish:result", { caught: true, fish: { id: fish.id, name: fish.name, icon: fish.icon }, gained: fish.points });
  }

  private tickFishing(now: number) {
    this.fishers.forEach((f, id) => {
      const c = this.room.clients.find((x) => x.sessionId === id);
      if (f.state === "waiting" && now >= f.biteAt) { f.state = "bite"; f.biteEnd = now + FISHING.biteMs; c?.send("fish:state", { state: "bite" }); }
      else if (f.state === "bite" && now > f.biteEnd + FISHING.graceMs) { f.state = "idle"; f.cdUntil = now + FISHING.cooldownMs; const pl = this.room.state.players.get(id); if (pl) pl.fishing = false; c?.send("fish:result", { caught: false, reason: "late" }); }
    });
  }

  // ---- cooking round ----
  private cooks = new Map<string, { recipe: Recipe; step: number; startedAt: number; lastTap: number; dishes: number }>();
  private orderOf(c: { recipe: Recipe; dishes: number }) {
    return { id: c.recipe.id, name: c.recipe.name, icon: c.recipe.icon, steps: c.recipe.steps, limitMs: cookLimitMs(c.recipe), dishes: c.dishes };
  }

  /** Cooking round. "start": take the first order at the stove. "stop": leave (the dish in progress is dropped, no penalty).
   *  "add": tap an ingredient. Checked here: round and distance, a minimum time between taps, and the exact order of the recipe. */
  cook(client: Client, action: string, ing?: string) {
    const p = this.room.state.players.get(client.sessionId);
    if (!p || !p.connected || this.kind !== "cooking") return;
    if (action === "stop") { const c0 = this.cooks.get(client.sessionId); if (c0) c0.step = 0; return; } // leaving drops only the dish in progress: the number of dishes done (and so the recipe length) is kept
    if (Math.hypot(p.x - COOK_STATION.x, p.z - COOK_STATION.z) > COOK.reach) return void client.send("cook:far", {});
    const now = Date.now();
    let c = this.cooks.get(client.sessionId);
    if (action === "start") {
      if (!c) { c = { recipe: pickRecipe(0, Math.random), step: 0, startedAt: now, lastTap: 0, dishes: 0 }; this.cooks.set(client.sessionId, c); }
      else { c.step = 0; c.startedAt = now; } // coming back to the stove: a fresh start of the same order, time spent away does not count
      return void client.send("cook:order", this.orderOf(c));
    }
    if (action !== "add" || !c || !isIngredient(ing)) return;
    if (now - c.lastTap < COOK.tapMinMs) return; // faster than a person can tap: ignored
    c.lastTap = now;
    const r = cookStep(c.recipe, c.step, ing);
    if (r === "wrong") { c.step = 0; return void client.send("cook:wrong", {}); } // restart this dish, nothing is lost
    c.step++;
    if (r === "ok") return void client.send("cook:progress", { step: c.step });
    const done = c.recipe, s = cookScore(done.steps.length, now - c.startedAt);
    p.score += s.total;
    this.addRound(p.team, s.total);
    c.dishes++; c.recipe = pickRecipe(c.dishes, Math.random, done.id); c.step = 0; c.startedAt = now;
    client.send("cook:done", { dish: done.name, icon: done.icon, gained: s.total, bonus: s.bonus, order: this.orderOf(c) });
  }
}
