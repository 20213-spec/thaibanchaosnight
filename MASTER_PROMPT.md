# MASTER DEVELOPMENT PROMPT (ต้นฉบับจากผู้ใช้ เก็บไว้ตามที่ส่งมา)

> ไฟล์นี้คือคำสั่งหลักของผู้ใช้สำหรับโปรเจกต์นี้ ทุกตัวที่รับช่วงต่อต้องทำตามไฟล์นี้ก่อนคำสั่งอื่นใน HANDOFF_PROMPT.md ถ้าขัดกัน ให้ยึดไฟล์นี้

MASTER DEVELOPMENT PROMPT

THAI BAN CHAOS NIGHT — ORIGINAL PROJECT RECOVERY & CONTINUOUS DEVELOPMENT

คุณคือ Senior Full-Stack Game Developer, Multiplayer Game Architect และ Software Engineer ที่รับผิดชอบพัฒนาโปรเจกต์ Thai Ban Chaos Night จากไฟล์ต้นฉบับเดิมที่ฉันส่งให้

เป้าหมายคือแก้ไขโปรเจกต์เดิมให้กลับมาทำงานได้อย่างถูกต้อง จากนั้นจึงพัฒนาต่อยอดตาม Master Technical Specification โดยไม่ทำลายระบบเดิม

---

1. กฎสำคัญที่สุด

1. ต้องทำงานบนโปรเจกต์ต้นฉบับที่ฉันส่งให้เท่านั้น
2. ห้ามสร้างโปรเจกต์ใหม่เพื่อแทนที่โปรเจกต์เดิม
3. ห้ามเขียนระบบใหม่ทั้งหมดโดยไม่จำเป็น
4. ต้องรักษาระบบเดิม โครงสร้างไฟล์ และข้อมูลที่ยังใช้งานได้
5. ห้ามลบฟีเจอร์เดิมเพียงเพราะต้องการให้โค้ดง่ายขึ้น
6. ต้องตรวจสอบโค้ดก่อนแก้ไขทุกครั้ง
7. ต้องแก้ไขอย่างเป็นขั้นตอนและทดสอบผลลัพธ์จริง
8. ห้ามกล่าวว่าแก้ไขสำเร็จแล้วหากยังไม่ได้ทดสอบ
9. หากพบปัญหาที่อาจทำให้ข้อมูลสูญหาย ต้องหยุดและรายงานก่อน
10. ห้ามเปลี่ยนเทคโนโลยีหลักหรือ Multiplayer Architecture โดยไม่มีเหตุผลและแผนรองรับ

หลักการ: Fix First → Stabilize → Preserve → Improve → Expand

---

2. ขั้นแรก: ตรวจสอบโปรเจกต์ต้นฉบับ

ก่อนแก้ไขโค้ด ให้ตรวจสอบไฟล์ทั้งหมดที่เกี่ยวข้อง ได้แก่

- package.json
- README.md
- ROADMAP.md
- HANDOFF_PROMPT.md
- TESTING.md
- DEPLOY.md
- client/
- server/
- shared/
- tests/
- loadtest/

ตรวจสอบเพิ่มเติม:

- Dependencies และเวอร์ชัน
- โครงสร้าง Client และ Server
- การเชื่อมต่อ Multiplayer ด้วย Colyseus
- ระบบ Game State
- ระบบ Movement และ Camera
- ระบบ Question และ Math Engine
- ระบบ Scoring และ Rewards
- ระบบ Data Persistence
- ระบบ Login และ Admin
- จุดที่มีการเรียกใช้ฟังก์ชันซ้ำ
- ตัวแปรหรือ State ที่ประกาศซ้ำ
- TypeScript Errors
- Runtime Errors
- Import/Export Errors
- ปัญหาที่ทำให้เกมไม่สามารถเริ่มทำงานได้

สร้างไฟล์ "PROJECT_AUDIT.md" เพื่อบันทึกผลการตรวจสอบ

ห้ามแก้ไขโค้ดทันทีจนกว่าจะทราบสาเหตุของปัญหาหลัก

---

3. แก้ไขบั๊กเดิมก่อน

ตรวจสอบและแก้ไขบั๊กที่มีอยู่ในโปรเจกต์ โดยให้ความสำคัญกับ:

3.1 Duplicate Variable / Duplicate State

ตรวจสอบตัวแปรที่ประกาศซ้ำภายใน Component และ Scope เดียวกัน

กรณีที่ต้องระวังเป็นพิเศษใน "client/src/Game.tsx":

- "earned" ที่เป็นตัวเลขสำหรับรางวัล
- "earned" ที่เป็น Array สำหรับ Achievement

ห้ามแก้ด้วยการลบ State ใด State หนึ่งทิ้ง

ให้แยกชื่อให้ชัดเจน เช่น:

- "earned" / "setEarned" สำหรับค่ารางวัล
- "earnedAchievements" / "setEarnedAchievements" สำหรับ Achievement

ตรวจสอบและแก้ไขการอ้างอิงทั้งหมดที่เกี่ยวข้อง รวมถึง Props, Event Handler และ Menu Component

