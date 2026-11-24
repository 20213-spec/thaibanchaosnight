import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BackSide, BoxGeometry, BufferGeometry, CircleGeometry, Color, ConeGeometry, CylinderGeometry, Float32BufferAttribute, InstancedMesh,
  type Material, MeshBasicMaterial, MeshLambertMaterial, Object3D, SphereGeometry, CanvasTexture, type Group,
} from "three";
import type { Room } from "colyseus.js";
import { TEAMS, TREES, LAMPS, SIGNS, STILT_HOUSES, POND, TEMPLE, HUT, scatterPoints } from "../../shared/src/index.ts";
import { makeRng } from "../../shared/src/math/rng.ts";
import { settings } from "./settings.ts";
import { doorOpen, doorLocked } from "./doorState.ts";

/* ---------- shared geometry / materials (created once) ---------- */
const g = {
  sphere: new SphereGeometry(1, 10, 8), cone7: new ConeGeometry(1, 1, 7), cone4: new ConeGeometry(1, 1, 4),
  cyl6: new CylinderGeometry(1, 1, 1, 6), box: new BoxGeometry(1, 1, 1), circle: new CircleGeometry(1, 20),
};
const lam = (c: string) => new MeshLambertMaterial({ color: c });
const M = {
  white: lam("#ffffff"), wood: lam("#7A5A3A"), dark: lam("#3A3A3F"), wall: lam("#E8D3A8"), roof: lam("#8B3A2B"), gold: lam("#E8B923"), door: lam("#5A3E2B"),
  trunk: lam("#6B4A2B"), brick: lam("#8A5A3C"), windowDay: lam("#BFE6F5"), windowNight: new MeshBasicMaterial({ color: "#FFD27A" }),
  shadow: new MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.22, depthWrite: false }),
  smoke: new MeshBasicMaterial({ color: "#D0D0D0", transparent: true, opacity: 0.45, depthWrite: false }),
  bulbDay: new MeshBasicMaterial({ color: "#FFF6D6" }), bulbNight: new MeshBasicMaterial({ color: "#FFE08A" }),
  glow: new MeshBasicMaterial({ color: "#E8FF7A" }), cloud: new MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.92, fog: false }),
  cloudRain: new MeshBasicMaterial({ color: "#B7BFCA", transparent: true, opacity: 0.95, fog: false }), cloudStorm: new MeshBasicMaterial({ color: "#7E8794", transparent: true, opacity: 0.97, fog: false }),
  drop: new MeshBasicMaterial({ color: "#B9D0EE", transparent: true, opacity: 0.55, depthWrite: false }), leaf: new MeshBasicMaterial({ color: "#6FA83E" }),
};
type P3 = [number, number, number];
const Mesh = ({ geo, mat, p, s, r }: { geo: BufferGeometry; mat: Material; p?: P3; s?: P3; r?: P3 }) => <mesh geometry={geo} material={mat} position={p} scale={s} rotation={r} />;

/* ---------- instancing ---------- */
interface Item { x: number; y?: number; z: number; s?: number | P3; ry?: number; rx?: number; color?: string }
/** Many copies of one shape in a single draw call. */
function Instances({ geo, mat, items }: { geo: BufferGeometry; mat: Material; items: Item[] }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m || items.length === 0) return;
    const d = new Object3D(), c = new Color();
    items.forEach((it, i) => {
      d.position.set(it.x, it.y ?? 0, it.z); d.rotation.set(it.rx ?? 0, it.ry ?? 0, 0);
      if (Array.isArray(it.s)) d.scale.set(it.s[0], it.s[1], it.s[2]); else d.scale.setScalar(it.s ?? 1);
      d.updateMatrix(); m.setMatrixAt(i, d.matrix);
      if (it.color) { c.set(it.color); m.setColorAt(i, c); }
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [items]);
  if (items.length === 0) return null;
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} frustumCulled={false} />;
}

