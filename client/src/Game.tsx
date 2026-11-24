import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Vector3, type Group } from "three";
import type { Room } from "colyseus.js";
import { LOST, VILLAGE_HEAD, closureStep, closureActive, TRADE, WEATHER, surfaceAt, EMOTES, MAX_PLAYERS, GHOST_KINDS, ABILITY_NAMES, TEAMS, WALK_SPEED, RUN_SPEED, clampWorld, PUZZLE_ZONE, PUZZLE_RADIUS, EVIDENCE_REACH, CRATE, CRATE_REACH, dropZoneFor, DROP_REACH, HELP, resolveCollisions, PLAYER_RADIUS, POND, FISHING, CHAOS_ROUNDS, CASE_SPOTS, CASE, SUSPECTS, SEARCH_SPOTS, SEARCH_REACH, DOORS, DOOR_REACH, markAdd, markActive, type Mark, ROUTE_SPOT, ROUTE_REACH, GADGET, SECRET, pickRivalTarget, tripRules, type Rival } from "../../shared/src/index.ts";
import { lookOf, type Snapshot } from "./net.ts";
import { input, axis, bindKeyboard } from "./input.ts";
import { World } from "./World.tsx";
import { Avatar, newMotion } from "./Avatar.tsx";
import { Controls } from "./Controls.tsx";
import { EvidenceOrb, AIGhost, PartyOrb, ClueMark, SearchMark, RouteMark, BossMark, ClosureMark, LostMark, VillageHead, PingMark, GadgetMark, LooseCrate } from "./Actors.tsx";
import { CaseBoard, emptyCase, type CaseView } from "./CaseBoard.tsx";
import { Quiz } from "./Quiz.tsx";
import { Cook } from "./Cook.tsx";
import { COOK, COOK_STATION } from "../../shared/src/index.ts";
import { Splash } from "./Splash.tsx";
import { audio, footstep } from "./audio.ts";
import { PlayerShadows } from "./Scenery.tsx";
import { Mystery } from "./Mystery.tsx";
import { Results } from "./Results.tsx";
import { Menu } from "./Menu.tsx";
import { Lobby } from "./Lobby.tsx";
import { settings } from "./settings.ts";
import { doorOpen, doorLocked } from "./doorState.ts";
import { LockPuzzle } from "./LockPuzzle.tsx";
import { RoutePuzzle } from "./RoutePuzzle.tsx";
import { RacePuzzle, type RaceInfo } from "./RacePuzzle.tsx";
import type { Look } from "./look.ts";

const colorOf = (team: string) => TEAMS.find((t) => t.id === team)?.color ?? "#999";

