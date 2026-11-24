import { makeRng } from "./math/rng.ts";
import { SEARCH_SPOTS } from "./missions.ts";

/** Story notes found in searchable objects: 70% funny, 30% mildly spooky, never violent. Pure and deterministic per (seed, object). */
export const FUNNY_NOTES = [
  "สมุดบัญชีเก่า จดว่า \"ผีมาซื้อข้าวเหนียว แต่ไม่มีเงิน ขอติดไว้ก่อน\"",
  "ใบปลิวขายกะละมังมือสอง ท้ายใบเขียนว่า \"กะละมังนี้เคยมีเสียงผิวปากดังออกมาตอนกลางคืน\"",
  "ผ้าขาวม้าผืนหนึ่งพับไว้เรียบร้อย มีกระดาษแปะว่า \"ใครมาเอาไป ผีจะตามทวง\"",
  "ตะกร้าใบเล็ก ข้างในมีแต่ถุงขนมเปล่า กับรอยนิ้วมือแปะแป้ง",
  "จดหมายถึงผู้ใหญ่บ้าน: \"เมื่อคืนเสียงร้องเพลงแถวป่า เพราะมาก ขอเรียกใช้งานงานบุญปีหน้า\"",
  "ร่มคันเก่าเปียกชื้น ทั้งที่ฝนไม่ได้ตกมาสามวันแล้ว",
  "ป้ายเล็กๆ เขียนด้วยดินสอ: \"โปรดอย่าหัวเราะดังๆ ตอนตีสาม ผีนอนไม่หลับ\"",
] as const;
export const SPOOKY_NOTES = [
  "รอยเท้าเปียกเดินวนรอบหีบ แล้วหายไปตรงขอบบ่อ",
  "เสียงเคาะไม้ดังสองครั้งจากข้างใน แต่พอเปิดดูก็ไม่มีอะไร",
  "โคมไฟดวงหนึ่งแขวนอยู่ ทั้งที่ไม่มีใครจุดมันขึ้นมา",
] as const;

export function noteFor(seed: number, objectIndex: number): string {
  const r = makeRng((seed ^ Math.imul(objectIndex + 1, 0x9e3779b1)) >>> 0);
  return r.next() < 0.7 ? r.pick(FUNNY_NOTES) : r.pick(SPOOKY_NOTES);
}
export const searchSpot = (id: string) => SEARCH_SPOTS.find((o) => o.id === id) ?? null;
