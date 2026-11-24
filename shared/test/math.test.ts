import { test } from "node:test";
import assert from "node:assert/strict";
import { generateQuestion, TOPICS, validateQuestion, suggestTeam, puzzleScore } from "../src/index.ts";
import { binomPmf, poissonPmf, normalCdf } from "../src/math/calc.ts";

test("known reference values", () => {
  assert.ok(Math.abs(binomPmf(10, 3, 0.5) - 0.1171875) < 1e-9);
  assert.ok(Math.abs(poissonPmf(2, 3) - 0.18044704) < 1e-7);
  assert.ok(Math.abs(normalCdf(1.96) - 0.9750021) < 1e-5);
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-7);
});

test("2000 generated questions all pass the validator", () => {
  let n = 0;
  for (const topic of TOPICS) for (const d of ["easy", "normal", "hard", "expert"] as const)
    for (let seed = 1; seed <= 85; seed++) {
      const q = generateQuestion(topic, d, seed);
      assert.deepEqual(validateQuestion(q), [], `${q.id}`);
      n++;
    }
  assert.ok(n >= 2000);
});

test("validator rejects tampered question", () => {
  const q = generateQuestion("binomial", "normal", 7);
  q.correctIndex = (q.correctIndex + 1) % 4;
  assert.notDeepEqual(validateQuestion(q), []);
});

test("same seed gives same question", () => {
  assert.deepEqual(generateQuestion("poisson", "hard", 5), generateQuestion("poisson", "hard", 5));
});

test("team suggestion and scoring", () => {
  assert.equal(suggestTeam({ red: 8, blue: 3, green: 5, yellow: 3, purple: 8 }), "blue");
  assert.equal(suggestTeam({ red: 8, blue: 8, green: 8, yellow: 8, purple: 8 }), null);
  assert.equal(puzzleScore(1, 0), 75);
  assert.equal(puzzleScore(3, 0), 50);
});

import { spawnFor, clampWorld, WORLD_HALF, TEAMS, MAX_TEAM_SIZE } from "../src/index.ts";
test("spawn points stay inside the world and clamp works", () => {
  for (const t of TEAMS) for (let s = 0; s < MAX_TEAM_SIZE; s++) {
    const p = spawnFor(t.id, s);
    assert.ok(Math.abs(p.x) <= WORLD_HALF && Math.abs(p.z) <= WORLD_HALF);
  }
  assert.equal(clampWorld(99), WORLD_HALF);
  assert.equal(clampWorld(-99), -WORLD_HALF);
});

import { stepGhost, shouldScare, GHOST, EVIDENCE_SPOTS } from "../src/index.ts";
test("ghost moves at most speed*dt, retargets inside bounds, scare has cooldown", () => {
  let g = { x: 0, z: 0, tx: 10, tz: 0 };
  const n = stepGhost(g, 0.1, Math.random);
  assert.ok(Math.hypot(n.x - g.x, n.z - g.z) <= GHOST.speed * 0.1 + 1e-9);
  for (let i = 0; i < 500; i++) {
    g = stepGhost(g, 0.1, Math.random);
    assert.ok(Math.abs(g.tx) <= GHOST.xHalf && g.tz >= GHOST.zMin && g.tz <= GHOST.zMax);
  }
  assert.equal(shouldScare(0, 0, 1, 0, 0, 20_000), true);
  assert.equal(shouldScare(0, 0, 1, 0, 10_000, 20_000), false);
  assert.equal(shouldScare(0, 0, 30, 0, 0, 20_000), false);
  assert.ok(EVIDENCE_SPOTS.every((s) => Math.abs(s.x) < 40 && Math.abs(s.z) < 40));
});

