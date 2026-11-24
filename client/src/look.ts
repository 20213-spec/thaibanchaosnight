import { cleanLook, DEFAULT_LOOK, type Look } from "../../shared/src/index.ts";
export type { Look };

/** The player's chosen look, kept in this browser so it can be used before joining any room. The server validates it again. */
const KEY = "tbcn-look";

export function loadLook(): Look {
  try { return cleanLook(JSON.parse(localStorage.getItem(KEY) ?? "null")) ?? { ...DEFAULT_LOOK }; } catch { return { ...DEFAULT_LOOK }; }
}
export function saveLook(l: Look) {
  try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* ignore */ }
}
