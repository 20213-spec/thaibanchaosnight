# PROJECT_AUDIT.md — Phase 0 (Audit & Backup)

โปรเจกต์: THAI BAN: CHAOS NIGHT, เวอร์ชัน 0.29.0 | ผู้ตรวจ: Claude | ขอบเขต: อ่านและตรวจเท่านั้น **ไม่ได้แก้ source code ใดๆ ในรอบนี้** (ตามข้อ 10 ของ MASTER_PROMPT.md)
สำรองข้อมูลแล้ว: `BACKUP_thai-ban-chaos-night_v0.29.0_before-phase1.zip` (สภาพเดียวกับที่ผู้ใช้รันอยู่ รวมบั๊ก P0-1)

## 0. ข้อจำกัดของการตรวจนี้ (อ่านก่อน)

- สภาพแวดล้อมของผู้ตรวจ **ไม่มีเน็ตและไม่มีเบราว์เซอร์** ติดตั้ง `colyseus`, `react`, `three`, `vite` ไม่ได้ จึง **ไม่เคย build หรือรัน `server/` และ `client/` เลย** ทุกสถานะของ server/client ในเอกสารนี้จึงเป็น UNVERIFIED เว้นแต่ระบุว่าเป็นผลจากเครื่องของผู้ใช้
- หลักฐานจากการรันจริงชิ้นเดียวที่มีคือ error ที่ผู้ใช้ส่งมาจาก Vite (P0-1 ด้านล่าง) ซึ่งยืนยันว่าบั๊กอย่างน้อย 1 ตัวหลุดเข้าไปในเวอร์ชันที่ส่งมอบ
- Vite รายงาน error ของ "การสแกน dependency" เท่านั้น มักหยุดที่ error แรกๆ จึง **อาจมี error อื่นซ่อนอยู่** จนกว่าจะรัน `tsc` และ `vite build` จริง

## 1. สิ่งที่ตรวจแล้วและผลที่ได้จริง (รันในสภาพแวดล้อมของผู้ตรวจ)

| การตรวจ | ผล | หมายเหตุ |
|---|---|---|
| `npm run test:shared` | **40/40 ผ่าน** | ครอบคลุมเฉพาะ `shared/` (กติกา ตรรกะ Math Engine) |
| `tsc --strict` กับ `shared/src` | **สะอาด** | ไม่รวมไฟล์เทสต์ |
| อ่านไวยากรณ์ (TypeScript parser) ทั้ง 62 ไฟล์ใน client/server/shared | **62/62 ผ่าน** | ตรวจไวยากรณ์เท่านั้น ไม่ใช่การตรวจ type และไม่ใช่การ build |
| สแกนตัวแปรประกาศซ้ำใน scope เดียวกัน (ทุกไฟล์ .ts/.tsx) | **พบ 1 จุด** | `earned`/`setEarned` ใน `client/src/Game.tsx` (P0-1) ไม่พบที่อื่น (ตัวสแกนตรวจเฉพาะ `const/let/var` และ `function` ใน block เดียวกัน) |
| ตรวจ import/export ภายในโปรเจกต์ (527 named imports แบบ relative) | **ไม่พบปัญหา** | ตรวจว่าไฟล์ปลายทางมีอยู่และ export ชื่อนั้นจริง ไม่ได้ตรวจ package ภายนอก |
| `server/` ตรวจ type กับ stub ของ colyseus (รอบก่อนๆ) | ไม่มี error ที่มาจากโค้ดโปรเจกต์ | stub เป็นของผู้ตรวจเอง ไม่ใช่ type จริงของ colyseus จึง **ไม่ถือเป็นหลักฐานว่า build ผ่าน** |
| `client/` ตรวจ type | **ทำไม่ได้** | ไม่มี `@types/react`, `three` ฯลฯ |

## 2. ผลการตรวจ (Findings)

### P0 — ทำให้เกมเริ่มไม่ได้

