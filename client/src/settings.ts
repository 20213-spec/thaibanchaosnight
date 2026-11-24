/** Local-only preferences (stored in this browser). */
export type Quality = "low" | "medium" | "high";
import { DEFAULT_VOLUME, type Volume } from "../../shared/src/index.ts";
export interface Settings { sensitivity: number; quality: Quality; hints: boolean; volume: Volume; muted: boolean }
const KEY = "tbcn-settings";

function defaultQuality(): Quality {
  try { return matchMedia("(pointer: coarse)").matches ? "medium" : "high"; } catch { return "high"; } // phones start on medium
}

function load(): Settings {
  const d: Settings = { sensitivity: 1, quality: defaultQuality(), hints: true, volume: { ...DEFAULT_VOLUME }, muted: false };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (typeof raw.sensitivity === "number" && raw.sensitivity >= 0.3 && raw.sensitivity <= 2.5) d.sensitivity = raw.sensitivity;
    if (raw.quality === "low" || raw.quality === "medium" || raw.quality === "high") d.quality = raw.quality;
    if (typeof raw.hints === "boolean") d.hints = raw.hints;
    if (typeof raw.muted === "boolean") d.muted = raw.muted;
    for (const k of Object.keys(DEFAULT_VOLUME) as (keyof Volume)[]) { const v = raw.volume?.[k]; if (typeof v === "number" && v >= 0 && v <= 1) d.volume[k] = v; }
  } catch { /* storage unavailable: use defaults */ }
  return d;
}

export const settings: Settings = load(); // shared, mutable; read it each frame/render

export function saveSettings(patch: Partial<Settings>) {
  Object.assign(settings, patch);
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}