import { buildCustom, KINDS } from "../src/index.ts";
test("custom questions: answers computed in code, bad input rejected", () => {
  const ok = buildCustom("binom_exact", { n: 10, k: 3, p: 50 }, "โยนเหรียญ 10 ครั้ง โอกาสออกหัว 50% ความน่าจะเป็นที่ออกหัว 3 ครั้งพอดีคือเท่าไร", "normal", 1);
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.question!.choices[ok.question!.correctIndex], "0.1172");
  assert.notDeepEqual(buildCustom("binom_exact", { n: 5, k: 9, p: 50 }, "ข้อความยาวพอสมควรสำหรับทดสอบ 5 9 50", "normal", 1).errors, []);
  assert.notDeepEqual(buildCustom("binom_exact", { n: 10, k: 3, p: 50 }, "ข้อความที่ไม่มีตัวเลขตรงกับพารามิเตอร์เลย", "normal", 1).errors, []);
  assert.notDeepEqual(buildCustom("rm_rf", {}, "x".repeat(20), "easy", 1).errors, []);
  assert.notDeepEqual(buildCustom("expected_value", { v1: 1, v2: 2, v3: 3, q1: 50, q2: 50, q3: 50 }, "1 2 3 50 50 50 ข้อความ", "easy", 1).errors, []);
  assert.ok(KINDS.length === 14);
});

import { cleanLook, DEFAULT_LOOK, LOOK_LIMITS } from "../src/index.ts";
test("look validation", () => {
  assert.deepEqual(cleanLook({ skin: 1, hat: 2 }), { ...DEFAULT_LOOK, skin: 1, hat: 2 }); // missing fields take defaults
  assert.deepEqual(cleanLook(DEFAULT_LOOK), DEFAULT_LOOK);
  assert.equal(cleanLook({ skin: 99 }), null);
  assert.equal(cleanLook({ skin: "1" }), null);
  assert.equal(cleanLook({ hair: 1.5 }), null);
  assert.equal(cleanLook({ shoes: -1 }), null);
  assert.equal(cleanLook(null), null);
  assert.equal(cleanLook(5), null);
  for (const k of Object.keys(LOOK_LIMITS) as (keyof typeof LOOK_LIMITS)[]) {
    assert.ok(cleanLook({ [k]: LOOK_LIMITS[k] - 1 }) !== null); // the last valid index is accepted
    assert.equal(cleanLook({ [k]: LOOK_LIMITS[k] }), null);     // one past the end is not
  }
});

import { maxGhosts, booPoints, GHOST_POINT_CAP, GHOST_ABILITIES } from "../src/index.ts";
test("ghost balance rules", () => {
  assert.equal(maxGhosts(1), 1); assert.equal(maxGhosts(7), 1); assert.equal(maxGhosts(16), 2); assert.equal(maxGhosts(40), 5);
  assert.equal(booPoints(0), GHOST_ABILITIES.boo.points);
  assert.equal(booPoints(GHOST_POINT_CAP - 5), 5);
  assert.equal(booPoints(GHOST_POINT_CAP), 0);
});

import { recordTeamwork, TEAMWORK, dropZoneFor, CRATE, SPECIAL_SPOTS } from "../src/index.ts";
test("teamwork bonus needs 3 different members inside the window", () => {
  let r = recordTeamwork([], "a", 0);
  r = recordTeamwork(r.events, "a", 1000); assert.deepEqual(r.awarded, []);
  r = recordTeamwork(r.events, "b", 2000); assert.deepEqual(r.awarded, []);
  r = recordTeamwork(r.events, "c", 3000); assert.deepEqual(r.awarded.sort(), ["a", "b", "c"]);
  assert.deepEqual(r.events, []);
  let q = recordTeamwork([], "a", 0);
  q = recordTeamwork(q.events, "b", 1000);
  q = recordTeamwork(q.events, "c", TEAMWORK.windowMs + 5000); // a and b expired
  assert.deepEqual(q.awarded, []);
});
test("mission locations are inside the world", () => {
  for (const t of TEAMS) { const d = dropZoneFor(t.id); assert.ok(Math.abs(d.x) <= WORLD_HALF && Math.abs(d.z) <= WORLD_HALF); }
  assert.ok(Math.abs(CRATE.x) < WORLD_HALF && SPECIAL_SPOTS.every((s) => Math.abs(s.x) <= WORLD_HALF && Math.abs(s.z) <= WORLD_HALF));
});

