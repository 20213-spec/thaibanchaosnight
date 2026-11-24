import { forwardRef, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry, CanvasTexture, CircleGeometry, ConeGeometry, CylinderGeometry, MeshBasicMaterial, MeshLambertMaterial,
  SphereGeometry, TorusGeometry, type Group,
} from "three";
import { DEFAULT_LOOK, SKIN_TONES, HAIR_COLORS, BOTTOM_COLORS, type Look } from "../../shared/src/index.ts";
import { settings } from "./settings.ts";

/* ---------- shared geometry and materials (one copy for all players, so 40 characters stay cheap) ---------- */
const G = {
  sphere: new SphereGeometry(1, 14, 10),
  sphereLow: new SphereGeometry(1, 8, 6),
  box: new BoxGeometry(1, 1, 1),
  cyl: new CylinderGeometry(1, 1, 1, 8),
  cone: new ConeGeometry(1, 1, 10),
  torus: new TorusGeometry(1, 0.14, 6, 18),
};
const CIRCLES: Record<number, CircleGeometry> = { 3: new CircleGeometry(1, 3), 4: new CircleGeometry(1, 4), 5: new CircleGeometry(1, 5), 6: new CircleGeometry(1, 6), 32: new CircleGeometry(1, 24) };
const lamberts = new Map<string, MeshLambertMaterial>();
const basics = new Map<string, MeshBasicMaterial>();
const mat = (color: string, opacity = 1) => {
  const k = color + "|" + opacity;
  let m = lamberts.get(k);
  if (!m) { m = new MeshLambertMaterial({ color, transparent: opacity < 1, opacity }); lamberts.set(k, m); }
  return m;
};
const basic = (color: string, opacity = 1) => {
  const k = color + "|" + opacity;
  let m = basics.get(k);
  if (!m) { m = new MeshBasicMaterial({ color, transparent: opacity < 1, opacity }); basics.set(k, m); }
  return m;
};

/** Team symbol on the chest (also readable without colour): circle, triangle, diamond, pentagon, hexagon. */
const EMBLEM: Record<string, { seg: number; rot: number }> = {
  red: { seg: 32, rot: 0 }, blue: { seg: 3, rot: Math.PI / 2 }, green: { seg: 4, rot: 0 }, yellow: { seg: 5, rot: Math.PI / 2 }, purple: { seg: 6, rot: 0 },
};

/** Animation inputs. The parent mutates this object every frame (no React re-render). */
export interface Motion { speed: number; air: boolean; carrying: boolean; fishing: boolean; scared: boolean }
export const newMotion = (): Motion => ({ speed: 0, air: false, carrying: false, fishing: false, scared: false });

/* ---------- small helpers ---------- */
type P3 = [number, number, number];
type GeoKey = keyof typeof G;
function Part({ g, m, p, s, r }: { g: GeoKey; m: any; p?: P3; s?: P3; r?: P3 }) {
  return <mesh geometry={G[g]} material={m} position={p} scale={s} rotation={r} />;
}
function Flat({ seg, m, p, s, r }: { seg: number; m: any; p: P3; s: number; r?: number }) {
  return <mesh geometry={CIRCLES[seg]} material={m} position={p} scale={[s, s, 1]} rotation={[0, 0, r ?? 0]} />;
}

function NameTag({ name }: { name: string }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 256; c.height = 64;
    const x = c.getContext("2d")!;
    x.fillStyle = "rgba(20,14,8,0.6)"; x.fillRect(0, 8, 256, 48);
    x.fillStyle = "#fff"; x.font = "600 28px 'Noto Sans Thai', sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(name, 128, 33, 240);
    return new CanvasTexture(c);
  }, [name]);
  useEffect(() => () => tex.dispose(), [tex]);
  return <sprite position={[0, 2.75, 0]} scale={[2.4, 0.6, 1]}><spriteMaterial map={tex} transparent depthTest={false} /></sprite>;
}

