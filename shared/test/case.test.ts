import { test } from "node:test";
import assert from "node:assert/strict";
import { SUSPECTS, CASE, makeCase, remainingSuspects, canAccuse, isCulprit, solvePoints, clueSpot, clueText, CASE_SPOTS, EVIDENCE_SPOTS, SPECIAL_SPOTS, resolveCollisions, WORLD_HALF, PLAYER_RADIUS } from "../src/index.ts";

test("case: suspects are distinct on every attribute", () => {
  assert.equal(SUSPECTS.length, 5);
  for (const k of ["id", "name", "place", "item", "sound"] as const) assert.equal(new Set(SUSPECTS.map((s) => s[k])).size, 5, k);
});

test("case: 500 seeds are solvable, every clue is true of the culprit, and the clues together name exactly one suspect", () => {
  for (let seed = 1; seed <= 500; seed++) {
    const c = makeCase(seed);
    assert.equal(c.clues.length, 5);
    assert.deepEqual(c.clues.map((k) => k.spot), [0, 1, 2, 3, 4]);
    assert.equal(new Set(c.clues.map((k) => k.id)).size, 5);
    const culprit = SUSPECTS.find((s) => s.id === c.culprit)!;
    for (const k of c.clues) {
      const cleared = SUSPECTS.find((s) => s.id === k.eliminates)!;
      assert.notEqual(cleared.id, culprit.id);                       // a clue never clears the culprit
      assert.notEqual(cleared[k.attr], culprit[k.attr]);             // the statement is true of the culprit
      assert.ok(k.text.includes(cleared[k.attr]), k.text);           // and it names the cleared suspect's attribute
      assert.equal(k.text, clueText(k.spot, k.attr, cleared));
    }
    assert.deepEqual(remainingSuspects(c, c.clues.map((k) => k.id)), [c.culprit]);
    assert.equal(new Set(c.clues.map((k) => k.eliminates)).size, 4); // each of the 4 innocents is cleared, one of them twice
  }
});

test("case: for every subset of clues the culprit stays in the list; a team may accuse only when 2 or fewer remain", () => {
  for (let seed = 1; seed <= 60; seed++) {
    const c = makeCase(seed);
    for (let mask = 0; mask < 32; mask++) {
      const found = c.clues.filter((_, i) => mask & (1 << i)).map((k) => k.id);
      const rem = remainingSuspects(c, found);
      assert.ok(rem.includes(c.culprit));
      assert.equal(canAccuse(c, found), rem.length <= CASE.maxRemainingToAccuse);
    }
    assert.equal(canAccuse(c, []), false);                           // no blind guessing
    assert.equal(remainingSuspects(c, []).length, 5);
  }
});

test("case: any 4 of the 5 clues leave at most 2 suspects, and the full set leaves 1", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const c = makeCase(seed);
    for (let skip = 0; skip < 5; skip++) {
      const rem = remainingSuspects(c, c.clues.filter((_, i) => i !== skip).map((k) => k.id));
      assert.ok(rem.length <= 2 && rem.length >= 1);
      assert.ok(canAccuse(c, c.clues.filter((_, i) => i !== skip).map((k) => k.id)));
    }
  }
});

test("case: deterministic per seed and the culprit is spread evenly", () => {
  assert.deepEqual(makeCase(12345), makeCase(12345));
  const counts: Record<string, number> = {}; const N = 5000;
  for (let i = 1; i <= N; i++) { const k = makeCase(i * 7919).culprit; counts[k] = (counts[k] ?? 0) + 1; }
  for (const s of SUSPECTS) assert.ok(Math.abs(counts[s.id] / N - 0.2) < 0.03, `${s.id}: ${counts[s.id] / N}`);
});

test("case: accusation and points rules", () => {
  const c = makeCase(99);
  assert.equal(isCulprit(c, c.culprit), true);
  assert.equal(isCulprit(c, SUSPECTS.find((s) => s.id !== c.culprit)!.id), false);
  assert.equal(solvePoints(1), CASE.solveFirst);
  assert.equal(solvePoints(2), CASE.solveLater);
  assert.ok(CASE.solveFirst > CASE.solveLater && CASE.cluePoints > 0 && CASE.accuseCooldownMs >= 10_000);
  assert.deepEqual(clueSpot("c2"), CASE_SPOTS[2]);
  for (const bad of ["c5", "c-1", "x1", "", "c10", "__proto__"]) assert.equal(clueSpot(bad), null, bad);
});

test("case: clue spots are inside the world, reachable (not inside a solid) and well apart from each other and from other pickups", () => {
  assert.equal(CASE_SPOTS.length, 5);
  for (const [i, p] of CASE_SPOTS.entries()) {
    assert.ok(Math.abs(p.x) < WORLD_HALF - 2 && Math.abs(p.z) < WORLD_HALF - 2);
    const r = resolveCollisions(p.x, p.z, PLAYER_RADIUS + CASE.reach / 3);
    assert.ok(Math.hypot(r.x - p.x, r.z - p.z) < 1e-9, `spot ${i} is inside or touching a solid`);
    for (const q of [...EVIDENCE_SPOTS, ...SPECIAL_SPOTS]) assert.ok(Math.hypot(p.x - q.x, p.z - q.z) > CASE.reach + 1, `spot ${i} overlaps another pickup`);
    for (const [j, q] of CASE_SPOTS.entries()) if (j !== i) assert.ok(Math.hypot(p.x - q.x, p.z - q.z) > 8);
  }
});

import { newTeamCase, foundClue, accuse } from "../src/index.ts";
test("case referee: clues count once, accusing needs narrowing, wrong guesses cool down, first team gets more", () => {
  const c = makeCase(2024), A = newTeamCase(), B = newTeamCase();
  const wrongId = SUSPECTS.find((s) => s.id !== c.culprit)!.id;
  assert.equal(foundClue(A, c, "c9"), false);                       // unknown clue id
  assert.equal(foundClue(A, c, c.clues[0].id), true);
  assert.equal(foundClue(A, c, c.clues[0].id), false);              // the same clue twice does nothing
  assert.deepEqual(accuse(c, A, c.culprit, 0, 0), { kind: "need_clues" }); // 4 suspects left: no lucky guesses
  assert.deepEqual(accuse(c, A, "nope", 0, 0), { kind: "ignored" });
  for (const k of c.clues) foundClue(A, c, k.id);
  assert.deepEqual(remainingSuspects(c, A.found), [c.culprit]);
  // a wrong accusation (possible only with some clue sets) starts a cooldown; here a team with 3 clues is narrowed to 2 and guesses wrong
  const T = newTeamCase();
  for (const k of c.clues) { foundClue(T, c, k.id); if (canAccuse(c, T.found)) break; }
  const t0 = 1_000_000;
  const w = accuse(c, T, remainingSuspects(c, T.found).find((id) => id !== c.culprit) ?? wrongId, t0, 0);
  assert.equal(remainingSuspects(c, T.found).length, 2);            // each clue clears at most one suspect, so the first time we may accuse exactly 2 remain
  assert.deepEqual(w, { kind: "wrong", waitMs: CASE.accuseCooldownMs });
  assert.equal(accuse(c, T, c.culprit, t0 + 1000, 0).kind, "cooldown");
  assert.equal(accuse(c, T, c.culprit, t0 + CASE.accuseCooldownMs, 0).kind, "solved");
  const first = accuse(c, A, c.culprit, t0, 0);
  assert.deepEqual(first, { kind: "solved", rank: 1, gained: CASE.solveFirst });
  assert.deepEqual(accuse(c, A, c.culprit, t0 + 1, 1), { kind: "ignored" }); // cannot be solved twice by the same team
  for (const k of c.clues) foundClue(B, c, k.id);
  assert.deepEqual(accuse(c, B, c.culprit, t0, 1), { kind: "solved", rank: 2, gained: CASE.solveLater });
  assert.equal(foundClue(A, c, c.clues[1].id), false);               // nothing changes after solving
});

