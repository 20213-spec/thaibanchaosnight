# THAI BAN: CHAOS NIGHT

3D multiplayer party + mystery game (Thai village, 5 teams, Math Mystery).
Version 0.50.0 (see ROADMAP.md for the audit and the plan for the big visual/gameplay overhaul) (early prototype: online lobby, walkable 3D village, math puzzles, evidence hunt, AI lantern ghost, player ghost role, admin generator, match timer + history).

## Run on your computer (Node 20+ recommended)

    npm install
    npm run dev:server     # terminal 1  -> ws://localhost:2567
    npm run dev:client     # terminal 2  -> http://localhost:5173

Open http://localhost:5173 in two or more browser tabs: create a room in one tab,
paste the room code in the others, pick teams, press Ready, host presses Start.
In the village walk to the yellow ring in front of the school and press E (or the
Interact button on mobile) to open the Math Mystery room.

Ghost players: keys 1/2/3 (or on-screen buttons) use whisper / dim / boo. Tick "play as ghost" in the lobby.

Controls: WASD move, Shift run, Space jump, E interact, drag mouse to rotate camera.
Mobile: left joystick, buttons for run / jump / interact, drag empty screen to rotate.

Test on your phone: same Wi-Fi, open `http://<computer-IP>:5173` (the client
connects to `ws://<same-IP>:2567` automatically). To point at another server set
`VITE_SERVER_URL=ws://host:2567` before `npm run dev:client`.

## Admin question generator

Start the server with a token, then open `http://localhost:5173/#admin`:

    ADMIN_TOKEN=choose-a-long-secret npm run dev:server        # Windows PowerShell: $env:ADMIN_TOKEN="..."; npm run dev:server

- Template mode: pick topic, level, count. Questions land as "pending".
- Content mode: paste lesson text. With `ANTHROPIC_API_KEY` set on the server, an LLM only proposes
  (kind, numbers, Thai wording); the answer, choices and solution are always computed by code and every
  stem must contain its own numbers. Without a key it detects topics by keyword and uses templates.
  Optional: `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`). The key never reaches the browser.
- Only questions you press "Approve" on are used in games (about half of the puzzles draw from approved ones).
- Bank file: `server/data/bank.json` (set `BANK_FILE` to move it). Set `ADMIN_ORIGIN` to your client origin when deployed.

## Load test (you must run this; it has never been run)

Bots are simulated players (join, pick team, ready, start, walk at 10 moves/s, ping every second).

    npm run dev:server                                   # terminal 1 (default match length 600 s)
    npm run loadtest -- --players=4 --seconds=60         # terminal 2 (add --mode=chaos_party --seconds=460 to test the party mode)
    # then 8, 20, 40. Add --url=wss://your-server for a deployed server (run bots from another machine)

Each run prints JSON and saves `loadtest/results/<players>-players-<time>.json`: join failures, disconnects,
round-trip time p50/p95/max, state updates per bot per second, snap-backs, server memory (`/health`).
PASS rule (my default, edit in `loadtest/run.mjs`): all bots joined, 0 disconnects, p95 RTT < 150 ms, snap-backs <= players.

What it does NOT measure: real phone browsers rendering 3D, mobile networks, bots and server sharing one
computer's CPU (use a second machine for honest numbers), and puzzle/ghost-ability traffic.

Record real results here. Until a row says PASS you may only say "designed for 40, tested up to X".

| Players | Date | Server | Verdict | p95 RTT | Notes |
|---|---|---|---|---|---|
| 2-4 | not run | | | | |
| 8 | not run | | | | |
| 20 | not run | | | | |
| 40 | not run | | | | |

See TESTING.md for the first-run test checklist and DEPLOY.md for hosting steps (Firebase Hosting for the client, Render or Docker for the server).

Run the engine tests (no install needed, Node 22.6+):

    npm run test:shared
    npm run typecheck      # tsc --noEmit for client and server (needs npm install first)
    npm run check          # typecheck + test:shared

## IMPORTANT: what has and has not been tested

The code in `server/` and `client/` was written WITHOUT being able to install
packages or run it. It has never been compiled or executed. Expect small
fixes (typos, library API differences). Likely first places to look:

- `server/src/GameRoom.ts`: Colyseus 0.15 + `@colyseus/schema` 2.x decorators
  (needs `experimentalDecorators`, already set in `server/tsconfig.json`).
- `client/src/net.ts` and `App.tsx`: `colyseus.js` 0.15 API (`create`, `joinById`,
  `onStateChange`, `onMessage` returning an unsubscribe function).
