import { useEffect, useState } from "react";
import type { Room } from "colyseus.js";
import { TEAMS, BOXES, TREES, POND, TEMPLE, CHEDI, WORLD_HALF, MAP_PLACES, worldToMap } from "../../shared/src/index.ts";
import type { Snapshot } from "./net.ts";

const S = 320;
const P = (x: number, z: number) => worldToMap(x, z, S);
const K = S / (2 * WORLD_HALF); // metres to map units

/** Top-down village map (north up). Shows where you and your teammates are, refreshed a few times per second. Other teams stay hidden. */
export function MapView({ room, snap }: { room: Room; snap: Snapshot }) {
  const [, tick] = useState(0);
  useEffect(() => { const id = window.setInterval(() => tick((n) => n + 1), 400); return () => clearInterval(id); }, []);
  const me = snap.players.find((p) => p.id === room.sessionId);
  const dots: { id: string; x: number; z: number; ry: number; team: string }[] = [];
  (room.state as any).players.forEach((p: any, id: string) => {
    if (!p.connected || p.role === "ghost") return;
    if (id === room.sessionId || (me?.team && p.team === me.team)) dots.push({ id, x: p.x, z: p.z, ry: p.ry, team: p.team });
  });
  const teamColor = (t: string) => TEAMS.find((x) => x.id === t)?.color ?? "#999";
  const rect = (cx: number, cz: number, hx: number, hz: number) => { const a = P(cx - hx, cz - hz); return { x: a.x, y: a.y, w: hx * 2 * K, h: hz * 2 * K }; };
  const road = rect(0, 5, 3, 29), field = rect(26, -8, 11, 15), pond = P(POND.x, POND.z);
  return (
    <>
      <p className="mute small">แผนที่มองจากด้านบน (ทิศเหนืออยู่ด้านบน บ้านทีมอยู่ด้านล่าง) เห็นเฉพาะคุณและเพื่อนร่วมทีม</p>
      <svg viewBox={`0 0 ${S} ${S}`} style={{ width: "100%", maxWidth: 440, display: "block", margin: "0 auto", borderRadius: 16, border: "2px solid var(--line)" }} role="img" aria-label="แผนที่หมู่บ้านโนนสุข">
        <rect width={S} height={S} fill="#7CC86B" />
        <rect {...road} fill="#D9B98A" /><rect {...field} fill="#A8D968" />
        <circle cx={pond.x} cy={pond.y} r={POND.r * K} fill="#3FA7D6" />
        {TREES.map((t, i) => { const q = P(t.x, t.z); return <circle key={i} cx={q.x} cy={q.y} r={2.2} fill="#2E8B4F" opacity={0.7} />; })}
        {BOXES.map((b, i) => <rect key={i} {...rect(b.x, b.z, b.hx, b.hz)} fill="#CBB98F" stroke="#8A6A3A" strokeWidth={0.8} />)}
        <circle cx={P(CHEDI.x, CHEDI.z).x} cy={P(CHEDI.x, CHEDI.z).y} r={CHEDI.r * K} fill="#E8B923" />
        <rect {...rect(TEMPLE.x, TEMPLE.z, 5, 3.5)} fill="#C0392B" opacity={0.85} />
        {MAP_PLACES.map((m) => { const q = P(m.x, m.z); return (
          <g key={m.name}><text x={q.x} y={q.y} fontSize={16} textAnchor="middle" dominantBaseline="middle">{m.icon}</text>
            <text x={q.x} y={q.y + 15} fontSize={9} textAnchor="middle" fill="#1B1B1F" stroke="#fff" strokeWidth={2.4} paintOrder="stroke">{m.name}</text></g>
        ); })}
        {dots.map((d) => { const q = P(d.x, d.z), mine = d.id === room.sessionId; return (
          <g key={d.id}>
            <line x1={q.x} y1={q.y} x2={q.x + Math.sin(d.ry) * 11} y2={q.y + Math.cos(d.ry) * 11} stroke="#1B1B1F" strokeWidth={2} strokeLinecap="round" />
            <circle cx={q.x} cy={q.y} r={mine ? 6.5 : 4.5} fill={teamColor(d.team)} stroke={mine ? "#fff" : "#1B1B1F"} strokeWidth={mine ? 2.5 : 1} />
          </g>
        ); })}
      </svg>
      <p className="small">⚪ วงขอบขาว = คุณ · จุดสีทีม = เพื่อนร่วมทีม · เส้นสั้น = ทิศที่หันหน้าไป</p>
    </>
  );
}