import { earnBaht, EARN, canBuy, canEquip, isValidPlayerKey, SHOP_ITEMS } from "../src/index.ts";
test("shop rules: earnings capped, purchases validated, keys validated", () => {
  assert.equal(earnBaht(0), EARN.base);
  assert.equal(earnBaht(200), 70);
  assert.equal(earnBaht(10_000_000), EARN.cap);
  assert.equal(earnBaht(NaN), EARN.base);
  assert.equal(earnBaht(-50), EARN.base);
  const w = { baht: 70, owned: ["glasses"], equipped: "" };
  assert.equal(canBuy(w, "khaoma"), "not_enough");   // costs 80, has 70
  assert.equal(canBuy({ ...w, baht: 80 }, "khaoma"), "ok");
  assert.equal(canBuy(w, "glasses"), "already_owned");
  assert.equal(canBuy(w, "nope"), "unknown_item");
  assert.equal(canBuy({ ...w, baht: 5 }, "garland"), "not_enough");
  assert.equal(canEquip(w, "glasses"), true);
  assert.equal(canEquip(w, "lantern"), false);
  assert.equal(canEquip(w, ""), true);
  assert.equal(isValidPlayerKey("abcdefghijklmnop"), true);
  assert.equal(isValidPlayerKey("short"), false);
  assert.equal(isValidPlayerKey("has space has space!"), false);
  assert.ok(SHOP_ITEMS.every((i) => i.price > 0));
  assert.equal(new Set(SHOP_ITEMS.map((i) => i.id)).size, SHOP_ITEMS.length);
  const price = (r: string) => Math.min(...SHOP_ITEMS.filter((i) => i.rarity === r).map((i) => i.price));
  assert.ok(price("common") < price("rare") && price("rare") < price("epic") && price("epic") < price("legendary")); // rarer = pricier
});

import { resolveCollisions, PLAYER_RADIUS, BOXES, TREES, PUZZLE_ZONE, TEMPLE, WORLD_HALF as WH } from "../src/index.ts";
test("collisions: pushed out of solids; key spots stay reachable", () => {
  const p = resolveCollisions(0, -28, PLAYER_RADIUS); // inside the school
  assert.ok(Math.abs(p.x) > 8 || Math.abs(p.z + 28) > 3.5);
  const q = resolveCollisions(5, 5, PLAYER_RADIUS); // open ground is untouched
  assert.deepEqual(q, { x: 5, z: 5 });
  const free = (x: number, z: number) => { const r = resolveCollisions(x, z, PLAYER_RADIUS); return Math.hypot(r.x - x, r.z - z) < 1e-9; };
  for (const s of EVIDENCE_SPOTS) assert.ok(free(s.x, s.z), `evidence ${s.x},${s.z} is inside a solid`);
  for (const s of SPECIAL_SPOTS) assert.ok(free(s.x, s.z), `special ${s.x},${s.z} is inside a solid`);
  assert.ok(free(CRATE.x, CRATE.z) && free(PUZZLE_ZONE.x, PUZZLE_ZONE.z));
  for (const t of TEAMS) { const d = dropZoneFor(t.id); assert.ok(free(d.x, d.z - 3)); for (let s = 0; s < 8; s++) { const sp = spawnFor(t.id, s); assert.ok(free(sp.x, sp.z), `spawn ${t.id}#${s}`); } }
  assert.ok(TREES.length > 30 && TREES.every((t) => Math.abs(t.x) < WH && Math.abs(t.z) < WH));
  assert.ok(BOXES.some((b) => b.x === TEMPLE.x));
});

import { chaosPlan, chaosTotalSeconds, roundWinner, CHAOS } from "../src/index.ts";
test("chaos party plan and round winner", () => {
  const plan = chaosPlan();
  assert.deepEqual(plan.map((p) => p.kind), ["intro", "collect", "break", "quiz", "break", "relay", "break", "fishing", "break", "cooking"]);
  assert.equal(chaosTotalSeconds(), 5 + 60 + 8 + 5 * 23 + 8 + 90 + 8 + 75 + 8 + 75);
  assert.equal(roundWinner({ red: 30, blue: 50, green: 0 }), "blue");
  assert.equal(roundWinner({ red: 50, blue: 50 }), null);
  assert.equal(roundWinner({ red: 0, blue: 0 }), null);
  assert.equal(roundWinner({}), null);
  assert.ok(CHAOS.collect.orbs > 0 && CHAOS.roundWinnerBonus > 0);
});