**P0-1 ตัวแปร `earned` ประกาศซ้ำใน `client/src/Game.tsx`** (ยืนยันด้วย error จริงจาก Vite ของผู้ใช้)
- ปัญหา: `const [earned, setEarned]` ถูกประกาศ 2 ครั้งใน component `Game` ทำให้ Vite/esbuild ไม่ผ่าน
- สาเหตุ: เวอร์ชัน v0.29 (เพิ่มรายการป้ายความสำเร็จในเมนู) เพิ่ม state ใหม่ชื่อซ้ำกับ state เดิมที่เก็บรางวัลเป็นเงินบาท **เป็นความผิดพลาดของ Claude ตัวก่อนหน้าที่ไม่ได้ตรวจชื่อซ้ำก่อนส่งมอบ**
- ตำแหน่งในไฟล์ปัจจุบัน:
  - บรรทัด 139: `const [earned, setEarned] = useState<number | null>(null);` (รางวัลเงินบาท ของเดิม)
  - บรรทัด 149: `const [earned, setEarned] = useState<string[]>([]);` (ป้ายความสำเร็จ ของใหม่ v0.29 ซ้ำ)
  - บรรทัด 225: `room.onMessage("earned", (m) => setEarned(m.baht))` (ของเดิม ใช้ตัวเลข)
  - บรรทัด 275: handler `"achv"` เรียก `setEarned((e) => [...])` (ของใหม่ ต้องเปลี่ยนชื่อ)
  - บรรทัด 344: `<Results ... earned={earned} />` (ของเดิม ใช้ตัวเลข **ต้องคงไว้**)
  - บรรทัด 346: `<Menu ... earned={earned} ...>` (ของใหม่ ต้องส่ง state ป้ายความสำเร็จ)
  - `client/src/Menu.tsx`: prop `earned?: string[]` (ของใหม่)
- แผนแก้ (ตามข้อ 3.1 ของ MASTER_PROMPT: **ไม่ลบ state ใดทิ้ง** แยกชื่อ):
  1. บรรทัด 149 → `const [earnedAchievements, setEarnedAchievements] = useState<string[]>([]);`
  2. บรรทัด 275 → `setEarnedAchievements(...)`
  3. บรรทัด 346 → `<Menu ... earnedAchievements={earnedAchievements} ...>` และบรรทัด 344 `Results earned={earned}` **ไม่แตะ**
  4. `Menu.tsx` เปลี่ยน prop `earned` เป็น `earnedAchievements` (และจุดที่ใช้ภายใน)
- ข้อควรระวัง: ความพยายามแก้ครั้งก่อนในแชตล้มระหว่างทางเพราะ `earned={earned}` ปรากฏ 2 ที่ (Results และ Menu) ไม่มีการเขียนไฟล์ ไฟล์ใน ZIP จึงยังเป็นสภาพเดิมที่มีบั๊ก ต้องแก้แบบเจาะจงทีละจุดเท่านั้น
- เกณฑ์ผ่าน: ผู้ใช้รัน `npm run dev:client` แล้วไม่มี error นี้ และผลรางวัลเงินบาทหน้าผลคะแนนยังแสดงเหมือนเดิม

**P0-2 `server/` และ `client/` ไม่เคยถูกคอมไพล์หรือรันเลย** (UNVERIFIED ทั้งหมด)
- ความเสี่ยง: นอกจาก P0-1 น่าจะมี error ชนิดอื่นอีก (type ไม่ตรง prop ผิด ฯลฯ) ที่ Vite ยังไม่ได้รายงาน
- แผน: ผู้ใช้รัน `npm install` แล้ว `npx tsc -p client --noEmit` และ `npx tsc -p server --noEmit` ส่งผลมาให้ครบทุก error แล้วแก้ทีละกลุ่ม (ดูแผนข้อ 4)

### P1 — ความเสี่ยงต่อเสถียรภาพและการดูแลโปรเจกต์