const GREENS = ["#2E8B4F", "#3A9A55", "#277A45", "#4BA85F"];
const hash = (i: number) => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;

/** All trees: trunks, conifer cones and round mango-style crowns (3 draw calls) plus contact shadows. */
export function Trees() {
  const { trunks, cones, crowns, shadows } = useMemo(() => {
    const trunks: Item[] = [], cones: Item[] = [], crowns: Item[] = [], shadows: Item[] = [];
    TREES.forEach((t, i) => {
      const h = 1.6 + hash(i) * 0.8, col = GREENS[i % GREENS.length];
      trunks.push({ x: t.x, y: h / 2, z: t.z, s: [0.28, h, 0.28] });
      if (i % 3 === 2) crowns.push({ x: t.x, y: h + 1.0, z: t.z, s: [1.7, 1.45, 1.7], color: col });
      else cones.push({ x: t.x, y: h + 1.2, z: t.z, s: [1.4, 3 + hash(i + 7), 1.4], color: col, ry: i });
      shadows.push({ x: t.x, y: 0.03, z: t.z, rx: -Math.PI / 2, s: [1.5, 1.5, 1] });
    });
    return { trunks, cones, crowns, shadows };
  }, []);
  return <>
    <Instances geo={g.cyl6} mat={M.trunk} items={trunks} /><Instances geo={g.cone7} mat={M.white} items={cones} />
    <Instances geo={g.sphere} mat={M.white} items={crowns} /><Instances geo={g.circle} mat={M.shadow} items={shadows} />
  </>;
}

/** Grass tufts, flowers, bushes and rice stalks. Amounts depend on the graphics setting (none on Low). */
export function Decor() {
  const q = settings.quality;
  const { grass, flowers, bushes, rice } = useMemo(() => {
    const nG = q === "high" ? 420 : q === "medium" ? 160 : 0, nF = q === "high" ? 160 : q === "medium" ? 60 : 0, nB = q === "high" ? 50 : q === "medium" ? 26 : 10;
    const grass = scatterPoints(21, nG, 0.4).map((p, i) => ({ x: p.x, y: 0.22, z: p.z, s: [0.09, 0.45, 0.09] as P3, ry: i, color: i % 3 ? "#5DAA4B" : "#7BC464" }));
    const palette = ["#FF8FB1", "#FFD23F", "#FFFFFF", "#B48CFF", "#FF9F1C"];
    const flowers = scatterPoints(22, nF, 0.4).map((p, i) => ({ x: p.x, y: 0.3, z: p.z, s: 0.13, color: palette[i % palette.length] }));
    const bushes = scatterPoints(23, nB, 1.0).map((p, i) => ({ x: p.x, y: 0.45, z: p.z, s: [0.7 + hash(i) * 0.5, 0.5, 0.7 + hash(i + 3) * 0.5] as P3, color: GREENS[i % GREENS.length] }));
    const rice: Item[] = [];
    if (q !== "low") for (let row = 0; row < 9; row++) for (let k = 0; k < 23; k += q === "high" ? 1 : 2) {
      const x = 16 + k * 0.9, z = -21 + row * 3.2;
      if (Math.hypot(x - HUT.x, z - HUT.z) < 2.4 || Math.hypot(x - 24, z + 14) < 1) continue; // keep the hut and scarecrow clear
      rice.push({ x, y: 0.35, z, s: [0.16, 0.7, 0.16], ry: k + row, color: (k + row) % 2 ? "#B5C94A" : "#9DBE3E" });
    }
    return { grass, flowers, bushes, rice };
  }, [q]);
  return <>
    <Instances geo={g.cone4} mat={M.white} items={grass} /><Instances geo={g.sphere} mat={M.white} items={flowers} />
    <Instances geo={g.sphere} mat={M.white} items={bushes} /><Instances geo={g.cone4} mat={M.white} items={rice} />
  </>;
}

