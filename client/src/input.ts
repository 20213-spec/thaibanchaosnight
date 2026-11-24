/** Shared input state, written by keyboard/touch handlers, read every frame by the game loop (no React re-render). */
export const input = { jx: 0, jz: 0, run: false, jump: false, interact: false, yaw: 0, blocked: false, keys: new Set<string>() };

export function axis(): { x: number; z: number } {
  const k = input.keys;
  let x = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0) + input.jx;
  let z = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0) + input.jz;
  const len = Math.hypot(x, z);
  if (len > 1) { x /= len; z /= len; }
  return { x, z };
}

export function bindKeyboard(): () => void {
  const down = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if ((e.target as HTMLElement)?.tagName === "SELECT") return;
    if (k === " ") { input.jump = true; e.preventDefault(); }
    else if (k === "e") input.interact = true;
    else if (k === "shift") input.run = true;
    else input.keys.add(k);
  };
  const up = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === "shift") input.run = false;
    else input.keys.delete(k);
  };
  const blur = () => { input.keys.clear(); input.run = false; };
  addEventListener("keydown", down); addEventListener("keyup", up); addEventListener("blur", blur);
  return () => { removeEventListener("keydown", down); removeEventListener("keyup", up); removeEventListener("blur", blur); };
}