| ID | ปัญหา | หลักฐาน | ข้อเสนอ |
|---|---|---|---|
| P1-1 | ไม่มี script ตรวจ type | `package.json` มีแค่ `test:shared`, `dev:*`, `loadtest`; `client` มีแค่ `dev`/`build`; `server` รันด้วย `tsx` ซึ่งตัด type ทิ้งโดยไม่ตรวจ | เพิ่ม `typecheck` ให้ client/server และ root (ทำใน Phase 1 หลังได้รับอนุมัติ) |
| P1-2 | ไม่มี `package-lock.json` | ไม่พบในโฟลเดอร์ราก | หลังผู้ใช้รัน `npm install` สำเร็จ ควร commit lock file เพื่อตรึงเวอร์ชัน |
| P1-3 | ไม่มีโฟลเดอร์ `tests/` ตามที่ MASTER_PROMPT ระบุ | เทสต์อยู่ที่ `shared/test/` (2 ไฟล์) | คงที่เดิม (ไม่ย้ายโดยไม่จำเป็น) บันทึกไว้ในเอกสาร ไม่มีเทสต์ของ server/client เลย |
| P1-4 | เอกสารไม่ตรงกัน | `ROADMAP.md` บรรทัดสถานะยังเขียน v0.19.0 แต่พูดถึง 40 tests; เซลล์ M3 ผสมหลายสถานะในช่องเดียว | แก้เอกสารใน Phase 1 (ไม่กระทบโค้ด) |
| P1-5 | ข้อมูลเก็บเป็นไฟล์ JSON บนดิสก์ของ server | `wallet.ts`/`history.ts`/`bank.ts` เขียนไฟล์ `.tmp` แล้ว `renameSync` (ปลอดภัยจากไฟล์ขาดครึ่ง) แต่เก็บใน `data/` ของ container | ถ้า deploy บนที่เก็บไฟล์ชั่วคราว (เช่น Docker ไม่ผูก volume) ข้อมูลหายเมื่อเริ่มใหม่ ต้องบอกผู้ใช้ก่อนใช้งานจริง **ไม่ได้ตรวจการ deploy จริง** |
| P1-6 | ตัวตนผู้เล่นคือคีย์สุ่มในเบราว์เซอร์ ไม่ใช่บัญชี | `GameRoom.onJoin` รับ `options.key` และผูกกับกระเป๋าเงิน (`wallets.peek(key)`) | ใครได้คีย์ก็ใช้กระเป๋าเงินนั้นได้ ต้องมี Firebase Auth ตามแผน (A9) ก่อนมีเงิน/ข้อมูลที่มีมูลค่าจริง |
| P1-7 | Admin API ใช้ token เดียว และ CORS เริ่มต้นเป็น `*` | `server/src/admin.ts` บรรทัด 20-39: ตรวจ `x-admin-token` ด้วย timing-safe compare (ดี) แต่ `ADMIN_ORIGIN` ไม่ตั้ง = เปิดทุก origin | ตั้ง `ADMIN_ORIGIN` ตอน deploy; ระบบ role Player/Teacher/Admin ยังไม่มี (ดูข้อ 3) |

### P2 — ค้างจาก ROADMAP เดิม (ไม่ใช่บั๊กใหม่)

- A6: ล็อบบี้ไม่มี reconnect (ในแมตช์มี `allowReconnection(client, 30)` ที่ `GameRoom.ts` บรรทัด 644)
- A7: ผี AI และ server ไม่คิดการชนกับสิ่งก่อสร้าง (ผู้เล่นฝั่ง server ถูกตรวจความเร็วและกำแพงโลกแต่ไม่ชนวัตถุ)

## 3. ผลตรวจระบบ Multiplayer / ความปลอดภัยฝั่ง Server (อ่านโค้ด ไม่ได้รัน)

พบว่าเป็นไปตามหลัก "Server เป็นผู้ตัดสิน" ในจุดที่อ่านแล้ว:
- **การเคลื่อนที่**: `move` ตรวจฝั่ง server ปฏิเสธการเทเลพอร์ต/ความเร็วเกิน (`GameRoom.ts` บรรทัด ~171-181) และ clamp ในขอบแผนที่
- **อัตราข้อความ**: ทุก handler ผ่าน token bucket ต่อผู้เล่น (`handle()` บรรทัด ~384-394)
- **คำตอบโจทย์**: `puzzle:answer` เทียบ `correctIndex` ที่ server เก็บไว้เอง (บรรทัด ~358-370) และโจทย์ที่สร้างเองถูกตรวจด้วย `validateQuestion` (บรรทัด ~353) ไม่เชื่อ client
- **คะแนน/เงิน/ผล**: คำนวณใน `GameRoom.ts`/`chaos.ts` client ส่งแค่ "ความตั้งใจ" (หยิบ ส่ง ตอบ)
- **ข้อมูลลับของคดี**: ผีตัวการอยู่ที่ server เท่านั้น
- ข้อความ handler ทั้งหมดที่ server รับ: `ability acc case:accuse case:collect case:sync collect deliver emote fish:cast fish:reel gadget:take gadget:use help look mode move pickup ping puzzle:answer puzzle:hint puzzle:new quiz:answer ready role search start team`
- **ยังไม่ได้ตรวจเชิงลึก** (จะทำใน Phase 1/4): การทดสอบหลายคนจริง การซิงค์ state ที่ client รับ การรั่วของข้อมูลใน schema สาธารณะ และประสิทธิภาพ (มี `loadtest/run.mjs` แต่ยังไม่เคยรัน)