/** Street lamps along the main road. Bulbs glow at night; on High two real lights near the plaza. */
export function Lamps({ night }: { night: boolean }) {
  const poles = useMemo(() => LAMPS.map((l) => ({ x: l.x, y: 1.6, z: l.z, s: [0.07, 3.2, 0.07] as P3 })), []);
  const bulbs = useMemo(() => LAMPS.map((l) => ({ x: l.x, y: 3.3, z: l.z, s: 0.24 })), []);
  return <>
    <Instances geo={g.cyl6} mat={M.dark} items={poles} /><Instances geo={g.sphere} mat={night ? M.bulbNight : M.bulbDay} items={bulbs} />
    {night && settings.quality === "high" && [2, 7].map((i) => <pointLight key={i} position={[LAMPS[i].x, 3.3, LAMPS[i].z]} color="#FFD27A" intensity={1.2} distance={14} />)}
  </>;
}

/** บ้านทรงไทยยกพื้น: posts, raised floor, walls, steep roof, windows that light up at night. */
/** Front door of a stilt house: hinged at its left edge, swings open (about 100 degrees) when doorOpen[id] is true. */
function HouseDoor({ id }: { id: string }) {
  const piv = useRef<Group>(null), lock = useRef<Group>(null);
  useFrame((_, dt) => {
    const p = piv.current; if (p) { const target = doorOpen[id] ? -1.75 : 0; p.rotation.y += (target - p.rotation.y) * Math.min(1, dt * 8); }
    if (lock.current) lock.current.visible = !!doorLocked[id]; // little padlock while the door waits for a calculation
  });
  return <group ref={piv} position={[-0.4, 2.1, 1.81]}>
    <Mesh geo={g.box} mat={M.door} p={[0.4, 0, 0]} s={[0.8, 1.3, 0.06]} />
    <group ref={lock} visible={false} position={[0.65, 0, 0.07]}><Mesh geo={g.box} mat={M.gold} s={[0.18, 0.16, 0.06]} /><Mesh geo={g.box} mat={M.dark} p={[0, 0.13, 0]} s={[0.06, 0.12, 0.04]} /></group>
  </group>;
}
export function StiltHouses({ night }: { night: boolean }) {
  const win = night ? M.windowNight : M.windowDay;
  return <>{STILT_HOUSES.map((h, n) => (
    <group key={n} position={[h.x, 0, h.z]} rotation={[0, n * 0.5, 0]}>
      {[[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]].map(([x, z], i) => <Mesh key={i} geo={g.cyl6} mat={M.wood} p={[x, 0.7, z]} s={[0.14, 1.4, 0.14]} />)}
      <Mesh geo={g.box} mat={M.wood} p={[0, 1.45, 0]} s={[4.4, 0.2, 4.4]} />
      <Mesh geo={g.box} mat={M.wall} p={[0, 2.45, 0]} s={[3.6, 1.8, 3.6]} />
      <HouseDoor id={`d${n}`} />
      <Mesh geo={g.box} mat={M.wood} p={[0, 0.5, 2.5]} s={[1.2, 0.12, 1.2]} r={[0, 0, 0]} /><Mesh geo={g.box} mat={M.wood} p={[0, 0.95, 2.1]} s={[1.2, 0.12, 0.7]} />
      <Mesh geo={g.box} mat={win} p={[1.81, 2.7, 0]} s={[0.06, 0.6, 0.8]} /><Mesh geo={g.box} mat={win} p={[-1.81, 2.7, 0]} s={[0.06, 0.6, 0.8]} /><Mesh geo={g.box} mat={win} p={[1.1, 2.75, 1.81]} s={[0.6, 0.6, 0.06]} />
      <Mesh geo={g.cone4} mat={M.roof} p={[0, 4.2, 0]} s={[3.1, 1.7, 3.1]} r={[0, Math.PI / 4, 0]} />
      <Mesh geo={g.cone4} mat={M.gold} p={[0, 5.3, 0]} s={[0.2, 0.7, 0.2]} r={[0, Math.PI / 4, 0]} />
    </group>
  ))}</>;
}