test("case referee: over 300 random matches a team that gathers all clues always solves it, and never loses points", () => {
  for (let seed = 1; seed <= 300; seed++) {
    const c = makeCase(seed * 31), t = newTeamCase();
    for (const k of c.clues) assert.equal(foundClue(t, c, k.id), true);
    const o = accuse(c, t, c.culprit, 5, 0);
    assert.equal(o.kind, "solved");
    assert.ok(o.kind === "solved" && o.gained > 0);
  }
});

import { ACHIEVEMENTS, bump, type Stats } from "../src/index.ts";
test("achievements: unlock exactly once at the threshold, ids unique, no points involved", () => {
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  let s: Stats = {}; const got: string[] = [];
  for (let i = 0; i < 10; i++) { const r = bump(s, "clue"); s = r.stats; got.push(...r.unlocked.map((a) => a.id)); }
  assert.deepEqual(got, ["cl1", "cl4"]);
  assert.equal(s.clue, 10);
  assert.deepEqual(bump({}, "shelter").unlocked.map((a) => a.id), ["sh1"]);
  assert.deepEqual(bump({ evidence: 3 }, "evidence").unlocked, []);
});

import { SEARCH_SPOTS, SEARCH_REACH_SERVER, noteFor, searchSpot, FUNNY_NOTES, SPOOKY_NOTES } from "../src/index.ts";
test("search objects: reachable, apart from other pickups, notes deterministic and from the pools", () => {
  assert.equal(SEARCH_SPOTS.length, 4);
  for (const [i, p] of SEARCH_SPOTS.entries()) {
    assert.ok(Math.abs(p.x) < WORLD_HALF - 2 && Math.abs(p.z) < WORLD_HALF - 2);
    const r = resolveCollisions(p.x, p.z, PLAYER_RADIUS + 0.5);
    assert.ok(Math.hypot(r.x - p.x, r.z - p.z) < 1e-9, `object ${i} inside a solid`);
    for (const q of [...EVIDENCE_SPOTS, ...SPECIAL_SPOTS, ...CASE_SPOTS]) assert.ok(Math.hypot(p.x - q.x, p.z - q.z) > 3.5, `object ${i} overlaps a pickup`);
    for (const q of SEARCH_SPOTS) if (q.id !== p.id) assert.ok(Math.hypot(p.x - q.x, p.z - q.z) > 8);
    assert.equal(noteFor(77, i), noteFor(77, i));
  }
  let spooky = 0; const N = 4000;
  for (let i = 0; i < N; i++) { const n = noteFor(i * 13 + 1, i % 4); assert.ok((FUNNY_NOTES as readonly string[]).includes(n) || (SPOOKY_NOTES as readonly string[]).includes(n)); if ((SPOOKY_NOTES as readonly string[]).includes(n)) spooky++; }
  assert.ok(Math.abs(spooky / N - 0.3) < 0.04, String(spooky / N));
  assert.equal(searchSpot("o2")?.x, 30); assert.equal(searchSpot("zz"), null);
  assert.ok(SEARCH_REACH_SERVER > 3);
});

import { villageNews, spoilerWords, CASE_SPOT_NAMES } from "../src/index.ts";
test("village news: always some text, only hints at spot names, never leaks a suspect name or clue attribute", () => {
  let seed = 1; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const spoilers = spoilerWords().filter((w) => !CASE_SPOT_NAMES.some((n) => n.includes(w) || w.includes(n)));
  const mentioned = new Set<string>();
  for (let i = 0; i < 3000; i++) {
    const c = makeCase(i + 1), found = new Set(c.clues.filter(() => rnd() < 0.4).map((k) => k.id));
    const text = villageNews(c, found, i % 3, rnd);
    assert.ok(text.length > 5);
    for (const w of spoilers) assert.ok(!text.includes(w), `${w} leaked in: ${text}`);
    for (const n of CASE_SPOT_NAMES) if (text.includes("แสงสีม่วง") && text.includes(n)) {
      mentioned.add(n);
      const k = c.clues.find((x) => CASE_SPOT_NAMES[x.spot] === n)!;
      assert.ok(!found.has(k.id), "news pointed at a clue that was already found");
    }
  }
  assert.equal(mentioned.size, 5);
});
test("village news: with every clue found it never claims there is an unfound clue", () => {
  const c = makeCase(5), all = new Set(c.clues.map((k) => k.id));
  for (let i = 0; i < 200; i++) assert.ok(!villageNews(c, all, 0, Math.random).includes("แสงสีม่วง"));
});

