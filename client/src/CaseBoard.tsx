import { useState } from "react";
import type { Room } from "colyseus.js";
import { SUSPECTS, ATTR_LABEL, CASE, CASE_SPOT_NAMES, type ClueAttr } from "../../shared/src/index.ts";

export interface CaseClue { id: string; attr: ClueAttr; text: string }
export interface CaseView { clues: CaseClue[]; solved: boolean; culprit: string; note: string }
export const emptyCase: CaseView = { clues: [], solved: false, culprit: "", note: "" };

/** Case board: found clues (private to the team), the five suspects, a local "rule out" mark and the accuse button. The server decides everything. */
export function CaseBoard({ room, view, onClose }: { room: Room; view: CaseView; onClose: () => void }) {
  const [struck, setStruck] = useState<Set<string>>(new Set()); // purely a personal note on this device
  const toggle = (id: string) => setStruck((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const found = [...view.clues].sort((a, b) => a.id.localeCompare(b.id));
  return (
    <>
      <div className="bar"><h1 style={{ margin: 0, flex: 1 }}>สืบคดีผีโนนสุข</h1><button onClick={onClose}>กลับไปเล่น</button></div>
      <p className="mute small">มีผีตัวการ 1 ตนจาก 5 ตน เบาะแส {CASE_SPOT_NAMES.length} จุดกระจายทั่วหมู่บ้าน (เสาแสงสีม่วง) แต่ละจุดบอกว่าผีตัวการ "ไม่ใช่" แบบไหน ให้เทียบกับการ์ดด้านล่างแล้วตัดออก เมื่อเหลือไม่เกิน 2 ตนจึงชี้ตัวได้ ชี้ผิดไม่เสียคะแนน แค่รอ {CASE.accuseCooldownMs / 1000} วินาที (ชี้ถูกทีมแรกได้ +{CASE.solveFirst} ต่อคน ทีมถัดไป +{CASE.solveLater})</p>
      <h2>เบาะแสที่ทีมพบ ({found.length}/{CASE_SPOT_NAMES.length})</h2>
      {found.length === 0 && <p className="mute small">ยังไม่พบเบาะแส ไปที่เสาแสงสีม่วงแล้วกดโต้ตอบ</p>}
      <ul>{found.map((k) => <li key={k.id}>{k.text}</li>)}</ul>
      {view.note && <p role="status"><b>{view.note}</b></p>}
      <h2>ตัวต้องสงสัย</h2>
      {SUSPECTS.map((s) => {
        const culprit = view.solved && view.culprit === s.id;
        return (
          <div key={s.id} className="team" style={{ ["--c" as any]: culprit ? "#2E9E4F" : "#7B3FE4", opacity: struck.has(s.id) && !culprit ? 0.45 : 1 } as React.CSSProperties}>
            <div className="th"><b style={{ textDecoration: struck.has(s.id) && !culprit ? "line-through" : "none" }}>{culprit ? "🎯 " : ""}{s.name}</b></div>
            <p className="mute small">{ATTR_LABEL.place}: {s.place} · {ATTR_LABEL.item}: {s.item} · {ATTR_LABEL.sound}: {s.sound}</p>
            <div className="bar">
              <button onClick={() => toggle(s.id)} aria-pressed={struck.has(s.id)}>{struck.has(s.id) ? "คืนกลับ" : "ตัดออก"}</button>
              <button className="go" disabled={view.solved} onClick={() => room.send("case:accuse", { suspect: s.id })}>ชี้ตัว</button>
            </div>
          </div>
        );
      })}
      <p className="mute small">การตัดออกเป็นแค่โน้ตบนเครื่องคุณ เฉลยจริงอยู่ที่ server และจะเปิดให้ทีมที่ชี้ถูกเท่านั้น</p>
    </>
  );
}