/** The five team houses: team-coloured walls, Thai-style roof, door, windows, chimney and a team flag. Chimney smoke is drawn by <Smoke/>. */
export const TEAM_CHIMNEYS = TEAMS.map((_, i) => ({ x: (i - 2) * 14 - 1.8, y: 4.4, z: 36.4 }));
export function TeamHouses({ night }: { night: boolean }) {
  const win = night ? M.windowNight : M.windowDay;
  return <>{TEAMS.map((t, i) => {
    const col = lam(t.color);
    return (
      <group key={t.id} position={[(i - 2) * 14, 0, 37]}>
        <Mesh geo={g.box} mat={col} p={[0, 1.5, 0]} s={[6, 3, 4]} />
        <Mesh geo={g.cone4} mat={M.roof} p={[0, 3.9, 0]} s={[4.9, 2.0, 4.9]} r={[0, Math.PI / 4, 0]} />
        <Mesh geo={g.box} mat={M.door} p={[0, 0.9, 2.02]} s={[1.0, 1.8, 0.1]} />
        <Mesh geo={g.box} mat={win} p={[-1.9, 1.8, 2.02]} s={[0.9, 0.8, 0.08]} /><Mesh geo={g.box} mat={win} p={[1.9, 1.8, 2.02]} s={[0.9, 0.8, 0.08]} />
        <Mesh geo={g.box} mat={M.wood} p={[0, 0.08, 2.7]} s={[2.4, 0.15, 1.2]} />
        <Mesh geo={g.box} mat={M.brick} p={[-1.8, 3.6, -0.6]} s={[0.6, 1.4, 0.6]} />
        <Mesh geo={g.cyl6} mat={M.wood} p={[3.7, 1.7, 2]} s={[0.05, 3.4, 0.05]} /><Mesh geo={g.box} mat={col} p={[4.3, 3.0, 2]} s={[1.1, 0.7, 0.04]} />
      </group>
    );
  })}</>;
}

/** Rising puffs from chimneys and temple incense. One instanced mesh; skipped on Low. */
export function Smoke({ sources }: { sources: { x: number; y: number; z: number }[] }) {
  const N = 7, ref = useRef<InstancedMesh>(null), d = useMemo(() => new Object3D(), []);
  useFrame((s) => {
    const m = ref.current;
    if (!m) return;
    const t = s.clock.elapsedTime;
    let i = 0;
    sources.forEach((src, si) => {
      for (let k = 0; k < N; k++) {
        const ph = (t * 0.35 + k / N + si * 0.13) % 1;
        d.position.set(src.x + Math.sin(t * 0.8 + k + si) * 0.25 * ph + ph * 0.6, src.y + ph * 3.2, src.z);
        d.scale.setScalar((0.12 + ph * 0.55) * (1 - ph * 0.4));
        d.updateMatrix(); m.setMatrixAt(i++, d.matrix);
      }
    });
    m.instanceMatrix.needsUpdate = true;
  });
  if (settings.quality === "low") return null;
  return <instancedMesh ref={ref} args={[g.sphere, M.smoke, sources.length * N]} frustumCulled={false} />;
}
export const TEMPLE_INCENSE = [{ x: TEMPLE.x - 1.5, y: 1.2, z: TEMPLE.z + 4.4 }, { x: TEMPLE.x + 1.5, y: 1.2, z: TEMPLE.z + 4.4 }];

