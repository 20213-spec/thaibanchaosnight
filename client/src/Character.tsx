import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";
import {
  SKIN_TONES, HATS, HAIR_STYLES, HAIR_COLORS, TOPS, BOTTOMS, BOTTOM_COLORS, SHOES, SHOP_ITEMS, CURRENCY, RARITY_LABEL, RARITY_COLOR, type Wallet,
} from "../../shared/src/index.ts";
import { Avatar, newMotion } from "./Avatar.tsx";
import { shopApi } from "./net.ts";
import { loadLook, saveLook, type Look } from "./look.ts";

function Spin({ children }: { children: React.ReactNode }) {
  const g = useRef<Group>(null);
  useFrame((_, dt) => { if (g.current) g.current.rotation.y += dt * 0.7; });
  return <group ref={g}>{children}</group>;
}

const Row = ({ title, children }: { title: string; children: React.ReactNode }) => <><h3>{title}</h3><div className="chips" role="group" aria-label={title}>{children}</div></>;

/**
 * Character page: live 3D preview and every customisation slot.
 * The look is saved in this browser and sent when joining a room (the server validates it); accessories come from the shop.
 */
export function CharacterEditor({ team = "red", teamColor = "#E5383B", onLook, onAcc }: { team?: string; teamColor?: string; onLook?: (l: Look) => void; onAcc?: () => void }) {
  const [look, setLook] = useState<Look>(loadLook);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [err, setErr] = useState("");
  const motion = useRef(newMotion());
  useEffect(() => { shopApi("/me").then((d) => setWallet(d.wallet)).catch(() => setErr("โหลดไอเท็มของคุณไม่ได้ (server รันอยู่ไหม?)")); }, []);

  const set = (p: Partial<Look>) => { const n = { ...look, ...p }; setLook(n); saveLook(n); onLook?.(n); };
  const equip = async (id: string) => {
    setErr("");
    try { const d = await shopApi("/equip", { item: id }); setWallet(d.wallet); onAcc?.(); } catch { setErr("ใส่ไอเท็มไม่สำเร็จ"); }
  };
  const owned = SHOP_ITEMS.filter((i) => wallet?.owned.includes(i.id));

  return (
    <div className="charpage">
      <div className="preview" aria-label="ตัวอย่างตัวละคร">
        <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.2, 5.6], fov: 30 }}>
          <ambientLight intensity={0.9} /><directionalLight position={[3, 5, 4]} intensity={1.1} />
          <group position={[0, -1.15, 0]}><Spin><Avatar color={teamColor} team={team} look={look} acc={wallet?.equipped ?? ""} motion={motion.current} /></Spin></group>
        </Canvas>
      </div>
      <Row title="สีผิว">{SKIN_TONES.map((c, i) => <button key={c} className="swatch" aria-label={"สีผิว " + (i + 1)} aria-pressed={look.skin === i} style={{ background: c }} onClick={() => set({ skin: i })} />)}</Row>
      <Row title="ทรงผม">{HAIR_STYLES.map((h, i) => <button key={h} className="chip" aria-pressed={look.hair === i} onClick={() => set({ hair: i })}>{h}</button>)}</Row>
      <Row title="สีผม">{HAIR_COLORS.map((c, i) => <button key={c} className="swatch" aria-label={"สีผม " + (i + 1)} aria-pressed={look.hairColor === i} style={{ background: c }} onClick={() => set({ hairColor: i })} />)}</Row>
      <Row title="เสื้อ (สีตามทีม)">{TOPS.map((h, i) => <button key={h} className="chip" aria-pressed={look.top === i} onClick={() => set({ top: i })}>{h}</button>)}</Row>
      <Row title="กางเกง/กระโปรง">{BOTTOMS.map((h, i) => <button key={h} className="chip" aria-pressed={look.bottom === i} onClick={() => set({ bottom: i })}>{h}</button>)}</Row>
      <Row title="สีกางเกง">{BOTTOM_COLORS.map((c, i) => <button key={c} className="swatch" aria-label={"สีกางเกง " + (i + 1)} aria-pressed={look.bottomColor === i} style={{ background: c }} onClick={() => set({ bottomColor: i })} />)}</Row>
      <Row title="รองเท้า">{SHOES.map((h, i) => <button key={h} className="chip" aria-pressed={look.shoes === i} onClick={() => set({ shoes: i })}>{h}</button>)}</Row>
      <Row title="หมวก">{HATS.map((h, i) => <button key={h} className="chip" aria-pressed={look.hat === i} onClick={() => set({ hat: i })}>{h}</button>)}</Row>
      <Row title="เครื่องประดับ">
        <button className="chip" aria-pressed={wallet?.equipped === ""} disabled={!wallet} onClick={() => equip("")}>ไม่ใส่</button>
        {owned.map((i) => <button key={i.id} className="chip" aria-pressed={wallet?.equipped === i.id} style={{ borderColor: RARITY_COLOR[i.rarity] }} onClick={() => equip(i.id)}>{i.icon} {i.name}</button>)}
      </Row>
      {wallet && owned.length === 0 && <p className="mute small">ยังไม่มีเครื่องประดับ ซื้อได้ที่แท็บร้านค้าด้วย{CURRENCY}ที่ได้จากการเล่น ({Object.values(RARITY_LABEL).join(" › ")})</p>}
      <p className="mute small">เสื้อจะเป็นสีของทีมที่คุณเลือกในล็อบบี้ และมีสัญลักษณ์ทีมที่หน้าอก (วงกลม สามเหลี่ยม ข้าวหลามตัด ห้าเหลี่ยม หกเหลี่ยม)</p>
      {err && <p role="alert" className="err">{err}</p>}
    </div>
  );
}
