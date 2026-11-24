import fs from "node:fs";
import path from "node:path";
import { SHOP_ITEMS, canBuy, canEquip, type Wallet } from "../../shared/src/index.ts";

const FILE = process.env.WALLET_FILE ?? path.join(process.cwd(), "data", "wallets.json");
const START = Math.max(0, Math.floor(Number(process.env.START_BAHT) || 0)); // testing aid: starting balance for new wallets

let store: Record<string, Wallet> = (() => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; } })();
function save() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE + ".tmp", JSON.stringify(store));
    fs.renameSync(FILE + ".tmp", FILE);
  } catch (e) { console.error("[tbcn] could not save wallets", e); }
}
const fresh = (): Wallet => ({ baht: START, owned: [], equipped: "" });

/** Wallets are created only when something is written, so random keys from outside cannot fill the disk. */
export const wallets = {
  peek: (key: string): Wallet => ({ ...(store[key] ?? fresh()), owned: [...(store[key]?.owned ?? [])] }),

  buy(key: string, itemId: string): { error?: string; wallet: Wallet } {
    const w = store[key] ?? fresh();
    const r = canBuy(w, itemId);
    if (r !== "ok") return { error: r, wallet: wallets.peek(key) };
    w.baht -= SHOP_ITEMS.find((i) => i.id === itemId)!.price;
    w.owned.push(itemId);
    store[key] = w; save();
    return { wallet: wallets.peek(key) };
  },

  equip(key: string, itemId: string): { error?: string; wallet: Wallet } {
    const w = store[key] ?? fresh();
    if (!canEquip(w, itemId)) return { error: "not_owned", wallet: wallets.peek(key) };
    w.equipped = itemId;
    store[key] = w; save();
    return { wallet: wallets.peek(key) };
  },

  earn(key: string, amount: number) {
    if (!(amount > 0)) return;
    const w = store[key] ?? fresh();
    w.baht += Math.floor(amount);
    store[key] = w; save();
  },
};