import { DELIVERY, GADGET, GADGET_SPOTS, SCORE, tripRules, deliveryPoints, pickRivalTarget, landingSpot, chooseGadgetSpot, CRATE, type Rival } from "../src/index.ts";
test("delivery: unlimited count but only the first few pay in full; trips are time-limited and cooled down", () => {
  assert.equal(deliveryPoints(1), SCORE.mission); assert.equal(deliveryPoints(DELIVERY.fullCount), SCORE.mission);
  assert.equal(deliveryPoints(DELIVERY.fullCount + 1), Math.round(SCORE.mission * DELIVERY.laterRate));
  assert.ok(deliveryPoints(50) > 0 && deliveryPoints(50) < SCORE.mission);
  const hunt = tripRules(false), party = tripRules(true);
  for (const r of [hunt, party]) assert.ok(r.tripMs >= 20_000 && r.tripMs <= 60_000 && r.cooldownMs >= 5_000 && r.expiredCooldownMs >= 5_000);
  assert.ok(party.tripMs <= hunt.tripMs && party.cooldownMs <= hunt.cooldownMs); // relay is the faster race
  // balance: back-to-back deliveries over a 10 minute match must stay well below what 4 full deliveries plus the old cap allowed to be exploited
  const per = DELIVERY.cooldownMs + 10_000; let total = 0, n = 0;
  for (let t = 0; t + per <= 600_000; t += per) total += deliveryPoints(++n);
  assert.ok(total <= 4 * SCORE.mission + 12 * Math.round(SCORE.mission * DELIVERY.laterRate), String(total));
});
const R = (o: Partial<Rival>): Rival => ({ id: "r", x: 0, z: 0, team: "b", connected: true, role: "human", carrying: false, fishing: false, ...o });
test("gadget: only the nearest rival who can be hit in this round is a target", () => {
  const me = { x: 0, z: 0, team: "a" };
  assert.equal(pickRivalTarget(me, [], "relay"), null);
  assert.equal(pickRivalTarget(me, [R({ x: 2 })], "relay"), null);                                  // rival without a crate
  assert.equal(pickRivalTarget(me, [R({ x: 2, carrying: true, team: "a" })], "relay"), null);        // teammate
  assert.equal(pickRivalTarget(me, [R({ x: 2, carrying: true, role: "ghost" })], "relay"), null);
  assert.equal(pickRivalTarget(me, [R({ x: 2, carrying: true, connected: false })], "relay"), null);
  assert.equal(pickRivalTarget(me, [R({ x: GADGET.range + 0.1, carrying: true })], "relay"), null);  // out of range
  assert.equal(pickRivalTarget(me, [R({ id: "far", x: 4, carrying: true }), R({ id: "near", x: 2, carrying: true })], "relay")?.id, "near");
  assert.equal(pickRivalTarget(me, [R({ x: 2, carrying: true })], "fishing"), null);                 // carrying does not matter while fishing
  assert.equal(pickRivalTarget(me, [R({ x: 2, fishing: true })], "fishing")?.id, "r");
  assert.equal(pickRivalTarget(me, [R({ x: 2, fishing: true })], "relay"), null);
});
test("gadget: a knocked-off crate always lands somewhere reachable close by", () => {
  let s = 7; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (const p of [...GADGET_SPOTS, CRATE, { x: 0, z: 12 }, { x: -20, z: 13 }, { x: 33, z: -30 }]) for (let i = 0; i < 100; i++) {
    const l = landingSpot(p.x, p.z, rnd);
    assert.ok(Math.hypot(l.x - p.x, l.z - p.z) < 5, "landed too far");
    const r = resolveCollisions(l.x, l.z, PLAYER_RADIUS + 0.4);
    assert.ok(Math.hypot(r.x - l.x, r.z - l.z) < 1e-9, "landed inside a solid");
  }
});
test("gadget: spots are reachable, spread out, clear of other pickups, and the spawner never double-books", () => {
  assert.ok(GADGET_SPOTS.length >= GADGET.max * 2);
  for (const [i, p] of GADGET_SPOTS.entries()) {
    assert.ok(Math.abs(p.x) < WORLD_HALF - 2 && Math.abs(p.z) < WORLD_HALF - 2);
    const r = resolveCollisions(p.x, p.z, PLAYER_RADIUS + 0.5);
    assert.ok(Math.hypot(r.x - p.x, r.z - p.z) < 1e-9, `gadget spot ${i} inside a solid`);
    for (const q of [...EVIDENCE_SPOTS, ...SPECIAL_SPOTS, ...CASE_SPOTS, ...SEARCH_SPOTS, CRATE]) assert.ok(Math.hypot(p.x - q.x, p.z - q.z) > 3.5, `gadget spot ${i} overlaps a pickup`);
    for (const [j, q] of GADGET_SPOTS.entries()) if (j !== i) assert.ok(Math.hypot(p.x - q.x, p.z - q.z) > 5, `gadget spots ${i}/${j} too close`);
  }
  const lying: { x: number; z: number }[] = [];
  for (let i = 0; i < GADGET_SPOTS.length; i++) { const c = chooseGadgetSpot(lying, Math.random)!; assert.ok(c); lying.push(c); }
  assert.equal(new Set(lying.map((c) => c.x + "," + c.z)).size, GADGET_SPOTS.length);
  assert.equal(chooseGadgetSpot(lying, Math.random), null);
});

test("gadget: with a preferred area the spawner picks spots there first, then falls back to any free spot", () => {
  const near = { x: -20, z: 17, r: 12 }, lying: { x: number; z: number }[] = [];
  const inside = (p: { x: number; z: number }) => Math.hypot(p.x - near.x, p.z - near.z) <= near.r;
  const inNear = GADGET_SPOTS.filter(inside).length;
  assert.ok(inNear >= 3);
  for (let i = 0; i < inNear; i++) { const c = chooseGadgetSpot(lying, Math.random, near)!; assert.ok(inside(c)); lying.push(c); }
  const next = chooseGadgetSpot(lying, Math.random, near)!; // every near spot is taken: any other free spot is fine
  assert.ok(next && !lying.some((o) => o.x === next.x && o.z === next.z));
});

import { SECRET, secretNeed, secretSite, pickSecretMission, secretProgress, secretState, type SecretMission, type SecretMember } from "../src/index.ts";
const SM = (o: Partial<SecretMember>): SecretMember => ({ id: "p", x: 0, z: 0, connected: true, role: "human", ...o });
test("secret mission: how many teammates are needed", () => {
  assert.deepEqual([2, 3, 4, 5, 6, 8].map(secretNeed), [2, 3, 3, 4, 5, 6]);
  for (let n = 2; n <= 12; n++) { const k = secretNeed(n); assert.ok(k >= 2 && k <= n); }
  assert.equal(secretNeed(1), 1); // a lone player is never given a mission (see below), but the formula must not exceed the team
});
test("secret mission: picks an eligible team and a landmark, avoids repeating the last team when it can", () => {
  let s = 3; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  assert.equal(pickSecretMission(rnd, [], null, 0), null);
  const seenSites = new Set<number>();
  for (let i = 0; i < 400; i++) {
    const m = pickSecretMission(rnd, ["red", "blue", "green"], "red", 1000)!;
    assert.notEqual(m.team, "red"); assert.ok(m.site >= 0 && m.site < 5); assert.equal(m.until, 1000 + SECRET.durationMs); seenSites.add(m.site);
    assert.equal(pickSecretMission(rnd, ["red"], "red", 0)!.team, "red"); // the only eligible team may repeat
  }
  assert.equal(seenSites.size, 5);
  assert.ok(SECRET.durationMs < SECRET.everyMs && SECRET.firstMs >= 60_000 && SECRET.points > 0 && SECRET.points < 100);
});
test("secret mission: progress counts only connected non-ghost teammates inside the radius, and expiry never costs anything", () => {
  const m: SecretMission = { team: "red", site: 2, startedAt: 0, until: 45_000 }, site = secretSite(2);
  const at = (d: number, o: Partial<SecretMember> = {}) => SM({ x: site.x + d, z: site.z, ...o });
  let p = secretProgress(m, [at(0, { id: "a" }), at(3.9, { id: "b" }), at(4.1, { id: "c" })]);
  assert.deepEqual([p.eligible, p.need, p.insideIds, p.done], [3, 3, ["a", "b"], false]);
  assert.equal(secretState(m, 10_000, p), "running"); assert.equal(secretState(m, 45_000, p), "expired");
  p = secretProgress(m, [at(0, { id: "a" }), at(1, { id: "b" }), at(2, { id: "c" })]);
  assert.equal(p.done, true); assert.equal(secretState(m, 44_999, p), "done"); assert.equal(secretState(m, 99_999, p), "done"); // finishing wins even at the deadline
  p = secretProgress(m, [at(0, { id: "a" }), at(1, { id: "b" }), at(0, { id: "g", role: "ghost" }), at(0, { id: "d", connected: false })]);
  assert.deepEqual([p.eligible, p.need, p.done], [2, 2, true]);                                  // ghosts and disconnected players do not count
  p = secretProgress(m, [at(0, { id: "a" })]);
  assert.equal(p.done, false);                                                                     // one player alone can never complete it
  assert.equal(secretProgress(m, []).done, false);
});