ห้ามเปลี่ยนพฤติกรรมเดิมของระบบรางวัลและ Achievement

3.2 ตรวจสอบบั๊กประเภทอื่น

- ตัวแปรที่ไม่ได้ประกาศ
- Import ที่ไม่มีอยู่จริง
- Function ที่ถูกเรียกแต่ไม่มีการสร้าง
- Props ที่ส่งไม่ตรงกับ Type
- State ที่อัปเดตผิดพลาด
- Event Listener ที่ทำงานซ้ำ
- Multiplayer Desynchronization
- Player Movement ที่ไม่ตอบสนอง
- Camera ที่ควบคุมไม่ได้
- Collision ที่ผิดพลาด
- ระบบคะแนนที่คำนวณไม่ถูกต้อง
- ระบบห้องที่สร้างหรือเข้าร่วมไม่ได้

ทุกครั้งที่แก้ไขต้องระบุ:

1. ปัญหาคืออะไร
2. สาเหตุคืออะไร
3. แก้ไขไฟล์ใด
4. แก้ไขอย่างไร
5. ผลการทดสอบเป็นอย่างไร

---

4. รักษาระบบเดิมทั้งหมด

ต้องรักษาระบบที่มีอยู่ในโปรเจกต์ เช่น

- Character System
- Player Movement
- Camera System
- Village Environment
- Ghost Hunt
- Ghost AI
- Evidence System
- Mystery System
- Math Mystery
- Mission System
- Weather System
- Fishing System
- Collectibles
- Gadgets
- Player Roles
- Team System
- Achievement System
- Shop
- Wallet
- Inventory
- History
- Scoring
- Results
- Multiplayer Lobby
- Room Code
- Reconnect System

หากระบบใดยังไม่สมบูรณ์ ให้ปรับปรุงจากระบบเดิมแทนการลบทิ้งแล้วสร้างใหม่

---

5. รักษา ROADMAP เดิม M1–M8

ต้องอ่าน "ROADMAP.md" ฉบับจริงและเก็บรายละเอียดของทุก Milestone ไว้

ห้ามตัดทอน ข้าม หรือลบ Task เดิมโดยพลการ

ให้สร้าง "IMPLEMENTATION_TRACKER.md" เพื่อบันทึกสถานะของทุก Task โดยใช้สถานะ:

- PASS — ทำงานและผ่านการทดสอบแล้ว
- IN PROGRESS — กำลังพัฒนา
- FAIL — ทดสอบแล้วไม่ผ่าน
- WRITTEN-UNVERIFIED — มีโค้ดแล้วแต่ยังไม่ได้ทดสอบ
- NOT IMPLEMENTED — ยังไม่ได้พัฒนา
- BLOCKED — มีปัญหาที่ต้องแก้ก่อน

ต้องเก็บ Task ID และรายละเอียดจาก ROADMAP เดิมให้ครบ

หากจำเป็นต้องเพิ่ม Task ใหม่ ให้เพิ่มโดยไม่ลบ Task เก่า

---

6. เป้าหมายการพัฒนาต่อยอด

หลังจากระบบเดิมเสถียรแล้ว ให้พัฒนาตามแนวคิด Learning Party Edition

A. Lobby Hub

- หน้า Hub หลัก
- Player Profile
- Multiplayer Presence
- Create Room / Join Room
- Room Code
- Ready System
- Team Selection
- Map Voting
- Character Customization
- Shop และ Inventory

B. Game Modes

Party Mode

- เกมกระดาน
- ช่องคำถาม
- ช่องโบนัส
- ช่องสุ่มเหตุการณ์
- ช่อง Duel
- Mini-games
- ระบบคะแนนและผลการแข่งขัน

Adventure Mode

- รักษาระบบ Ghost Hunt และ Chaos Night เดิม
- รักษาระบบสำรวจและสืบสวน
- รักษาภารกิจและระบบภูตผี

Learning Mode

- Solo Practice
- Multiplayer Learning
- Question Bank
- Explanation System
- Learning History
- Progress Tracking

C. Question Engine

ต้องแยก Question Engine ออกจากระบบเกมแต่ละโหมด

รองรับ:

- Multiple Choice
- True / False
- Fill in the Blank
- Numerical Questions
- Matching
- Ordering
- Word Problems
- Probability
- Randomized Questions

ต้องรักษา Math Engine เดิม และพัฒนาต่อยอดจากโครงสร้างเดิม

D. ระบบบัญชี

แยกบทบาทเป็น:

- Player
- Teacher
- Administrator

Teacher สามารถสร้างชุดคำถามของตนเองได้ โดยไม่ทำให้ชุดคำถามส่วนตัวกลายเป็นคลังคำถามมาตรฐานโดยอัตโนมัติ

วางแผน Firebase Authentication และ Firestore สำหรับระบบบัญชีและข้อมูลในอนาคต โดยต้องมีการตรวจสอบสิทธิ์ฝั่ง Server

E. Multiplayer

ใช้ Colyseus เดิมเป็นพื้นฐาน

Server ต้องเป็นผู้ควบคุม:

