import { useEffect, useState } from "react";
import type { Room } from "colyseus.js";
import { TEAMS, MAX_TEAM_SIZE, MAX_PLAYERS, dailyTheme, dayKey } from "../../shared/src/index.ts";
import { TOKEN_KEY, type Snapshot } from "./net.ts";
import { CharacterEditor } from "./Character.tsx";

const ERR: Record<string, string> = {
  team_full: "ทีมนี้เต็มแล้ว", too_many_ghosts: "จำนวนผีเกินสัดส่วน (1 ตัวต่อ 8 คน)", need_human: "ต้องมีผู้เล่นฝ่ายมนุษย์อย่างน้อย 1 คน",
  not_ready: "ยังมีคนไม่พร้อมหรือยังไม่ได้เลือกทีม", no_ghost_here: "โหมดนี้ไม่มีบทบาทผี",
};
const MODES = [
  { id: "ghost_hunt", icon: "👻", name: "Ghost Hunt", desc: "สืบหาหลักฐาน ไขปริศนาคณิตศาสตร์ ส่งของ และหลบผี" },
  { id: "chaos_party", icon: "🎉", name: "Chaos Party", desc: "มินิเกมแข่งทีม 5 รอบ: เก็บลูกแก้ว ตอบคำถาม วิ่งส่งของ ตกปลา ทำอาหาร" },
  { id: "chaos_night", icon: "🌙", name: "Chaos Night", desc: "กลางคืน ไฟดับเป็นรอบ ต้องกลับวงปลอดภัยของทีม" },
];

export function Lobby({ room, snap, onClose }: { room: Room; snap: Snapshot; onClose?: () => void }) {
  const [msg, setMsg] = useState("");
  const [showChar, setShowChar] = useState(false);
  useEffect(() => room.onMessage("error", (m: any) => setMsg(ERR[m.code] ?? "เกิดข้อผิดพลาด")), [room]);
  const me = snap.players.find((p) => p.id === room.sessionId);
  const host = snap.hostId === room.sessionId;
  const counts = Object.fromEntries(TEAMS.map((t) => [t.id, snap.players.filter((p) => p.team === t.id).length]));
  const suggested = [...TEAMS].filter((t) => counts[t.id] < MAX_TEAM_SIZE).sort((a, b) => counts[a.id] - counts[b.id])[0];
  const pick = (id: string) => room.send("team", { team: id });
  const teamColor = TEAMS.find((t) => t.id === me?.team)?.color ?? "#E5383B";
  const readyCount = snap.players.filter((p) => p.team && p.ready).length;

  return (
    <>
      {onClose && <button className="wide go" onClick={onClose}>🏃 กลับไปเดินเล่นในล็อบบี้</button>}
      <div className="lobbyhead">
        <div><small className="mute">รหัสห้อง</small><div className="code">{room.roomId}</div></div>
        <button onClick={() => navigator.clipboard?.writeText(room.roomId).then(() => setMsg("คัดลอกรหัสแล้ว ส่งให้เพื่อนได้เลย"), () => setMsg("คัดลอกไม่ได้ จดรหัสเอง"))}>คัดลอก</button>
        <div style={{ marginLeft: "auto", textAlign: "right" }}><b>{snap.players.length}/{MAX_PLAYERS}</b> คน<br /><small className="mute">พร้อม {readyCount}</small></div>
      </div>

      <p className="mute small">{dailyTheme(dayKey(Date.now())).icon} วันนี้: {dailyTheme(dayKey(Date.now())).name} · {dailyTheme(dayKey(Date.now())).blurb}</p>
      <h2>โหมด</h2>
      <div className="modes">
        {MODES.map((m) => (
          <button key={m.id} className="modecard" aria-pressed={snap.mode === m.id} disabled={!host} onClick={() => room.send("mode", { mode: m.id })}>
            <span className="icon" aria-hidden="true">{m.icon}</span><span><b>{m.name}</b><br /><small>{m.desc}</small></span>
          </button>
        ))}
      </div>
      {!host && <p className="mute small">เจ้าของห้อง (★) เป็นคนเลือกโหมด</p>}

      <h2>ทีม</h2>
      {TEAMS.map((t) => (
        <div key={t.id} className={"team" + (me?.team === t.id ? " me" : "")} style={{ ["--c" as any]: t.color }}>
          <div className="th"><b><span className="sw" />{t.name} {counts[t.id]}/{MAX_TEAM_SIZE}</b>
            <button className="join" disabled={me?.team === t.id || counts[t.id] >= MAX_TEAM_SIZE} onClick={() => pick(t.id)}>{me?.team === t.id ? "ทีมของคุณ" : "เข้าทีม"}</button></div>
          <ul className="mem">{snap.players.filter((p) => p.team === t.id).map((p) => <li key={p.id} className={p.ready ? "rdy" : ""}>{p.role === "ghost" ? "👻 " : ""}{p.name}{p.id === room.sessionId ? " (คุณ)" : ""}{p.id === snap.hostId ? " ★" : ""}</li>)}</ul>
        </div>
      ))}

      <button className="wide" aria-expanded={showChar} onClick={() => setShowChar((v) => !v)}>🧑‍🌾 ปรับตัวละคร {showChar ? "▲" : "▼"}</button>
      {showChar && <div className="card"><CharacterEditor team={me?.team || "red"} teamColor={teamColor} onLook={(l) => room.send("look", l)} onAcc={() => room.send("acc")} /></div>}
      {snap.mode !== "chaos_party" && (
        <label className="check"><input type="checkbox" checked={me?.role === "ghost"} onChange={(e) => room.send("role", { ghost: e.target.checked })} /> ขอเล่นเป็นผี 👻 <small className="mute">(ใช้พลังหลอก เก็บคะแนนจากการทำให้ตกใจ ไม่เก็บหลักฐาน)</small></label>
      )}
      <p className="mute" aria-live="polite">{msg}</p>
      <button className="linkbtn" onClick={() => { sessionStorage.removeItem(TOKEN_KEY); room.leave(); }}>ออกจากห้อง</button>

      <div className="stickybar">
        <button disabled={!suggested} onClick={() => suggested && pick(suggested.id)}>เข้าทีมที่คนน้อยสุด</button>
        <button className={me?.ready ? "" : "go"} disabled={!me?.team} onClick={() => room.send("ready", { ready: !me?.ready })}>{me?.ready ? "ยกเลิกพร้อม" : "พร้อม"}</button>
        {host && <button className="go" onClick={() => room.send("start")}>เริ่มเกม</button>}
      </div>
    </>
  );
}