import { DOORS, doorById, doorToggle, doorIsOpen, DOOR_OPEN_MS, DOOR_COOLDOWN_MS, DOOR_REACH, DOOR_REACH_SERVER } from "../src/index.ts";
test("doors: one per stilt house, reachable from outside the walls, toggle rules (cooldown, reach, auto-close)", () => {
  assert.equal(DOORS.length, 3);
  for (const d of DOORS) {
    assert.ok(Math.abs(d.x) < WORLD_HALF - 2 && Math.abs(d.z) < WORLD_HALF - 2);
    // a player can stand within reach of the door without being pushed out by a solid
    let ok = false;
    for (let a = 0; a < 360 && !ok; a += 10) {
      const px = d.x + Math.sin((a * Math.PI) / 180) * 1.5, pz = d.z + Math.cos((a * Math.PI) / 180) * 1.5;
      const r = resolveCollisions(px, pz, PLAYER_RADIUS);
      if (Math.hypot(r.x - px, r.z - pz) < 1e-9 && Math.hypot(px - d.x, pz - d.z) <= DOOR_REACH) ok = true;
    }
    assert.ok(ok, `door ${d.id} unreachable`);
    for (const q of [...EVIDENCE_SPOTS, ...SPECIAL_SPOTS, ...CASE_SPOTS, ...SEARCH_SPOTS]) assert.ok(Math.hypot(d.x - q.x, d.z - q.z) > 2.5, `door ${d.id} overlaps a pickup`);
    assert.equal(doorById(d.id)?.house, d.house);
  }
  assert.equal(doorById("zz"), null);
  assert.ok(DOOR_REACH_SERVER > DOOR_REACH);
  const t0 = 100_000;
  const o = doorToggle(0, 0, t0, 1)!;                       // closed -> open
  assert.ok(o.open && o.openUntil === t0 + DOOR_OPEN_MS && doorIsOpen(o.openUntil, t0 + 1));
  assert.ok(!doorIsOpen(o.openUntil, t0 + DOOR_OPEN_MS));   // auto-closes
  assert.equal(doorToggle(o.openUntil, t0, t0 + DOOR_COOLDOWN_MS - 1, 1), null); // cooldown
  const c = doorToggle(o.openUntil, t0, t0 + DOOR_COOLDOWN_MS, 1)!;             // open -> closed by hand
  assert.ok(!c.open && c.openUntil === 0);
  assert.equal(doorToggle(0, 0, t0, DOOR_REACH_SERVER + 0.1), null);            // too far
  assert.equal(doorToggle(0, 0, t0, NaN), null);
});

import { pickEerie, eerieDelay, EERIE, EERIE_SITES, EERIE_KINDS } from "../src/index.ts";
import { makeRng } from "../src/math/rng.ts";
test("eerie sounds: valid, never repeat back-to-back, mostly funny, in bounds, no clue/culprit leak, delay in range", () => {
  const r = makeRng(5).next; let last: string | null = null, funny = 0; const N = 3000;
  for (let i = 0; i < N; i++) {
    const e = pickEerie(r, last);
    assert.notEqual(e.kind, last); last = e.kind;
    assert.ok(EERIE_KINDS.some((k) => k.id === e.kind) && EERIE_SITES.some((s) => s.name === e.site));
    assert.ok(e.text.includes(e.site) && e.text.length > 10 && Math.abs(e.x) < WORLD_HALF && Math.abs(e.z) < WORLD_HALF);
    for (const s of SUSPECTS) assert.ok(!e.text.includes(s.name), "leaks a suspect name");
    if (EERIE_KINDS.find((k) => k.id === e.kind)!.funny) funny++;
    const d = eerieDelay(r); assert.ok(d >= EERIE.minMs && d <= EERIE.maxMs);
  }
  assert.ok(Math.abs(funny / N - 0.7) < 0.04, String(funny / N));
  assert.equal(pickEerie(() => 0, null).kind, EERIE_KINDS[0].id);
});

import { LOCK, pickLockDoor, lockDelay, lockNote, TOPICS, generateQuestion, validateQuestion } from "../src/index.ts";
test("locked doors: pick rules, delays, reward note, and every lock topic yields valid easy questions", () => {
  const r = makeRng(9).next;
  assert.equal(pickLockDoor(r, new Set(["d0"])), null);                          // cap: one locked door at a time
  assert.equal(pickLockDoor(r, new Set(), new Set(["d0", "d1", "d2"])), null);   // none free
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) { const id = pickLockDoor(r, new Set(), new Set(["d1"])); assert.ok(id === "d0" || id === "d2", String(id)); seen.add(id!); }
  assert.equal(seen.size, 2);
  for (let i = 0; i < 500; i++) { const d = lockDelay(r); assert.ok(d >= LOCK.minMs && d <= LOCK.maxMs); }
  assert.equal(lockNote(3, 1), lockNote(3, 1));
  for (const t of LOCK.topics) {
    assert.ok((TOPICS as readonly string[]).includes(t));
    for (let s = 1; s <= 150; s++) { const q = generateQuestion(t, LOCK.difficulty, s * 7919); assert.equal(validateQuestion(q).length, 0, `${t} seed ${s}`); assert.equal(q.choices.length, 4); }
  }
});

import { ROUTE_SPOT, ROUTE_REACH_SERVER, ROUTE_MIN_GAP, makeRoute, validateRoute, routeFlavorWrong, ROUTE_FLAVOR_WRONG } from "../src/index.ts";
import { TREES, LAMPS, SIGNS } from "../src/index.ts";
test("route choice: spot is reachable and apart, every generated question is valid and balanced, validator catches tampering", () => {
  const r0 = resolveCollisions(ROUTE_SPOT.x, ROUTE_SPOT.z, PLAYER_RADIUS + 1);
  assert.ok(Math.hypot(r0.x - ROUTE_SPOT.x, r0.z - ROUTE_SPOT.z) < 1e-9, "spot inside a solid");
  assert.ok(TREES.every((t) => Math.hypot(t.x - ROUTE_SPOT.x, t.z - ROUTE_SPOT.z) > 2.5));
  for (const q of [...EVIDENCE_SPOTS, ...SPECIAL_SPOTS, ...CASE_SPOTS, ...SEARCH_SPOTS, ...GADGET_SPOTS, ...DOORS]) assert.ok(Math.hypot(ROUTE_SPOT.x - q.x, ROUTE_SPOT.z - q.z) > 6, "overlaps another spot");
  for (const q of [...LAMPS, ...SIGNS]) assert.ok(Math.hypot(ROUTE_SPOT.x - q.x, ROUTE_SPOT.z - q.z) > 2.5);
  assert.ok(Math.abs(ROUTE_SPOT.x) < WORLD_HALF - 2 && ROUTE_REACH_SERVER > 3);
  const rnd = makeRng(21).next; const correct = [0, 0], twoGate = [0, 0]; let twoWins = 0; const N = 6000;
  for (let i = 0; i < N; i++) {
    const q = makeRoute(rnd);
    assert.deepEqual(validateRoute(q), [], q.text);
    assert.ok(Math.abs(q.a * q.b / 100 - q.c) >= ROUTE_MIN_GAP);
    correct[q.correctIndex]++; twoGate[q.twoGateIndex]++; if (q.correctIndex === q.twoGateIndex) twoWins++;
  }
  assert.ok(correct[0] > N * 0.4 && correct[1] > N * 0.4 && twoGate[0] > N * 0.4 && twoGate[1] > N * 0.4); // no position bias
  assert.ok(twoWins > N * 0.2 && twoWins < N * 0.8, String(twoWins / N));                                      // neither route always wins
  const q = makeRoute(makeRng(3).next);
  assert.ok(validateRoute({ ...q, correctIndex: (1 - q.correctIndex) as 0 | 1 }).length > 0);                  // tampered answer caught
  assert.ok(validateRoute({ ...q, c: q.c + 1 }).length > 0 || validateRoute({ ...q, c: q.c + 1 }).includes("text misses " + (q.c + 1)));
  assert.ok((ROUTE_FLAVOR_WRONG as readonly string[]).includes(routeFlavorWrong(() => 0.99)));
});

