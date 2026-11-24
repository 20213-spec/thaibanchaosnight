import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import type { Room } from "colyseus.js";
import { settings } from "./settings.ts";
import { Avatar, newMotion } from "./Avatar.tsx";
import { DEFAULT_LOOK } from "../../shared/src/index.ts";

/** Evidence orb: reads the live server state every frame (no React re-render per patch). */
export function EvidenceOrb({ room, id, fog = false }: { room: Room; id: string; fog?: boolean }) {
  const g = useRef<Group>(null), a = useRef<Mesh>(null), b = useRef<Mesh>(null);
  useFrame((s) => {
    const e = (room.state as any).evidence.get(id);
    if (!g.current || !e) return;
    const near = !fog || e.special || Math.hypot(s.camera.position.x - e.x, s.camera.position.z - e.z) < 14; // in fog only nearby evidence can be seen
    g.current.visible = e.active && near;
    g.current.position.set(e.x, 1.1 + Math.sin(s.clock.elapsedTime * 2 + e.x) * 0.15, e.z);
    g.current.rotation.y = s.clock.elapsedTime;
    if (a.current) a.current.visible = !e.special; // cyan = normal evidence, gold = special mission
    if (b.current) b.current.visible = !!e.special;
  });
  return (
    <group ref={g}>
      <mesh ref={a}><octahedronGeometry args={[0.45]} /><meshLambertMaterial color="#5FE3F0" emissive="#1BA7B8" /></mesh>
      <mesh ref={b} visible={false}><octahedronGeometry args={[0.9]} /><meshLambertMaterial color="#FFD23F" emissive="#FF9F1C" /></mesh>
      {settings.quality === "high" && <pointLight color="#5FE3F0" intensity={0.8} distance={6} />}
    </group>
  );
}

/** Chaos Party collect-round orb (position comes from the snapshot; picked up automatically by walking into it). */
export function PartyOrb({ x, z }: { x: number; z: number }) {
  const g = useRef<Group>(null);
  useFrame((s) => { if (g.current) { g.current.rotation.y = s.clock.elapsedTime * 2; g.current.position.y = 0.9 + Math.sin(s.clock.elapsedTime * 3 + x) * 0.12; } });
  return <group ref={g} position={[x, 0.9, z]}><mesh><octahedronGeometry args={[0.4]} /><meshLambertMaterial color="#FFD23F" emissive="#FF9F1C" /></mesh></group>;
}

/** AI ghost (server-controlled, harmless). Look depends on its kind; only the lantern ghost carries a light (cheap on phones). */
export function AIGhost({ room, id, kind, fog = false }: { room: Room; id: string; kind: string; fog?: boolean }) {
  const g = useRef<Group>(null);
  useFrame((s, dt) => {
    const gh = (room.state as any).ghosts.get(id);
    if (!g.current || !gh) return;
    const k = 1 - Math.exp(-(kind === "prankster" ? 30 : 6) * Math.min(dt, 0.1)); // the prankster snaps to new spots, the others glide
    g.current.position.x += (gh.x - g.current.position.x) * k;
    g.current.position.z += (gh.z - g.current.position.z) * k;
    g.current.position.y = (kind === "shadow" ? 1.1 : 1.6) + Math.sin(s.clock.elapsedTime * 1.5 + gh.x) * 0.3;
    g.current.visible = !fog || Math.hypot(s.camera.position.x - g.current.position.x, s.camera.position.z - g.current.position.z) < 10; // fog hides ghosts until they are close
  });
  const look = ({
    lantern: { c: "#F4F7FF", e: "#9FB4FF", o: 0.8, s: 1 },
    prankster: { c: "#FFF0F6", e: "#FF9AC8", o: 0.85, s: 0.8 },
    shadow: { c: "#2A2A44", e: "#000000", o: 0.6, s: 1.15 },
    guardian: { c: "#F3D98B", e: "#9A7A1F", o: 0.85, s: 1.3 },
  } as Record<string, { c: string; e: string; o: number; s: number }>)[kind] ?? { c: "#fff", e: "#999", o: 0.8, s: 1 };
  return (
    <group ref={g} scale={look.s}>
      <mesh><sphereGeometry args={[0.7, 14, 12]} /><meshLambertMaterial color={look.c} transparent opacity={look.o} emissive={look.e} /></mesh>
      <mesh position={[0, -0.9, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.7, 1.2, 10]} /><meshLambertMaterial color={look.c} transparent opacity={look.o * 0.75} /></mesh>
      {kind !== "shadow" && <>
        <mesh position={[-0.22, 0.1, 0.62]}><sphereGeometry args={[0.1, 8, 8]} /><meshBasicMaterial color="#222" /></mesh>
        <mesh position={[0.22, 0.1, 0.62]}><sphereGeometry args={[0.1, 8, 8]} /><meshBasicMaterial color="#222" /></mesh></>}
      {kind === "prankster" && <mesh position={[0, -0.15, 0.64]}><boxGeometry args={[0.4, 0.08, 0.05]} /><meshBasicMaterial color="#222" /></mesh>}
      {kind === "lantern" && settings.quality === "high" && <pointLight color="#FFD27A" intensity={1.2} distance={9} />}
    </group>
  );
}