/** The closed area of the moment (M3.8), shared by the walking code and the message handlers. null = nothing closed. */
const closureNow = { v: null as { site: number; startedAt: number; until: number } | null };
/** The lost item of the moment (L3), read by the walking code to offer the pick-up button. null = none. */
const lostNow = { v: null as { x: number; z: number; until: number } | null };
type Target = { kind: "cook" } | { kind: "fish" } | { kind: "puzzle" } | { kind: "crate" } | { kind: "drop" } | { kind: "help"; id: string } | { kind: "evidence"; id: string } | { kind: "clue"; id: string } | { kind: "search"; id: string } | { kind: "door"; id: string } | { kind: "lockdoor"; id: string } | { kind: "route" } | { kind: "gadget"; id: string } | { kind: "hit" } | { kind: "trade"; id: string } | { kind: "lost" } | null;
function LocalPlayer({ room, team, look, acc, emote, ghost, mode, relay, fishing, cooking, night, weather, open, foundClues, searched, onTarget, onInteract }: { room: Room; team: string; look: Look; acc: string; emote?: string; ghost: boolean; mode: string; relay: boolean; fishing: boolean; cooking: boolean; night: boolean; weather: string; open: boolean; foundClues: string[]; searched: string[]; onTarget: (t: Target) => void; onInteract: (t: Target) => void }) {
  const g = useRef<Group>(null);
  const me = (room.state as any).players.get(room.sessionId);
  const st = useRef({ x: me?.x ?? 0, y: 0, z: me?.z ?? 12, vy: 0, ry: 0, sendAt: 0, key: "", air: false, stepDist: 0 });
  const camPos = useRef(new Vector3());
  const motion = useRef(newMotion());
  useEffect(() => room.onMessage("correct", (m: { x: number; z: number }) => { st.current.x = m.x; st.current.z = m.z; }), [room]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05), s = st.current;
    const mePl = (room.state as any).players.get(room.sessionId);
    const px = s.x, pz = s.z;
    const hunt = mode !== "chaos_party"; // puzzle, evidence and help exist only in Ghost Hunt; the crate also in the Chaos Party relay round
    if (!input.blocked) {
      const a = axis();
      const fx = -Math.sin(input.yaw), fz = -Math.cos(input.yaw); // away from the camera
      const rx = Math.cos(input.yaw), rz = -Math.sin(input.yaw);
      const dx = fx * a.z + rx * a.x, dz = fz * a.z + rz * a.x;
      const sp = (input.run ? RUN_SPEED : WALK_SPEED) * (mePl?.scared ? 0.7 : 1) * (WEATHER[weather as keyof typeof WEATHER]?.walkMul ?? 1); // startled players move slower for a few seconds
      if (Math.hypot(dx, dz) > 0.01) {
        s.x = clampWorld(s.x + dx * sp * dt); s.z = clampWorld(s.z + dz * sp * dt);
        s.ry = Math.atan2(dx, dz);
      }
      { const cl = closureNow.v; if (cl && !ghost && closureActive(cl, Date.now())) { const c = closureStep(cl, { x: px, z: pz }, { x: s.x, z: s.z }); s.x = c.x; s.z = c.z; } } // closed area: same rule as the server
      { const c = resolveCollisions(s.x, s.z, PLAYER_RADIUS); s.x = c.x; s.z = c.z; } // client-side: do not walk through buildings and trees
      if (input.jump && s.y === 0) { s.vy = 6.5; audio.sfx("jump"); }
    }
    input.jump = false;
    s.vy -= 18 * dt; s.y = Math.max(0, s.y + s.vy * dt); if (s.y === 0) s.vy = Math.max(0, s.vy);
    { const m = motion.current; m.speed = Math.hypot(s.x - px, s.z - pz) / Math.max(dt, 1e-3); m.air = s.y > 0.08; m.carrying = !!mePl?.carrying; m.fishing = !!mePl?.fishing; m.scared = !!mePl?.scared; }
    { // footsteps on the surface under the player, jump landing thud
      const moved = Math.hypot(s.x - px, s.z - pz), airNow = s.y > 0.05;
      if (s.air && !airNow) audio.sfx("land");
      s.air = airNow;
      if (!airNow && moved > 0.001 && !input.blocked) { s.stepDist += moved; if (s.stepDist >= (input.run ? 1.9 : 1.4)) { s.stepDist = 0; footstep(surfaceAt(s.x, s.z)); } }
    }

    let target = null as Target; // later checks override earlier ones: evidence > help > crate/drop > puzzle
    if (!ghost && mode !== "lobby") { // no mission targets while waiting in the lobby
      if (hunt && Math.hypot(s.x - PUZZLE_ZONE.x, s.z - PUZZLE_ZONE.z) <= PUZZLE_RADIUS) target = { kind: "puzzle" };
      if ((hunt || relay) && !mePl?.carrying && Math.hypot(s.x - CRATE.x, s.z - CRATE.z) <= CRATE_REACH) target = { kind: "crate" };
      if ((hunt || relay) && mePl?.carrying) { const dz = dropZoneFor(team); if (Math.hypot(s.x - dz.x, s.z - dz.z) <= DROP_REACH + 2) target = { kind: "drop" }; }
      if (fishing && Math.hypot(s.x - POND.x, s.z - POND.z) <= FISHING.reach) target = { kind: "fish" };
      if (cooking && Math.hypot(s.x - COOK_STATION.x, s.z - COOK_STATION.z) <= COOK.reach) target = { kind: "cook" };
      if (relay && !mePl?.carrying) (room.state as any).crates?.forEach((c: any) => { if (c.active && Math.hypot(s.x - c.x, s.z - c.z) <= GADGET.pickReach) target = { kind: "crate" }; }); // a knocked-off crate
      if ((relay || fishing) && !mePl?.gadget) (room.state as any).gadgets?.forEach((g: any, id: string) => { if (g.active && Math.hypot(s.x - g.x, s.z - g.z) <= GADGET.pickReach) target = { kind: "gadget", id }; });
      if ((relay || fishing) && mePl?.gadget) { // holding a gadget with a rival in range: the interact button throws it
        const others: Rival[] = [];
        (room.state as any).players.forEach((q: any, id: string) => { if (id !== room.sessionId) others.push({ id, x: q.x, z: q.z, team: q.team, connected: q.connected, role: q.role, carrying: q.carrying, fishing: q.fishing }); });
        if (pickRivalTarget({ x: s.x, z: s.z, team }, others, relay ? "relay" : "fishing")) target = { kind: "hit" };
      }
      (room.state as any).players.forEach((p: any, id: string) => {
        if (hunt && id !== room.sessionId && p.scared && p.team === team && p.role !== "ghost" && Math.hypot(s.x - p.x, s.z - p.z) <= HELP.reach) target = { kind: "help", id };
      });
      { const l = lostNow.v; if (hunt && !ghost && l && Date.now() < l.until && Math.hypot(s.x - l.x, s.z - l.z) <= LOST.reach) target = { kind: "lost" }; } // lost item close by (L3)
      if (hunt) CASE_SPOTS.forEach((c, i) => { if (!foundClues.includes("c" + i) && Math.hypot(s.x - c.x, s.z - c.z) <= CASE.reach) target = { kind: "clue", id: "c" + i }; });
      if (hunt) DOORS.forEach((d) => { if (Math.hypot(s.x - d.x, s.z - d.z) <= DOOR_REACH) target = { kind: doorLocked[d.id] ? "lockdoor" : "door", id: d.id }; });
      if (hunt && Math.hypot(s.x - ROUTE_SPOT.x, s.z - ROUTE_SPOT.z) <= ROUTE_REACH) target = { kind: "route" };
      if (hunt) SEARCH_SPOTS.forEach((o) => { if (!searched.includes(o.id) && Math.hypot(s.x - o.x, s.z - o.z) <= SEARCH_REACH) target = { kind: "search", id: o.id }; });
      let best = EVIDENCE_REACH;
      (room.state as any).evidence.forEach((e: any, id: string) => {
        const d = Math.hypot(s.x - e.x, s.z - e.z);
        if (e.active && d <= best) { best = d; target = { kind: "evidence", id }; }
      });
      if (hunt && foundClues.length > 0) (room.state as any).players.forEach((p: any, id: string) => { // rival player close by: offer a clue swap (M3.10). Checked last so a door, clue spot or orb nearby cannot hide it (v0.46.2)
        if (id !== room.sessionId && p.connected && p.role !== "ghost" && p.team && p.team !== team && Math.hypot(s.x - p.x, s.z - p.z) <= TRADE.reach) target = { kind: "trade", id };
      });
    }
    const key = target ? (target as any).kind + ((target as any).id ?? "") : "";
    if (key !== s.key) { s.key = key; onTarget(target); }
    if (input.interact) { input.interact = false; if (target && !open) onInteract(target); }

    if (g.current) { g.current.position.set(s.x, s.y, s.z); g.current.rotation.y = s.ry; }
    const t = state.clock.elapsedTime;
    if (t - s.sendAt > 0.1) {
      s.sendAt = t;
      room.send("move", { x: +s.x.toFixed(2), y: +s.y.toFixed(2), z: +s.z.toFixed(2), ry: +s.ry.toFixed(2) });
    }
    const pitch = 0.5, d = 9;
    camPos.current.set(s.x + Math.sin(input.yaw) * Math.cos(pitch) * d, s.y + 1.5 + Math.sin(pitch) * d, s.z + Math.cos(input.yaw) * Math.cos(pitch) * d);
    state.camera.position.lerp(camPos.current, 1 - Math.exp(-12 * dt));
    state.camera.lookAt(s.x, s.y + 1.2, s.z);
  });
  return <Avatar ref={g} color={colorOf(team)} team={team} look={look} acc={acc} ghost={ghost} lantern={night} emote={emote} motion={motion.current} />;
}

function RemotePlayer({ room, id, team, look, acc, name, ghost, emote }: { room: Room; id: string; team: string; look: Look; acc: string; name: string; ghost: boolean; emote?: string }) {
  const g = useRef<Group>(null);
  const placed = useRef(false);
  const motion = useRef(newMotion());
  const last = useRef({ x: 0, z: 0 });
  const [lod, setLod] = useState<"high" | "low">("high");
  useFrame((state, dt) => {
    const p = (room.state as any).players.get(id);
    if (!p || !g.current) return;
    if (!placed.current) { g.current.position.set(p.x, p.y, p.z); g.current.rotation.y = p.ry; last.current = { x: p.x, z: p.z }; placed.current = true; return; } // appear where they are, do not fly in from the origin
    const k = 1 - Math.exp(-10 * Math.min(dt, 0.1)); // smooth toward the latest server position
    g.current.position.x += (p.x - g.current.position.x) * k;
    g.current.position.y += (p.y - g.current.position.y) * k;
    g.current.position.z += (p.z - g.current.position.z) * k;
    let d = p.ry - g.current.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    g.current.rotation.y += d * k;
    // animation inputs come from how far the displayed position moved and from the shared state flags
    const m = motion.current;
    m.speed = Math.hypot(g.current.position.x - last.current.x, g.current.position.z - last.current.z) / Math.max(dt, 1e-3);
    last.current.x = g.current.position.x; last.current.z = g.current.position.z;
    m.air = g.current.position.y > 0.08; m.carrying = !!p.carrying; m.fishing = !!p.fishing; m.scared = !!p.scared;
    // level of detail by distance to the camera (hysteresis avoids flicker); fewer details on weaker graphics settings
    const thr = settings.quality === "high" ? 45 : settings.quality === "medium" ? 26 : 13;
    const dist = Math.hypot(state.camera.position.x - g.current.position.x, state.camera.position.z - g.current.position.z);
    if (lod === "high" && dist > thr + 3) setLod("low"); else if (lod === "low" && dist < thr - 3) setLod("high");
  });
  return <Avatar ref={g} color={colorOf(team)} team={team} look={look} acc={acc} name={name} ghost={ghost} emote={emote} motion={motion.current} lod={lod} />;
}

