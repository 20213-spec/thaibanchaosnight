# คู่มือ Deploy THAI BAN: CHAOS NIGHT

> สถานะ: เขียนจากความรู้ทั่วไปของแต่ละบริการ **ยังไม่เคย deploy จริง** ราคา โควตา และเงื่อนไขฟรีของผู้ให้บริการเปลี่ยนได้ ตรวจหน้าเว็บของบริการนั้นก่อนใช้ ชื่อโปรเจกต์/โดเมนที่เห็นด้านล่างเป็นตัวอย่างให้แทนที่ ไม่ใช่ค่าจริง

เกมมี 2 ส่วนที่ deploy แยกกัน

| ส่วน | คืออะไร | ที่ลงได้ |
|---|---|---|
| Client | ไฟล์เว็บคงที่ (React + 3D) | Firebase Hosting หรือ static host ใดก็ได้ |
| Server | Node + WebSocket (Colyseus) ต้องรันค้างตลอด | Render, Fly.io, VPS หรือบริการที่รองรับ WebSocket แบบถาวร |

Firebase Hosting เสิร์ฟได้เฉพาะไฟล์คงที่ จึงใช้รัน server ไม่ได้

## 0. ก่อนเริ่ม (ครั้งเดียว)

1. รัน `npm install` ที่โฟลเดอร์หลัก แล้ว commit ไฟล์ `package-lock.json` (ให้ build ซ้ำได้เหมือนเดิม)
2. ทดสอบในเครื่องให้ผ่านก่อน (README หัวข้อ Run on your computer) อย่าเพิ่ง deploy ถ้ายังรันบนเครื่องไม่ได้

## 1. Deploy server

ตัวแปรสภาพแวดล้อม (Environment variables)

| ชื่อ | จำเป็น | ความหมาย |
|---|---|---|
| `PORT` | บริการส่วนใหญ่ตั้งให้เอง | พอร์ตที่ server ฟัง (ค่าเริ่มต้น 2567) |
| `ADMIN_TOKEN` | ถ้าจะใช้หน้า Admin | รหัสลับยาวๆ สุ่มเอง อย่าใช้ซ้ำกับที่อื่น ถ้าไม่ตั้ง หน้า Admin จะปิด |
| `ADMIN_ORIGIN` | แนะนำ | ที่อยู่เว็บ client เช่น `https://your-app.web.app` (ไม่ตั้ง = อนุญาตทุกที่) |
| `ANTHROPIC_API_KEY` | ไม่บังคับ | เปิดโหมด AI เสนอโจทย์ ไม่ตั้งก็ใช้ Template ได้ |
| `ANTHROPIC_MODEL` | ไม่บังคับ | ชื่อ model ที่ใช้ (มีค่าเริ่มต้น) |
| `MATCH_SECONDS` | ไม่บังคับ | ความยาวแมตช์เป็นวินาที (30–3600, ค่าเริ่มต้น 600) |
| `BANK_FILE`, `HISTORY_FILE`, `WALLET_FILE` | ไม่บังคับ | ที่เก็บไฟล์คลังโจทย์ ประวัติ และกระเป๋าเงิน (บาท) |
| `START_BAHT` | เฉพาะทดสอบ | ยอดบาทเริ่มต้นของกระเป๋าใหม่ (ปล่อย 0 ตอนใช้งานจริง) |
| `ALLOW_SOLO_EARN` | เฉพาะทดสอบ | `1` = ได้บาทแม้เล่นคนเดียว (ปิดไว้ตอนใช้งานจริง) |

**ข้อควรระวังเรื่องข้อมูล:** คลังโจทย์และประวัติแมตช์เก็บเป็นไฟล์ในเครื่อง server ถ้าบริการใช้ดิสก์ชั่วคราว ข้อมูลจะหายเมื่อ restart ให้เมานต์ดิสก์ถาวรแล้วชี้ `BANK_FILE` / `HISTORY_FILE` ไปที่ดิสก์นั้น (ย้ายไป Firestore เป็นงานที่ยังไม่ได้ทำ)

### ตัวเลือก A: Render (แบบ Web Service)

1. ใส่โปรเจกต์ใน GitHub
2. Render → New → Web Service → เลือก repo
3. Runtime: Node
4. Build command: `npm install --workspace=server --workspace=shared`
5. Start command: `npm run start --workspace=server`
6. ใส่ตัวแปรตามตารางข้างบน
7. หลัง deploy ทดสอบ `https://<ชื่อบริการ>.onrender.com/health` ต้องได้ `{"ok":true,...}`
8. ที่อยู่ WebSocket ของคุณคือ `wss://<ชื่อบริการ>.onrender.com`

### ตัวเลือก B: Docker (Fly.io หรือ VPS)

ใน repo มี `Dockerfile` สำหรับ server แล้ว

    docker build -t tbcn-server .
    docker run -p 2567:2567 -e ADMIN_TOKEN=... tbcn-server

Fly.io: `fly launch` (ใช้ Dockerfile, internal port 2567) แล้ว `fly secrets set ADMIN_TOKEN=...` และแนบ volume สำหรับข้อมูลถ้าต้องการเก็บถาวร

บริการฟรีบางเจ้าจะหยุดเครื่องเมื่อไม่มีคนใช้ ผู้เล่นที่เล่นอยู่อาจหลุด ตรวจเงื่อนไขปัจจุบันก่อนใช้จัดแข่งจริง

## 2. Deploy client (Firebase Hosting)

    npm install -g firebase-tools
    firebase login
    firebase use --add            # เลือกหรือสร้างโปรเจกต์ Firebase ของคุณ (ชื่อโปรเจกต์ต้องเป็นของคุณเอง)

    # ใส่ที่อยู่ server จริง (ต้องเป็น wss:// เมื่อเว็บเป็น https://)
    VITE_SERVER_URL=wss://<ชื่อบริการ>.onrender.com npm run build --workspace=client     # PowerShell: $env:VITE_SERVER_URL="wss://..."; npm run build --workspace=client
    firebase deploy --only hosting

ไฟล์ `firebase.json` ใน repo ชี้ไปที่ `client/dist` พร้อม rewrite ให้ทุกเส้นทางกลับมาที่ `index.html`

หลัง deploy เปิดเว็บ → สร้างห้อง → เปิดอีกแท็บหรือมือถือเพื่อเข้าห้อง ตรวจว่าเห็นกันและกันเดินได้

## 3. เช็กลิสต์ก่อนเปิดให้คนอื่นเล่น

- [ ] `/health` ของ server ตอบ ok
- [ ] ตั้ง `ADMIN_TOKEN` แล้ว และตั้ง `ADMIN_ORIGIN` เป็นที่อยู่ client จริง
- [ ] `ANTHROPIC_API_KEY` ตั้งเป็น secret ของบริการ ไม่ได้ commit ลง git
- [ ] ทดสอบบนมือถือจริงอย่างน้อย Android 1 เครื่อง และ iOS 1 เครื่อง (ยังไม่เคยทดสอบ)
- [ ] ทำ load test ตาม README (หัวข้อ Load test) และบันทึกผลก่อนบอกจำนวนผู้เล่นที่รองรับ

## 4. สิ่งที่ยังไม่มีในชุด deploy

- Firebase Auth / Firestore (ยังไม่ได้เชื่อม ไม่จำเป็นต่อการรันเกมตอนนี้)
- การ monitor / แจ้งเตือน และ CI อัตโนมัติ
