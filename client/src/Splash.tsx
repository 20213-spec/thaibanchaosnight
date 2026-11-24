import { useEffect, useState } from "react";

const TIPS = [
  "ผีในเกมแค่หลอกให้ตกใจ ไม่มีใครเสียคะแนน",
  "ตอบโจทย์ผิดไม่หักคะแนน และขอคำใบ้ได้",
  "ลูกแก้วสีฟ้าคือหลักฐาน เก็บแล้วได้ +20 คะแนน",
  "วงสีทีมหน้าบ้านทีมคือจุดปลอดภัยในโหมด Chaos Night",
  "เพื่อนร่วมทีมที่ตกใจเดินช้าลง เดินไปปลอบเพื่อรับ +30",
  "ทำคะแนนพร้อมเพื่อนในทีม 3 คนภายใน 1 นาที ได้โบนัสทีมเวิร์ก",
  "บาทที่ได้จากการเล่นใช้ซื้อของตกแต่งตัวละครเท่านั้น",
];

/** Full-screen loading / connecting screen. */
export function Splash({ message = "กำลังโหลด…" }: { message?: string }) {
  const [i, setI] = useState(() => Math.floor(Math.random() * TIPS.length));
  useEffect(() => { const t = setInterval(() => setI((n) => (n + 1) % TIPS.length), 3500); return () => clearInterval(t); }, []);
  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="lamp" aria-hidden="true" />
      <h1 className="splash-title">THAI BAN<small>CHAOS NIGHT</small></h1>
      <div className="loadbar" aria-hidden="true"><i /></div>
      <p>{message}</p>
      <p className="tip">💡 {TIPS[i]}</p>
    </div>
  );
}
