/** Character look: every field is an index into the lists below. Validated on the server; the client only displays it. */
export const SKIN_TONES = ["#F2C9A0", "#E0AC7E", "#B97A56", "#8A5A3C", "#FBE3D0", "#6B4430"] as const;
export const HATS = ["ไม่สวม", "งอบ", "หมวกแก๊ป", "ผ้าคาดหัว"] as const;
export const HAIR_STYLES = ["สั้นเรียบ", "ทรงนักเรียน", "หน้าม้า", "หางม้า", "ทรงฟู", "ผมยาว"] as const;
export const HAIR_COLORS = ["#1B1B1F", "#3B2412", "#7A4B22", "#C9972B", "#B8312F", "#6B7A8F"] as const;
export const TOPS = ["เสื้อยืด", "แขนยาว", "เสื้อกล้าม", "ฮู้ด", "เสื้อกั๊กทีม", "ลายขาวม้า"] as const;
export const BOTTOMS = ["ขาสั้น", "ขายาว", "กระโปรง", "ขาสามส่วน"] as const;
export const BOTTOM_COLORS = ["#2F4B7C", "#3D3D3D", "#7A4B22", "#2E7D32", "#6A1B9A", "#B71C1C"] as const;
export const SHOES = ["ผ้าใบ", "รองเท้าแตะ", "บู๊ต"] as const;
export const DEFAULT_MATCH_SECONDS = 600;

export interface Look { skin: number; hat: number; hair: number; hairColor: number; top: number; bottom: number; bottomColor: number; shoes: number }
export const DEFAULT_LOOK: Look = { skin: 0, hat: 0, hair: 0, hairColor: 0, top: 0, bottom: 1, bottomColor: 0, shoes: 0 };
export const LOOK_LIMITS: Record<keyof Look, number> = {
  skin: SKIN_TONES.length, hat: HATS.length, hair: HAIR_STYLES.length, hairColor: HAIR_COLORS.length,
  top: TOPS.length, bottom: BOTTOMS.length, bottomColor: BOTTOM_COLORS.length, shoes: SHOES.length,
};

/** Returns a full valid look (missing fields take defaults), or null when any given field is not a valid index. */
export function cleanLook(input: unknown): Look | null {
  if (typeof input !== "object" || input === null) return null;
  const src = input as Record<string, unknown>;
  const out: Look = { ...DEFAULT_LOOK };
  for (const k of Object.keys(LOOK_LIMITS) as (keyof Look)[]) {
    const v = src[k];
    if (v === undefined) continue;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v >= LOOK_LIMITS[k]) return null;
    out[k] = v;
  }
  return out;
}

/** Quick reactions shown above a player for a few seconds and played as an animation. The server accepts only these. */
export const EMOTES = ["👋", "😂", "🎉", "❤️", "😮", "🤔", "😱"] as const;
export const EMOTE_NAMES: Record<string, string> = { "👋": "ทักทาย", "😂": "หัวเราะ", "🎉": "ดีใจ", "❤️": "รักเลย", "😮": "ตกใจ", "🤔": "สงสัย", "😱": "กลัว" };
