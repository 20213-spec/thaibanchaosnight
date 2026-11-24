import { useState } from "react";
import { settings, saveSettings, type Quality } from "./settings.ts";
import { audio } from "./audio.ts";
import type { Volume } from "../../shared/src/index.ts";

export function SettingsPanel({ onChange }: { onChange?: () => void }) {
  const [, bump] = useState(0);
  const set = (p: Parameters<typeof saveSettings>[0]) => { saveSettings(p); bump((n) => n + 1); onChange?.(); };
  return (
    <div>
      <label>ความไวการหมุนกล้อง
        <input type="range" min={0.3} max={2.5} step={0.1} value={settings.sensitivity} onChange={(e) => set({ sensitivity: Number(e.target.value) })} /> {settings.sensitivity.toFixed(1)}</label>
      <div className="row"><label>คุณภาพกราฟิก
        <select value={settings.quality} onChange={(e) => set({ quality: e.target.value as Quality })}>
          <option value="high">สูง (แสงและรายละเอียดตัวละครเต็ม)</option><option value="medium">กลาง (สมดุล แนะนำสำหรับมือถือ)</option><option value="low">ต่ำ (ลื่นสุดบนเครื่องเก่า)</option></select></label></div>
      <label><input type="checkbox" checked={settings.hints} onChange={(e) => set({ hints: e.target.checked })} /> แสดงคำแนะนำปุ่มควบคุม (บนคอม)</label>
      <h3>เสียง</h3>
      <label><input type="checkbox" checked={settings.muted} onChange={(e) => { set({ muted: e.target.checked }); audio.apply(); }} /> ปิดเสียงทั้งหมด</label>
      {([["master", "ระดับเสียงรวม"], ["sfx", "เสียงเอฟเฟกต์"], ["ambient", "เสียงบรรยากาศ"], ["music", "เพลง"]] as [keyof Volume, string][]).map(([k, label]) => (
        <label key={k}>{label}
          <input type="range" min={0} max={1} step={0.05} value={settings.volume[k]} disabled={settings.muted}
            onChange={(e) => { set({ volume: { ...settings.volume, [k]: Number(e.target.value) } }); audio.apply(); }}
            onPointerUp={() => audio.sfx("collect")} /> {Math.round(settings.volume[k] * 100)}%</label>
      ))}
      <p className="mute small">เสียงทั้งหมดสร้างขึ้นด้วยโค้ดในเบราว์เซอร์ (ไม่มีไฟล์เสียง) เสียงเริ่มทำงานหลังแตะหน้าจอหรือกดปุ่มครั้งแรก เก็บไว้ในเบราว์เซอร์เครื่องนี้เท่านั้น</p>
    </div>
  );
}
