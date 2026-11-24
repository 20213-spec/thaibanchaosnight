import { useState } from "react";
import { TOPICS } from "../../shared/src/index.ts";
import { httpUrl } from "./net.ts";

const TN: Record<string, string> = { all: "ทุกหัวข้อ", basic: "ความน่าจะเป็นพื้นฐาน", expected: "ค่าคาดหมาย", variance: "ความแปรปรวน", binomial: "ทวินาม", poisson: "ปัวซง", normal: "ปกติ", uniform: "เอกรูปไม่ต่อเนื่อง" };
const DN: Record<string, string> = { easy: "ง่าย", normal: "ปกติ", hard: "ยาก", expert: "ผู้เชี่ยวชาญ" };
const SN: Record<string, string> = { pending: "รออนุมัติ", approved: "อนุมัติแล้ว", rejected: "ปฏิเสธ" };

export function Admin() {
  const [token, setToken] = useState("");
  const [mode, setMode] = useState<"template" | "content">("template");
  const [topic, setTopic] = useState("all");
  const [diff, setDiff] = useState("normal");
  const [count, setCount] = useState(5);
  const [content, setContent] = useState("");
  const [entries, setEntries] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function api(path: string, init?: RequestInit) {
    const res = await fetch(httpUrl + "/admin" + path, { ...init, headers: { "content-type": "application/json", "x-admin-token": token, ...(init?.headers ?? {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error === "unauthorized" ? "โทเคนไม่ถูกต้อง" : data?.error === "admin_disabled" ? "server ยังไม่ได้ตั้ง ADMIN_TOKEN" : `ผิดพลาด: ${data?.error ?? res.status}${data?.detail ? " (" + data.detail + ")" : ""}`);
    return data;
  }
  const run = async (fn: () => Promise<void>) => { setBusy(true); setMsg(""); try { await fn(); } catch (e: any) { setMsg(String(e?.message ?? e)); } finally { setBusy(false); } };
  const refresh = () => run(async () => setEntries((await api("/questions")).entries.slice().reverse()));
  const generate = () => run(async () => {
    const d = await api("/generate", { method: "POST", body: JSON.stringify({ mode, topic, difficulty: diff, count, content }) });
    setEntries((await api("/questions")).entries.slice().reverse());
    setMsg(`สร้างได้ ${d.added.length} ข้อ${d.aiUsed ? " (ใช้ AI เสนอโจทย์ คำตอบคำนวณด้วยโค้ด)" : mode === "content" ? " (ไม่มี AI Key จึงใช้ตัวสร้างแบบ Template ตามหัวข้อที่พบในเนื้อหา)" : ""}${d.rejected.length ? ` · ตรวจไม่ผ่าน ${d.rejected.length} ข้อ: ${d.rejected.join(" | ")}` : ""}`);
  });
  const setStatus = (id: string, status: string) => run(async () => { await api(`/questions/${encodeURIComponent(id)}/status`, { method: "POST", body: JSON.stringify({ status }) }); setEntries((await api("/questions")).entries.slice().reverse()); });
  const del = (id: string) => run(async () => { await api(`/questions/${encodeURIComponent(id)}`, { method: "DELETE" }); setEntries((await api("/questions")).entries.slice().reverse()); });

  return (
    <main>
      <h1>ตัวสร้างโจทย์ (ผู้ดูแล)</h1>
      <p className="mute">โจทย์ที่สร้างจะอยู่สถานะ "รออนุมัติ" และจะถูกนำไปใช้ในเกมเฉพาะเมื่อคุณกดอนุมัติ</p>
      <div className="bar"><input type="password" value={token} placeholder="ADMIN_TOKEN" aria-label="ADMIN_TOKEN" onChange={(e) => setToken(e.target.value)} /><button disabled={!token || busy} onClick={refresh}>เชื่อมต่อ / โหลดรายการ</button></div>
      <div className="row">
        <select aria-label="วิธีสร้าง" value={mode} onChange={(e) => setMode(e.target.value as any)}><option value="template">จากคลังโจทย์ (Template)</option><option value="content">จากเนื้อหาที่วางเอง</option></select>
        <select aria-label="ระดับ" value={diff} onChange={(e) => setDiff(e.target.value)}>{Object.keys(DN).map((d) => <option key={d} value={d}>{DN[d]}</option>)}</select>
      </div>
      {mode === "template"
        ? <div className="row"><select aria-label="หัวข้อ" value={topic} onChange={(e) => setTopic(e.target.value)}>{["all", ...TOPICS].map((t) => <option key={t} value={t}>{TN[t]}</option>)}</select></div>
        : <textarea rows={6} value={content} maxLength={8000} placeholder="วางเนื้อหาบทเรียนหรือพิมพ์หัวข้อ (20–8000 ตัวอักษร)" aria-label="เนื้อหา" onChange={(e) => setContent(e.target.value)} />}
      <div className="row"><label>จำนวนข้อ <input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} /></label>
        <button className="go" disabled={!token || busy} onClick={generate}>{busy ? "กำลังทำงาน…" : "สร้างโจทย์"}</button></div>
      {msg && <p role="status" aria-live="polite">{msg}</p>}
      {entries.map((e) => (
        <div key={e.q.id} className="team" style={{ ["--c" as any]: e.status === "approved" ? "#2FA84F" : e.status === "rejected" ? "#E5383B" : "#C98F00" }}>
          <div className="th"><b>{SN[e.status]}</b><span className="mute small">{TN[e.q.topic]} · {DN[e.q.difficulty]} · {e.q.source === "ai" ? "AI เสนอ" : "Template"}</span></div>
          <p>{e.q.text}</p>
          <ol className="mem" style={{ listStyle: "none" }}>{e.q.choices.map((c: string, i: number) => <li key={i} className={i === e.q.correctIndex ? "rdy" : ""}>{c}</li>)}</ol>
          <details><summary>วิธีทำ</summary><ol>{e.q.solution.map((s: string, i: number) => <li key={i}>{s}</li>)}</ol></details>
          <div className="bar"><button disabled={busy || e.status === "approved"} onClick={() => setStatus(e.q.id, "approved")}>อนุมัติ</button>
            <button disabled={busy || e.status === "rejected"} onClick={() => setStatus(e.q.id, "rejected")}>ปฏิเสธ</button>
            <button disabled={busy} onClick={() => del(e.q.id)}>ลบ</button></div>
        </div>
      ))}
      <a href="#">กลับหน้าเกม</a>
    </main>
  );
}