function EmoteBubble({ e }: { e: string }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 128; c.height = 128;
    const x = c.getContext("2d")!;
    x.font = "88px 'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(e, 64, 70);
    return new CanvasTexture(c);
  }, [e]);
  useEffect(() => () => tex.dispose(), [tex]);
  return <sprite position={[0, 3.55, 0]} scale={[1.2, 1.2, 1]}><spriteMaterial map={tex} transparent depthTest={false} /></sprite>;
}

function Hair({ style, color }: { style: number; color: string }) {
  const m = mat(color);
  return (
    <group>
      <Part g="sphere" m={m} p={[0, 0.07, -0.03]} s={[0.325, 0.27, 0.32]} />
      {style !== 4 && <Part g="sphere" m={m} p={[0, -0.02, -0.1]} s={[0.31, 0.3, 0.25]} />}
      {style === 1 && <><Part g="box" m={m} p={[0, 0.2, 0.24]} s={[0.5, 0.07, 0.1]} /><Part g="box" m={m} p={[-0.3, 0.05, 0.02]} s={[0.05, 0.16, 0.2]} /><Part g="box" m={m} p={[0.3, 0.05, 0.02]} s={[0.05, 0.16, 0.2]} /></>}
      {style === 2 && <Part g="box" m={m} p={[0, 0.17, 0.27]} s={[0.52, 0.13, 0.08]} />}
      {style === 3 && <><Part g="sphere" m={m} p={[0, 0.1, -0.33]} s={[0.12, 0.12, 0.12]} /><Part g="cyl" m={m} p={[0, -0.1, -0.36]} s={[0.07, 0.34, 0.07]} r={[0.2, 0, 0]} /></>}
      {style === 4 && <><Part g="sphere" m={m} p={[0, 0.12, -0.03]} s={[0.44, 0.38, 0.42]} /><Part g="sphere" m={m} p={[-0.28, 0.0, -0.05]} s={[0.17, 0.17, 0.17]} /><Part g="sphere" m={m} p={[0.28, 0.0, -0.05]} s={[0.17, 0.17, 0.17]} /></>}
      {style === 5 && <><Part g="box" m={m} p={[0, -0.28, -0.2]} s={[0.46, 0.55, 0.1]} /><Part g="box" m={m} p={[-0.31, -0.1, 0.0]} s={[0.05, 0.38, 0.16]} /><Part g="box" m={m} p={[0.31, -0.1, 0.0]} s={[0.05, 0.38, 0.16]} /></>}
    </group>
  );
}

function Hat({ id }: { id: number }) {
  if (id === 1) return <group><Part g="cone" m={mat("#D9B26B")} p={[0, 0.4, 0]} s={[0.66, 0.3, 0.66]} /><Part g="cyl" m={mat("#B58A44")} p={[0, 0.27, 0]} s={[0.3, 0.04, 0.3]} /></group>;
  if (id === 2) return <group><Part g="sphere" m={mat("#2B2118")} p={[0, 0.17, 0]} s={[0.335, 0.2, 0.335]} /><Part g="box" m={mat("#2B2118")} p={[0, 0.2, 0.3]} s={[0.32, 0.03, 0.22]} /></group>;
  if (id === 3) return <Part g="torus" m={basic("#FFD23F")} p={[0, 0.12, 0]} s={[0.3, 0.3, 0.3]} r={[Math.PI / 2, 0, 0]} />;
  return null;
}

/* ---------- the character ---------- */
interface AvatarProps {
  color: string; team?: string; look?: Look; acc?: string; name?: string; ghost?: boolean; lantern?: boolean; emote?: string;
  motion?: Motion; lod?: "high" | "low";
}

