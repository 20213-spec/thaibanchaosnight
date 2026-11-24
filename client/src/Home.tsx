import { useEffect, useState } from "react";
import { CharacterEditor } from "./Character.tsx";
import { Shop } from "./Shop.tsx";
import { SettingsPanel } from "./SettingsPanel.tsx";
import { CURRENCY, dailyTheme, dailyTopic, dayKey } from "../../shared/src/index.ts";
import { shopApi } from "./net.ts";

export interface Daily { day: string; top: { name: string; team: string; best: number; matches: number }[] }
export interface Match { at: number; teams: { id: string; name: string; score: number }[]; top: { name: string; score: number }[] }
const TN: Record<string, string> = { basic: "ความน่าจะเป็นพื้นฐาน", expected: "ค่าคาดหมาย", variance: "ความแปรปรวน", binomial: "ทวินาม", poisson: "ปัวซง", normal: "ปกติ", uniform: "เอกรูปไม่ต่อเนื่อง" };
type Tab = "play" | "char" | "shop" | "board" | "settings";
const TABS: [Tab, string, string][] = [["play", "🏮", "เล่น"], ["char", "🧑‍🌾", "ตัวละคร"], ["shop", "🛍️", "ร้านค้า"], ["board", "🏆", "ประวัติ"], ["settings", "⚙️", "ตั้งค่า"]];

export function Home(p: {
  name: string; setName: (v: string) => void; code: string; setCode: (v: string) => void;
  busy: boolean; err: string; matches: Match[]; daily?: Daily | null; onCreate: () => void; onJoin: () => void;
}) {
  const [tab, setTab] = useState<Tab>("play");
  const [pasteMsg, setPasteMsg] = useState("");
  const paste = async () => { // M7: one tap paste of the room code (clipboard may be blocked, then say so)
    try { const t = (await navigator.clipboard.readText()).trim(); if (t) { p.setCode(t); setPasteMsg(""); } else setPasteMsg("คลิปบอร์ดว่าง"); }
    catch { setPasteMsg("เบราว์เซอร์ไม่อนุญาตให้อ่านคลิปบอร์ด กดค้างที่ช่องแล้ววางเองได้"); }
  };
  const [baht, setBaht] = useState<number | null>(null); // wallet chip (M7); stays hidden if the server cannot be reached
  useEffect(() => { shopApi("/me").then((d) => { if (typeof d?.wallet?.baht === "number") setBaht(d.wallet.baht); }).catch(() => {}); }, []);
  const theme = dailyTheme(dayKey(Date.now())); // same theme for everyone today (I4)
  return (
    <>
      <main className="home">
        <div className="tabpane" key={tab}>
        {tab === "play" && <>
          <div className="hero">
            {baht !== null && <button type="button" className="walletchip" onClick={() => setTab("shop")} aria-label={`ยอดเงิน ${baht} ${CURRENCY} แตะเพื่อไปร้านค้า`}>🪙 {baht} {CURRENCY}</button>}
            <div className="lamp small" aria-hidden="true" />
            <h1>THAI BAN<small>CHAOS NIGHT</small></h1>
            <p className="mute">เกมปาร์ตี้สืบผีในหมู่บ้านโนนสุข แข่ง 5 ทีม พร้อมปริศนาคณิตศาสตร์</p>
          </div>
          <div className="card" aria-label="เหตุการณ์ประจำวัน"><b>{theme.icon} วันนี้: {theme.name}</b><p className="mute small">{theme.blurb} (มีผลกับสภาพอากาศในโหมดล่าผีและกลางคืน ไม่เสียคะแนน)</p><p className="mute small">⭐ หัวข้อปริศนาประจำวัน: {TN[dailyTopic(dayKey(Date.now()))]}</p></div>
          <div className="card">
            <label className="field">ชื่อตัวละคร
              <input value={p.name} maxLength={16} placeholder="เช่น น้องข้าวเหนียว" onChange={(e) => p.setName(e.target.value)} /></label>
            <button className="go big" disabled={p.busy || !p.name.trim()} onClick={p.onCreate}>สร้างห้องใหม่</button>
          </div>
          <div className="card">
            <label className="field">มีรหัสห้องจากเพื่อน?
              <input value={p.code} placeholder="วางรหัสห้อง" onChange={(e) => p.setCode(e.target.value)} /></label>
            <button type="button" className="pastebtn" onClick={paste}>📋 วางรหัสจากคลิปบอร์ด</button>
            {pasteMsg && <p role="status" className="mute small">{pasteMsg}</p>}
            <button className="big" disabled={p.busy || !p.name.trim() || !p.code.trim()} onClick={p.onJoin}>เข้าห้อง</button>
          </div>
          {p.err && <p role="alert" className="err">{p.err}</p>}
          <p className="mute small">ปรับตัวละครได้ที่แท็บ "ตัวละคร" และแก้ต่อในล็อบบี้ได้</p>
        </>}
        {tab === "char" && <><h1>ปรับแต่งตัวละคร</h1><CharacterEditor /></>}
        {tab === "shop" && <><h1>ร้านค้า</h1><Shop /></>}
        {tab === "board" && <>
          <h1>ประวัติการแข่งขัน</h1>
          <h2>🏆 อันดับวันนี้</h2>
          {(!p.daily || p.daily.top.length === 0) && <p className="mute small">ยังไม่มีใครมีคะแนนวันนี้ เล่นแมตช์แรกเพื่อขึ้นอันดับ</p>}
          {p.daily && p.daily.top.length > 0 && <ol className="board" aria-label="อันดับผู้เล่นวันนี้">
            {p.daily.top.map((r) => <li key={r.name}><b>{r.name}</b> <span>{r.best} คะแนน</span> <small className="mute">({r.matches} แมตช์)</small></li>)}
          </ol>}
          <p className="mute small">นับคะแนนสูงสุดต่อแมตช์ของวันนี้ (เวลาไทย) จากประวัติล่าสุด 100 แมตช์ ชื่อซ้ำจะรวมเป็นคนเดียว</p>
          <h2>ประวัติแมตช์ล่าสุด</h2>
          {p.matches.length === 0 && <p className="mute">ยังไม่มีแมตช์ที่จบ (หรือเชื่อมต่อ server ไม่ได้)</p>}
          {p.matches.map((m) => (
            <div key={m.at} className="team"><div className="th"><b>{new Date(m.at).toLocaleString("th-TH")}</b><span>{m.teams[0]?.name} ชนะ {m.teams[0]?.score}</span></div>
              <p className="mute small">ผู้เล่นยอดเยี่ยม: {m.top[0]?.name ?? "-"} ({m.top[0]?.score ?? 0})</p></div>
          ))}
        </>}
        {tab === "settings" && <><h1>ตั้งค่า</h1><SettingsPanel /><p><a href="#admin">สำหรับผู้ดูแล</a></p></>}
        </div>
      </main>
      <nav className="tabs" aria-label="เมนูหลัก">
        {TABS.map(([id, icon, label]) => (
          <button key={id} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}><span aria-hidden="true">{icon}</span><small>{label}</small></button>
        ))}
      </nav>
    </>
  );
}
