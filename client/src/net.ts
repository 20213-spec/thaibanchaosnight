import { Client, Room } from "colyseus.js";

const url = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? `ws://${location.hostname}:2567`;
export const client = new Client(url);
export const httpUrl = url.replace(/^ws/, "http");

export interface PlayerView { id: string; name: string; team: string; ready: boolean; score: number; connected: boolean; skin: number; hat: number; hair: number; hairColor: number; top: number; bottom: number; bottomColor: number; shoes: number; fishing: boolean; acc: string; role: string; carrying: boolean; scared: boolean; delivered: number; gadget: boolean }
export interface Snapshot { players: PlayerView[]; hostId: string; started: boolean; ended: boolean; secondsLeft: number; specialActive: boolean; mode: string; phase: string; phaseLeft: number; round: number; roundTitle: string; weather: string; orbs: { id: string; x: number; z: number }[]; gadgets: { id: string; x: number; z: number }[]; crates: { id: string; x: number; z: number }[]; ghosts: { id: string; kind: string }[] }

export function snapshot(state: any): Snapshot {
  const players: PlayerView[] = [];
  state.players.forEach((p: any, id: string) =>
    players.push({ id, name: p.name, team: p.team, ready: p.ready, score: p.score, connected: p.connected, skin: p.skin, hat: p.hat, hair: p.hair, hairColor: p.hairColor, top: p.top, bottom: p.bottom, bottomColor: p.bottomColor, shoes: p.shoes, fishing: p.fishing, acc: p.acc, role: p.role, carrying: p.carrying, scared: p.scared, delivered: p.delivered, gadget: !!p.gadget }));
  const ghosts: { id: string; kind: string }[] = [];
  state.ghosts?.forEach((g: any, id: string) => ghosts.push({ id, kind: g.kind }));
  const orbs: { id: string; x: number; z: number }[] = [];
  state.orbs?.forEach((o: any, id: string) => { if (o.active) orbs.push({ id, x: o.x, z: o.z }); });
  const gadgets: { id: string; x: number; z: number }[] = [], crates: { id: string; x: number; z: number }[] = [];
  state.gadgets?.forEach((o: any, id: string) => { if (o.active) gadgets.push({ id, x: o.x, z: o.z }); });
  state.crates?.forEach((o: any, id: string) => { if (o.active) crates.push({ id, x: o.x, z: o.z }); });
  return { players, hostId: state.hostId, started: state.started, ended: state.ended, secondsLeft: state.secondsLeft, specialActive: !!state.evidence?.get("sp")?.active, mode: state.mode, phase: state.phase, phaseLeft: state.phaseLeft, round: state.round, roundTitle: state.roundTitle, weather: state.weather, orbs, gadgets, crates, ghosts }
}

/** Private random token that identifies this browser's wallet. Stored locally, sent only to the server, never shown to others. */
export function playerKey(): string {
  const gen = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
  try {
    let k = localStorage.getItem("tbcn-key");
    if (!k || !/^[A-Za-z0-9_-]{16,64}$/.test(k)) { k = gen(); localStorage.setItem("tbcn-key", k); }
    return k;
  } catch { return gen(); } // storage blocked: wallet will not persist
}
import { loadLook } from "./look.ts";
export const createRoom = (name: string): Promise<Room> => client.create("game", { name, key: playerKey(), ...loadLook() });
export const joinRoom = (code: string, name: string): Promise<Room> => client.joinById(code.trim(), { name, key: playerKey(), ...loadLook() });

export async function shopApi(path: string, body?: object): Promise<any> {
  const res = await fetch(httpUrl + "/shop" + path, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", "x-player-key": playerKey() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(d?.error ?? String(res.status)), { wallet: d?.wallet });
  return d;
}

export const TOKEN_KEY = "tbcn-rt";
export const reconnectWith = (token: string): Promise<Room> => client.reconnect(token);

export const lookOf = (p: Pick<PlayerView, "skin" | "hat" | "hair" | "hairColor" | "top" | "bottom" | "bottomColor" | "shoes">) =>
  ({ skin: p.skin, hat: p.hat, hair: p.hair, hairColor: p.hairColor, top: p.top, bottom: p.bottom, bottomColor: p.bottomColor, shoes: p.shoes });