- CORS between the Vite dev server and the Colyseus HTTP matchmaker.

Tested (really run): `shared/` team rules, scoring, Math Mystery generator and validator
(2,040 generated questions pass; tampered answers are rejected).

## Status

| Part | Status |
|---|---|
| Admin: token-protected API, question bank file, approve/reject, AI proxy with code-verified answers, admin web page | Written, NOT run (builder and parameter checks unit-tested in shared) |
| Match timer (default 600 s, env `MATCH_SECONDS`), results screen, match history file + public `/history`, Home history list | Written, NOT run |
| Character look (skin tone, hat), name tags above players | Written, NOT run (look validation unit-tested) |
| Reconnect after refresh or dropped connection while a match is running (30 s hold, token in sessionStorage) | Written, NOT run |
| Player Ghost: opt-in at the lobby, 1 ghost per 8 players (min 1), abilities whisper / dim / boo with cooldowns, points only from startling players of other teams (cap 150/match), ghosts cannot collect evidence or answer puzzles | Written, NOT run (balance rules unit-tested) |
| Missions: delivery (crate at the market to your team house ring; any time and any number of times, but each trip must finish within 45 s or the crate is lost, and each delivery starts a 30 s cooldown; the first 4 deliveries pay +100, later ones +40), special golden lantern (+150, appears every ~3 min for 60 s), help a startled teammate (+30, cap 300), teamwork bonus (+50 each when 3 different teammates score within 60 s) | Written, NOT run (teamwork rule and locations unit-tested) |
| In-game menu (☰): Missions (values read from shared constants, live progress), Leaderboard (teams + top players), Settings (camera sensitivity, graphics quality, hints; saved in the browser). Settings also on Home. | Written, NOT run |
| Shop + Inventory in **บาท** (virtual currency, cosmetics only: 4 items, shown on your avatar to everyone). Earned at match end (20 + score/4, cap 300; only in rooms with 2+ players). Wallet kept on the server, bound to a private random key in your browser; server validates every buy/equip. | Written, NOT run (rules unit-tested) |
| Map expansion: temple (hall + golden chedi), rice-field rows + hut + scarecrow, dense north-west forest, 2 more evidence spots (10 total). Client-side collision with buildings and trees (server only enforces speed and map bounds). | Written, NOT run (collision and "key spots are reachable" unit-tested) |
| **Mode: Chaos Party** (host picks it in the lobby; no ghost role): intro, collect round (24 orbs, +10 each, walk into them), quiz round (5 questions x 20 s, +50, +25 first correct in the room, wrong costs nothing; uses the same validated generator and approved bank), relay round (crate to team ring, +60 each, no cap), round-winner bonus +50 per member (ties: none). About 370 s total with the fishing round. Server-authoritative; reuses scores, leaderboard, history and Baht. | Written, NOT run (round plan and winner rule unit-tested) |
| **Mode: Chaos Night** (host picks it in the lobby): Ghost Hunt rules at night (dark scene, lantern light on your avatar, faster AI ghost) plus a safe ring in front of each team house: AI ghosts cannot startle you inside it and startled players recover on entering. Lights-out alerts (10 s warning, 6 s dark): teams with at least half of their online members inside the ring when the lights return get +40 per player (cap 120 per match). Nobody loses points. | Written, NOT run (ring, shelter rule, cap and ghost speed unit-tested) |
| **4 AI ghost kinds** (all harmless, startle only, shared 15 s cooldown per player): ผีโคมไฟ wanders; ผีขาวจอมป่วน blinks in 9-12 units from a random player every 10-14 s; เงาปริศนา follows the nearest player but never closer than 5 units; ผีเจ้าถิ่น guards the temple front. Ghost Hunt uses lantern + guardian, Chaos Night all four. | Written, NOT run (each behaviour unit-tested in shared) |
| UI polish: boot splash + connecting splash + 3D-scene loading splash (tips); Home with bottom tabs (Play, Character, Shop, History, Settings); new Lobby (room-code card, mode cards, team cards, sticky Ready/Start bar); Character page with live 3D preview (skin, hat saved in the browser and sent on join; accessories from the shop). Low graphics quality now also drops point lights. Puzzle ring / crate hidden in modes where they do nothing. | Written, NOT run |
| Chaos Party round 4: **fishing** (บ่อน้ำ pond added to the map, solid in all modes): cast, wait 2-5 s, reel inside the 1.2 s bite window; fish are worth 10/20/30/80 (odds 50/30/15/5 %); pulling early or late costs nothing. Server-side timing and weighted pick. Party is now ~455 s with 5 rounds. | Written, NOT run (odds, pond placement unit-tested) |
| **Walkable lobby**: joining a room puts you in the village plaza (3D scene) where everyone can run, jump and see each other while waiting. A panel (☰) holds mode, teams and character; close it to roam. Bar with 4 emotes (server-whitelisted, shown above the head for 2.5 s), Ready and Start (host). No missions or pickups in the lobby; at Start everyone is moved to their team spawn. Lobby spawn spots (40 slots) and emote list unit-tested. | Written, NOT run |
| **Character redesign (M1)**: new procedural rig (legs, arms, torso, head, eyes with highlights and blinking, brows, mouth, cheeks, ears), 6 hair styles x 6 colours, 6 tops, 4 bottoms x 6 colours, 3 shoes, 4 hats, team colour + team symbol on the chest, walk / run / jump / idle animation, emotions via emotes (wave, laugh, cheer, love, surprise, thinking, fear) and a fear shake when startled, carrying and fishing poses, rarity system for shop items (common / rare / epic / legendary, 8 accessories). Shared geometry/materials and distance-based level of detail. Graphics Low / Medium / High. UI snapshots throttled to ~5 per second. | Written, NOT run (look validation and rarity pricing unit-tested; nothing visual has been seen) |
| Quiz sheet can be hidden so players who answered can walk around; chip brings it back. In-game emote tray (😀). | Written, NOT run |
| **Village dressing (M2, decoration part)**: gradient sky, clouds, sun / moon and stars, 3 tree kinds with ground shadows, grass, flowers, bushes, rice stalks, street lamps (glowing bulbs at night), 3 Thai stilt houses (solid), team houses with door / windows / chimney / flag, chimney and incense smoke, 7 Thai direction signs, market awnings with goods, school door / windows / flag, temple steps and lanterns, pond with ripples / reeds / rocks / lily pads, fireflies at night, blob shadows under players. Heavy use of instancing (a few dozen draw calls for thousands of plants); amounts scale with Low / Medium / High. Real-time sun shadows were NOT added (too heavy for phones). | Written, NOT run (placement rules unit-tested; nothing visual has been seen) |
| **Sound (M4)**: everything synthesised with Web Audio (no audio files, so nothing to license): footsteps on 5 surfaces (dirt, grass, rice field, stone, wood), jump and landing, 22 sound effects, day ambience (wind, birds) and night ambience (wind, crickets, owl), 5 generative music modes (lobby, day, night, party, special event; pentatonic scales chosen by the mode), countdown ticks, per-type volume (master, effects, ambience, music) and mute in Settings. Silent until the first tap or key (browser rule). | Written, NOT run (surface map, melody rules unit-tested; I cannot hear the result, so levels and taste are unverified) |
| **Weather (M5)**: fog, rain, storm with lightning, strong wind, scheduled by the server (hunt modes only; none in the lobby or Chaos Party). Real effects, never removing points: fog = short visibility and ghosts startle from 1.35x farther; rain = slightly slower (x0.93) but evidence respawns faster (x0.6); storm = rain plus lightning every 10-22 s that startles players within 5 units (the night safe ring protects) and sometimes cuts the power for 4 s; wind = the golden lantern is blown to a new spot every 12 s. Visuals (grey sky, dark clouds, fog, rain streaks, blowing leaves, lightning flash) and sound (rain, stronger wind, thunder delayed by distance). | Written, NOT run (schedule rules, odds, durations, lightning bounds and fog radius unit-tested) |
| **Detective case (M3, first part)**: each Ghost Hunt / Chaos Night match has one hidden culprit among 5 village ghosts (the culprit stays on the server). 5 clue spots (lilac light pillars at the school, market, temple, pond, forest) each hold a true statement that the culprit is NOT like one suspect (by place, item or sound); a team collects its own clues (+30 each, found clues are private to the team), matches them against the 5 suspect cards on the case board (📋) and may accuse only when 2 or fewer suspects remain (no blind guessing). Wrong accusation = 20 s team cooldown, no points lost; first team to name the culprit gets +200 per connected non-ghost teammate, later teams +100. Rules (case generation is always solvable, referee, cooldown, scoring) are pure code in `shared/src/case.ts` with 9 unit tests (500+ seeds) | Server and client Written, NOT run; shared rules unit-tested |
| **Achievements (M3, part)**: 8 badges (evidence, deliveries, helping, math puzzles, clues, solving the case, sheltering), badges only and never points; counted per player on the server, shown as a toast when unlocked. Rules in `shared/src/achievements.ts`, unit-tested. The ☰ menu lists all badges with ✅/🔒 for this match (resets if you reconnect) | Written, NOT run; shared rules unit-tested |
| **Interactive world (M3, part)**: 4 searchable village objects (small chests: stilt-house cabinet, chest behind a stilt house, abandoned mailbox by the rice field, crate by the road). Press interact next to one to read a short story note (70% funny, 30% mildly spooky, none violent), once per player per object, no points; searching all 4 unlocks a badge. Server checks role, distance and the once-only rule; note text is picked by pure code in `shared/src/notes.ts` (unit-tested). Doors, drawers that open and NPCs are NOT done | Written, NOT run; shared rules unit-tested |
| **Village headman news (M3, part)**: in Ghost Hunt / Chaos Night the server broadcasts a short news line first after 60 s, then every 75 s. It points at WHERE an unfound clue is glimmering (a landmark name), announces when a team has solved the case, or gives harmless gossip; it never names a suspect or what a clue means, and never points at a clue every team already found. Pure code in `shared/src/news.ts` with 2 unit tests (3000 random cases, spoiler check). No actual NPC character in the 3D world yet | Written, NOT run; shared rules unit-tested |
| **Timed delivery trips and Chaos Party gadgets (v0.27)**: deliveries are unlimited but time-limited (hunt modes: 45 s per trip, 30 s cooldown after a delivery, 15 s after a lost crate; relay round: 30 s trip, 8 s cooldown). In the Chaos Party relay and fishing rounds 5 throwable gadgets (sepak-takraw balls) lie on the map (12 possible spots, 3 of them by the pond; the fishing round always keeps at least 2 gadgets within 12 m of the pond, one reappears every 10 s while fewer than 5 lie there, all cleared when the round ends). Hold one, get within 5 m of a rival who carries a crate and press interact: the crate is knocked out, lands 1-2.4 m away and stays 12 s for anyone to grab (the victim cannot pick up for 1.5 s); the thrower gets +10. In the fishing round the same throw at a fishing rival cancels their line and locks their casting for 3 s. Wasted throws (no rival in range) are not used up. Rules are pure code in `shared/src/gadget.ts` (6 unit tests); the server applies them in `GameRoom.ts` and `chaos.ts` | Written, NOT run; shared rules unit-tested |
| **Secret missions (v0.30, M3 part)**: in Ghost Hunt / Chaos Night, first after 90 s and then every 120 s, the server privately tells ONE team (rotating, only teams with at least 2 connected non-ghost players) to gather at a landmark (one of the 5 clue landmarks) within 45 s: at least 75% of the eligible team (min 2) must stand within 4 m. Success gives +40 to each teammate standing there; failure costs nothing. Only that team receives the message. Pure rules in `shared/src/secret.ts` (3 unit tests); the server applies them in `GameRoom.tickSecret` | Written, NOT run; shared rules unit-tested |
| **Math Mystery: discrete uniform topic** (the topic the spec asked for that was missing; Phase 2 / M6): 3 problem kinds (probability of a value range, mean, variance) with worked steps and hints, generated, checked by the independent validator, usable in puzzles, the party quiz, the admin generator (keyword detection) and the AI-proposal parameter ranges. Now 7 topics x 4 levels. | Logic unit-tested (exact values such as the fair die, 1,600 generated questions validated, parameter rules); UI label untested (WRITTEN-UNVERIFIED) |
| **Chaos Party round 5: cooking** (M3.11): tap ingredients in the recipe order at the stove beside the market; 9 Thai dishes, 10 ingredients, dishes get longer (3 to 5 steps) as you cook, speed bonus, a wrong tap only restarts the dish (no point loss); server checks distance, tap interval and exact order. Party is now 5 rounds (~455 s). | Logic unit-tested (65/65); gameplay WRITTEN-UNVERIFIED |
| **Village map tab** (M7, in the menu): top-down SVG map with road, field, pond, buildings, trees, labelled landmarks and the live position and heading of you and your teammates (other teams hidden). Client-only, no server or scoring change. | Logic unit-tested (66/66); WRITTEN-UNVERIFIED in the browser |
| `DEPLOY.md` (Render / Docker / Firebase Hosting), `Dockerfile`, `firebase.json`, server `/health` | Written, NOT run (never deployed) |
| `loadtest/run.mjs` bot load test (2-40 bots) | Written, NOT run; no results yet |
| Shared: teams (5, max 8), scoring, 6 math topics x 4 levels, validator | Done, tested |
| Server: room, teams, ready, host start, team lock, rate limit, server-side answers and scores, reconnect window (30s) | Written, NOT run |
| Client: Home, Lobby, Math Mystery with team leaderboard | Written, NOT run |
| Client: 3D village (low-poly), third-person camera, PC + touch controls, remote players with smoothing | Written, NOT run |
| Server: movement validation (speed limit, map bounds, snap-back), puzzle only near the school ring | Written, NOT run (spawn/clamp rules unit-tested in shared) |
| Standalone phone pages (single player, local bots): see the two HTML files shared in chat | Published in chat |
| Server: 10 evidence spots (+20 each, respawn after 20s), pickup checked by distance | Written, NOT run |
| Server: AI lantern ghost (wanders, harmless startle with 15s cooldown, random blackout / whisper events) | Written, NOT run (ghost movement and scare rules unit-tested in shared) |
| Client: evidence orbs, ghost model, blackout and scare effects | Written, NOT run |
| AI random events still missing from the spec list: doors opening/closing, items going missing. Ghost sounds. Chaos Party mini-game still missing from the spec examples: cooking; map selection (only one map exists, so there is no selector on purpose) |
| More mission types; more map areas (full market lanes, school interior); server-side collision | Not started |
| More shop items (only 4 so far), item previews, accounts (Firebase Auth) so wallets survive clearing the browser | Not started |
| Ghost audio, more AI ghost types, balance tuning from real playtests, ghost "sense evidence" ability | Not started |
| Firebase-backed admin login (admin currently uses a shared token), question edit screen | Not started |
| Firebase Auth / Firestore history | Not started |
| Reconnect while still in the lobby (a refresh in the lobby leaves the room, rejoin with the room code), full outfit/accessory picker, GLB models | Not started |
| Load test RESULTS | None yet. Nothing is claimed about 40 players (the room cap is 40, never load tested) |

