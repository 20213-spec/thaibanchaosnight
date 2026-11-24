import { useEffect, useState } from "react";
import type { Room } from "colyseus.js";
import { INGREDIENTS } from "../../shared/src/index.ts";

interface Order { id: string; name: string; icon: string; steps: string[]; limitMs: number; dishes: number }

/** Cooking round sheet: tap the ingredients in the recipe's order. Always mounted so it never misses the first order message. */
export function Cook({ room, open, phaseLeft, onClose }: { room: Room; open: boolean; phaseLeft: number; onClose: () => void }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState("");
  const [shake, setShake] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const offs = [
      room.onMessage("cook:order", (m: Order) => { setOrder(m); setStep(0); }),
      room.onMessage("cook:progress", (m: { step: number }) => setStep(m.step)),
      room.onMessage("cook:wrong", () => { setStep(0); setMsg("ผิดลำดับ! เริ่มจานนี้ใหม่ (ไม่เสียคะแนน)"); setShake(true); window.setTimeout(() => setShake(false), 350); }),
      room.onMessage("cook:done", (m: { dish: string; icon: string; gained: number; bonus: number; order: Order }) => {
        setTotal((t) => t + m.gained); setMsg(`${m.icon} ${m.dish} เสร็จแล้ว! +${m.gained}${m.bonus > 0 ? ` (เร็ว +${m.bonus})` : ""}`);
        setOrder(m.order); setStep(0);
      }),
      room.onMessage("cook:far", () => { setMsg("ไกลจากเตาเกินไป เดินเข้าไปใกล้ก่อน"); onClose(); }),
    ];
    return () => offs.forEach((off) => off());
  }, [room]);

  if (!open) return null;
  const leave = () => { room.send("cook", { a: "stop" }); onClose(); };
  return (
    <div className="overlay"><main>
      <button className="wide" onClick={leave}>🏃 กลับไปเดิน (เหลือเวลา {phaseLeft} วินาที)</button>
      <h1>🍳 ทำอาหาร</h1>
      {order ? <>
        <p className="q">{order.icon} {order.name}</p>
        <p className="mute small">แตะวัตถุดิบตามลำดับให้เร็วที่สุด ผิดลำดับแค่เริ่มจานนี้ใหม่ ไม่เสียคะแนน · ทำเสร็จ {order.dishes} จาน (+{total})</p>
        <div className={"cookslots" + (shake ? " cookshake" : "")}>
          {order.steps.map((id, i) => {
            const ing = INGREDIENTS.find((x) => x.id === id);
            return <span key={i} className={"slot" + (i < step ? " done" : i === step ? " now" : "")}><span>{i < step ? "✓" : ing?.icon}</span><small>{ing?.name}</small></span>;
          })}
        </div>
        <div className="cookgrid">
          {INGREDIENTS.map((ing) => (
            <button key={ing.id} aria-label={ing.name} onClick={() => room.send("cook", { a: "add", ing: ing.id })}><span>{ing.icon}</span><small>{ing.name}</small></button>
          ))}
        </div>
      </> : <p className="mute">กำลังเตรียมเตา…</p>}
      <p aria-live="polite">{msg}</p>
    </main></div>
  );
}