import { NIGHT, safeZoneFor, inSafeZone, shelterAwards, shelterPointsFor } from "../src/index.ts";
test("chaos night: safe ring, shelter bonus with cap, faster ghost", () => {
  for (const t of TEAMS) {
    const z = safeZoneFor(t.id);
    assert.ok(Math.abs(z.x) <= WORLD_HALF && Math.abs(z.z) <= WORLD_HALF);
    assert.ok(inSafeZone(t.id, z.x, z.z) && !inSafeZone(t.id, z.x + 20, z.z));
  }
  assert.deepEqual(shelterAwards([]), []);
  assert.deepEqual(shelterAwards([{ id: "a", inside: true }, { id: "b", inside: false }]), ["a"]);          // 1 of 2 is enough (half)
  assert.deepEqual(shelterAwards([{ id: "a", inside: true }, { id: "b", inside: false }, { id: "c", inside: false }]), []); // 1 of 3 is not
  assert.deepEqual(shelterAwards([{ id: "a", inside: false }]), []);
  assert.equal(shelterPointsFor(0), NIGHT.shelterPoints);
  assert.equal(shelterPointsFor(NIGHT.shelterCap - 10), 10);
  assert.equal(shelterPointsFor(NIGHT.shelterCap), 0);
  const slow = stepGhost({ x: 0, z: 0, tx: 50, tz: 0 }, 1, Math.random);
  const fast = stepGhost({ x: 0, z: 0, tx: 50, tz: 0 }, 1, Math.random, NIGHT.ghostSpeedMul);
  assert.ok(fast.x > slow.x);
});

import { stepGhostAI, initGhost, ghostsFor, GHOST_KINDS, GUARDIAN, SHADOW_KEEP, PRANK } from "../src/index.ts";
import { makeRng } from "../src/math/rng.ts";
test("AI ghost kinds behave as designed", () => {
  const r = makeRng(7).next;
  assert.deepEqual(ghostsFor("chaos_party"), []);
  assert.ok(ghostsFor("chaos_night").length === 4 && ghostsFor("ghost_hunt").length === 2);
  // guardian stays near the temple front
  let g = initGhost("guardian", r);
  for (let i = 0; i < 3000; i++) { g = stepGhostAI(g, 100, r, []); assert.ok(Math.hypot(g.x - GUARDIAN.x, g.z - GUARDIAN.z) <= GUARDIAN.r + 0.6); }
  // shadow closes in but never inside the keep-away distance
  let s = { ...initGhost("shadow", r), x: -30, z: 20, tx: -30, tz: 20 };
  const h = { x: 10, z: -10 };
  let prev = Math.hypot(h.x - s.x, h.z - s.z);
  for (let i = 0; i < 4000; i++) { s = stepGhostAI(s, 100, r, [h]); const d = Math.hypot(h.x - s.x, h.z - s.z); assert.ok(d >= SHADOW_KEEP - 1e-6); assert.ok(d <= prev + 1e-9); prev = d; }
  assert.ok(prev < SHADOW_KEEP + 0.7);
  // prankster blinks in 9-12 units from a player when its timer runs out
  const p0 = { ...initGhost("prankster", r), x: 30, z: -30, tx: 30, tz: -30, timer: 0 };
  const hum = { x: -10, z: 5 };
  const p1 = stepGhostAI(p0, 100, r, [hum]);
  const dd = Math.hypot(p1.x - hum.x, p1.z - hum.z);
  assert.ok(dd >= PRANK.distMin - 3 && dd <= PRANK.distMax + 1, `blink distance ${dd}`); // slack: clamping to the map can shorten it
  // every kind stays on the map over a long run with moving players
  for (const kind of Object.keys(GHOST_KINDS) as (keyof typeof GHOST_KINDS)[]) {
    let x = initGhost(kind, r);
    for (let i = 0; i < 2000; i++) { x = stepGhostAI(x, 100, r, [{ x: (r() * 2 - 1) * 30, z: (r() * 2 - 1) * 30 }]); assert.ok(Math.abs(x.x) <= 40 && Math.abs(x.z) <= 40, kind); }
  }
});