## 4. ช่องว่างเทียบกับเป้าหมาย Learning Party (MASTER_PROMPT ข้อ 6) ที่พบจากการอ่านโค้ด

| เป้าหมาย | สถานะที่พบ |
|---|---|
| Lobby Hub / Create / Join / Room Code / Ready / เลือกทีม / ปรับแต่งตัวละคร / ร้านค้า | มีบางส่วนในโค้ด (Home, Lobby, Shop, Avatar, ready/team/look handlers) ยังไม่มี Map Voting และ Hub แบบเต็ม |
| Adventure Mode (Ghost Hunt, Chaos Night) | มีในโค้ด (WRITTEN-UNVERIFIED) |
| Party Mode แบบเกมกระดาน | **ไม่มี** (Chaos Party ปัจจุบันเป็นมินิเกมแข่งทีม 4 รอบ ไม่ใช่เกมกระดาน) |
| Learning Mode (Solo/Multiplayer/ประวัติการเรียน/ติดตามความก้าวหน้า) | **ไม่มี** มี History เป็นประวัติแมตช์ ไม่ใช่ประวัติการเรียน |
| Question Engine แยกจากโหมด | `shared/src/math/*` เป็นแกนที่ดี (สร้างโจทย์ แก้ ตรวจ) แต่รองรับแค่ปรนัยแบบเลือกคำตอบ (`choices` + `correctIndex`) ยังไม่มีรูปแบบอื่น |
| บทบาท Player/Teacher/Administrator | **ไม่มี** มีแค่ Admin ด้วย ADMIN_TOKEN เดียว |
| Firebase Auth/Firestore | **ไม่มี** (`firebase.json` ตั้งค่าแค่ Hosting) |
| MiniGame Registry/Manager | **ไม่มี** รอบมินิเกมถูกเขียนตายตัวใน `server/src/chaos.ts` (เก็บลูกแก้ว ตอบคำถาม วิ่งส่งของ ตกปลา) |

## 5. แผนเสนอ (เรียงตามลำดับความสำคัญ) — รออนุมัติ

**Phase 1 — แก้และทำให้เสถียร (ยังไม่เริ่ม)**
1. แก้ P0-1 ตามแผนด้านบน (ไฟล์เดียว 2 ไฟล์: `Game.tsx`, `Menu.tsx`) แล้วให้ผู้ใช้รัน `npm run dev:client` ยืนยัน
2. ผู้ใช้รัน `npm install` + `npx tsc -p client --noEmit` + `npx tsc -p server --noEmit` ส่งผลมาครบ; แก้ทีละกลุ่มและส่งรายงานตามรูปแบบ "ปัญหา/สาเหตุ/ไฟล์/วิธีแก้/ผลทดสอบ"
3. เพิ่ม `typecheck` script (P1-1) หลังได้รับอนุมัติ
4. รัน server + client จริง เข้าห้อง เดิน กล้อง เก็บของ ตาม `TESTING.md` ทีละหัวข้อ บันทึกผลลง `IMPLEMENTATION_TRACKER.md`
5. แก้เอกสารที่ไม่ตรง (P1-4)

**จะไม่ทำจนกว่า Phase 1 ผ่าน:** ฟีเจอร์ใหม่ทุกอย่าง (ระบบสืบคดีส่วนต่อ เหตุการณ์สุ่ม ฯลฯ) ตามหลัก Fix First

**Phase 2/3/4:** ตามลำดับใน MASTER_PROMPT ข้อ 7 ทีละ Milestone/ทีละมินิเกม โดยทดสอบหลายคนจริงก่อนเพิ่มอย่างถัดไป

## 5.1 ความคืบหน้า Phase 1 (v0.29.1) — ผู้ใช้อนุมัติแล้ว