/** Wooden direction signs with Thai text (billboards, so they are always readable). */
export function Sign({ text, x, z, y = 2.1, post = true }: { text: string; x: number; z: number; y?: number; post?: boolean }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 320; c.height = 96;
    const k = c.getContext("2d")!;
    k.fillStyle = "#7A5A3A"; k.fillRect(0, 0, 320, 96);
    k.strokeStyle = "#E8D3A8"; k.lineWidth = 6; k.strokeRect(6, 6, 308, 84);
    k.fillStyle = "#FFF3D6"; k.font = "700 40px 'Mali','Noto Sans Thai',sans-serif"; k.textAlign = "center"; k.textBaseline = "middle";
    k.fillText(text, 160, 50, 290);
    return new CanvasTexture(c);
  }, [text]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <group position={[x, 0, z]}>
      {post && <Mesh geo={g.cyl6} mat={M.wood} p={[0, 0.95, 0]} s={[0.07, 1.9, 0.07]} />}
      <sprite position={[0, y, 0]} scale={[2.4, 0.72, 1]}><spriteMaterial map={tex} /></sprite>
    </group>
  );
}
export const Signs = () => <>{SIGNS.map((s) => <Sign key={s.text} {...s} />)}</>;

/** Night fireflies drifting around the pond and the village edge. */
export function Fireflies() {
  const q = settings.quality, n = q === "high" ? 36 : q === "medium" ? 14 : 0;
  const base = useMemo(() => scatterPoints(33, n, 0.3), [n]);
  const ref = useRef<InstancedMesh>(null), d = useMemo(() => new Object3D(), []);
  useFrame((s) => {
    const m = ref.current;
    if (!m) return;
    const t = s.clock.elapsedTime;
    base.forEach((p, i) => { d.position.set(p.x + Math.sin(t * 0.5 + i) * 1.2, 1.1 + Math.sin(t * 0.9 + i * 2) * 0.6, p.z + Math.cos(t * 0.4 + i) * 1.2); d.scale.setScalar(0.07); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
    m.instanceMatrix.needsUpdate = true;
  });
  if (n === 0) return null;
  return <instancedMesh ref={ref} args={[g.sphere, M.glow, base.length]} frustumCulled={false} />;
}

/** Gradient sky dome, drifting clouds, sun by day, moon and stars at night. */
export function SkyDome({ night, weather = "clear" }: { night: boolean; weather?: string }) {
  const q = settings.quality;
  const geo = useMemo(() => {
    const s = new SphereGeometry(150, 16, 12), pos = s.attributes.position, col = new Float32Array(pos.count * 3);
    const gray = weather === "storm" ? ["#2F3A4A", "#6A7684"] : weather === "rain" ? ["#6D7B8C", "#A9B4BF"] : weather === "fog" ? ["#B9C4CC", "#D8DEE3"] : null;
    const top = new Color(night ? (gray ? "#04081C" : "#050A25") : gray ? gray[0] : "#5FA8E8"), hor = new Color(night ? (gray ? "#141C3A" : "#1B2A5A") : gray ? gray[1] : "#E3F4FF"), c = new Color();
    for (let i = 0; i < pos.count; i++) { c.copy(hor).lerp(top, Math.pow(Math.max(0, pos.getY(i) / 150), 0.6)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    s.setAttribute("color", new Float32BufferAttribute(col, 3));
    return s;
  }, [night, weather]);
  useEffect(() => () => geo.dispose(), [geo]);
  const stars = useMemo(() => {
    const n = night ? (q === "high" ? 260 : q === "medium" ? 120 : 0) : 0, arr = new Float32Array(n * 3), r = makeRng(5).next;
    for (let i = 0; i < n; i++) { const th = r() * Math.PI * 2, ph = Math.acos(0.15 + r() * 0.85); arr[i * 3] = 130 * Math.sin(ph) * Math.cos(th); arr[i * 3 + 1] = 130 * Math.cos(ph); arr[i * 3 + 2] = 130 * Math.sin(ph) * Math.sin(th); }
    const b = new BufferGeometry(); b.setAttribute("position", new Float32BufferAttribute(arr, 3));
    return b;
  }, [night, q]);
  useEffect(() => () => stars.dispose(), [stars]);
  const clouds = useRef<Group>(null);
  useFrame((_, dt) => { if (clouds.current) clouds.current.rotation.y += dt * (weather === "wind" ? 0.06 : weather === "storm" ? 0.03 : 0.012); });
  const cm = weather === "storm" ? M.cloudStorm : weather === "rain" || weather === "fog" ? M.cloudRain : M.cloud;
  const showSun = !night && (weather === "clear" || weather === "wind");
  const nCloud = q === "low" ? 3 : 7;
  return <>
    <mesh geometry={geo} renderOrder={-1}><meshBasicMaterial vertexColors side={BackSide} fog={false} depthWrite={false} /></mesh>
    {!night && <group ref={clouds}>{Array.from({ length: nCloud }, (_, i) => {
      const a = (i / nCloud) * Math.PI * 2, r = 70 + (i % 3) * 18, y = 48 + (i % 4) * 7;
      return <group key={i} position={[Math.cos(a) * r, y, Math.sin(a) * r]}>
        <Mesh geo={g.sphere} mat={cm} s={[7, 2.4, 3.4]} /><Mesh geo={g.sphere} mat={cm} p={[4.5, -0.3, 0.5]} s={[4.5, 1.9, 2.8]} /><Mesh geo={g.sphere} mat={cm} p={[-4.5, -0.4, -0.5]} s={[4, 1.7, 2.6]} />
      </group>;
    })}</group>}
    {showSun ? <mesh geometry={g.sphere} position={[70, 80, -90]} scale={7}><meshBasicMaterial color="#FFF2B0" fog={false} /></mesh>
      : night ? <mesh geometry={g.sphere} position={[-60, 85, -80]} scale={6}><meshBasicMaterial color="#EAF0FF" fog={false} /></mesh> : null}
    {night && q !== "low" && <points geometry={stars} frustumCulled={false}><pointsMaterial color="#FFFFFF" size={2} sizeAttenuation={false} fog={false} /></points>}
  </>;
}

/** Pond: water, expanding ripples, lily pads, rocks and reeds around the edge. */
export function Pond() {
  const rings = useRef<Group>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    rings.current?.children.forEach((m, i) => { const ph = (t * 0.25 + i / 3) % 1; m.scale.setScalar(0.3 + ph * 0.75); ((m as any).material).opacity = (1 - ph) * 0.45; });
  });
  const { rocks, reeds, pads } = useMemo(() => {
    const rocks: Item[] = [], reeds: Item[] = [], pads: Item[] = [];
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + 0.2; rocks.push({ x: POND.x + Math.cos(a) * (POND.r + 0.35), y: 0.12, z: POND.z + Math.sin(a) * (POND.r + 0.35), s: [0.3 + hash(i) * 0.2, 0.22, 0.3 + hash(i + 5) * 0.2], color: "#8D9199" }); }
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 + 0.5, r = POND.r + 0.05 + hash(i + 9) * 0.3; reeds.push({ x: POND.x + Math.cos(a) * r, y: 0.5, z: POND.z + Math.sin(a) * r, s: [0.06, 1.0 + hash(i) * 0.5, 0.06], color: "#5E9E3F" }); }
    for (let i = 0; i < 5; i++) { const a = i * 1.3, r = 0.6 + hash(i + 2) * (POND.r - 1.3); pads.push({ x: POND.x + Math.cos(a) * r, y: 0.06, z: POND.z + Math.sin(a) * r, rx: -Math.PI / 2, s: [0.4, 0.4, 1], color: "#3E8E41" }); }
    return { rocks, reeds, pads };
  }, []);
  return <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[POND.x, 0.04, POND.z]}><circleGeometry args={[POND.r, 28]} /><meshLambertMaterial color="#3FA7D6" /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[POND.x, 0.045, POND.z]}><ringGeometry args={[POND.r, POND.r + 0.5, 28]} /><meshLambertMaterial color="#8A6A3A" /></mesh>
    <group ref={rings} position={[POND.x, 0.07, POND.z]} rotation={[-Math.PI / 2, 0, 0]}>
      {[0, 1, 2].map((i) => <mesh key={i}><ringGeometry args={[POND.r * 0.9, POND.r * 0.96, 32]} /><meshBasicMaterial color="#FFFFFF" transparent opacity={0.3} depthWrite={false} /></mesh>)}
    </group>
    <Instances geo={g.sphere} mat={M.white} items={rocks} /><Instances geo={g.cone4} mat={M.white} items={reeds} /><Instances geo={g.circle} mat={M.white} items={pads} />
  </>;
}