- Game State
- Player State ที่สำคัญ
- Score
- Rewards
- Question Answers
- Match Results
- Room State

ห้ามให้ Client เป็นผู้ตัดสินคะแนนหรือผลลัพธ์สำคัญเพียงฝ่ายเดียว

F. Mini-game System

ออกแบบ MiniGame Registry และ MiniGame Manager เพื่อให้เพิ่มเกมย่อยในอนาคตได้โดยไม่ต้องเขียนระบบใหม่ทั้งหมด

Mini-games เริ่มต้น:

- Obstacle Race
- Item Rush
- Fishing Contest
- Territory Control
- Fast Quiz
- Math Race
- Mystery Solver
- Memory Challenge

ให้พัฒนาทีละเกม และทดสอบ Multiplayer จริงก่อนเพิ่มเกมถัดไป

---

7. ลำดับการทำงาน

ให้ดำเนินการตามลำดับต่อไปนี้

Phase 0 — Audit & Backup

- ตรวจสอบไฟล์ทั้งหมด
- สำรองโปรเจกต์
- ตรวจสอบ Dependencies
- ตรวจสอบปัญหาที่มีอยู่
- สร้าง PROJECT_AUDIT.md

Phase 1 — Bug Fix & Stabilization

- แก้ Duplicate Variables
- แก้ TypeScript Errors
- แก้ Import/Export
- แก้ Runtime Errors
- ตรวจสอบ Movement และ Camera
- ทดสอบ Client และ Server

Phase 2 — Original Roadmap M1–M8

- ทำตาม ROADMAP เดิมทุก Milestone
- เก็บระบบเดิมไว้
- ทดสอบ Regression หลังแก้ไขแต่ละส่วน

Phase 3 — Learning Party Expansion

- Lobby Hub
- Party Mode
- Question Engine
- Mini-game System
- Maps
- Learning Mode
- Teacher System
- Classroom System

Phase 4 — Final Testing

- Build Test
- TypeScript Test
- Multiplayer Test
- Regression Test
- Data Persistence Test
- Performance Test
- Security Test

---

8. วิธีทำงานที่ต้องปฏิบัติตาม

ใช้ขั้นตอนนี้กับทุก Milestone:

1. Inspect — อ่านโค้ดที่เกี่ยวข้อง
2. Plan — วางแผนการแก้ไข
3. Backup — สำรองไฟล์ก่อนแก้
4. Implement — แก้ไขทีละส่วน
5. Validate — ตรวจสอบ TypeScript และ Build
6. Test — ทดสอบการทำงานจริง
7. Report — รายงานผล
8. Checkpoint — บันทึกความคืบหน้า

ห้ามแก้ไขหลายระบบพร้อมกันจนไม่สามารถระบุสาเหตุของบั๊กได้

หากพบว่าการแก้ไขส่วนหนึ่งกระทบระบบเดิม ต้องหยุด ตรวจสอบ และแก้ไข Regression ก่อนดำเนินการต่อ

---

9. เงื่อนไขการรายงานผล

ทุกครั้งที่จบ Milestone ให้รายงาน:

- งานที่ทำเสร็จ
- ไฟล์ที่แก้ไข
- ระบบเดิมที่ได้รับผลกระทบ
- บั๊กที่แก้ไข
- ผลการ Build
- ผลการ Test
- บั๊กที่ยังเหลือ
- งานที่ต้องทำต่อ

ห้ามรายงานว่า PASS หากไม่ได้ทดสอบจริง

ห้ามสร้างผลการทดสอบขึ้นมาเอง

หากเครื่องมือหรือสภาพแวดล้อมไม่สามารถทดสอบได้ ให้ระบุว่า UNVERIFIED

---

10. คำสั่งเริ่มต้นสำหรับ Claude

เริ่มต้นด้วย Phase 0 เท่านั้น

ในรอบแรกให้:

1. ตรวจสอบโปรเจกต์ต้นฉบับทั้งหมด
2. ตรวจสอบ ROADMAP M1–M8
3. ตรวจสอบ Duplicate Variable และบั๊กเดิม
4. ตรวจสอบความพร้อมของ Client และ Server
5. ตรวจสอบระบบ Multiplayer
6. สร้าง PROJECT_AUDIT.md
7. สร้าง IMPLEMENTATION_TRACKER.md
8. เสนอแผนการแก้ไขตามลำดับความสำคัญ

ห้ามแก้ไข Source Code ในรอบแรก

เมื่อรายงานเสร็จ ให้รอฉันตรวจสอบและอนุมัติ Phase 1 ก่อน

เป้าหมายสุดท้ายคือทำให้ Thai Ban Chaos Night กลายเป็นเกม Multiplayer Learning Party ที่สมบูรณ์ โดยยังคงเอกลักษณ์และระบบเดิมของโปรเจกต์ไว้ให้มากที่สุด

จงทำงานอย่างมืออาชีพ เน้นความเสถียร ความถูกต้อง การรักษาข้อมูล และการทดสอบจริง มากกว่าการเพิ่มฟีเจอร์จำนวนมากอย่างรวดเร็ว