**P0-1: แก้ในโค้ดแล้ว (ยังไม่ได้ยืนยันด้วยการรันจริง)**
- ปัญหา: `earned`/`setEarned` ประกาศซ้ำใน `Game.tsx`
- สาเหตุ: v0.29 เพิ่ม state ป้ายความสำเร็จชื่อซ้ำกับ state รางวัลเงินบาทเดิม
- ไฟล์ที่แก้: `client/src/Game.tsx`, `client/src/Menu.tsx`
- วิธีแก้: ตัวป้ายความสำเร็จเปลี่ยนเป็น `earnedAchievements`/`setEarnedAchievements` (บรรทัด 149, handler `achv`, prop ที่ส่งให้ `Menu`, และ prop ใน `Menu.tsx`); state รางวัลเงินบาท `earned`/`setEarned` และ `<Results earned={earned}>` ไม่ถูกแตะ ไม่ลบ state ใดทิ้ง
- ผลตรวจที่รันจริง (ผู้ตรวจ): สแกนชื่อซ้ำทั้งโปรเจกต์ = 0 จุด; ไวยากรณ์ 62/62; import/export 527 รายการไม่มีปัญหา; `npm run test:shared` 40/40
- **ผลทดสอบจริงของฟีเจอร์: ยังไม่มี** รอผู้ใช้รัน `npm run dev:client` (เกณฑ์ผ่าน: ไม่มี error นี้ และหน้าผลคะแนนยังแสดงเงินบาทเหมือนเดิม)

**ตรวจ type ฝั่ง client แบบใช้ stub (ไม่ใช่การ build จริง):** รัน `tsc` กับ stub ของ react/three/@react-three/fiber/colyseus.js (ทุกอย่างเป็น `any` แบบหลวมๆ) ได้ error 80 รายการ ทั้งหมดไล่ดูแล้วเป็นผลของ stub (ไม่มี export ของ three, namespace `React`, prop `key`, implicit any จาก type ที่ stub ให้) **ไม่พบ** error ชนิด "ไม่รู้จักชื่อ" (TS2304) "ไม่มี property" (TS2339) หรือ "จำนวน argument ผิด" (TS2554) ในโค้ดโปรเจกต์ แต่เพราะ stub เป็น `any` จึงยังซ่อน type error จริงได้ ถือเป็นหลักฐานอ่อน ไม่ใช่ PASS

## 5.2 ผลจริงจากเครื่องผู้ใช้ (v0.29.1) และการแก้ (v0.29.2)

- `npx tsc -p server --noEmit`: **ไม่มี error** (ผู้ใช้รันจริง คำสั่งไม่พิมพ์อะไร) — ยังไม่ได้ยืนยันด้วยการรัน server จริง
- `npx tsc -p client --noEmit`: **2 error** (TS2322) ที่ `client/src/Avatar.tsx` บรรทัด 195 และ 203
  - ปัญหา: `ref={r}` บน `<group>` ไม่ผ่านการตรวจ type
  - สาเหตุ: ฟังก์ชันช่วย `leg`/`arm` ระบุชนิดพารามิเตอร์เป็น `React.RefObject<Group | null>` ซึ่งไม่ตรงกับ `Ref<Group>` ที่ react-three-fiber ต้องการ
  - ไฟล์ที่แก้: `client/src/Avatar.tsx` (2 บรรทัด) วิธีแก้: เปลี่ยนเป็น `React.Ref<Group>` (รับค่าจาก `useRef<Group>(null)` ได้ทั้ง React 18/19) การสร้าง ref ที่บรรทัด 111 ไม่ถูกแตะ
  - ผลทดสอบ: **ยังไม่มี** รอผู้ใช้รัน `npx tsc -p client --noEmit` ซ้ำ
- บทเรียน: การตรวจ type ด้วย stub ของผู้ตรวจ **จับ error นี้ไม่ได้** (ตามที่ระบุไว้ว่าเป็นหลักฐานอ่อน) ให้เชื่อผลจาก `tsc` บนเครื่องผู้ใช้เท่านั้น

## 5.3 ตรวจโค้ดการเดิน/กล้อง/โปรโตคอลข้อความ (v0.29.3, อ่านโค้ดเท่านั้น ไม่ได้รัน)

