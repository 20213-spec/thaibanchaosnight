import { useEffect, useState } from "react";
import type { Room } from "colyseus.js";

interface Q { id: string; text: string; choices: string[] }

/** Question that unlocks a locked house door (M6.2). Wrong answers cost nothing; the reward is a story note from inside the house. */
export function LockPuzzle({ room, doorId, onClose }: { room: Room; doorId: string; onClose: () => void }) {
  const [q, setQ] = useState<Q | null>(null);
  const [note, setNote] = useState("");
  const [solution, setSolution] = useState<string[]>([]);
  const [okIdx, setOkIdx] = useState(-1);
  const [badIdx, setBadIdx] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const offs = [
      room.onMessage("lock:question", (m: Q) => { if (m.id === doorId) { setQ(m); setNote(""); setSolution([]); setOkIdx(-1); setBadIdx([]); setDone(false); } }),
      room.onMessage("lock:result", (m: any) => {
        if (m.gone) { setDone(true); setNote("มีคนปลดล็อกประตูนี้ไปก่อนแล้ว"); }
        else if (m.correct) { setDone(true); setOkIdx(m.correctIndex); setSolution(m.solution ?? []); setNote(`🔓 ปลดล็อกแล้ว! ในบ้านพบโน้ต: ${m.note}`); }
        else setNote("ยังไม่ถูก ลองใหม่ได้ ไม่หักคะแนน");
      }),
    ];
    room.send("lock:new", { id: doorId });
    return () => offs.forEach((off) => off());
  }, [room, doorId]);

  return (
    <div className="overlay"><main>
      <button onClick={onClose}>กลับไปเดิน</button>
      <h1>🔒 ประตูล็อกอยู่</h1>
      <p className="mute">ตอบโจทย์ให้ถูกเพื่อปลดล็อกประตู ตอบผิดไม่เสียอะไร</p>
      <div className="team">
        {q ? <><p className="q">{q.text}</p>
          {q.choices.map((c, i) => <button key={i} className={"ch" + (i === okIdx ? " ok" : badIdx.includes(i) ? " bad" : "")} disabled={done || badIdx.includes(i)}
            onClick={() => { setBadIdx((b) => [...b, i]); room.send("lock:answer", { index: i }); }}>{c}</button>)}</> : <p className="mute">กำลังโหลดโจทย์…</p>}
        <p className="mute" aria-live="polite">{note}</p>
        {solution.length > 0 && <ol>{solution.map((s, i) => <li key={i}>{s}</li>)}</ol>}
      </div>
    </main></div>
  );
}