import { RACE, raceReward, raceDelay, raceRankOf, raceCanFinish, raceOver } from "../src/index.ts";
test("team race: rewards, ranks, one scoring answer per team, end rule, and race topics produce valid questions", () => {
  assert.equal(raceReward(1), 60); assert.equal(raceReward(2), 40); assert.equal(raceReward(3), 20);
  assert.equal(raceReward(4), 0); assert.equal(raceReward(0), 0); assert.equal(raceReward(-1), 0); assert.equal(raceReward(1.5), 0);
  for (let k = 1; k < RACE.rewards.length; k++) assert.ok(RACE.rewards[k] < RACE.rewards[k - 1]);   // faster pays more
  assert.ok(RACE.rewards.every((n) => n >= 0));                                                       // never a loss
  const r = makeRng(4).next; for (let i = 0; i < 300; i++) { const d = raceDelay(r); assert.ok(d >= RACE.minMs && d <= RACE.maxMs); }
  assert.equal(raceRankOf(["red", "blue"], "blue"), 2); assert.equal(raceRankOf(["red"], "green"), 0);
  assert.ok(raceCanFinish([], "red") && !raceCanFinish(["red"], "red"));
  const t0 = 1000;
  assert.ok(!raceOver(t0, t0 + 25_000, ["red"], ["red", "blue"]));
  assert.ok(raceOver(t0 + 25_000, t0 + 25_000, [], ["red", "blue"]));                               // time up
  assert.ok(raceOver(t0, t0 + 25_000, ["blue", "red"], ["red", "blue"]));                           // everyone finished
  assert.ok(!raceOver(t0, t0 + 25_000, [], []));                                                    // no teams: never "all finished"
  for (const t of RACE.topics) {
    assert.ok((TOPICS as readonly string[]).includes(t));
    for (let s = 1; s <= 120; s++) { const q = generateQuestion(t, RACE.difficulty, s * 104729); assert.equal(validateQuestion(q).length, 0, `${t} seed ${s}`); }
  }
});

import { PING, markAllowed, markActive, markAdd, type Mark } from "../src/index.ts";
test("team ping: cooldown, expiry, newest-3 cap, no mutation", () => {
  assert.ok(markAllowed(0, 10_000) && markAllowed(5000, 5000 + PING.cooldownMs) && !markAllowed(5000, 5000 + PING.cooldownMs - 1));
  const mk = (id: string, at: number): Mark => ({ id, x: 1, z: 2, by: "a", at });
  const l0: Mark[] = []; const l1 = markAdd(l0, mk("a", 1000), 1000);
  assert.equal(l0.length, 0); assert.equal(l1.length, 1);                               // input untouched
  let l = l1; for (const [id, at] of [["b", 2000], ["c", 3000], ["d", 4000]] as const) l = markAdd(l, mk(id, at), at);
  assert.deepEqual(l.map((m) => m.id), ["b", "c", "d"]);                                // cap keeps the newest 3
  assert.deepEqual(markActive(l, 2000 + PING.ttlMs).map((m) => m.id), ["c", "d"]);      // b expired at its ttl
  assert.equal(markAdd(l, mk("e", 20_000), 20_000).length, 1);                          // all older ones expired
  assert.equal(markAdd([mk("a", 1000)], mk("a", 1500), 1500).length, 1);                // same id replaces
});

import { dayKey, dailyTop, BOARD_SIZE, DAY_TZ_MIN } from "../src/index.ts";
test("daily leaderboard: Thai-time day key, best per name, merges duplicates, filters other days and bad rows, caps size", () => {
  // 2026-11-15 23:30 Thai time = 16:30 UTC; 2026-11-16 00:10 Thai time = 17:10 UTC the same date
  const late = Date.UTC(2026, 10, 15, 16, 30), after = Date.UTC(2026, 10, 15, 17, 10);
  assert.equal(dayKey(late), "2026-11-15"); assert.equal(dayKey(after), "2026-11-16");
  assert.equal(dayKey(Date.UTC(2026, 0, 1, 0, 0), 0), "2026-01-01"); assert.equal(DAY_TZ_MIN, 420);
  const T = (name: string, score: number, team = "red") => ({ name, team, score });
  const rows = [
    { at: late, top: [T("นก", 300), T("แมว", 500, "blue"), T("นก", 999)] },     // duplicate name in one match counts once
    { at: late + 1000, top: [T(" นก ", 700, "green"), T("หมา", 0), T("", 50), T("ปลา", NaN)] },
    { at: after, top: [T("นก", 9999)] },                                          // other day
    { at: NaN, top: [T("นก", 9999)] },
  ];
  const copy = JSON.stringify(rows);
  const top = dailyTop(rows, "2026-11-15");
  assert.deepEqual(top.map((r) => [r.name, r.best, r.matches, r.team]), [["นก", 700, 2, "green"], ["แมว", 500, 1, "blue"]]);
  assert.equal(JSON.stringify(rows), copy);                                       // input untouched
  assert.deepEqual(dailyTop(rows, "2026-11-16").map((r) => r.best), [9999]);
  assert.deepEqual(dailyTop([], "2026-11-15"), []);
  const many = [{ at: late, top: Array.from({ length: 30 }, (_, i) => T("p" + i, 100 + i)) }];
  const cap = dailyTop(many, "2026-11-15");
  assert.equal(cap.length, BOARD_SIZE); assert.equal(cap[0].name, "p29"); assert.equal(dailyTop(many, "2026-11-15", 3).length, 3);
  assert.equal(dailyTop(many, "2026-11-15", -1).length, 0);
});