/** Soft dark circle under every player (one draw call). Reads positions straight from the shared state. */
export function PlayerShadows({ room }: { room: Room }) {
  const ref = useRef<InstancedMesh>(null), d = useMemo(() => new Object3D(), []);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    let i = 0;
    (room.state as any).players.forEach((p: any) => {
      if (i >= 40) return;
      const h = Math.max(0, 1 - p.y * 0.35);
      d.position.set(p.x, 0.04, p.z); d.rotation.set(-Math.PI / 2, 0, 0); d.scale.set(0.55 * h, 0.55 * h, 1);
      d.updateMatrix(); m.setMatrixAt(i++, d.matrix);
    });
    m.count = i; m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[g.circle, M.shadow, 40]} frustumCulled={false} />;
}

/** Falling rain drops around the camera (instanced streaks). Fewer on weaker graphics settings. */
export function Rain({ heavy }: { heavy: boolean }) {
  const q = settings.quality, n = (q === "high" ? 520 : q === "medium" ? 260 : 90) * (heavy ? 1.4 : 1) | 0;
  const seeds = useMemo(() => { const r = makeRng(77).next; return Array.from({ length: n }, () => ({ x: (r() * 2 - 1) * 24, z: (r() * 2 - 1) * 24, y: r() * 18, v: 16 + r() * 8 })); }, [n]);
  const ref = useRef<InstancedMesh>(null), d = useMemo(() => new Object3D(), []);
  useFrame((s, dt) => {
    const m = ref.current;
    if (!m) return;
    const cam = s.camera.position;
    seeds.forEach((p, i) => {
      p.y -= p.v * Math.min(dt, 0.05); if (p.y < 0) p.y += 18;
      d.position.set(cam.x + p.x, p.y, cam.z + p.z); d.rotation.set(0, 0, 0.12); d.scale.set(0.02, 0.55, 0.02); d.updateMatrix(); m.setMatrixAt(i, d.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[g.box, M.drop, n]} frustumCulled={false} />;
}

/** Leaves blown across the scene by strong wind. */
export function Leaves() {
  const q = settings.quality, n = q === "high" ? 70 : q === "medium" ? 32 : 0;
  const seeds = useMemo(() => { const r = makeRng(88).next; return Array.from({ length: n }, () => ({ x: (r() * 2 - 1) * 26, z: (r() * 2 - 1) * 26, y: 0.5 + r() * 5, v: 5 + r() * 5, ph: r() * 6 })); }, [n]);
  const ref = useRef<InstancedMesh>(null), d = useMemo(() => new Object3D(), []);
  useFrame((s, dt) => {
    const m = ref.current;
    if (!m) return;
    const cam = s.camera.position, t = s.clock.elapsedTime;
    seeds.forEach((p, i) => {
      p.x += p.v * Math.min(dt, 0.05); if (p.x > 26) p.x -= 52;
      d.position.set(cam.x + p.x, p.y + Math.sin(t * 2 + p.ph) * 0.6, cam.z + p.z); d.rotation.set(t * 3 + p.ph, t * 2, 0); d.scale.set(0.16, 0.02, 0.1); d.updateMatrix(); m.setMatrixAt(i, d.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  if (n === 0) return null;
  return <instancedMesh ref={ref} args={[g.box, M.leaf, n]} frustumCulled={false} />;
}