import { pickFish, FISH, FISHING, POND, CHAOS_ROUNDS } from "../src/index.ts";
test("fishing odds and pond placement", () => {
  assert.equal(FISH.reduce((a, f) => a + f.weight, 0), 100);
  assert.equal(pickFish(0).id, "tilapia");
  assert.equal(pickFish(0.999).id, "golden");
  assert.equal(pickFish(0.49).id, "tilapia");   // [0, 0.5) is tilapia
  assert.equal(pickFish(0.5).id, "snakehead");  // [0.5, 0.8) is snakehead
  assert.equal(pickFish(NaN).id, "tilapia");
  assert.equal(pickFish(5).id, "golden");
  let total = 0; const N = 100000;
  const rng = makeRng(3).next;
  for (let i = 0; i < N; i++) total += pickFish(rng()).points;
  const expected = FISH.reduce((a, f) => a + f.points * f.weight / 100, 0);
  assert.ok(Math.abs(total / N - expected) < 0.5, `mean ${total / N} vs ${expected}`);
  assert.ok(FISHING.biteMs > 0 && FISHING.waitMin < FISHING.waitMax && CHAOS_ROUNDS === 5);
  // the pond is solid water, clear of key spots, and the shore is reachable
  const r = resolveCollisions(POND.x, POND.z, PLAYER_RADIUS);
  assert.ok(Math.hypot(r.x - POND.x, r.z - POND.z) >= POND.r + PLAYER_RADIUS - 1e-6);
  for (const s of EVIDENCE_SPOTS) assert.ok(Math.hypot(s.x - POND.x, s.z - POND.z) > POND.r + 2);
  assert.ok(FISHING.reach > POND.r + PLAYER_RADIUS + 0.5);
  assert.ok(TREES.every((t) => Math.hypot(t.x - POND.x, t.z - POND.z) > POND.r + 2));
});

import { lobbySpawn, LOBBY_CENTER, EMOTES } from "../src/index.ts";
test("walkable lobby: every slot has a free, distinct spot inside the world; emotes whitelist", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const p = lobbySpawn(i);
    assert.ok(Math.abs(p.x) <= WORLD_HALF && Math.abs(p.z) <= WORLD_HALF);
    const r = resolveCollisions(p.x, p.z, PLAYER_RADIUS);
    assert.ok(Math.hypot(r.x - p.x, r.z - p.z) < 1e-9, `lobby slot ${i} is inside a solid`);
    seen.add(p.x.toFixed(2) + "," + p.z.toFixed(2));
  }
  assert.equal(seen.size, 40);
  assert.deepEqual(lobbySpawn(40), lobbySpawn(0)); // wraps
  assert.ok(Math.hypot(lobbySpawn(0).x - LOBBY_CENTER.x, lobbySpawn(0).z - LOBBY_CENTER.z) < 4);
  assert.ok(EMOTES.length >= 3 && new Set(EMOTES).size === EMOTES.length);
});