## Shop rules (บาท)

- Baht is a virtual in-game currency. There is no real-money purchase anywhere. Items are cosmetics: they never change scoring, speed, abilities or ghost balance.
- Earned only when a match ends: `20 + floor(score / 4)`, capped at 300 per match. Rooms with a single player earn nothing unless the server has `ALLOW_SOLO_EARN=1` (for testing alone).
- New wallets start at 0. For testing set `START_BAHT=200` on the server (applies to wallets created afterwards).
- Wallet file: `server/data/wallets.json` (`WALLET_FILE` to move it). Identity is an anonymous random key in your browser's storage: clearing site data loses the wallet, and anyone who copies the key can use it. Real accounts (Firebase Auth) are not done yet.
- Not stored/sent to others: the key. Others only see your equipped cosmetic id.

## Assumptions I made (please correct any that are wrong)

- Platform: browser game, React + TypeScript + React Three Fiber client; Colyseus (Node) server; Firebase only for static hosting of the client. Firebase Auth/Firestore are NOT used yet: data lives in JSON files on the server (`bank`, `history`, `wallets`).
- Only one map exists (village Non Suk with school, market, temple, rice field, forest, team houses), so there is no map selector.
- Math Mystery uses a fixed set of 11 problem templates (6 topics). The LLM option only proposes numbers and Thai wording; answers are always computed by code and a human must approve.
- Characters are simple low-poly figures built in code (no GLB models, no animation), customised by skin tone, hat and 4 shop accessories.
- Baht is a virtual currency for cosmetics only. All point values, cooldowns and caps are first guesses, never playtested.
- No audio, no player-to-player chat, no in-game friend invites beyond sharing the room code.

## What has been verified, and what has not

- Verified by running: `shared/` (43 unit tests: math engine and validator, team rules, scoring, collisions and spawn points, missions, teamwork, ghost AI behaviours, shop rules, chaos plan, night rules).
- Never run: everything in `server/` and `client/`, the load test, the deployment steps. They were written without the ability to install packages or start a browser. Expect compile errors and small bugs on first run; send them back and they will be fixed.
- No claim is made about how many players the server can handle. The room limit is 40; the load test has never been run (see the results table above).

## Design notes

- The server is authoritative. Clients send intentions only; the correct answer
  index is revealed to a client only after it answers correctly. Scores change in
  exactly one place (`puzzle:answer` handler).
- Room code is Colyseus's built-in room id (not a short code yet).
- Joining after the game starts is rejected (room is locked on start).
- All point values and caps in `shared/src/missions.ts` and `scoring.ts` are my first guesses and have not been playtested.
- The ghost never harms or penalizes anyone; "scare" is only a short screen effect.
- The client currently re-renders React on every state patch (snapshot); fine for small rooms, to be optimized before large tests.
- Planned next: R3F scene with position sync over Colyseus (never Firestore per frame).
