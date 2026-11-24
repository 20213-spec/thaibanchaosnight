import type { Room } from "colyseus.js";
import { TEAMS, CURRENCY } from "../../shared/src/index.ts";
import { TOKEN_KEY, type Snapshot } from "./net.ts";

export function Results({ room, snap, earned }: { room: Room; snap: Snapshot; earned: number | null }) {
  const board = TEAMS.map((t) => ({ ...t, pts: snap.players.filter((p) => p.team === t.id).reduce((s, p) => s + p.score, 0) })).sort((a, b) => b.pts - a.pts);
  const top = [...snap.players].sort((a, b) => b.score - a.score).slice(0, 10);
  const me = snap.players.find((p) => p.id === room.sessionId);
  return (
    <>
      <h1>จบเกม</h1>
      <p>ทีมชนะ: <b style={{ color: board[0].color }}>{board[0].name}</b> ({board[0].pts} คะแนน) · คะแนนของคุณ {me?.score ?? 0}</p>
      {earned !== null && <p>ได้รับ <b>{earned} {CURRENCY}</b> ไปใช้ในร้านค้า (ตกแต่งตัวละครเท่านั้น ไม่มีผลต่อคะแนน)</p>}
      <h2>อันดับทีม</h2>
      {board.map((t, i) => <div key={t.id} className="team" style={{ ["--c" as any]: t.color }}><div className="th"><b><span className="sw" />{i + 1}. {t.name}</b><b>{t.pts}</b></div></div>)}
      <h2>ผู้เล่นยอดเยี่ยม</h2>
      <ol>{top.map((p) => <li key={p.id}>{p.name} — {p.score}</li>)}</ol>
      <button className="go" onClick={() => { sessionStorage.removeItem(TOKEN_KEY); room.leave(); }}>กลับหน้าแรก</button>
    </>
  );
}