import { DAILY_THEMES, dailyTheme, dailyWeights, dayNumber, nextWeather as nextW, weatherWeights as wW } from "../src/index.ts";
test("daily event: same day same theme, consecutive days differ, all themes appear in 5 days, bad keys fall back", () => {
  assert.equal(dailyTheme("2026-11-15").id, dailyTheme("2026-11-15").id);
  const days = Array.from({ length: 5 }, (_, i) => `2026-11-${String(10 + i).padStart(2, "0")}`);
  assert.equal(new Set(days.map((d) => dailyTheme(d).id)).size, DAILY_THEMES.length);
  for (let i = 0; i < 400; i++) { const a = new Date(Date.UTC(2026, 0, 1 + i)), b = new Date(Date.UTC(2026, 0, 2 + i)); assert.notEqual(dailyTheme(a.toISOString().slice(0, 10)).id, dailyTheme(b.toISOString().slice(0, 10)).id); }
  for (const bad of ["", "x", "2026-13-01", "2026-02-30", "2026-1-1"]) { assert.equal(dayNumber(bad), null); assert.equal(dailyTheme(bad).id, DAILY_THEMES[0].id); }
  assert.equal(dayNumber("1970-01-02"), 1);
  assert.equal(new Set(DAILY_THEMES.map((t) => t.id)).size, DAILY_THEMES.length);
});
test("daily event: weights stay positive and only tilt odds; weatherless modes stay clear; no theme removes a spell", () => {
  for (const t of DAILY_THEMES) {
    for (const mode of ["chaos_night", "ghost_hunt"]) {
      const w = dailyWeights(mode, t), base = wW(mode);
      assert.deepEqual(Object.keys(w).sort(), Object.keys(base).sort());
      for (const v of Object.values(w)) assert.ok((v ?? 0) > 0);
    }
    for (const mode of ["chaos_party", "lobby", "other"]) { assert.deepEqual(dailyWeights(mode, t), {}); assert.equal(nextW(mode, "clear", Math.random, null, { rain: 100 }), "clear"); }
  }
  const drizzle = DAILY_THEMES.find((t) => t.id === "drizzle")!, calm = DAILY_THEMES.find((t) => t.id === "calm")!;
  assert.ok((dailyWeights("chaos_night", drizzle).rain ?? 0) > (wW("chaos_night").rain ?? 0));
  const share = (t: typeof drizzle) => { const w = dailyWeights("chaos_night", t) as Record<string, number>; return w.rain / Object.values(w).reduce((a, b) => a + b, 0); };
  assert.ok(share(drizzle) > share(calm));
  let seed = 7; const r = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  let rain = 0, rainCalm = 0; const N = 4000;
  for (let i = 0; i < N; i++) { if (nextW("chaos_night", "clear", r, null, dailyWeights("chaos_night", drizzle)) === "rain") rain++; if (nextW("chaos_night", "clear", r, null, dailyWeights("chaos_night", calm)) === "rain") rainCalm++; }
  assert.ok(rain > rainCalm);                                                     // the tilt shows up in actual draws
  for (let i = 0; i < 300; i++) assert.ok(nextW("chaos_night", "clear", r, "rain", dailyWeights("chaos_night", drizzle)) !== "rain"); // still never repeats the last spell
  for (const prev of ["fog", "rain", "storm", "wind"] as const) assert.equal(nextW("chaos_night", prev, r, null, dailyWeights("chaos_night", drizzle)), "clear");
});

import { dailyTopic, TOPICS as TOP } from "../src/index.ts";
test("daily topic: same day same topic, consecutive days differ, all topics within a week, bad key falls back", () => {
  assert.equal(dailyTopic("2026-11-15"), dailyTopic("2026-11-15"));
  const week = Array.from({ length: TOP.length }, (_, i) => dailyTopic(`2026-12-${String(1 + i).padStart(2, "0")}`));
  assert.equal(new Set(week).size, TOP.length);
  for (let i = 0; i < 400; i++) assert.notEqual(dailyTopic(new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)), dailyTopic(new Date(Date.UTC(2026, 0, 2 + i)).toISOString().slice(0, 10)));
  for (const bad of ["", "nope", "2026-02-31"]) assert.equal(dailyTopic(bad), TOP[0]);
  for (let i = 0; i < 60; i++) assert.ok(TOP.includes(dailyTopic(new Date(Date.UTC(2027, 0, 1 + i)).toISOString().slice(0, 10))));
});

import { BOSS, bossNeed, startBoss, bossProgress, bossStep, bossState, bossRewards, bossSite, CASE_SPOTS as CS } from "../src/index.ts";
test("boss event: needs enough living players, never repeats the last site, need share is sane", () => {
  const mem = (n: number, role = "human") => Array.from({ length: n }, (_, i) => ({ id: "p" + i, x: 0, z: 0, connected: true, role }));
  assert.equal(startBoss(Math.random, mem(2), null, 0), null);
  assert.equal(startBoss(Math.random, mem(5, "ghost"), null, 0), null);
  assert.equal(startBoss(Math.random, [...mem(2), { id: "d", x: 0, z: 0, connected: false, role: "human" }], null, 0), null);
  for (let i = 0; i < 300; i++) { const b = startBoss(Math.random, mem(4), 2, 1000)!; assert.ok(b.site !== 2 && b.site >= 0 && b.site < CS.length); assert.equal(b.until, 1000 + BOSS.durationMs); assert.equal(b.calmMs, 0); }
  assert.equal(bossNeed(3), 2); assert.equal(bossNeed(2), 2); assert.equal(bossNeed(1), 1); assert.equal(bossNeed(10), 5); assert.equal(bossNeed(40), 20);
});
test("boss event: calm grows only while enough living players are near, ghosts/disconnected never count, steps are capped, input untouched", () => {
  const s = bossSite(1), at = (id: string, d: number, o: Partial<{ connected: boolean; role: string }> = {}) => ({ id, x: s.x + d, z: s.z, connected: true, role: "human", ...o });
  const b0 = { site: 1, startedAt: 0, until: BOSS.durationMs, calmMs: 0, lastAt: 0 };
  const team = [at("a", 1), at("b", 2), at("c", 30), at("d", 40), at("g", 0, { role: "ghost" }), at("x", 0, { connected: false })];
  const p = bossProgress(b0, team);
  assert.equal(p.eligible, 4); assert.equal(p.need, 2); assert.deepEqual(p.insideIds, ["a", "b"]); assert.equal(p.holding, true);
  assert.equal(bossProgress(b0, [at("a", 1), at("c", 30), at("d", 40), at("e", 50)]).holding, false);
  assert.equal(bossProgress(b0, [at("a", 0)]).holding, false);                         // one living player alone never counts
  const copy = JSON.stringify(b0);
  const b1 = bossStep(b0, 400, true); assert.equal(b1.calmMs, 400); assert.equal(JSON.stringify(b0), copy);
  assert.equal(bossStep(b1, 900, false).calmMs, 400);                                  // not holding: no growth
  assert.equal(bossStep(b1, 400 + 60_000, true).calmMs, 400 + BOSS.maxStepMs);         // long gap is capped
  assert.equal(bossStep(b1, 100, true).calmMs, 400);                                   // time never runs backwards
  let b = b0; for (let t = 1; t <= 40; t++) b = bossStep(b, t * 1000, true);
  assert.equal(b.calmMs, BOSS.calmGoalMs); assert.equal(bossState(b, 40_000), "calmed");
  assert.equal(bossState(b0, 100), "running"); assert.equal(bossState(b0, BOSS.durationMs), "expired");
  assert.equal(bossState({ ...b0, calmMs: BOSS.calmGoalMs }, BOSS.durationMs + 5), "calmed"); // calming on the last tick still wins
});
test("boss event: rewards go to living players only, near ones get extra, nobody loses points", () => {
  const r = bossRewards({ eligible: 3, need: 2, insideIds: ["a", "b"], eligibleIds: ["a", "b", "c"], holding: true });
  assert.deepEqual([...r.entries()], [["a", BOSS.rewardAll + BOSS.rewardNear], ["b", BOSS.rewardAll + BOSS.rewardNear], ["c", BOSS.rewardAll]]);
  for (const v of r.values()) assert.ok(v > 0);
  assert.equal(bossRewards({ eligible: 0, need: 0, insideIds: ["z"], eligibleIds: [], holding: false }).size, 0); // a stray id outside the living list gets nothing
});

