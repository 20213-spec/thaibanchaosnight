import { useEffect, useState } from "react";
import type { Room } from "colyseus.js";
import { TEAMS, TOPICS, dailyTopic, dayKey } from "../../shared/src/index.ts";
import type { Snapshot } from "./net.ts";

const TN: Record<string, string> = { basic: "ความน่าจะเป็นพื้นฐาน", expected: "ค่าคาดหมาย", variance: "ความแปรปรวน", binomial: "ทวินาม", poisson: "ปัวซง", normal: "ปกติ", uniform: "เอกรูปไม่ต่อเนื่อง" };
const DN: Record<string, string> = { easy: "ง่าย", normal: "ปกติ", hard: "ยาก", expert: "ผู้เชี่ยวชาญ" };
interface Q { text: string; choices: string[] }

export function Mystery({ room, snap }: { room: Room; snap: Snapshot }) {
  const [topic, setTopic] = useState<string>(dailyTopic(dayKey(Date.now()))); // topic of the day is only the default (I4)
  const [diff, setDiff] = useState("normal");
  const [q, setQ] = useState<Q | null>(null);
  const [note, setNote] = useState("");
  const [solution, setSolution] = useState<string[]>([]);
  const [okIdx, setOkIdx] = useState(-1);
  const [badIdx, setBadIdx] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const offs = [
      room.onMessage("puzzle:question", (m: Q) => { setQ(m); setNote(""); setSolution([]); setOkIdx(-1); setBadIdx([]); setDone(false); }),
      room.onMessage("puzzle:hint", (m: { text: string }) => setNote(m.text ? "คำใบ้: " + m.text : "ไม่มีคำใบ้เพิ่มแล้ว")),
      room.onMessage("puzzle:result", (m: any) => {
        if (m.correct) { setDone(true); setOkIdx(m.correctIndex); setSolution(m.solution); setNote(`ถูกต้อง +${m.gained} คะแนน${m.firstTry ? " (โบนัสตอบถูกครั้งแรก)" : ""}`); }
        else setNote("ยังไม่ถูก ลองใหม่หรือขอคำใบ้ได้ ไม่หักคะแนน");
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [room]);
  useEffect(() => { room.send("puzzle:new", { topic, difficulty: diff }); }, []); // first question

  const me = snap.players.find((p) => p.id === room.sessionId);
  const board = TEAMS.map((t) => ({ ...t, pts: snap.players.filter((p) => p.team === t.id).reduce((s, p) => s + p.score, 0) })).sort((a, b) => b.pts - a.pts);
  const myTeam = TEAMS.find((t) => t.id === me?.team);
  return (
    <>
      <h1>ห้องปริศนา</h1>
      <div className="row"><select aria-label="หัวข้อ" value={topic} onChange={(e) => setTopic(e.target.value)}>{TOPICS.map((t) => <option key={t} value={t}>{t === dailyTopic(dayKey(Date.now())) ? "⭐ " : ""}{TN[t]}</option>)}</select>
        <select aria-label="ระดับ" value={diff} onChange={(e) => setDiff(e.target.value)}>{Object.keys(DN).map((d) => <option key={d} value={d}>{DN[d]}</option>)}</select></div>
      <div className="team" style={{ ["--c" as any]: myTeam?.color }}>
        <div className="th"><b>{myTeam?.name}</b><b>คะแนนคุณ {me?.score ?? 0}</b></div>
        {q ? <><p className="q">{q.text}</p>
          {q.choices.map((c, i) => <button key={i} className={"ch" + (i === okIdx ? " ok" : badIdx.includes(i) ? " bad" : "")} disabled={done || badIdx.includes(i)}
            onClick={() => { setBadIdx((b) => [...b, i]); room.send("puzzle:answer", { index: i }); }}>{c}</button>)}</> : <p className="mute">กำลังโหลดโจทย์…</p>}
        <div className="bar"><button disabled={done || !q} onClick={() => room.send("puzzle:hint")}>ขอคำใบ้</button>
          <button className="go" onClick={() => room.send("puzzle:new", { topic, difficulty: diff })}>ข้อถัดไป</button></div>
        <p className="mute" aria-live="polite">{note}</p>
        {solution.length > 0 && <ol>{solution.map((s, i) => <li key={i}>{s}</li>)}</ol>}
      </div>
      <h2>อันดับทีม</h2>
      {board.map((t) => <div key={t.id} className="team" style={{ ["--c" as any]: t.color }}><div className="th"><b><span className="sw" />{t.name}</b><b>{t.pts}</b></div></div>)}
    </>
  );
}