import { scatterPoints, STILT_HOUSES, LAMPS, SIGNS } from "../src/index.ts";
test("village dressing: scatter is deterministic and clear of solids; houses, lamps and signs are placed sensibly", () => {
  const a = scatterPoints(11, 300, 0.5), b = scatterPoints(11, 300, 0.5);
  assert.deepEqual(a, b);
  assert.ok(a.length >= 270, `only ${a.length} points`);
  for (const p of a) {
    const r = resolveCollisions(p.x, p.z, 0.5);
    assert.ok(Math.hypot(r.x - p.x, r.z - p.z) < 1e-9 && Math.abs(p.x) < WORLD_HALF && Math.abs(p.z) < WORLD_HALF);
    assert.ok(!(Math.abs(p.x) < 3.4 && p.z > -24 && p.z < 34));
  }
  const free = (x: number, z: number) => { const r = resolveCollisions(x, z, PLAYER_RADIUS); return Math.hypot(r.x - x, r.z - z) < 1e-9; };
  for (const h of STILT_HOUSES) assert.ok(Math.abs(h.x) < WORLD_HALF && !EVIDENCE_SPOTS.some((s) => Math.hypot(s.x - h.x, s.z - h.z) < 5), `stilt house ${h.x},${h.z}`);
  for (const l of LAMPS) assert.ok(free(l.x, l.z), `lamp ${l.x},${l.z}`);
  for (const s of SIGNS) assert.ok(free(s.x, s.z) && s.text.length > 0, `sign ${s.text}`);
  assert.ok(TREES.every((t) => STILT_HOUSES.every((h) => Math.hypot(t.x - h.x, t.z - h.z) > 4)));
  for (const t of TEAMS) { const sp = spawnFor(t.id, 0); assert.ok(free(sp.x, sp.z)); }
  for (let i = 0; i < 40; i++) { const p = lobbySpawn(i); assert.ok(free(p.x, p.z), `lobby ${i}`); }
});

import { surfaceAt, melodyNote, MUSIC, midiToHz, DEFAULT_VOLUME } from "../src/index.ts";
test("sound design: surfaces, generative melody stays in key and in range", () => {
  assert.equal(surfaceAt(0, 10), "dirt");            // main road
  assert.equal(surfaceAt(26, -8), "field");          // rice field
  assert.equal(surfaceAt(TEMPLE.x, TEMPLE.z + 5), "stone");
  assert.equal(surfaceAt(0, -24), "stone");          // school steps
  assert.equal(surfaceAt(-22, 6), "wood");           // market
  assert.equal(surfaceAt(-30, 25), "grass");
  const kinds = new Set(["dirt", "grass", "field", "stone", "wood"]);
  for (let i = 0; i < 2000; i++) assert.ok(kinds.has(surfaceAt((Math.random() * 2 - 1) * 40, (Math.random() * 2 - 1) * 40)));
  for (const mode of Object.keys(MUSIC) as (keyof typeof MUSIC)[]) {
    const r = makeRng(9).next, a = makeRng(9).next;
    for (let step = 0; step < 400; step++) {
      const n = melodyNote(mode, step, r);
      assert.deepEqual(n, melodyNote(mode, step, a)); // deterministic for the same random source
      assert.ok(n.beats >= 0.5 && n.beats <= 2);
      if (!n.rest) {
        assert.ok(MUSIC[mode].scale.includes(n.midi % 12), `${mode}: note ${n.midi} out of scale`);
        assert.ok(n.midi >= MUSIC[mode].low && n.midi <= MUSIC[mode].high);
      }
    }
  }
  assert.ok(Math.abs(midiToHz(69) - 440) < 1e-9 && Math.abs(midiToHz(81) - 880) < 1e-6);
  assert.ok(Object.values(DEFAULT_VOLUME).every((v) => v >= 0 && v <= 1));
});

