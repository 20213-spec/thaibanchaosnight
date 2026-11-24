import { useEffect, useState } from "react";
import type { Room } from "colyseus.js";

interface Q { text: string; choices: string[] }

/** Crossroad question (M6.2): which route gives the better chance of getting through. Nobody loses anything. */
export function RoutePuzzle({ room, onClose }: { room: Room; onClose: () => void }) {
  const [q, setQ] = useState<Q | null>(null);
  const [res, setRes] = useState<{ correct: boolean; correctIndex: number; solution: string[]; text: string } | null>(null);
  const [wait, setWait] = useState(0);
  const [picked, setPicked] = useState(-1);

  useEffect(() => {
    const offs = [
      room.onMessage("route:question", (m: Q) => { setQ(m); setRes(null); setPicked(-1); setWait(0); }),
      room.onMessage("route:result", (m: any) => setRes(m)),
      room.onMessage("route:wait", (m: { ms: number }) => setWait(Math.ceil(m.ms / 1000))),
    ];
    room.send("route:new");
    return () => offs.forEach((off) => off());
  }, [room]);

  return (
    <div className="overlay"><main>
      <button onClick={onClose}>กลับไปเดิน</button>
      <h1>🧭 ทางแยก</h1>
      <p className="mute">เลือกเส้นทางที่มีโอกาสไปถึงปลายทางมากกว่า เลือกผิดไม่เสียอะไร</p>
      <div className="team">
        {q ? <><p className="q">{q.text}</p>
          {q.choices.map((c, i) => <button key={i} className={"ch" + (res ? (i === res.correctIndex ? " ok" : i === picked ? " bad" : "") : "")} disabled={!!res}
            onClick={() => { setPicked(i); room.send("route:answer", { index: i }); }}>{c}</button>)}</>
          : wait > 0 ? <p className="mute">ทางแยกยังวุ่นอยู่ รออีกประมาณ {wait} วินาทีแล้วกดโต้ตอบใหม่</p> : <p className="mute">กำลังโหลดโจทย์…</p>}
        {res && <>
          <p className="mute" aria-live="polite">{res.correct ? `✅ เลือกถูก! พบโน้ตข้างทาง: ${res.text}` : `🐔 ${res.text}`}</p>
          <ol>{res.solution.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </>}
      </div>
    </main></div>
  );
}