**การเดินและกล้อง** (`Game.tsx` `LocalPlayer` บรรทัด 35-100, `input.ts`, server `move` บรรทัด 172-186): ไม่พบข้อผิดพลาดจากการอ่าน
- ทิศเดินสอดคล้องกับตำแหน่งกล้อง (ข้างหน้า = ห่างจากกล้อง ขวา = ตั้งฉาก) ตรวจสูตรแล้วถูกต้อง
- ลด `dt` สูงสุด 0.05 วินาที กันกระโดดข้ามหลังสลับแท็บ; กระโดดและแรงโน้มถ่วงถูกต้อง
- การชนฝั่ง client ใช้ `resolveCollisions` (มี unit test); server ตรวจความเร็ว/ขอบแผนที่/เทเลพอร์ต แต่ไม่ตรวจการชนวัตถุ (ตรงกับ A7 ที่ทราบอยู่แล้ว)
- ส่งตำแหน่งทุก 0.1 วินาที เทียบกับ rate limit ของ server 30 ข้อความต่อวินาที ผ่าน
- ข้อจำกัด: นี่คือการอ่านโค้ด ไม่ใช่การทดสอบ จึง **ยืนยันไม่ได้ว่าเดิน/กล้องใช้งานได้จริง** ต้องดูจากการรัน

**โปรโตคอลข้อความ client↔server** (สคริปต์เทียบชื่อข้อความ): ไม่พบข้อความที่ client ส่งแต่ server ไม่มี handler และไม่พบข้อความที่ client รอรับแต่ server ไม่เคยส่ง รายการที่สคริปต์ติดธงทั้งหมดเป็นผลบวกลวง: `fish:cast`/`fish:reel` client ส่งผ่าน ternary, `ended` client ฟังผ่าน helper `on(...)`, `ping`/`pong` ใช้โดย `loadtest/run.mjs` ข้อจำกัด: ตรวจเฉพาะชื่อข้อความ ไม่ได้ตรวจรูปแบบข้อมูล (payload)

## 6. สิ่งที่ต้องการจากผู้ใช้เพื่อไปต่อ

1. **อนุมัติ Phase 1** (ตามคำสั่งในข้อ 10 ที่ให้รอการอนุมัติ)
2. ส่งผลจากเครื่องคุณหลังรันคำสั่งใน Phase 1 ข้อ 2 (ข้อความ error ทั้งหมดดีกว่าส่งทีละอัน)
3. บอกว่าจะ deploy ที่ไหน (มีผลต่อ P1-5 และการเก็บข้อมูล)

## 6. Phase 2 รอบแรก (v0.30.0 → v0.31.0): M6 หัวข้อเอกรูปไม่ต่อเนื่อง

สถานะตั้งต้น: ผู้ใช้รายงานว่ารัน/เดิน/กล้อง/เล่นได้ปกติ (Phase 1 ผ่านตามรายงานผู้ใช้) จึงเริ่ม Phase 2 ตาม MASTER_PROMPT ข้อ 7
1. งาน: เพิ่มหัวข้อ "การแจกแจงเอกรูปไม่ต่อเนื่อง" ที่ชุดคำสั่งตั้งต้นระบุไว้แต่โปรเจกต์ยังไม่มี (ก่อนหน้ามี 6 หัวข้อ)
2. ไฟล์ที่แตะ: `shared/src/math/{types,solve,generate,custom,validate}.ts`, `shared/test/math.test.ts`, `server/src/admin.ts` (คำค้น), `client/src/Mystery.tsx` และ `Admin.tsx` (ชื่อหัวข้อ)
3. วิธี: เพิ่มชนิดโจทย์ใหม่ในตัวคำนวณเดิม (คำนวณด้วยโค้ดเสมอ ตรวจซ้ำด้วยตัวตรวจแยกชั้นเดิม) ไม่แตะระบบคะแนน/ห้อง/Multiplayer
4. ผลทดสอบ: `npm run test:shared` 44/44 ผ่าน (รวมโจทย์เอกรูป 1,600 ข้อผ่านตัวตรวจ ค่าถูกต้องตามสูตร เช่น ลูกเต๋า Var = 35/12) ฝั่ง client/server **ยังไม่ได้ตรวจ type/รันในสภาพแวดล้อมของผู้แก้** (ไม่มี TypeScript) ผู้ใช้ควรรัน `npm run typecheck` เพื่อยืนยัน
5. ความเสี่ยง: ต่ำ (เพิ่มชนิดข้อมูลใหม่แบบ additive; `Topic` เพิ่มสมาชิก `"uniform"` ซึ่งทุกที่ที่ใช้ `Record<string,string>` ไม่กระทบ)