/** Searchable object marker: a small wooden chest that bobs a little. Hidden once this player has searched it. */
export function SearchMark({ x, z }: { x: number; z: number }) {
  const g = useRef<Group>(null);
  useFrame((s) => { if (g.current) g.current.position.y = 0.55 + Math.sin(s.clock.elapsedTime * 2 + x) * 0.06; });
  return (
    <group ref={g} position={[x, 0.55, z]}>
      <mesh><boxGeometry args={[0.7, 0.45, 0.5]} /><meshLambertMaterial color="#A5703A" /></mesh>
      <mesh position={[0, 0.3, 0]}><boxGeometry args={[0.74, 0.12, 0.54]} /><meshLambertMaterial color="#FFD27A" emissive="#B07A10" /></mesh>
    </group>
  );
}

/** Teammate ping beacon (M3.12): a tall cyan beam with a bobbing arrow, visible from far away. */
export function PingMark({ x, z }: { x: number; z: number }) {
  const a = useRef<Mesh>(null);
  useFrame((s) => { if (a.current) a.current.position.y = 3.2 + Math.sin(s.clock.elapsedTime * 3) * 0.3; });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 2, 0]}><cylinderGeometry args={[0.07, 0.07, 4, 8]} /><meshBasicMaterial color="#5EE6F5" transparent opacity={0.55} /></mesh>
      <mesh ref={a} position={[0, 3.2, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.4, 0.7, 4]} /><meshBasicMaterial color="#5EE6F5" /></mesh>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.6, 0.85, 24]} /><meshBasicMaterial color="#5EE6F5" transparent opacity={0.8} /></mesh>
    </group>
  );
}

/** Boss event marker (I3): a red-orange ring showing how close you must stand, a flame beam and a floating spirit light. */
export function BossMark({ x, z, radius }: { x: number; z: number; radius: number }) {
  const a = useRef<Mesh>(null), r = useRef<Mesh>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (a.current) a.current.position.y = 2.4 + Math.sin(t * 2.5) * 0.35;
    if (r.current) r.current.scale.setScalar(1 + Math.sin(t * 3) * 0.04);
  });
  return (
    <group position={[x, 0, z]}>
      <mesh ref={r} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[radius - 0.25, radius, 48]} /><meshBasicMaterial color="#FF6B2C" transparent opacity={0.7} /></mesh>
      <mesh position={[0, 3, 0]}><cylinderGeometry args={[0.1, 0.1, 6, 8]} /><meshBasicMaterial color="#FF9F5A" transparent opacity={0.45} /></mesh>
      <mesh ref={a} position={[0, 2.4, 0]}><sphereGeometry args={[0.55, 16, 12]} /><meshBasicMaterial color="#FFD27A" transparent opacity={0.9} /></mesh>
    </group>
  );
}

/** Village head NPC (M3.8): stands still in the middle of the village and shows a megaphone while the village makes an announcement. Not solid, no interaction. */
export function VillageHead({ x, z, name, talking }: { x: number; z: number; name: string; talking: boolean }) {
  const motion = useRef(newMotion());
  return (
    <group position={[x, 0, z]} rotation={[0, Math.PI, 0]}>
      <Avatar color="#8B6B3E" look={{ ...DEFAULT_LOOK, skin: 1, hair: 1, top: 5 }} name={name} emote={talking ? "📢" : undefined} motion={motion.current} />
    </group>
  );
}

/** Lost item marker (L3): a small gold light bobbing just above the ground with a thin beam, so it can be spotted from a distance but still has to be looked for. */
export function LostMark({ x, z }: { x: number; z: number }) {
  const a = useRef<Mesh>(null);
  useFrame((st) => { if (a.current) a.current.position.y = 0.8 + Math.sin(st.clock.elapsedTime * 3) * 0.2; });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.7, 0.95, 24]} /><meshBasicMaterial color="#FFD23F" transparent opacity={0.85} /></mesh>
      <mesh position={[0, 1.6, 0]}><cylinderGeometry args={[0.04, 0.04, 3.2, 6]} /><meshBasicMaterial color="#FFE98A" transparent opacity={0.5} /></mesh>
      <mesh ref={a} position={[0, 0.8, 0]}><sphereGeometry args={[0.3, 14, 10]} /><meshBasicMaterial color="#FFD23F" /></mesh>
    </group>
  );
}