import { TRADE, checkTrade, inTradeReach, tradeOfferLive, tradePairKey, makeCase as mkCase, newTeamCase as newTC } from "../src/index.ts";
test("clue swap: needs a fair exchange between different teams, respects limits and cooldown, never mutates", () => {
  const c = mkCase(42), ids = c.clues.map((k) => k.id).sort(), a = newTC(), b = newTC(), used = { a: 0, b: 0 };
  assert.ok(ids.length >= 3);
  assert.deepEqual(checkTrade(c, "red", "blue", a, b, used, 0, 1000), { ok: false, reason: "nothing_to_swap" });
  a.found.add(ids[2]);
  assert.deepEqual(checkTrade(c, "red", "blue", a, b, used, 0, 1000), { ok: false, reason: "nothing_to_swap" }); // only one side has something: no one-way gifts
  b.found.add(ids[1]); b.found.add(ids[0]);
  assert.deepEqual(checkTrade(c, "red", "blue", a, b, used, 0, 1000), { ok: true, forA: ids[0], forB: ids[2] }); // lowest id first
  assert.deepEqual(checkTrade(c, "blue", "red", b, a, used, 0, 1000), { ok: true, forA: ids[2], forB: ids[0] }); // symmetric
  assert.equal(a.found.size, 1); assert.equal(b.found.size, 2);                                                  // the check changes nothing
  a.found.add(ids[0]); b.found.add(ids[2]);                                                                      // after the swap A still lacks ids[1] but B has nothing A lacks except that
  assert.deepEqual(checkTrade(c, "red", "blue", a, b, used, 0, 1000), { ok: false, reason: "nothing_to_swap" });
});
test("clue swap: refusal reasons come in a fixed order, bogus clue ids are ignored", () => {
  const c = mkCase(7), ids = c.clues.map((k) => k.id).sort(), a = newTC(), b = newTC(), used = { a: 0, b: 0 };
  a.found.add(ids[0]); b.found.add(ids[1]);
  assert.equal(checkTrade(c, "red", "blue", a, b, used, 0, 5).ok, true);
  assert.deepEqual(checkTrade(c, "", "blue", a, b, used, 0, 5), { ok: false, reason: "no_team" });
  assert.deepEqual(checkTrade(c, "red", "red", a, b, used, 0, 5), { ok: false, reason: "same_team" });
  assert.deepEqual(checkTrade(c, "red", "blue", { ...a, solved: true }, b, used, 0, 5), { ok: false, reason: "solved" });
  assert.deepEqual(checkTrade(c, "red", "blue", a, { ...b, solved: true }, used, 0, 5), { ok: false, reason: "solved" });
  assert.deepEqual(checkTrade(c, "red", "blue", a, b, { a: TRADE.maxPerTeam, b: 0 }, 0, 5), { ok: false, reason: "limit" });
  assert.deepEqual(checkTrade(c, "red", "blue", a, b, { a: 0, b: TRADE.maxPerTeam }, 0, 5), { ok: false, reason: "limit" });
  assert.deepEqual(checkTrade(c, "red", "blue", a, b, used, 100, 99), { ok: false, reason: "cooldown" });
  assert.equal(checkTrade(c, "red", "blue", a, b, used, 100, 100).ok, true);                                    // cooldown is over exactly at its end
  const x = newTC(), y = newTC(); x.found.add("zzz"); y.found.add("qqq");
  assert.deepEqual(checkTrade(c, "red", "blue", x, y, used, 0, 5), { ok: false, reason: "nothing_to_swap" });  // ids that are not clues of this case do not count
});
test("clue swap: reach, offer lifetime and pair key", () => {
  assert.equal(inTradeReach(TRADE.reach, false), true); assert.equal(inTradeReach(TRADE.reach + 0.5, false), false);
  assert.equal(inTradeReach(TRADE.reach + 0.5, true), true); assert.equal(inTradeReach(TRADE.reachServer + 0.1, true), false);
  assert.equal(inTradeReach(NaN, true), false); assert.equal(inTradeReach(Infinity, true), false);
  const o = { from: "a", to: "b", until: 100 };
  assert.equal(tradeOfferLive(o, 99), true); assert.equal(tradeOfferLive(o, 100), false); assert.equal(tradeOfferLive(undefined, 0), false);
  assert.equal(tradePairKey("red", "blue"), tradePairKey("blue", "red"));
  assert.ok(TRADE.reachServer >= TRADE.reach && TRADE.points > 0 && TRADE.maxPerTeam >= 1);
});

import { CLOSURE, closureSite, closureActive, pickClosure, closureStep, CASE_SPOTS as CSP } from "../src/index.ts";
test("closed area: picking avoids last and avoided sites, state follows the clock", () => {
  for (let i = 0; i < 400; i++) { const c = pickClosure(Math.random, 2, 4, 1000); assert.ok(c.site !== 2 && c.site !== 4 && c.site >= 0 && c.site < CSP.length); assert.equal(c.until, 1000 + CLOSURE.durationMs); }
  assert.ok(pickClosure(() => 0, null, null, 0).site >= 0); assert.ok(pickClosure(() => 0.999999, null, null, 0).site < CSP.length);
  const c = pickClosure(Math.random, null, null, 50);
  assert.equal(closureActive(c, 50), true); assert.equal(closureActive(c, c.until - 1), true); assert.equal(closureActive(c, c.until), false);
  assert.equal(closureActive(null, 0), false); assert.equal(closureActive(undefined, 0), false);
});
test("closed area: nobody can enter, sliding along the edge, leaving is allowed, results are finite", () => {
  const c = { site: 1, startedAt: 0, until: 1e9 }, s = closureSite(1), r = CLOSURE.radius, d = (p: { x: number; z: number }) => Math.hypot(p.x - s.x, p.z - s.z);
  const out = { x: s.x + r + 1, z: s.z };
  assert.deepEqual(closureStep(c, out, { x: out.x + 0.2, z: out.z }), { x: out.x + 0.2, z: out.z });         // outside, staying outside: untouched
  const e = closureStep(c, out, { x: s.x + r - 1, z: s.z });                                                 // walking straight in: stops at the edge
  assert.ok(d(e) >= r && d(e) < r + 1e-3);
  for (let i = 0; i < 2000; i++) {                                                                           // random walks starting outside never end up inside
    let p = { x: s.x + r + 2 + Math.random(), z: s.z + (Math.random() - 0.5) * 4 };
    for (let k = 0; k < 60; k++) { const n = closureStep(c, p, { x: p.x + (Math.random() - 0.5) * 1.6 + (s.x - p.x) * 0.1, z: p.z + (Math.random() - 0.5) * 1.6 + (s.z - p.z) * 0.1 }); assert.ok(Number.isFinite(n.x) && Number.isFinite(n.z)); assert.ok(d(n) >= r, "entered the closed area"); p = n; }
  }
  const inside = { x: s.x + 1, z: s.z };                                                                     // already inside when it closed
  assert.deepEqual(closureStep(c, inside, { x: s.x + 0.5, z: s.z }), inside);                                // deeper in: blocked
  assert.deepEqual(closureStep(c, inside, { x: s.x + 2, z: s.z }), { x: s.x + 2, z: s.z });                  // outward: fine
  assert.deepEqual(closureStep(c, inside, { x: s.x + r + 3, z: s.z }), { x: s.x + r + 3, z: s.z });          // and out through the edge
  const centre = closureStep(c, out, { x: s.x, z: s.z });                                                    // exactly the centre: still pushed to the edge, no NaN
  assert.ok(d(centre) >= r && Number.isFinite(centre.x));
});