export function Game({ room, snap }: { room: Room; snap: Snapshot }) {
  const [target, setTarget] = useState<Target>(null);
  const [fishState, setFishState] = useState<"idle" | "waiting" | "bite">("idle");
  const [ready, setReady] = useState(false); // 3D scene created (plus a short minimum so the splash does not flash)
  const [menu, setMenu] = useState(false);
  const [earned, setEarned] = useState<number | null>(null);
  const [quality, setQuality] = useState(settings.quality);
  const [, bump] = useState(0);
  const [dark, setDark] = useState(false);
  const [flash, setFlash] = useState(false); // lightning flash
  const [scare, setScare] = useState(false);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [cs, setCs] = useState<CaseView>(emptyCase); // this team's detective board (clue texts arrive from the server only when found)
  const [caseOpen, setCaseOpen] = useState(false);
  const [earnedAchievements, setEarnedAchievements] = useState<string[]>([]); // achievement ids unlocked in this match
  const [invite, setInvite] = useState<{ from: string; name: string; until: number } | null>(null); // a rival asked me to swap clues (M3.10)
  const [closed, setClosed] = useState<{ site: string; x: number; z: number; r: number; until: number } | null>(null); // closed area of the moment (M3.8)
  useEffect(() => () => { closureNow.v = null; lostNow.v = null; }, []);
  const [lostView, setLostView] = useState<{ id: string; name: string; icon: string; site: string; x: number; z: number; until: number } | null>(null); // lost item event (L3), public to the whole room
  const [headTalk, setHeadTalk] = useState(false); const headTimer = useRef(0); // the village head shows a megaphone while an announcement is fresh (M3.8)
  const headSpeak = () => { setHeadTalk(true); window.clearTimeout(headTimer.current); headTimer.current = window.setTimeout(() => setHeadTalk(false), 8000); };
  useEffect(() => () => window.clearTimeout(headTimer.current), []);
  const [boss, setBoss] = useState<{ site: string; x: number; z: number; until: number; goalMs: number; calmMs: number; inside: number; need: number; radius: number } | null>(null); // boss event, public to the whole room (I3)
  const [secret, setSecret] = useState<{ site: string; until: number; need: number } | null>(null); // my team's secret mission (private)
  const [trip, setTrip] = useState(0); // time (ms) when the crate I carry is lost; 0 = no trip
  const [note, setNote] = useState<{ name: string; text: string } | null>(null); // story note from a searched object
  const [searched, setSearched] = useState<string[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]); // teammate pings (M3.12)
  useEffect(() => { const t = setInterval(() => setMarks((l) => { const a = markActive(l, Date.now()); return a.length === l.length ? l : a; }), 1000); return () => clearInterval(t); }, []);
  const [race, setRace] = useState<RaceInfo | null>(null); // running team math race (M6.3)
  const [raceOpen, setRaceOpen] = useState(false);
  const [raceEnd, setRaceEnd] = useState<{ correctIndex: number; solution: string[] } | null>(null);
  const [routeOpen, setRouteOpen] = useState(false); // crossroad question open (M6.2)
  const [lockDoor, setLockDoor] = useState<string | null>(null); // locked house door whose question is open (M6.2)
  const foundClues = useMemo(() => cs.clues.map((k) => k.id), [cs.clues]);
  const touch = useMemo(() => matchMedia("(pointer: coarse)").matches, []);
  const drag = useRef<{ x: number } | null>(null);
  const me = snap.players.find((p) => p.id === room.sessionId);
  const isGhost = me?.role === "ghost";
  const lobby = !snap.started;
  const playing = snap.started;
  const party = playing && snap.mode === "chaos_party";
  const night = playing && snap.mode === "chaos_night";
  const [cookOpen, setCookOpen] = useState(false); // cooking sheet (round 5)
  const [quizOpen, setQuizOpen] = useState(true); // the quiz sheet can be hidden so finished players can walk around
  const [emoteOpen, setEmoteOpen] = useState(false);
  const [panel, setPanel] = useState(true); // lobby panel (mode, teams, character); closed = free to run around
  const [emotes, setEmotes] = useState<Record<string, string>>({});
  const readyCount = snap.players.filter((p) => p.team && p.ready).length;
  const quizOn = party && snap.phase === "quiz";
  const [cd, setCd] = useState<Record<string, number>>({}); // ability -> time it becomes ready (ms)
  const [now, setNow] = useState(Date.now());
  const castAbility = (name: string) => { if ((cd[name] ?? 0) <= Date.now() && !input.blocked) room.send("ability", { name }); };

  useEffect(() => bindKeyboard(), []);

  // ---- sound: ambience and music follow the scene, sound effects follow server messages ----
  useEffect(() => { audio.ambience(night ? "night" : "day"); }, [night]);
  useEffect(() => { audio.weather(snap.weather); return () => audio.weather("clear"); }, [snap.weather, night]);
  useEffect(() => { audio.music(lobby ? "lobby" : snap.specialActive || dark ? "event" : party ? "party" : night ? "night" : "day"); }, [lobby, party, night, snap.specialActive, dark]);
  useEffect(() => () => { audio.ambience("off"); audio.music("off"); }, []);
  useEffect(() => {
    const on = (type: string, fn: (m: any) => void) => room.onMessage(type, fn);
    const offs = [
      on("collected", () => audio.sfx("collect")), on("party:orb", () => audio.sfx("orb")), on("picked", () => audio.sfx("pickup")),
      on("delivered", () => audio.sfx("success")), on("helped", () => audio.sfx("success")), on("sheltered", () => audio.sfx("success")),
      on("teamwork", () => audio.sfx("fanfare")), on("ended", () => audio.sfx("fanfare")), on("round:result", () => audio.sfx("roundEnd")),
      on("scare", () => audio.sfx("scare")), on("emote", () => audio.sfx("pop")),
      on("quiz:result", (m) => audio.sfx(m.correct ? "correct" : "wrong")),
      on("fish:state", (m) => audio.sfx(m.state === "bite" ? "bite" : "cast")), on("fish:result", (m) => audio.sfx(m.caught ? "catch" : "miss")),
      on("event", (m) => audio.sfx(m.kind === "nightfall" ? "alarm" : m.kind === "blackout" ? "blackout" : m.kind === "special" ? "special" : "whisper")),
    ];
    return () => offs.forEach((off) => off());
  }, [room]);
  useEffect(() => { // countdown ticks: last 3 s of the party intro/breaks, last 10 s of a hunt match
    if (!snap.started || snap.ended) return;
    const left = party ? (snap.phase === "intro" || snap.phase === "break" ? snap.phaseLeft : 99) : snap.secondsLeft;
    if (left > 0 && left <= (party ? 3 : 10)) audio.sfx("tick");
  }, [snap.phaseLeft, snap.secondsLeft]);
  useEffect(() => {
    if (!isGhost) return;
    const k = (e: KeyboardEvent) => { const n = ABILITY_NAMES[Number(e.key) - 1]; if (n) castAbility(n); };
    const iv = setInterval(() => setNow(Date.now()), 250);
    addEventListener("keydown", k);
    return () => { removeEventListener("keydown", k); clearInterval(iv); };
  });
  useEffect(() => room.onMessage("ability:result", (m: any) => {
    if (m.ok) { setCd((c) => ({ ...c, [m.name]: Date.now() + m.cooldownMs })); setMsg(m.points ? `ทำให้ตกใจสำเร็จ +${m.points} คะแนน` : "ใช้พลังแล้ว"); }
    else setMsg(m.reason === "no_target" ? "ไม่มีเป้าหมายใกล้พอ (ต้องเป็นคนต่างทีม)" : "พลังยังไม่พร้อม");
  }), [room]);
  useEffect(() => { input.blocked = open || menu || (quizOn && quizOpen) || (lobby && panel) || caseOpen || cookOpen; if (open || menu || (quizOn && quizOpen) || (lobby && panel) || caseOpen || cookOpen) { input.jx = 0; input.jz = 0; input.keys.clear(); } }, [open, menu, quizOn, quizOpen, lobby, panel, caseOpen, cookOpen]);
  useEffect(() => () => { input.blocked = false; }, []);
  useEffect(() => {
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
    const offs = [
      room.onMessage("weather", (m: { kind: string }) => { const w = WEATHER[m.kind as keyof typeof WEATHER]; if (w) setMsg(`${w.icon} ${w.start}`); }),
      room.onMessage("lightning", (m: { x: number; z: number }) => {
        setFlash(true); later(() => setFlash(false), 350);
        const p = (room.state as any).players.get(room.sessionId), d = p ? Math.hypot(p.x - m.x, p.z - m.z) : 30;
        audio.sfx("crack"); later(() => audio.sfx("thunder"), Math.min(2500, d * 45)); // sound travels slower than light
      }),
      room.onMessage("emote", (m: { id: string; e: string }) => {
        setEmotes((x) => ({ ...x, [m.id]: m.e }));
        later(() => setEmotes((x) => { if (x[m.id] !== m.e) return x; const n = { ...x }; delete n[m.id]; return n; }), 2500);
      }),
      room.onMessage("collected", (m: { gained: number }) => setMsg(`เก็บได้ +${m.gained} คะแนน`)),
      room.onMessage("earned", (m: { baht: number }) => setEarned(m.baht)),
      room.onMessage("party:orb", (m: { gained: number }) => setMsg(`เก็บลูกแก้ว +${m.gained}`)),
      room.onMessage("round:result", (m: any) => setMsg(m.winner ? `จบ${m.title}: ${m.teams.find((t: any) => t.id === m.winner)?.name} ชนะ (+${m.bonus} คะแนนต่อคน)` : `จบ${m.title}: เสมอ ไม่มีโบนัส`)),
      room.onMessage("sheltered", (m: { gained: number }) => setMsg(`หลบความมืดทัน +${m.gained} คะแนน`)),
      room.onMessage("fish:state", (m: { state: "waiting" | "bite" }) => { setFishState(m.state); if (m.state === "waiting") setMsg("เหวี่ยงเบ็ดแล้ว รอปลากิน…"); }),
      room.onMessage("fish:result", (m: any) => {
        setFishState("idle");
        setMsg(m.caught ? `${m.fish.icon} ได้${m.fish.name}! +${m.gained} คะแนน` : m.reason === "disrupted" ? "เบ็ดถูกกวน! ปลาหนีไปแล้ว (ไม่เสียคะแนน)" : m.reason === "early" ? "ดึงเร็วไป ปลาหนีไปแล้ว (ไม่เสียคะแนน)" : "ช้าไป ปลาหลุดแล้ว (ไม่เสียคะแนน)");
      }),
      room.onMessage("picked", (m: any) => { setTrip(m?.tripMs ? Date.now() + m.tripMs : 0); setNow(Date.now()); setMsg(m?.loose ? "แย่งลังมาได้แล้ว! รีบไปส่งที่วงสีทีม" : `หยิบของแล้ว! ส่งที่วงสีทีมภายใน ${Math.round((m?.tripMs ?? 0) / 1000)} วินาที`); }),
      room.onMessage("delivered", (m: { gained: number; cooldownMs?: number }) => { setTrip(0); setMsg(`ส่งของสำเร็จ +${m.gained} คะแนน${m.cooldownMs ? ` (พัก ${Math.round(m.cooldownMs / 1000)} วินาทีก่อนรอบใหม่)` : ""}`); }),
      room.onMessage("trip:expired", () => { setTrip(0); setMsg("หมดเวลา! ลังหลุดมือแล้ว รอพักสั้นๆ แล้วไปหยิบใหม่ได้"); }),
      room.onMessage("gadget:got", () => { audio.sfx("pickup"); setMsg(`ได้ ${GADGET.icon} ${GADGET.name}! เข้าใกล้คู่แข่งที่ถือลังหรือกำลังตกปลา แล้วกดโต้ตอบเพื่อปา`); }),
      room.onMessage("gadget:result", (m: any) => setMsg(m.ok ? `ปาโดน ${m.hit}! ${m.what === "crate" ? "ลังหลุดมือ" : "เบ็ดถูกกวน"} +${m.gained} คะแนน` : "ไม่มีคู่แข่งในระยะ (ต้องต่างทีมและถือลัง/กำลังตกปลา) ยังไม่เสียลูกตะกร้อ")),
      room.onMessage("gadget:hit", (m: any) => { setTrip(0); audio.sfx("wrong"); setMsg(m.what === "crate" ? `${m.by} ปาลูกตะกร้อใส่! ลังหลุดมือ รีบแย่งกลับ` : `${m.by} ปาลูกตะกร้อกวนเบ็ดของคุณ!`); }),
      room.onMessage("gadget:fx", (m: any) => { const mine = (room.state as any).players.get(room.sessionId)?.name; if (m.by !== mine && m.to !== mine) setMsg(`${m.by} ปาลูกตะกร้อใส่ ${m.to}! ${m.what === "crate" ? "ลังหลุดมือ" : "เบ็ดถูกกวน"}`); }),
      room.onMessage("helped", (m: { gained: number }) => setMsg(`ช่วยเพื่อนแล้ว +${m.gained} คะแนน`)),
      room.onMessage("teamwork", (m: { gained: number }) => setMsg(`โบนัสทีมเวิร์ก +${m.gained} คะแนน!`)),
      room.onMessage("error", (m: any) => { if (m.code === "too_far") setMsg("ไปยืนในวงสีเหลืองหน้าโรงเรียนก่อน"); else if (m.code === "delivery_wait") setMsg(`พักอีก ${Math.max(1, Math.ceil((m.waitMs ?? 1000) / 1000))} วินาทีก่อนหยิบของรอบใหม่`); else if (m.code === "help_cap") setMsg("ช่วยเพื่อนได้คะแนนสูงสุดแล้ว"); else if (m.code === "not_ready") setMsg("ยังมีคนไม่พร้อมหรือยังไม่ได้เลือกทีม"); else if (m.code === "need_human") setMsg("ต้องมีผู้เล่นฝ่ายมนุษย์อย่างน้อย 1 คน"); else if (m.code === "too_many_ghosts") setMsg("จำนวนผีเกินสัดส่วน (1 ตัวต่อ 8 คน)"); }),
      room.onMessage("scare", (m: { by?: string }) => { setScare(true); setMsg(m?.by === "lightning" ? "ฟ้าผ่าใกล้ตัว! ตกใจนิดหน่อย ไม่เสียคะแนน" : `${GHOST_KINDS[(m?.by ?? "lantern") as keyof typeof GHOST_KINDS]?.name ?? "ผี"}โผล่มาทักทาย! ไม่เป็นอันตราย`); later(() => setScare(false), 1400); }),
      room.onMessage("event", (m: { kind: string; ms?: number }) => {
        if (m.kind === "blackout") { setDark(true); setMsg("ไฟดับ! หาแสงสีฟ้าของหลักฐานไว้"); later(() => setDark(false), m.ms ?? 6000); }
        else if (m.kind === "nightfall") setMsg(`ไฟกำลังจะดับใน ${(m as any).seconds ?? 10} วินาที! รีบกลับวงสีทีมหน้าบ้านทีม`);
        else if (m.kind === "windmove") setMsg("ลมพัดโคมทองไปที่อื่นแล้ว!");
        else if (m.kind === "special") setMsg(`ภารกิจพิเศษ! โคมทองปรากฏแล้ว หาให้เจอใน ${(m as any).seconds ?? 60} วินาที (+150)`);
        else setMsg("ได้ยินเสียงกระซิบแว่วมาจากทุ่งนา…");
      }),
    ];
    return () => { offs.forEach((off) => off()); timers.forEach(clearTimeout); };
  }, [room]);
  useEffect(() => { // detective case messages (the culprit is only ever sent to a team that has named it)
    const nameOf = (id: string) => SUSPECTS.find((s) => s.id === id)?.name ?? "";
    const offs = [
      room.onMessage("case:board", (m: any) => setCs((c) => ({ ...c, clues: Array.isArray(m?.clues) ? m.clues : [], solved: !!m?.solved, culprit: String(m?.culprit ?? "") }))),
      room.onMessage("case:clue", (m: any) => {
        setCs((c) => (c.clues.some((k) => k.id === m.id) ? c : { ...c, clues: [...c.clues, { id: m.id, attr: m.attr, text: m.text }] }));
        audio.sfx("collect");
        setMsg(m.byId === room.sessionId ? `พบเบาะแส +${m.gained}: ${m.text}` : `${m.by} พบเบาะแสให้ทีม: ${m.text}`);
      }),
      room.onMessage("case:result", (m: any) => {
        if (m.ok) {
          const note = `ชี้ถูก! ผีตัวการคือ${nameOf(m.culprit)} (${m.by} เป็นคนชี้) ทุกคนในทีมได้ +${m.gained} คะแนน (ทีมที่ไขได้เป็นอันดับ ${m.rank})`;
          setCs((c) => ({ ...c, solved: true, culprit: m.culprit, note })); setMsg(note); audio.sfx("fanfare");
        } else {
          const note = m.reason === "need_clues" ? `ต้องตัดตัวต้องสงสัยให้เหลือไม่เกิน ${CASE.maxRemainingToAccuse} ตนก่อนจึงจะชี้ตัวได้ หาเบาะแสเพิ่ม`
            : m.reason === "cooldown" ? `ทีมเพิ่งชี้ไป รออีก ${Math.ceil((m.waitMs ?? 0) / 1000)} วินาที`
            : `${m.by} ชี้${nameOf(m.suspect)} แต่ไม่ใช่ตัวการ (ไม่เสียคะแนน) รอ ${Math.round((m.waitMs ?? 0) / 1000)} วินาทีก่อนชี้ใหม่`;
          setCs((c) => ({ ...c, note })); setMsg(note); if (m.reason === "wrong") audio.sfx("wrong");
        }
      }),
      room.onMessage("achv", (m: any) => { setEarnedAchievements((e) => [...new Set([...e, ...(m.list ?? []).map((a: any) => a.id)])]); audio.sfx("fanfare"); setMsg(`🏅 ปลดล็อกความสำเร็จ: ${(m.list ?? []).map((a: any) => `${a.icon} ${a.name}`).join(", ")}`); }),
      room.onMessage("eerie", (m: any) => { setMsg(`👂 ${m.text}`); audio.sfx(["whisper", "tick", "crack", "pop"].includes(m.sfx) ? m.sfx : "whisper"); }),
      room.onMessage("mark", (m: any) => { const now = Date.now(); setMarks((l) => markAdd(l, { id: String(m.id), x: Number(m.x), z: Number(m.z), by: String(m.by), at: now }, now)); setMsg(`📍 ${m.by} ชี้จุดให้ทีม`); audio.sfx("pop"); }),
      room.onMessage("race:start", (m: any) => { setRace({ text: m.text, choices: m.choices, endAt: Date.now() + Number(m.ms) }); setRaceEnd(null); setMsg("⚡ โจทย์ชิงธง! ทีมที่ตอบถูกเร็วสุดได้คะแนน กดปุ่มมุมขวาบนเพื่อร่วมแข่ง"); audio.sfx("pop"); }),
      room.onMessage("race:team", (m: any) => { const t = TEAMS.find((x) => x.id === m.team); setMsg(`🏁 ${t?.name ?? m.team} ตอบถูกเป็นอันดับ ${m.rank} (${m.by})`); }),
      room.onMessage("race:end", (m: any) => { setRaceEnd({ correctIndex: m.correctIndex, solution: m.solution }); setTimeout(() => { setRace(null); setRaceOpen(false); }, 8000); }),
      room.onMessage("lock", (m: any) => { doorLocked[String(m.id)] = !!m.locked; setMsg(m.locked ? "🔒 มีประตูบ้านถูกล็อก! ไปแก้โจทย์ที่ประตูเพื่อเปิดดูว่าข้างในมีอะไร" : `🔓 ${m.by ?? "ใครสักคน"} ปลดล็อกประตูบ้านแล้ว`); }),
      room.onMessage("door", (m: any) => { doorOpen[String(m.id)] = !!m.open; audio.sfx(m.open ? "pop" : "click"); }),
      room.onMessage("note", (m: any) => { setSearched((a) => (a.includes(m.id) ? a : [...a, m.id])); setNote({ name: m.name, text: m.text }); audio.sfx("pop"); }),
      room.onMessage("news", (m: any) => { headSpeak(); setMsg(`📢 ผู้ใหญ่บ้าน: ${m.text}`); }),
      room.onMessage("secret:mission", (m: any) => { setSecret({ site: m.site, until: Date.now() + (m.ms ?? SECRET.durationMs), need: m.need }); setNow(Date.now()); audio.sfx("pop"); setMsg(`🤫 ภารกิจลับของทีมคุณ: รวมตัวกันอย่างน้อย ${m.need} คนที่${m.site} ภายใน ${Math.round((m.ms ?? SECRET.durationMs) / 1000)} วินาที (+${m.points} ต่อคน)`); }),
      room.onMessage("secret:done", (m: any) => { setSecret(null); audio.sfx("fanfare"); setMsg(`ภารกิจลับสำเร็จ! คนที่อยู่ในจุดได้ +${m.points} คะแนน`); }),
      room.onMessage("secret:fail", () => { setSecret(null); setMsg("ภารกิจลับหมดเวลา (ไม่เสียคะแนน)"); }),
      room.onMessage("trade:sent", (m: any) => setMsg(`🤝 ส่งคำเสนอแลกเบาะแสให้ ${m.to} แล้ว รออีกฝ่ายตอบ`)),
      room.onMessage("trade:invite", (m: any) => { setInvite({ from: m.from, name: m.name, until: Date.now() + (m.ms ?? TRADE.offerMs) }); setNow(Date.now()); audio.sfx("pop"); try { navigator.vibrate?.(80); } catch { /* not supported */ } }),
      room.onMessage("trade:fail", (m: any) => { setInvite(null); setMsg("🤝 " + (m?.reason === "cooldown" && m.waitS ? `ทีมคู่นี้เพิ่งแลกกัน รออีก ${m.waitS} วินาที` : ({ none: "", nothing_to_swap: "ตอนนี้ไม่มีเบาะแสที่แลกกันได้ (ต้องต่างฝ่ายต่างมีของที่อีกฝ่ายยังไม่มี)", cooldown: "ทีมคู่นี้เพิ่งแลกกัน รอสักครู่", limit: "ทีมใช้สิทธิ์แลกเบาะแสครบแล้ว", solved: "ทีมที่ไขคดีได้แล้วไม่แลกเบาะแส", same_team: "ผู้เล่นทีมเดียวกันแชร์เบาะแสกันอยู่แล้ว", no_team: "ยังไม่มีทีม", declined: "อีกฝ่ายปฏิเสธการแลก", expired: "คำเสนอหมดเวลาแล้ว", far: "ห่างกันเกินไป เดินเข้าใกล้กันก่อน" } as Record<string, string>)[String(m?.reason)] ?? "แลกเบาะแสไม่ได้")); }),
      room.onMessage("trade:done", (m: any) => {
        setInvite(null);
        setCs((c) => (c.clues.some((k) => k.id === m.id) ? c : { ...c, clues: [...c.clues, { id: m.id, attr: m.attr, text: m.text }] }));
        audio.sfx("collect");
        setMsg(`🤝 แลกเบาะแสกับทีม${m.withTeam}สำเร็จ${m.byId === room.sessionId ? ` +${m.gained}` : ""}: ${m.text}`);
      }),
      room.onMessage("lost:start", (m: any) => { headSpeak(); const t = Date.now(), ms = Number(m.ms) || 60000; lostNow.v = { x: m.x, z: m.z, until: t + ms }; setLostView({ id: m.id, name: m.name, icon: m.icon, site: m.site, x: m.x, z: m.z, until: t + ms }); setNow(t); audio.sfx("pop"); setMsg(`🔎 ผู้ใหญ่บ้านประกาศ: ${m.name}ของชาวบ้านหายแถว${m.site}! ใครเจอก่อนได้ +${m.reward} (มองหาแสงสีทอง)`); }),
      room.onMessage("lost:end", (m: any) => { lostNow.v = null; setLostView(null); if (m.result === "found") { audio.sfx("collect"); setMsg(`${m.icon} ${m.by} เจอ${m.name}แล้ว! ได้ +${m.reward} เพื่อนร่วมทีมได้ +${m.teamReward}`); } else setMsg(`${m.icon} ${m.name}ที่หายไป ชาวบ้านเจอเองแล้ว (ไม่มีใครเสียคะแนน)`); }),
      room.onMessage("closure:start", (m: any) => { headSpeak(); const t = Date.now(), ms = Number(m.ms) || 30000; closureNow.v = { site: Number(m.id), startedAt: t, until: t + ms }; setClosed({ site: m.site, x: m.x, z: m.z, r: m.r, until: t + ms }); setNow(t); audio.sfx("pop"); setMsg(`🚧 ผู้ใหญ่บ้านประกาศ: ปิด${m.site}ชั่วคราว ${Math.round(ms / 1000)} วินาที เดินเข้าไม่ได้ ไม่เสียคะแนน`); }),
      room.onMessage("closure:end", () => { closureNow.v = null; setClosed(null); setMsg("🚧 เปิดพื้นที่แล้ว"); }),
      room.onMessage("boss:start", (m: any) => { headSpeak(); setBoss({ site: m.site, x: m.x, z: m.z, until: Date.now() + (m.ms ?? 70000), goalMs: m.goalMs ?? 20000, calmMs: 0, inside: 0, need: m.need, radius: m.radius ?? 5 }); setNow(Date.now()); audio.sfx("whisper"); setMsg(`🔥 ผีเจ้าที่โกรธปรากฏที่${m.site}! ทุกทีมช่วยกันไปยืนใกล้ๆ อย่างน้อย ${m.need} คนพร้อมกันเพื่อปลอบ`); }),
      room.onMessage("boss:progress", (m: any) => setBoss((b) => (b ? { ...b, calmMs: m.calmMs, inside: m.inside, need: m.need } : b))),
      room.onMessage("boss:end", (m: any) => { setBoss(null); if (m.result === "calmed") { audio.sfx("fanfare"); setMsg(`ผีเจ้าที่สงบแล้ว! ทุกคน +${m.all} คะแนน คนที่อยู่ใกล้ได้เพิ่มอีก +${m.near}`); } else setMsg("ผีเจ้าที่หายไปเอง (ไม่เสียคะแนน)"); }),
      room.onMessage("case:solved", (m: any) => setMsg(`ทีม${TEAMS.find((t) => t.id === m.team)?.name ?? ""}ไขคดีผีได้เป็นอันดับ ${m.rank}!`)),
    ];
    return () => offs.forEach((off) => off());
  }, [room]);
  useEffect(() => { if (playing) room.send("case:sync"); }, [room, playing]); // after the handlers above exist: also restores the board after a reconnect
  useEffect(() => { if (snap.phase !== "fishing") setFishState("idle"); }, [snap.phase]);
  useEffect(() => { if (snap.phase !== "cooking") setCookOpen(false); }, [snap.phase]);
  useEffect(() => { if (trip <= 0 && !secret && !boss && !invite && !closed && !lostView) return; const iv = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(iv); }, [trip, secret, boss, invite, closed, lostView]); // countdown of the carried crate (the shared clock only ticks for ghosts)
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(null), 9000); return () => clearTimeout(t); }, [note]);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(""), 3500); return () => clearTimeout(t); }, [msg]);
  const evIds = useMemo(() => { const a: string[] = []; (room.state as any).evidence.forEach((_: any, id: string) => a.push(id)); return a; }, [room]);
  const near = target !== null;
  const board = TEAMS.map((t) => ({ ...t, pts: snap.players.filter((p) => p.team === t.id).reduce((s, p) => s + p.score, 0) })).sort((a, b) => b.pts - a.pts);

  return (
    <div className="gamewrap"
      onPointerDown={(e) => { if ((e.target as HTMLElement).tagName === "CANVAS") drag.current = { x: e.clientX }; }}
      onPointerMove={(e) => { if (drag.current) { input.yaw -= (e.clientX - drag.current.x) * 0.006 * settings.sensitivity; drag.current.x = e.clientX; } }}
      onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}>
      <Canvas key={quality} dpr={quality === "low" ? [1, 1] : quality === "medium" ? [1, 1.25] : [1, 1.5]} gl={{ antialias: quality === "high" }} camera={{ fov: 60, position: [0, 8, 40] }} onCreated={() => setTimeout(() => setReady(true), 800)}>
        <World night={night} weather={snap.weather} mode={snap.started ? snap.mode : "lobby"} relay={snap.phase === "relay"} cooking={snap.phase === "cooking"} />
        <PlayerShadows room={room} />
        {me && <LocalPlayer room={room} team={me.team} look={lookOf(me)} acc={me.acc} emote={emotes[room.sessionId]} ghost={isGhost} mode={snap.started ? snap.mode : "lobby"} relay={snap.phase === "relay"} fishing={snap.phase === "fishing"} cooking={snap.phase === "cooking"} night={night} weather={snap.weather} open={open || lockDoor !== null || routeOpen || raceOpen} foundClues={foundClues} searched={searched} onTarget={setTarget} onInteract={(t) => { if (t?.kind === "search") room.send("search", { id: t.id }); else if (t?.kind === "door") room.send("door", { id: t.id }); else if (t?.kind === "lockdoor") setLockDoor(t.id); else if (t?.kind === "route") setRouteOpen(true); else if (t?.kind === "clue") room.send("case:collect", { id: t.id }); else if (t?.kind === "puzzle") { setMsg(""); setOpen(true); } else if (t?.kind === "evidence") room.send("collect", { id: t.id }); else if (t?.kind === "crate") room.send("pickup"); else if (t?.kind === "drop") room.send("deliver"); else if (t?.kind === "help") room.send("help", { id: t.id }); else if (t?.kind === "fish") room.send(fishState === "idle" ? "fish:cast" : "fish:reel"); else if (t?.kind === "cook") { setCookOpen(true); room.send("cook", { a: "start" }); } else if (t?.kind === "gadget") room.send("gadget:take", { id: t.id }); else if (t?.kind === "hit") room.send("gadget:use"); else if (t?.kind === "trade") room.send("trade:offer", { id: t.id }); else if (t?.kind === "lost") room.send("lost:take"); }} />}
        {playing && !party && evIds.map((id) => <EvidenceOrb key={id} room={room} id={id} fog={snap.weather === "fog"} />)}
        {playing && !party && snap.ghosts.map((g) => <AIGhost key={g.id} room={room} id={g.id} kind={g.kind} fog={snap.weather === "fog"} />)}
        {playing && !party && !isGhost && CASE_SPOTS.map((c, i) => (foundClues.includes("c" + i) ? null : <ClueMark key={"c" + i} x={c.x} z={c.z} fog={snap.weather === "fog"} />))}
        {marks.map((m) => <PingMark key={m.id} x={m.x} z={m.z} />)}
        {playing && !party && !isGhost && <RouteMark x={ROUTE_SPOT.x} z={ROUTE_SPOT.z} />}
        {playing && !party && <VillageHead x={VILLAGE_HEAD.x} z={VILLAGE_HEAD.z} name={VILLAGE_HEAD.name} talking={headTalk} />}
        {playing && !party && lostView && lostView.until > now && <LostMark x={lostView.x} z={lostView.z} />}
        {playing && !party && closed && closed.until > now && <ClosureMark x={closed.x} z={closed.z} radius={closed.r} />}
        {playing && !party && boss && <BossMark x={boss.x} z={boss.z} radius={boss.radius} />}
        {playing && !party && !isGhost && SEARCH_SPOTS.map((o) => (searched.includes(o.id) ? null : <SearchMark key={o.id} x={o.x} z={o.z} />))}
        {party && snap.gadgets.map((g) => <GadgetMark key={g.id} x={g.x} z={g.z} />)}
        {party && snap.crates.map((c) => <LooseCrate key={c.id} x={c.x} z={c.z} />)}
        {party && snap.orbs.map((o) => <PartyOrb key={o.id} x={o.x} z={o.z} />)}
        {snap.players.filter((p) => p.id !== room.sessionId).map((p) => <RemotePlayer key={p.id} room={room} id={p.id} team={p.team} look={lookOf(p)} acc={p.acc} name={p.name} ghost={p.role === "ghost"} emote={emotes[p.id]} />)}
      </Canvas>
      {!ready && <Splash message="กำลังเตรียมหมู่บ้านโนนสุข…" />}
      <div className="hud">
        {lobby ? <div><b>ล็อบบี้</b> · รหัส {room.roomId} · {snap.players.length}/{MAX_PLAYERS} คน · พร้อม {readyCount}</div>
          : <div><b>{me?.name}</b> · คะแนน {me?.score ?? 0} · เหลือ {Math.floor(snap.secondsLeft / 60)}:{String(snap.secondsLeft % 60).padStart(2, "0")} · {WEATHER[snap.weather as keyof typeof WEATHER]?.icon}</div>}
        {night && <div className="small">🌙 กลางคืน: วงสีทีมหน้าบ้านทีมปลอดภัยจากผี เมื่อได้ยินเตือนไฟดับให้รีบกลับไปวง</div>}
        {party && <div className="small"><b>{snap.roundTitle}</b> · {snap.phaseLeft} วินาที{snap.round > 0 ? ` (รอบ ${snap.round}/${CHAOS_ROUNDS})` : ""}{snap.phase === "collect" ? ` · เหลือลูกแก้ว ${snap.orbs.length}` : ""}{snap.phase === "collect" ? " · เดินชนลูกแก้วเพื่อเก็บ" : ""}{snap.phase === "relay" ? " · หยิบลังที่ตลาด ส่งที่วงสีทีม" : ""}{snap.phase === "fishing" ? " · ไปที่บ่อน้ำ กดโต้ตอบเพื่อเหวี่ยงเบ็ด พอปลากินกดอีกครั้ง" : ""}</div>}
        {!lobby && <div className="mini">{board.map((t) => <span key={t.id} style={{ color: t.color }}>● {t.pts}</span>)}</div>}
        {me?.carrying && <div className="small">📦 กำลังถือของ ไปส่งที่วงสีทีมหน้าบ้านทีม{trip > 0 ? ` · ⏱ เหลือ ${Math.max(0, Math.ceil((trip - now) / 1000))} วินาที` : ""}</div>}
      {me?.gadget && <div className="small">{GADGET.icon} ถือ{GADGET.name} (เข้าใกล้คู่แข่งที่ถือลัง/ตกปลา แล้วกดโต้ตอบเพื่อปา)</div>}
      {lostView && lostView.until > now && <div className="small">🔎 {lostView.name} หายแถว{lostView.site}: ไปหาแสงสีทอง ใครเก็บได้ก่อนได้ +{LOST.reward} · เหลือ {Math.max(0, Math.ceil((lostView.until - now) / 1000))} วินาที</div>}
      {closed && closed.until > now && <div className="small">🚧 ปิด{closed.site}ชั่วคราว (เดินเข้าไม่ได้) · เปิดอีก {Math.max(0, Math.ceil((closed.until - now) / 1000))} วินาที</div>}
      {invite && invite.until > now && !snap.ended && <div className="invitebar" role="alertdialog" aria-label="คำเสนอแลกเบาะแส"><span>🤝 <b>{invite.name}</b> (ทีมอื่น) ขอแลกเบาะแสกัน 1 ต่อ 1 · {Math.max(0, Math.ceil((invite.until - now) / 1000))} วิ</span><button className="go" onClick={() => { room.send("trade:accept", { id: invite.from }); setInvite(null); }}>ตกลง</button><button onClick={() => { room.send("trade:decline", { id: invite.from }); setInvite(null); }}>ไม่แลก</button></div>}
      {boss && boss.until > now && <div className="small">🔥 ผีเจ้าที่โกรธที่{boss.site}: ช่วยกันยืนใกล้ๆ อย่างน้อย {boss.need} คน (ตอนนี้ {boss.inside}) · ความสงบ {Math.min(100, Math.round((boss.calmMs / boss.goalMs) * 100))}% · ⏱ เหลือ {Math.max(0, Math.ceil((boss.until - now) / 1000))} วินาที</div>}
      {secret && secret.until > now && <div className="small">🤫 ภารกิจลับ: รวมตัวอย่างน้อย {secret.need} คนที่{secret.site} · ⏱ เหลือ {Math.max(0, Math.ceil((secret.until - now) / 1000))} วินาที</div>}
        {me?.scared && <div className="small">😨 ตกใจ (เดินช้าลง) ให้เพื่อนในทีมมาปลอบ</div>}
        {!touch && settings.hints && <div className="mute small">WASD เดิน · Shift วิ่ง · Space กระโดด · E โต้ตอบ · ลากเมาส์หมุนกล้อง</div>}
      </div>
      <button className="menubtn" onClick={() => (lobby ? setPanel(true) : setMenu(true))} aria-label={lobby ? "เมนูล็อบบี้" : "เมนู"}>☰</button>
      {!lobby && !snap.ended && !open && <button className="emotebtn" onClick={() => setEmoteOpen((v) => !v)} aria-label="อีโมจิ" aria-expanded={emoteOpen}>😀</button>}
      {playing && !party && !isGhost && !snap.ended && !open && <button className="casebtn" onClick={() => setCaseOpen(true)} aria-label={`กระดานสืบคดี พบเบาะแส ${cs.clues.length} จาก ${CASE_SPOTS.length}`}>📋<span className="casebadge">{cs.clues.length}/{CASE_SPOTS.length}</span></button>}
      {emoteOpen && !lobby && <div className="emotetray">{EMOTES.map((e) => <button key={e} onClick={() => { room.send("emote", { e }); setEmoteOpen(false); }} aria-label={"แสดงอีโมจิ " + e}>{e}</button>)}</div>}
      {lobby && !panel && <div className="lobbybar">
        {EMOTES.map((e) => <button key={e} onClick={() => room.send("emote", { e })} aria-label={"แสดงอีโมจิ " + e}>{e}</button>)}
        <button className={me?.ready ? "" : "go"} disabled={!me?.team} onClick={() => room.send("ready", { ready: !me?.ready })}>{me?.ready ? "ยกเลิกพร้อม" : "พร้อม"}</button>
        {snap.hostId === room.sessionId && <button className="go" onClick={() => room.send("start")}>เริ่มเกม</button>}
        {!me?.team && <small className="lobbyhint">ยังไม่ได้เลือกทีม: กด ☰</small>}
      </div>}
      {near && !open && <div className="prompt">{touch ? "กดปุ่มโต้ตอบ" : "กด E"} {({ evidence: "เพื่อเก็บหลักฐาน", clue: "เพื่อตรวจหาเบาะแสคดี", search: "เพื่อค้นดูของในนี้", door: "เพื่อเปิด/ปิดประตูบ้าน", lockdoor: "เพื่อแก้โจทย์ปลดล็อกประตู 🔒", route: "เพื่อเลือกเส้นทางที่ทางแยก 🧭", puzzle: "เพื่อเข้าห้องปริศนา", crate: "เพื่อหยิบของไปส่งบ้านทีม", drop: "เพื่อส่งของ", gadget: "เพื่อหยิบลูกตะกร้อ", hit: "เพื่อปาลูกตะกร้อใส่คู่แข่ง", help: "เพื่อช่วยปลอบเพื่อนที่ตกใจ", trade: "เพื่อเสนอแลกเบาะแสกับผู้เล่นทีมอื่น 🤝", lost: "เพื่อเก็บของที่หาย 🔎", cook: "เพื่อเริ่มทำอาหารที่เตา", fish: fishState === "idle" ? "เพื่อเหวี่ยงเบ็ด" : fishState === "waiting" ? "เพื่อดึงเบ็ด (ยังไม่มีปลากิน!)" : "ดึงเบ็ดเดี๋ยวนี้!" } as Record<string, string>)[target?.kind ?? "puzzle"]}</div>}
      {isGhost && playing && !snap.ended && <div className="ghostbar">{ABILITY_NAMES.map((n, i) => {
        const left = Math.max(0, Math.ceil(((cd[n] ?? 0) - now) / 1000));
        return <button key={n} className="cb" disabled={left > 0} onPointerDown={() => castAbility(n)}>{{ whisper: "กระซิบ", dim: "มืดลง", boo: "หลอก!" }[n]} <small>({i + 1}){left > 0 ? ` ${left}s` : ""}</small></button>;
      })}</div>}
      {fishState === "bite" && <div className="bite" role="alert">❗ ปลากินเบ็ด! กดโต้ตอบเดี๋ยวนี้!</div>}
      <div className={"flash" + (flash ? " on" : "")} />
      <div className={"blackout" + (dark ? " on" : "")} />
      {scare && <div className="scare">👻</div>}
      {note && <div className="notecard" role="status" onClick={() => setNote(null)}><b>{note.name}</b><br />{note.text}<br /><small className="mute">แตะเพื่อปิด</small></div>}
      {msg && <div className="prompt" role="alert">{msg}</div>}
      {touch && !open && !snap.ended && !(lobby && panel) && <Controls canInteract={near} />}
      <Quiz room={room} active={quizOn && !snap.ended} open={quizOpen} setOpen={setQuizOpen} />
      <Cook room={room} open={cookOpen && snap.phase === "cooking" && !snap.ended} phaseLeft={snap.phaseLeft} onClose={() => setCookOpen(false)} />
      {snap.ended && <div className="overlay"><main><Results room={room} snap={snap} earned={earned} /></main></div>}
      {lobby && panel && <div className="overlay"><main className="lobby"><Lobby room={room} snap={snap} onClose={() => setPanel(false)} /></main></div>}
      {menu && !open && !snap.ended && <div className="overlay"><main><Menu room={room} snap={snap} earnedAchievements={earnedAchievements} onClose={() => setMenu(false)} onSettings={() => { setQuality(settings.quality); bump((n) => n + 1); }} /></main></div>}
      {caseOpen && !open && !menu && !snap.ended && <div className="overlay"><main><CaseBoard room={room} view={cs} onClose={() => setCaseOpen(false)} /></main></div>}
      {!lobby && !snap.ended && !isGhost && !open && <button className="pingbtn" onClick={() => room.send("mark")} aria-label="ชี้จุดให้เพื่อนร่วมทีม" title="ชี้จุดให้เพื่อนร่วมทีม">📍</button>}
      {raceOpen && race && !snap.ended && <RacePuzzle room={room} race={race} ended={raceEnd} onClose={() => setRaceOpen(false)} />}
      {race && !raceOpen && !raceEnd && !isGhost && !snap.ended && <button className="go racebtn" onClick={() => setRaceOpen(true)}>⚡ โจทย์ชิงธง</button>}
      {routeOpen && !snap.ended && <RoutePuzzle room={room} onClose={() => setRouteOpen(false)} />}
      {lockDoor && !snap.ended && <LockPuzzle room={room} doorId={lockDoor} onClose={() => setLockDoor(null)} />}
      {open && !snap.ended && <div className="overlay"><main><button onClick={() => setOpen(false)}>กลับไปเดิน</button><Mystery room={room} snap={snap} /></main></div>}
    </div>
  );
}