import { WEATHER, nextWeather, weatherDurationMs, lightningStrike, weatherWeights, WEATHER_PLAN, LIGHTNING, shouldScare as shouldScareW } from "../src/index.ts";
test("weather: schedule rules, durations, lightning, fog widens the startle radius", () => {
  const r = makeRng(42).next;
  // no weather in the lobby or Chaos Party
  for (const m of ["chaos_party", "lobby", "other"]) assert.equal(nextWeather(m, "clear", r), "clear");
  // a spell always ends in clear skies; clear skies always lead to a spell in the hunt modes, never repeating the last one
  for (const prev of ["fog", "rain", "storm", "wind"] as const) assert.equal(nextWeather("chaos_night", prev, r), "clear");
  for (let i = 0; i < 500; i++) { const n = nextWeather("chaos_night", "clear", r, "rain"); assert.ok(n !== "clear" && n !== "rain"); }
  // long-run frequencies follow the weights (chaos_night: fog 30, rain 25, storm 15, wind 15 of 85)
  const counts: Record<string, number> = {}; const N = 40000;
  for (let i = 0; i < N; i++) { const n = nextWeather("chaos_night", "clear", r); counts[n] = (counts[n] ?? 0) + 1; }
  const w = weatherWeights("chaos_night") as Record<string, number>, total = Object.values(w).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(w)) assert.ok(Math.abs(counts[k] / N - w[k] / total) < 0.015, `${k}: ${counts[k] / N} vs ${w[k] / total}`);
  assert.ok((weatherWeights("ghost_hunt").storm ?? 0) < (weatherWeights("chaos_night").storm ?? 0)); // storms are rarer by day
  for (let i = 0; i < 300; i++) {
    const d = weatherDurationMs("rain", r), c = weatherDurationMs("clear", r);
    assert.ok(d >= WEATHER_PLAN.minMs && d <= WEATHER_PLAN.maxMs && c >= WEATHER_PLAN.clearMinMs && c <= WEATHER_PLAN.clearMaxMs);
    const s = lightningStrike(r); assert.ok(Math.abs(s.x) <= WORLD_HALF - 4 && Math.abs(s.z) <= WORLD_HALF - 4);
  }
  assert.ok(LIGHTNING.radius > 0 && LIGHTNING.powerCutChance > 0 && LIGHTNING.powerCutChance < 1);
  // effects table: nothing takes points away, fog widens the startle radius, rain slows a little and speeds up respawns
  assert.ok(WEATHER.fog.scareMul > 1 && WEATHER.rain.walkMul < 1 && WEATHER.rain.walkMul > 0.8 && WEATHER.rain.respawnMul < 1 && WEATHER.clear.scareMul === 1);
  assert.equal(shouldScareW(0, 0, 2.6, 0, 0, 20_000), false);                     // 2.6 > 2.2: not startled in clear weather
  assert.equal(shouldScareW(0, 0, 2.6, 0, 0, 20_000, WEATHER.fog.scareMul), true); // 2.6 <= 2.2 x 1.35 in fog
});

import { solve as solveKind, checkParams as checkP } from "../src/index.ts";
test("discrete uniform topic: exact values, validator, parameter rules", () => {
  assert.equal(solveKind("unif_mean", { a: 1, b: 6 }), 3.5);
  assert.ok(Math.abs(solveKind("unif_var", { a: 1, b: 6 }) - 35 / 12) < 1e-12);       // fair die: Var = 35/12
  assert.ok(Math.abs(solveKind("unif_between", { a: 1, b: 6, c: 2, d: 5 }) - 4 / 6) < 1e-12);
  assert.equal(solveKind("unif_between", { a: 3, b: 12, c: 3, d: 12 }), 1);          // whole range = certain
  assert.ok(Math.abs(solveKind("unif_var", { a: 10, b: 14 }) - 2) < 1e-12);            // n = 5: (25-1)/12
  for (let seed = 1; seed <= 400; seed++) for (const d of ["easy", "normal", "hard", "expert"] as const) {
    const q = generateQuestion("uniform", d, seed);
    assert.deepEqual(validateQuestion(q), [], q.id);
    assert.ok(q.kind.startsWith("unif_") && q.topic === "uniform");
    assert.deepEqual(checkP(q.kind, q.params), [], `params of ${q.id}`);
  }
  assert.notDeepEqual(checkP("unif_between", { a: 5, b: 10, c: 3, d: 8 }), []); // c below a
  assert.notDeepEqual(checkP("unif_between", { a: 5, b: 10, c: 8, d: 7 }), []); // d below c
  assert.notDeepEqual(checkP("unif_mean", { a: 9, b: 9 }), []);                  // a must be < b
  const ok = buildCustom("unif_mean", { a: 2, b: 8 }, "สุ่มเลขจาก 2 ถึง 8 เท่าๆ กัน ค่าคาดหมายคือเท่าไร", "normal", 5);
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.question!.choices[ok.question!.correctIndex], "5.00");
});