import { VILLAGE_HEAD, BOXES as BX, TREES as TR, STILT_HOUSES as SH, POND as PD, PUZZLE_ZONE as PZ, LOBBY_CENTER as LC, CASE_SPOTS as CSPOTS, SEARCH_SPOTS as SSPOTS, CRATE as CR, ROUTE_SPOT as RS, DOORS as DR, resolveCollisions as resolveC } from "../src/index.ts";
test("village head NPC stands in free space, away from solids and every mission spot", () => {
  const v = VILLAGE_HEAD, r = resolveC(v.x, v.z, 0.45);
  assert.ok(Math.hypot(r.x - v.x, r.z - v.z) < 1e-9);
  for (const b of BX) assert.ok(Math.max(0, Math.abs(v.x - b.x) - b.hx) + Math.max(0, Math.abs(v.z - b.z) - b.hz) >= 3);
  for (const t of TR) assert.ok(Math.hypot(t.x - v.x, t.z - v.z) - t.r >= 3);
  const spots = [...CSPOTS, ...SSPOTS, CR, RS, PZ, LC, PD, ...SH, ...DR.map((d) => ({ x: d.x, z: d.z }))];
  for (const p of spots) assert.ok(Math.hypot(p.x - v.x, p.z - v.z) >= 3, "too close to a spot");
  assert.ok(v.name.length > 0);
});

import { inAcceptReach, TRADE as TR2, inTradeReach as inReach2 } from "../src/index.ts";
test("clue swap: accepting tolerates a few steps of walking away but not the whole map", () => {
  assert.equal(inAcceptReach(TR2.acceptReach), true); assert.equal(inAcceptReach(TR2.acceptReach + 0.1), false);
  assert.equal(inAcceptReach(NaN), false); assert.equal(inAcceptReach(Infinity), false);
  assert.ok(TR2.acceptReach > TR2.reachServer && inReach2(TR2.reachServer, true) && TR2.offerMs >= 15_000);
});

import { LOST, LOST_ITEMS, pickLostSpot, startLost, lostLive, canTakeLost, lostRewards, lostSiteName, CASE_SPOTS as LCS, SEARCH_SPOTS as LSS, resolveCollisions as lres, WORLD_HALF as LWH } from "../src/index.ts";
test("lost item: every landmark has free ground in its ring, away from solids, landmark circles and mission spots", () => {
  for (let site = 0; site < LCS.length; site++) for (let i = 0; i < 300; i++) {
    const p = pickLostSpot(Math.random, site)!;
    assert.ok(p, "no spot for site " + site);
    assert.ok(Math.abs(p.x) <= LWH - 2 && Math.abs(p.z) <= LWH - 2);
    const r = lres(p.x, p.z, 0.6); assert.ok(Math.hypot(r.x - p.x, r.z - p.z) < 1e-9, "inside a solid");
    for (const c of LCS) assert.ok(Math.hypot(c.x - p.x, c.z - p.z) >= LOST.minR, "inside a landmark circle");
    for (const s of LSS) assert.ok(Math.hypot(s.x - p.x, s.z - p.z) >= 3, "on a search spot");
    assert.ok(Math.hypot(LCS[site].x - p.x, LCS[site].z - p.z) <= LOST.maxR + 1e-9, "too far from its landmark");
  }
  for (const rnd of [() => 0, () => 0.5, () => 0.999999]) for (let site = 0; site < LCS.length; site++) { const p = pickLostSpot(rnd, site); assert.ok(p === null || (Number.isFinite(p.x) && Number.isFinite(p.z))); }
});
test("lost item: start avoids last and avoided landmarks, has a live window, ids and names are sane", () => {
  for (let i = 0; i < 500; i++) {
    const it = startLost(Math.random, 1000, 2, [4, null], i)!;
    assert.ok(it && it.site !== 2 && it.site !== 4); assert.equal(it.until, 1000 + LOST.durationMs); assert.equal(it.id, "lost" + i);
    assert.ok(it.item >= 0 && it.item < LOST_ITEMS.length); assert.ok(lostSiteName(it).length > 0);
  }
  const it = startLost(Math.random, 50, null, [], 1)!;
  assert.equal(lostLive(it, 50), true); assert.equal(lostLive(it, it.until - 1), true); assert.equal(lostLive(it, it.until), false); assert.equal(lostLive(null, 0), false);
  assert.ok(startLost(() => 0, 0, null, [], 0) === null || true);                                                          // degenerate random never throws
  assert.ok(startLost(Math.random, 0, 0, LCS.map((_, i) => i), 0) !== null);                                              // everything "avoided": still starts somewhere
});
test("lost item: only living connected players close enough can take it; rewards go to the finder and living teammates only", () => {
  const it = { id: "lost1", item: 0, site: 0, x: 10, z: 10, startedAt: 0, until: 1000 };
  const at = (d: number, o: Partial<{ role: string; connected: boolean }> = {}) => ({ x: 10 + d, z: 10, role: "human", connected: true, ...o });
  assert.equal(canTakeLost(it, 5, at(LOST.reach), false), true); assert.equal(canTakeLost(it, 5, at(LOST.reach + 0.1), false), false);
  assert.equal(canTakeLost(it, 5, at(LOST.reachServer), true), true); assert.equal(canTakeLost(it, 5, at(LOST.reachServer + 0.1), true), false);
  assert.equal(canTakeLost(it, 1000, at(0), true), false); assert.equal(canTakeLost(null, 0, at(0), true), false);
  assert.equal(canTakeLost(it, 5, at(0, { role: "ghost" }), true), false); assert.equal(canTakeLost(it, 5, at(0, { connected: false }), true), false);
  assert.equal(canTakeLost(it, 5, { x: NaN, z: 0, role: "human", connected: true }, true), false);
  const m = [{ id: "a", team: "red", connected: true, role: "human" }, { id: "b", team: "red", connected: true, role: "human" }, { id: "c", team: "red", connected: false, role: "human" },
    { id: "d", team: "red", connected: true, role: "ghost" }, { id: "e", team: "blue", connected: true, role: "human" }, { id: "f", team: "", connected: true, role: "human" }];
  assert.deepEqual([...lostRewards("a", m).entries()], [["a", LOST.reward], ["b", LOST.teamReward]]);
  assert.deepEqual([...lostRewards("f", m).entries()], [["f", LOST.reward]]);                                                // no team: only the finder
  assert.equal(lostRewards("zzz", m).size, 0);
  for (const v of lostRewards("e", m).values()) assert.ok(v > 0);
});