export const Avatar = forwardRef<Group, AvatarProps>(function Avatar(
  { color, team = "red", look = DEFAULT_LOOK, acc = "", name, ghost = false, lantern = false, emote, motion, lod = "high" }, ref,
) {
  const skin = SKIN_TONES[look.skin] ?? SKIN_TONES[0], hairC = HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[0], botC = BOTTOM_COLORS[look.bottomColor] ?? BOTTOM_COLORS[0];
  const body = useRef<Group>(null), head = useRef<Group>(null), legL = useRef<Group>(null), legR = useRef<Group>(null), armL = useRef<Group>(null), armR = useRef<Group>(null);
  const eyes = useRef<Group>(null), mouth = useRef<Group>(null), browL = useRef<Group>(null), browR = useRef<Group>(null);
  const emoteRef = useRef(emote); emoteRef.current = emote;
  const anim = useRef({ phase: 0, sp: 0, air: 0 });

  useFrame((state, rawDt) => {
    if (!motion || lod === "low" || ghost || !body.current) return;
    const dt = Math.min(rawDt, 0.1), t = state.clock.elapsedTime, a = anim.current, k = Math.min(1, dt * 12);
    a.sp += (motion.speed - a.sp) * Math.min(1, dt * 10);
    const moving = a.sp > 0.3, run = Math.min(a.sp / 8, 1);
    a.phase += dt * (moving ? 5 + a.sp * 1.4 : 0);
    a.air += ((motion.air ? 1 : 0) - a.air) * Math.min(1, dt * 14);
    const swing = moving ? 0.35 + Math.min(a.sp, 8) * 0.09 : 0, s = Math.sin(a.phase), ground = 1 - a.air;
    const e = emoteRef.current ?? "", fear = motion.scared || e === "😱";

    const lL = s * swing * ground - 0.5 * a.air, lR = -s * swing * ground - 0.2 * a.air;
    let aLx = -s * swing * 0.9 * ground, aRx = s * swing * 0.9 * ground, aLz = 0.08, aRz = -0.08;
    if (!moving) { aLx = Math.sin(t * 1.6) * 0.05; aRx = Math.sin(t * 1.6 + 1) * 0.05; }
    if (a.air > 0.3) { aLz = 0.9; aRz = -0.9; }
    let bodyY = moving ? Math.abs(Math.sin(a.phase)) * 0.05 : Math.sin(t * 2) * 0.012, bodyX = 0, lean = run * 0.18;
    let headRy = moving ? 0 : Math.sin(t * 0.6) * 0.3, headRx = 0, headRz = 0;
    let eyeS = 1, mouthY = 1, mouthX = 1, brow = 0, pulse = 1;

    if (motion.carrying) { aLx = aRx = -1.25; aLz = 0.15; aRz = -0.15; }
    if (motion.fishing) { aRx = -1.15 + Math.sin(t * 3) * 0.05; aRz = -0.1; aLx = -0.55; }
    if (e === "👋") { aRz = -2.6 + Math.sin(t * 12) * 0.35; aRx = 0; mouthX = 1.4; }
    else if (e === "😂") { bodyY += Math.abs(Math.sin(t * 14)) * 0.05; headRx = -0.25; mouthY = 3; mouthX = 1.5; aLx = aRx = -0.6; brow = 0.15; }
    else if (e === "🎉") { aLz = 2.6 + Math.sin(t * 10) * 0.15; aRz = -2.6 - Math.sin(t * 10) * 0.15; aLx = aRx = 0; bodyY += Math.abs(Math.sin(t * 8)) * 0.12; mouthY = 2.5; mouthX = 1.6; }
    else if (e === "❤️") { aLx = aRx = -1.0; aLz = -0.55; aRz = 0.55; pulse = 1 + Math.sin(t * 8) * 0.03; mouthX = 1.3; }
    else if (e === "😮") { lean = -0.12; aLz = 0.9; aRz = -0.9; mouthY = 4; mouthX = 0.6; eyeS = 1.3; brow = 0.3; }
    else if (e === "🤔") { headRz = 0.3; aRx = -1.9; aRz = -0.3; brow = -0.25; mouthX = 0.5; }
    if (fear) { bodyX = Math.sin(t * 45) * (motion.scared ? 0.025 : 0.04); aLz = 2.3; aRz = -2.3; aLx = aRx = 0; mouthY = 4; mouthX = 0.7; eyeS = 1.3; brow = 0.3; bodyY -= 0.04; }

    const blink = t % 3.7 < 0.12 ? 0.1 : 1;
    const lerp = (o: any, key: string, v: number) => { o[key] += (v - o[key]) * k; };
    const b = body.current;
    b.position.y += (bodyY - b.position.y) * k; b.position.x = bodyX; lerp(b.rotation, "x", lean); b.scale.setScalar(pulse);
    if (legL.current) lerp(legL.current.rotation, "x", lL);
    if (legR.current) lerp(legR.current.rotation, "x", lR);
    if (armL.current) { lerp(armL.current.rotation, "x", aLx); lerp(armL.current.rotation, "z", aLz); }
    if (armR.current) { lerp(armR.current.rotation, "x", aRx); lerp(armR.current.rotation, "z", aRz); }
    if (head.current) { lerp(head.current.rotation, "y", headRy); lerp(head.current.rotation, "x", headRx); lerp(head.current.rotation, "z", headRz); }
    if (eyes.current) eyes.current.scale.set(eyeS, eyeS * blink, 1);
    if (mouth.current) { lerp(mouth.current.scale, "y", mouthY); lerp(mouth.current.scale, "x", mouthX); }
    if (browL.current) lerp(browL.current.position, "y", 0.135 + brow * 0.1);
    if (browR.current) lerp(browR.current.position, "y", 0.135 + brow * 0.1 + (e === "🤔" ? 0.05 : 0));
  });

  /* ghost player: simple pale spirit */
  if (ghost) {
    const gm = mat("#DDE6FF", 0.6);
    return (
      <group ref={ref} dispose={null}>
        <Part g="sphere" m={gm} p={[0, 1.4, 0]} s={[0.45, 0.5, 0.45]} />
        <Part g="cone" m={gm} p={[0, 0.6, 0]} s={[0.45, 1.0, 0.45]} r={[Math.PI, 0, 0]} />
        <Part g="sphere" m={basic("#222")} p={[-0.15, 1.45, 0.38]} s={[0.07, 0.07, 0.07]} /><Part g="sphere" m={basic("#222")} p={[0.15, 1.45, 0.38]} s={[0.07, 0.07, 0.07]} />
        {name && <NameTag name={name} />}{emote && <EmoteBubble e={emote} />}
      </group>
    );
  }

  /* far away: a handful of cheap meshes */
  if (lod === "low") {
    return (
      <group ref={ref} dispose={null}>
        <Part g="sphereLow" m={mat(color)} p={[0, 1.0, 0]} s={[0.3, 0.55, 0.22]} />
        <Part g="sphereLow" m={mat(botC)} p={[0, 0.4, 0]} s={[0.22, 0.4, 0.18]} />
        <Part g="sphereLow" m={mat(skin)} p={[0, 1.78, 0]} s={[0.3, 0.31, 0.29]} />
        <Part g="sphereLow" m={mat(hairC)} p={[0, 1.86, -0.04]} s={[0.32, 0.27, 0.32]} />
        {name && <NameTag name={name} />}{emote && <EmoteBubble e={emote} />}
      </group>
    );
  }

  const sk = mat(skin), tee = mat(color), white = mat("#F5F5F5"), pants = mat(botC);
  const top = look.top, longSleeve = top === 1 || top === 3, tank = top === 2, vest = top === 4;
  const sleeveM = vest ? white : tee;
  const em = EMBLEM[team] ?? EMBLEM.red;
  const shoeColor = look.shoes === 0 ? "#F2F2F2" : look.shoes === 1 ? "#8A5A3C" : "#2B2118";
  const bottom = look.bottom; // 0 shorts, 1 long, 2 skirt, 3 three-quarter
  const legCover = bottom === 0 ? 0.26 : bottom === 3 ? 0.45 : bottom === 1 ? 0.62 : 0;
  const hideHat = acc === "halo" || acc === "crown";

  const leg = (x: number, r: React.Ref<Group>) => (
    <group ref={r} position={[x, 0.82, 0]}>
      <Part g="cyl" m={sk} p={[0, -0.31, 0]} s={[0.085, 0.62, 0.085]} />
      {legCover > 0 && <Part g="cyl" m={pants} p={[0, -legCover / 2 + 0.01, 0]} s={[0.105, legCover, 0.105]} />}
      {look.shoes === 2 && <Part g="cyl" m={mat(shoeColor)} p={[0, -0.57, 0]} s={[0.115, 0.2, 0.115]} />}
      <Part g="sphere" m={mat(shoeColor)} p={[0, -0.72, look.shoes === 1 ? 0.03 : 0.055]} s={[0.115, look.shoes === 1 ? 0.04 : 0.075, 0.175]} />
    </group>
  );
  const arm = (x: number, r: React.Ref<Group>) => (
    <group ref={r} position={[x, 1.42, 0]}>
      <Part g="cyl" m={sk} p={[0, -0.25, 0]} s={[0.06, 0.5, 0.06]} />
      {!tank && <Part g="cyl" m={sleeveM} p={[0, longSleeve ? -0.25 : -0.1, 0]} s={[0.082, longSleeve ? 0.5 : 0.2, 0.082]} />}
      <Part g="sphere" m={sk} p={[0, -0.53, 0]} s={[0.07, 0.07, 0.07]} />
    </group>
  );

  return (
    <group ref={ref} dispose={null}>
      <group ref={body}>
        {leg(-0.13, legL)}{leg(0.13, legR)}
        {bottom === 2 ? <Part g="cone" m={pants} p={[0, 0.74, 0]} s={[0.36, 0.36, 0.3]} /> : <Part g="sphere" m={pants} p={[0, 0.86, 0]} s={[0.25, 0.15, 0.19]} />}

        {/* torso: team colour + team symbol */}
        <Part g="sphere" m={vest ? white : tee} p={[0, 1.18, 0]} s={[0.27, 0.36, 0.2]} />
        {vest && <Part g="sphere" m={tee} p={[0, 1.18, 0.02]} s={[0.255, 0.35, 0.2]} />}
        {top === 5 && <><Part g="box" m={white} p={[0, 1.3, 0]} s={[0.52, 0.04, 0.42]} /><Part g="box" m={white} p={[0, 1.08, 0]} s={[0.5, 0.04, 0.4]} /></>}
        {top === 3 && <Part g="sphere" m={tee} p={[0, 1.55, -0.1]} s={[0.26, 0.17, 0.17]} />}
        <Flat seg={em.seg} m={basic("#FFFFFF", 0.9)} p={[0, 1.27, 0.202]} s={0.075} r={em.rot} />
        <Part g="cyl" m={sk} p={[0, 1.56, 0]} s={[0.07, 0.1, 0.07]} />
        {arm(-0.34, armL)}{arm(0.34, armR)}

        {motion?.carrying && <Part g="box" m={mat("#C98F00")} p={[0, 1.15, 0.5]} s={[0.5, 0.4, 0.4]} />}
        {motion?.fishing && <Part g="cyl" m={mat("#6B4A2B")} p={[0.34, 1.35, 0.8]} s={[0.02, 1.5, 0.02]} r={[1.2, 0, 0]} />}

        {acc === "khaoma" && <Part g="torus" m={mat("#E5383B")} p={[0, 0.98, 0]} s={[0.3, 0.3, 0.3]} r={[Math.PI / 2, 0, 0]} />}
        {acc === "garland" && <Part g="torus" m={mat("#FF9F1C")} p={[0, 1.5, 0]} s={[0.22, 0.22, 0.22]} r={[Math.PI / 2, 0, 0]} />}
        {acc === "lantern" && <Part g="sphere" m={basic("#FFB300")} p={[0.85, 1.4, 0]} s={[0.17, 0.17, 0.17]} />}
        {acc === "wings" && <><Part g="sphere" m={mat("#FFFFFF", 0.9)} p={[-0.32, 1.4, -0.24]} s={[0.1, 0.34, 0.2]} r={[0, 0, 0.5]} /><Part g="sphere" m={mat("#FFFFFF", 0.9)} p={[0.32, 1.4, -0.24]} s={[0.1, 0.34, 0.2]} r={[0, 0, -0.5]} /></>}

        <group ref={head} position={[0, 1.78, 0]}>
          <Part g="sphere" m={sk} s={[0.3, 0.31, 0.29]} />
          <Part g="sphere" m={sk} p={[-0.3, 0, 0]} s={[0.05, 0.07, 0.04]} /><Part g="sphere" m={sk} p={[0.3, 0, 0]} s={[0.05, 0.07, 0.04]} />
          <Part g="sphere" m={sk} p={[0, -0.04, 0.29]} s={[0.032, 0.032, 0.032]} />
          <group ref={eyes}>
            {[-1, 1].map((sx) => (
              <group key={sx} position={[sx * 0.105, 0.03, 0.25]}>
                <Part g="sphere" m={basic("#FFFFFF")} s={[0.072, 0.082, 0.04]} />
                <Part g="sphere" m={basic("#1B1B1F")} p={[0, 0, 0.022]} s={[0.044, 0.055, 0.03]} />
                <Part g="sphere" m={basic("#FFFFFF")} p={[0.015, 0.02, 0.045]} s={[0.014, 0.014, 0.014]} />
              </group>
            ))}
          </group>
          <group ref={browL} position={[-0.105, 0.135, 0.262]} rotation={[0, 0, 0.1]}><Part g="box" m={mat(hairC)} s={[0.1, 0.022, 0.02]} /></group>
          <group ref={browR} position={[0.105, 0.135, 0.262]} rotation={[0, 0, -0.1]}><Part g="box" m={mat(hairC)} s={[0.1, 0.022, 0.02]} /></group>
          <group ref={mouth} position={[0, -0.12, 0.272]}><Part g="box" m={mat("#7A2E2E")} s={[0.09, 0.02, 0.02]} /></group>
          <Part g="sphere" m={mat("#F4A6A6", 0.6)} p={[-0.17, -0.07, 0.22]} s={[0.05, 0.035, 0.02]} /><Part g="sphere" m={mat("#F4A6A6", 0.6)} p={[0.17, -0.07, 0.22]} s={[0.05, 0.035, 0.02]} />
          <Hair style={look.hair} color={hairC} />
          {!hideHat && <Hat id={look.hat} />}
          {acc === "glasses" && <Part g="box" m={mat("#111")} p={[0, 0.035, 0.28]} s={[0.4, 0.07, 0.04]} />}
          {acc === "starglasses" && <><Flat seg={5} m={basic("#FFD23F")} p={[-0.105, 0.035, 0.285]} s={0.085} /><Flat seg={5} m={basic("#FFD23F")} p={[0.105, 0.035, 0.285]} s={0.085} /></>}
          {acc === "halo" && <Part g="torus" m={basic("#FFD23F")} p={[0, 0.5, 0]} s={[0.26, 0.26, 0.26]} r={[Math.PI / 2, 0, 0]} />}
          {acc === "crown" && <group position={[0, 0.34, 0]}><Part g="cyl" m={mat("#F5B700")} s={[0.27, 0.12, 0.27]} />{[0, 1, 2, 3, 4].map((i) => <Part key={i} g="cone" m={mat("#F5B700")} p={[Math.cos((i / 5) * 6.283) * 0.22, 0.12, Math.sin((i / 5) * 6.283) * 0.22]} s={[0.06, 0.14, 0.06]} />)}</group>}
        </group>
      </group>
      {lantern && settings.quality === "high" && <pointLight position={[0, 2.2, 0]} color="#FFD27A" intensity={1.8} distance={16} />}
      {name && <NameTag name={name} />}
      {emote && <EmoteBubble e={emote} />}
    </group>
  );
});
