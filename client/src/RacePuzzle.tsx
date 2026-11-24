import { useEffect, useState } from "react";
import type { Room } from "colyseus.js";

export interface RaceInfo { text: string; choices: string[]; endAt: number }

/** Team math race question (M6.3). Wrong answers cost nothing; the first correct answer of a team sets its rank. */
export function RacePuzzle({ room, race, ended, onClose }: { room: Room; race: RaceInfo; ended: { correctIndex: number; solution: string[] } | null; onClose: () => void }) {
  const [left, setLeft] = useState(Math.max(0, Math.ceil((race.endAt - Date.now()) / 1000)));
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [bad, setBad] = useState<number[]>([]);

  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, Math.ceil((race.endAt - Date.now()) / 1000))), 500);
    const off = room.onMessage("race:result", (m: any) => {
      if (m.correct) { setDone(true); setNote(m.gained > 0 ? `🏁 ทีมคุณได้อันดับ ${m.rank}! ทุกคนในทีมได้ +${m.gained} คะแนน` : `🏁 ทีมคุณตอบถูกแล้ว (อันดับ ${m.rank})`); }
      else setNote("ยังไม่ถูก ลองใหม่ได้ ไม่หักคะแนน");
    });
    return () => { clearInterval(t); off(); };
  }, [room, race.endAt]);

  const over = left <= 0 || ended !== null;
  return (
    <div className="overlay"><main>
      <button onClick={onClose}>กลับไปเดิน</button>
      <h1>⚡ โจทย์ชิงธง</h1>
      <p className="mute">{over ? "หมดเวลาแล้ว" : `เหลือ ${left} วินาที ทีมที่ตอบถูกเร็วที่สุดได้คะแนนมากที่สุด ตอบผิดไม่เสียอะไร`}</p>
      <div className="team">
        <p className="q">{race.text}</p>
        {race.choices.map((c, i) => <button key={i} className={"ch" + (ended && i === ended.correctIndex ? " ok" : bad.includes(i) ? " bad" : "")} disabled={over || done || bad.includes(i)}
          onClick={() => { setBad((b) => [...b, i]); room.send("race:answer", { index: i }); }}>{c}</button>)}
        <p className="mute" aria-live="polite">{note}</p>
        {ended && <ol>{ended.solution.map((s, i) => <li key={i}>{s}</li>)}</ol>}
      </div>
    </main></div>
  );
}
