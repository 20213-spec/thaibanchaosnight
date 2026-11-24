import { useEffect, useState } from "react";
import { CURRENCY, SHOP_ITEMS, RARITY_LABEL, RARITY_COLOR, type Wallet, type ShopItem } from "../../shared/src/index.ts";
import { shopApi } from "./net.ts";

const ERR: Record<string, string> = {
  not_enough: `${CURRENCY}ไม่พอ`, already_owned: "มีไอเท็มนี้แล้ว", unknown_item: "ไม่พบไอเท็ม", not_owned: "ยังไม่ได้ซื้อไอเท็มนี้",
  rate_limited: "ทำรายการเร็วเกินไป รอสักครู่", bad_key: "ระบุตัวตนไม่สำเร็จ (เบราว์เซอร์บล็อกที่เก็บข้อมูล?)",
};

/** Shop + inventory. Cosmetics only; all checks are done by the server, this page only displays its answers. */
export function Shop({ onEquipped }: { onEquipped?: () => void }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [items, setItems] = useState<ShopItem[]>(SHOP_ITEMS);
  const [tab, setTab] = useState<"shop" | "mine">("shop");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<any>, ok?: string) => {
    setBusy(true); setMsg("");
    try { const d = await fn(); if (d?.wallet) setWallet(d.wallet); if (d?.items) setItems(d.items); if (ok) setMsg(ok); }
    catch (e: any) { if (e?.wallet) setWallet(e.wallet); setMsg(ERR[e?.message] ?? "เชื่อมต่อ server ไม่ได้ (server รันอยู่ไหม?)"); }
    finally { setBusy(false); }
  };
  useEffect(() => { run(() => shopApi("/me")); }, []);

  const mine = items.filter((i) => wallet?.owned.includes(i.id));
  return (
    <div>
      <p><b>{wallet ? `${wallet.baht} ${CURRENCY}` : "…"}</b> <span className="mute small">ได้จากการเล่นจบแมตช์ ใช้ซื้อของตกแต่งตัวละครเท่านั้น ไม่ใช่เงินจริงและไม่มีผลต่อคะแนน</span></p>
      <div className="bar" role="tablist">
        <button role="tab" aria-selected={tab === "shop"} className={tab === "shop" ? "go" : ""} onClick={() => setTab("shop")}>ร้านค้า</button>
        <button role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "go" : ""} onClick={() => setTab("mine")}>ของฉัน ({mine.length})</button>
      </div>
      {tab === "shop" && items.map((i) => {
        const owned = wallet?.owned.includes(i.id);
        return (
          <div key={i.id} className="team" style={{ ["--c" as any]: RARITY_COLOR[i.rarity] }}><div className="th"><b>{i.icon} {i.name}</b> <span className="rarity" style={{ background: RARITY_COLOR[i.rarity] }}>{RARITY_LABEL[i.rarity]}</span>
            <button disabled={busy || !wallet || owned || wallet.baht < i.price} onClick={() => run(() => shopApi("/buy", { item: i.id }), `ซื้อ ${i.name} แล้ว`)}>
              {owned ? "มีแล้ว" : `${i.price} ${CURRENCY}`}</button></div></div>
        );
      })}
      {tab === "mine" && <>
        <div className="team"><div className="th"><b>ไม่ใส่อะไร</b>
          <button disabled={busy || !wallet || wallet.equipped === ""} onClick={() => run(async () => { const d = await shopApi("/equip", { item: "" }); onEquipped?.(); return d; })}>{wallet?.equipped === "" ? "ใช้อยู่" : "เลือก"}</button></div></div>
        {mine.length === 0 && <p className="mute">ยังไม่มีไอเท็ม ไปซื้อที่แท็บร้านค้าได้เมื่อมี{CURRENCY}พอ</p>}
        {mine.map((i) => (
          <div key={i.id} className="team"><div className="th"><b>{i.icon} {i.name}</b>
            <button disabled={busy || wallet?.equipped === i.id} onClick={() => run(async () => { const d = await shopApi("/equip", { item: i.id }); onEquipped?.(); return d; })}>{wallet?.equipped === i.id ? "ใช้อยู่" : "ใส่"}</button></div></div>
        ))}
      </>}
      {msg && <p role="status" aria-live="polite">{msg}</p>}
    </div>
  );
}
