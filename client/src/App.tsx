import { useEffect, useState } from "react";
import type { Room } from "colyseus.js";
import { createRoom, joinRoom, reconnectWith, snapshot, httpUrl, TOKEN_KEY, type Snapshot } from "./net.ts";
import { Game } from "./Game.tsx";
import { Admin } from "./Admin.tsx";
import { Home, type Match, type Daily } from "./Home.tsx";
import { Splash } from "./Splash.tsx";
import { audio } from "./audio.ts";

export function App() {
  const [room, setRoom] = useState<Room | null>(null);
  const [name, setName] = useState(() => { try { return localStorage.getItem("tbcn-name") ?? ""; } catch { return ""; } });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [booted, setBooted] = useState(false);
  const [err, setErr] = useState("");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [hash, setHash] = useState(location.hash);
  const [matches, setMatches] = useState<Match[]>([]);
  const [daily, setDaily] = useState<Daily | null>(null);
  useEffect(() => { const f = () => setHash(location.hash); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);

  // Boot screen: wait for web fonts (at most 1.5 s) and show the splash for at least 0.9 s so it never flashes.
  useEffect(() => {
    const fonts = (document as any).fonts?.ready ?? Promise.resolve();
    Promise.all([Promise.race([fonts, new Promise((r) => setTimeout(r, 1500))]), new Promise((r) => setTimeout(r, 900))]).then(() => setBooted(true));
  }, []);
  // Sound: browsers allow audio only after a gesture, so unlock on the first tap/key. Every button also gets a small click.
  useEffect(() => {
    const unlock = () => audio.unlock();
    const click = (e: Event) => { if ((e.target as HTMLElement | null)?.closest?.("button")) audio.sfx("click"); };
    addEventListener("pointerdown", unlock); addEventListener("keydown", unlock); document.addEventListener("click", click);
    return () => { removeEventListener("pointerdown", unlock); removeEventListener("keydown", unlock); document.removeEventListener("click", click); };
  }, []);
  useEffect(() => { try { localStorage.setItem("tbcn-name", name); } catch { /* ignore */ } }, [name]);

  const attach = (r: Room) => { sessionStorage.setItem(TOKEN_KEY, r.reconnectionToken); setRoom(r); };

  // Rejoin after a page refresh (works while the match is running; the server holds the seat 30 s).
  useEffect(() => {
    const t = sessionStorage.getItem(TOKEN_KEY);
    if (!t) return;
    setBusy(true);
    reconnectWith(t).then(attach).catch(() => sessionStorage.removeItem(TOKEN_KEY)).finally(() => setBusy(false));
  }, []);

  useEffect(() => {
    if (room) return;
    fetch(httpUrl + "/history").then((r) => r.json()).then((d) => { setMatches(d.matches ?? []); setDaily(d.daily ?? null); }).catch(() => {});
  }, [room]);

  useEffect(() => {
    if (!room) return;
    setSnap(snapshot(room.state));
    // The shared state changes up to 20 times a second (positions). The React UI only needs about 5 updates a second:
    // positions and animation are read straight from the state inside the 3D scene, not from this snapshot.
    let last = 0, timer: number | null = null;
    room.onStateChange((s) => {
      const run = () => { last = Date.now(); timer = null; setSnap(snapshot(s)); };
      const wait = 200 - (Date.now() - last);
      if (wait <= 0) run(); else if (timer === null) timer = window.setTimeout(run, wait);
    });
    room.onLeave(async (closeCode) => {
      setRoom(null); setSnap(null);
      if (closeCode === 1000 || closeCode === 4000 || !sessionStorage.getItem(TOKEN_KEY)) { sessionStorage.removeItem(TOKEN_KEY); return; }
      setBusy(true); setErr("การเชื่อมต่อหลุด กำลังเชื่อมต่อใหม่…");
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const t = sessionStorage.getItem(TOKEN_KEY);
        if (!t) break;
        try { attach(await reconnectWith(t)); setErr(""); setBusy(false); return; } catch { /* try again */ }
      }
      sessionStorage.removeItem(TOKEN_KEY);
      setBusy(false);
      setErr("เชื่อมต่อใหม่ไม่สำเร็จ ห้องอาจปิดไปแล้ว");
    });
  }, [room]);

  async function go(fn: () => Promise<Room>) {
    setBusy(true); setErr("");
    try { attach(await fn()); }
    catch (e: any) { setErr("เชื่อมต่อไม่ได้: " + (e?.message ?? e) + " (server รันอยู่ไหม? ห้องถูกล็อกหรือรหัสผิดหรือเปล่า?)"); }
    finally { setBusy(false); }
  }

  if (hash === "#admin") return <Admin />;
  if (!booted) return <Splash message="กำลังเตรียมเกม…" />;
  if (busy && !room) return <Splash message={err || "กำลังเชื่อมต่อห้อง…"} />;
  if (room && snap) return <Game room={room} snap={snap} />; // the lobby is part of the 3D scene now
  return <Home name={name} setName={setName} code={code} setCode={setCode} busy={busy} err={err} matches={matches} daily={daily}
    onCreate={() => go(() => createRoom(name))} onJoin={() => go(() => joinRoom(code, name))} />;
}
