/**
 * Virtual currency: บาท (Baht). Earned by playing, spent on COSMETICS ONLY.
 * Nothing here can be bought with real money and nothing here changes scoring, speed or abilities.
 */
export const CURRENCY = "บาท";

export type Rarity = "common" | "rare" | "epic" | "legendary";
export const RARITY_LABEL: Record<Rarity, string> = { common: "ธรรมดา", rare: "หายาก", epic: "เอพิค", legendary: "ในตำนาน" };
export const RARITY_COLOR: Record<Rarity, string> = { common: "#8A8F98", rare: "#2F6DF6", epic: "#8E4FD6", legendary: "#F5B700" };
export interface ShopItem { id: string; name: string; icon: string; price: number; rarity: Rarity }
export const SHOP_ITEMS: ShopItem[] = [
  { id: "glasses", name: "แว่นกันแดด", icon: "🕶️", price: 60, rarity: "common" },
  { id: "khaoma", name: "ผ้าขาวม้าคาดเอว", icon: "🧣", price: 80, rarity: "common" },
  { id: "garland", name: "พวงมาลัยดอกดาวเรือง", icon: "🌼", price: 100, rarity: "common" },
  { id: "lantern", name: "โคมไฟน้อยลอยข้างตัว", icon: "🏮", price: 150, rarity: "rare" },
  { id: "starglasses", name: "แว่นรูปดาว", icon: "🤩", price: 180, rarity: "rare" },
  { id: "wings", name: "ปีกนางฟ้าจิ๋ว", icon: "🪽", price: 400, rarity: "epic" },
  { id: "halo", name: "ฮาโลทอง", icon: "😇", price: 450, rarity: "epic" },
  { id: "crown", name: "มงกุฎทองคำ", icon: "👑", price: 900, rarity: "legendary" },
];

/** Earnings at the end of a match: a base amount plus a share of the score, capped so the economy cannot inflate. */
export const EARN = { base: 20, perPoints: 4, cap: 300 };
export function earnBaht(score: number): number {
  const s = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
  return Math.min(EARN.cap, EARN.base + Math.floor(s / EARN.perPoints));
}

export interface Wallet { baht: number; owned: string[]; equipped: string } // equipped "" = nothing

export function canBuy(w: Wallet, itemId: string): "ok" | "unknown_item" | "already_owned" | "not_enough" {
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return "unknown_item";
  if (w.owned.includes(itemId)) return "already_owned";
  return w.baht >= item.price ? "ok" : "not_enough";
}
export const canEquip = (w: Wallet, itemId: string): boolean => itemId === "" || w.owned.includes(itemId);

/** The player key is a private random token stored in the player's browser. It identifies a wallet and is never shown to other players. */
export const isValidPlayerKey = (k: unknown): k is string => typeof k === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(k);
