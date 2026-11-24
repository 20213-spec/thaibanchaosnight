import { useEffect, useState } from "react";
import type { Room } from "colyseus.js";

interface Q { index: number; total: number; text: string; choices: string[] }

/** Chaos Party quiz round. Always mounted so it never misses the first question message; shows only while `active`. */
export function Quiz({ room, active, open, setOpen }: { room: Room; active: boolean; open: boolean; setOpen: (v: boolean) => void }) {
  const [q, setQ] = useState<Q | null>(null);
  const [endAt, setEndAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [picked, setPicked] = useState(-1);
  const [res, setRes] = useState<{ correct: boolean; gained: number; first?: boolean } | null>(null);
  const [reveal, setReveal] = useState<{ correctIndex: number; solution: string[] } | null>(null);

  useEffect(() => {
    const offs = [
      room.onMessage("quiz:q", (m: Q & { seconds: number }) => { setQ(m); setEndAt(Date.now() + m.seconds * 1000); setPicked(-1); setRes(null); setReveal(null); setOpen(true); }), // a new question opens the sheet again
      room.onMessage("quiz:result", (m: any) => setRes(m)),
      room.onMessage("quiz:end", (m: any) => setReveal(m)),
    ];
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => { offs.forEach((o) => o()); clearInterval(iv); };
  }, [room, setOpen]);

  if (!active || !q) return null;
  const left = reveal ? 0 : Math.max(0, Math.ceil((endAt - now) / 1000));
  if (!open) { // sheet hidden: the player can walk around; this chip brings it back
    return <button className="quizchip" onClick={() => setOpen(true)}>{reveal ? "📖 ดูเฉลยข้อนี้" : picked >= 0 ? `✅ ตอบแล้ว รอเฉลย (${left}s)` : `📝 กลับไปตอบ (เหลือ ${left}s)`}</button>;
  }
  return (
    <div className="overlay"><main>
      <button className="wide" onClick={() => setOpen(false)}>🏃 {picked >= 0 || reveal ? "ตอบแล้ว กลับไปเดิน" : "พักเดินก่อน (กลับมาตอบได้)"}</button>
      <h1>คำถามที่ {q.index + 1}/{q.total}</h1>
      <p className="mute">{reveal ? "เฉลย" : `เหลือ ${left} วินาที · ตอบได้ครั้งเดียว ตอบถูกคนแรกของห้องได้โบนัส`}</p>
      <p className="q">{q.text}</p>
      {q.choices.map((c, i) => (
        <button key={i} className={"ch" + (reveal ? (i === reveal.correctIndex ? " ok" : i === picked ? " bad" : "") : i === picked ? " ok" : "")}
          disabled={picked >= 0 || !!reveal || left === 0} onClick={() => { setPicked(i); room.send("quiz:answer", { index: i }); }}>{c}</button>
      ))}
      {res && <p aria-live="polite">{res.correct ? `ถูกต้อง +${res.gained} คะแนน${res.first ? " (ตอบถูกคนแรก!)" : ""}` : "ผิด ไม่เสียคะแนน"}</p>}
      {!res && picked >= 0 && !reveal && <p className="mute">ส่งคำตอบแล้ว รอเฉลย…</p>}
      {reveal && <ol>{reveal.solution.map((s, i) => <li key={i}>{s}</li>)}</ol>}
    </main></div>
  );
}