/** Closed-area marker (M3.8): a translucent red dome-like cylinder with a bright rim, so everybody sees where they cannot walk. */
export function ClosureMark({ x, z, radius }: { x: number; z: number; radius: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[radius, radius, 2.4, 40, 1, true]} /><meshBasicMaterial color="#E5484D" transparent opacity={0.22} /></mesh>
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[radius - 0.3, radius, 48]} /><meshBasicMaterial color="#E5484D" transparent opacity={0.85} /></mesh>
    </group>
  );
}

/** Crossroad marker (M6.2): a signpost with two arrows, gently bobbing. */
export function RouteMark({ x, z }: { x: number; z: number }) {
  const g = useRef<Group>(null);
  useFrame((s) => { if (g.current) g.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.8) * 0.25; });
  return (
    <group ref={g} position={[x, 0, z]}>
      <mesh position={[0, 0.9, 0]}><boxGeometry args={[0.14, 1.8, 0.14]} /><meshLambertMaterial color="#6B4A2B" /></mesh>
      <mesh position={[0.45, 1.5, 0]}><boxGeometry args={[0.9, 0.26, 0.07]} /><meshLambertMaterial color="#FFD27A" emissive="#B07A10" /></mesh>
      <mesh position={[-0.45, 1.1, 0]}><boxGeometry args={[0.9, 0.26, 0.07]} /><meshLambertMaterial color="#9FD3A0" emissive="#2E6B34" /></mesh>
    </group>
  );
}

/** Detective clue marker: a lilac ring on a tall light pillar (visible from afar). Hidden in fog beyond 14 units, like evidence. */
export function ClueMark({ x, z, fog = false }: { x: number; z: number; fog?: boolean }) {
  const g = useRef<Group>(null);
  useFrame((s) => {
    if (!g.current) return;
    g.current.visible = !fog || Math.hypot(s.camera.position.x - x, s.camera.position.z - z) < 14;
    g.current.rotation.y = s.clock.elapsedTime * 1.5;
  });
  return (
    <group ref={g} position={[x, 0, z]}>
      <mesh position={[0, 1.6, 0]}><cylinderGeometry args={[0.07, 0.07, 3.2, 6]} /><meshBasicMaterial color="#B58CFF" transparent opacity={0.35} /></mesh>
      <mesh position={[0, 1.0, 0]}><torusGeometry args={[0.38, 0.09, 8, 16]} /><meshLambertMaterial color="#B58CFF" emissive="#7B3FE4" /></mesh>
      <mesh position={[0.3, 0.62, 0]} rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[0.08, 0.4, 0.08]} /><meshLambertMaterial color="#7B3FE4" emissive="#4B1FA4" /></mesh>
    </group>
  );
}

/** Throwable gadget lying on the map (a sepak-takraw ball): an orange ball that bobs and spins. */
export function GadgetMark({ x, z }: { x: number; z: number }) {
  const g = useRef<Group>(null);
  useFrame((s) => { if (g.current) { g.current.position.y = 0.7 + Math.sin(s.clock.elapsedTime * 3 + x) * 0.12; g.current.rotation.y = s.clock.elapsedTime * 2; } });
  return (
    <group ref={g} position={[x, 0.7, z]}>
      <mesh><icosahedronGeometry args={[0.32, 1]} /><meshLambertMaterial color="#FF8A1F" emissive="#B34A00" flatShading /></mesh>
      <mesh position={[0, -0.7, 0]}><cylinderGeometry args={[0.05, 0.05, 1.2, 6]} /><meshBasicMaterial color="#FFB36B" transparent opacity={0.3} /></mesh>
    </group>
  );
}

/** A crate knocked out of a carrier's hands, lying on the ground for anyone to grab. */
export function LooseCrate({ x, z }: { x: number; z: number }) {
  const g = useRef<Group>(null);
  useFrame((s) => { if (g.current) g.current.scale.setScalar(1 + Math.sin(s.clock.elapsedTime * 6) * 0.06); });
  return (
    <group ref={g} position={[x, 0.25, z]}>
      <mesh><boxGeometry args={[0.55, 0.45, 0.45]} /><meshLambertMaterial color="#C98F00" emissive="#6B4A00" /></mesh>
    </group>
  );
}
