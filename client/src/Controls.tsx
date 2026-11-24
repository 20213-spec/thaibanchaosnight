import { useRef } from "react";
import { input } from "./input.ts";

/** Touch controls: left joystick = move, buttons = jump/run/interact. Dragging the empty screen rotates the camera (see Game). */
export function Controls({ canInteract }: { canInteract: boolean }) {
  const knob = useRef<HTMLDivElement>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const R = 48;
  const move = (e: React.PointerEvent) => {
    if (!origin.current) return;
    let dx = e.clientX - origin.current.x, dy = e.clientY - origin.current.y;
    const len = Math.hypot(dx, dy);
    if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
    input.jx = dx / R; input.jz = -dy / R;
    if (knob.current) knob.current.style.transform = `translate(${dx}px,${dy}px)`;
  };
  const end = () => { origin.current = null; input.jx = 0; input.jz = 0; if (knob.current) knob.current.style.transform = ""; };
  return (
    <div className="controls">
      <div className="joy" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); const r = e.currentTarget.getBoundingClientRect(); origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; move(e); }}
        onPointerMove={move} onPointerUp={end} onPointerCancel={end}><div className="knob" ref={knob} /></div>
      <div className="btns">
        <button className="cb" onPointerDown={() => (input.run = !input.run)} aria-label="วิ่ง">วิ่ง</button>
        <button className="cb" onPointerDown={() => (input.jump = true)} aria-label="กระโดด">กระโดด</button>
        <button className={"cb" + (canInteract ? " hot" : "")} onPointerDown={() => (input.interact = true)} aria-label="โต้ตอบ">โต้ตอบ</button>
      </div>
    </div>
  );
}