import { RECIPES, INGREDIENTS, COOK, COOK_STATION, recipeLength, pickRecipe, cookScore, cookStep, cookLimitMs, isIngredient } from "../src/index.ts";
test("cooking round: recipes valid, length grows, scoring bounded, order enforced, stove reachable", () => {
  const ids = new Set<string>(INGREDIENTS.map((i) => i.id));
  assert.equal(new Set(RECIPES.map((r) => r.id)).size, RECIPES.length);
  for (const r of RECIPES) {
    assert.ok(r.steps.length >= 3 && r.steps.length <= 5 && r.name && r.icon);
    assert.ok(r.steps.every((s) => ids.has(s)), `${r.id} uses an unknown ingredient`);
    for (let i = 1; i < r.steps.length; i++) assert.notEqual(r.steps[i], r.steps[i - 1], `${r.id} repeats an ingredient back to back`);
  }
  for (const len of [3, 4, 5]) assert.ok(RECIPES.filter((r) => r.steps.length === len).length >= 2, `need 2+ recipes of length ${len}`);
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(recipeLength), [3, 3, 4, 4, 5, 5]);
  const r = makeRng(3).next;
  for (let d = 0; d < 10; d++) { let prev: string | undefined; for (let i = 0; i < 40; i++) { const x = pickRecipe(d, r, prev); assert.equal(x.steps.length, recipeLength(d)); assert.notEqual(x.id, prev); prev = x.id; } }
  assert.equal(pickRecipe(0, () => 0).id, pickRecipe(0, () => 0).id);
  for (const len of [3, 4, 5]) {
    const base = len * COOK.pointsPerStep, max = base + len * COOK.speedBonusPerStep;
    assert.equal(cookScore(len, 0).total, max);
    assert.equal(cookScore(len, len * COOK.perStepLimitMs).total, base);
    assert.equal(cookScore(len, 10 ** 9).total, base);
    assert.equal(cookScore(len, -500).total, max);
    let prev = Infinity; for (let t = 0; t <= len * COOK.perStepLimitMs; t += 250) { const s = cookScore(len, t).total; assert.ok(s <= prev && s >= base && s <= max); prev = s; }
  }
  assert.equal(cookLimitMs(RECIPES[0]), 3 * COOK.perStepLimitMs);
  const rec = RECIPES.find((x) => x.id === "tomyum")!;
  assert.equal(cookStep(rec, 0, "shrimp"), "ok"); assert.equal(cookStep(rec, 0, "chili"), "wrong");
  assert.equal(cookStep(rec, 3, "onion"), "done"); assert.equal(cookStep(rec, 4, "onion"), "wrong"); assert.equal(cookStep(rec, -1, "shrimp"), "wrong");
  assert.ok(isIngredient("egg") && !isIngredient("gold") && !isIngredient(7));
  const q = resolveCollisions(COOK_STATION.x, COOK_STATION.z, PLAYER_RADIUS);
  assert.ok(Math.hypot(q.x - COOK_STATION.x, q.z - COOK_STATION.z) < 1e-9, "the stove is inside a solid");
  assert.ok(TREES.every((t) => Math.hypot(t.x - COOK_STATION.x, t.z - COOK_STATION.z) > 3.2));
});

import { worldToMap, MAP_PLACES } from "../src/index.ts";
test("village map: world to map coordinates and landmark placement", () => {
  const S = 320, c1 = worldToMap(-WORLD_HALF, -WORLD_HALF, S), c2 = worldToMap(WORLD_HALF, WORLD_HALF, S), mid = worldToMap(0, 0, S);
  assert.deepEqual([c1.x, c1.y, c2.x, c2.y, mid.x, mid.y], [0, 0, S, S, S / 2, S / 2]);
  assert.ok(worldToMap(0, 30, S).y > worldToMap(0, -30, S).y); // north (negative z) is at the top, the team houses at the bottom
  for (const p of MAP_PLACES) { const m = worldToMap(p.x, p.z, S); assert.ok(m.x >= 0 && m.x <= S && m.y >= 0 && m.y <= S, p.name); assert.ok(p.name && p.icon); }
  for (let i = 0; i < MAP_PLACES.length; i++) for (let j = i + 1; j < MAP_PLACES.length; j++) assert.ok(Math.hypot(MAP_PLACES[i].x - MAP_PLACES[j].x, MAP_PLACES[i].z - MAP_PLACES[j].z) > 8, `labels ${MAP_PLACES[i].name}/${MAP_PLACES[j].name} too close`);
});
