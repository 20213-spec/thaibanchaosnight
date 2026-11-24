import { useState } from "react";
import type { Room } from "colyseus.js";
import { BOSS, LOST, CLOSURE, TRADE, COOK, GADGET, tripRules, deliveryPoints, CASE, WEATHER, WEATHER_PLAN, FISH, FISHING, CHAOS, NIGHT, GHOST_KINDS, ghostsFor, TEAMS, SCORE, PUZZLE, DELIVERY, HELP, TEAMWORK, SPECIAL, GHOST_ABILITIES, GHOST_POINT_CAP, EVIDENCE_RESPAWN_MS, ACHIEVEMENTS } from "../../shared/src/index.ts";
import type { Snapshot } from "./net.ts";
import { SettingsPanel } from "./SettingsPanel.tsx";
import { MapView } from "./MapView.tsx";

type Tab = "missions" | "map" | "board" | "settings";

export function Menu({ room, snap, earnedAchievements = [], onClose, onSettings }: { room: Room; snap: Snapshot; earnedAchievements?: string[]; onClose: () => void; onSettings: () => void }) {
  const [tab, setTab] = useState<Tab>("missions");
  const me = snap.players.find((p) => p.id === room.sessionId);
  const color = TEAMS.find((t) => t.id === me?.team)?.color ?? "#999";
  const board = TEAMS.map((t) => ({ ...t, pts: snap.players.filter((p) => p.team === t.id).reduce((s, p) => s + p.score, 0) })).sort((a, b) => b.pts - a.pts);
  const top = [...snap.players].sort((a, b) => b.score - a.score).slice(0, 10);
  const Card = ({ title, pts, children }: { title: string; pts: string; children: React.ReactNode }) => (
    <div className="team" style={{ ["--c" as any]: color }}><div className="th"><b>{title}</b><b>{pts}</b></div><p className="mute small">{children}</p></div>
  );
  return (
    <>
      <div className="bar"><h1 style={{ margin: 0, flex: 1 }}>เมนู</h1><button onClick={onClose}>กลับไปเล่น</button></div>
      <div className="bar" role="tablist">
        {([["missions", "ภารกิจ"], ["map", "แผนที่"], ["board", "อันดับ"], ["settings", "ตั้งค่า"]] as [Tab, string][]).map(([t, label]) =>
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "go" : ""} onClick={() => setTab(t)}>{label}</button>)}
      </div>

      <div className="tabpane" key={tab}>
      {tab === "missions" && (snap.mode === "chaos_party" ? <>
        <Card title="รอบเก็บลูกแก้ว" pts={`+${CHAOS.collect.points} ต่อลูก`}>เดินชนลูกแก้วสีทองเพื่อเก็บ {CHAOS.collect.orbs} ลูกกระจายในหมู่บ้าน เวลา {CHAOS.collect.seconds} วินาที</Card>
        <Card title="รอบตอบคำถาม" pts={`+${CHAOS.quiz.correct}`}>{CHAOS.quiz.questions} ข้อ ข้อละ {CHAOS.quiz.answerS} วินาที ตอบได้ครั้งเดียวต่อข้อ ตอบถูกเป็นคนแรกของห้องได้โบนัส +{CHAOS.quiz.firstBonus} ตอบผิดไม่เสียคะแนน</Card>
        <Card title="รอบวิ่งส่งของ" pts={`+${CHAOS.relay.points} ต่อครั้ง`}>หยิบลังที่ตลาดแล้วส่งที่วงสีทีมหน้าบ้านทีม ไม่จำกัดจำนวนครั้ง เวลา {CHAOS.relay.seconds} วินาที แต่ละรอบต้องส่งภายใน {tripRules(true).tripMs / 1000} วินาที และพัก {tripRules(true).cooldownMs / 1000} วินาทีหลังส่ง มี{GADGET.icon}{GADGET.name}ตกอยู่ตามแผนที่ หยิบแล้วเข้าใกล้คู่แข่งที่ถือลัง กดโต้ตอบเพื่อปา ลังจะหลุดมือไปอยู่กับพื้น {GADGET.looseCrateMs / 1000} วินาที ใครก็แย่งไปส่งได้ (ปาโดนได้ +{GADGET.hitPoints})</Card>
        <Card title="รอบทำอาหาร" pts={`+${COOK.pointsPerStep}/ขั้น`}>เดินไปที่เตาข้างตลาด กดโต้ตอบ แล้วแตะวัตถุดิบตามลำดับของเมนูให้เร็วที่สุด (ไข่เจียว ส้มตำ ต้มยำกุ้ง ผัดไทย ฯลฯ) ทำเร็วได้โบนัส จานยิ่งทำมากยิ่งยาวขึ้น (3→5 ขั้น) แตะผิดแค่เริ่มจานใหม่ ไม่เสียคะแนน เวลา {COOK.seconds} วินาที</Card>
        <Card title="รอบตกปลา" pts={`+${FISH.map((f) => f.points).join("/")}`}>ไปที่บ่อน้ำสีฟ้า กดโต้ตอบเพื่อเหวี่ยงเบ็ด รอสักครู่จะมีข้อความปลากิน ต้องกดโต้ตอบอีกครั้งภายในเสี้ยววินาที ({FISH.map((f) => `${f.icon}${f.name}`).join(" ")}) เวลา {FISHING.seconds} วินาที ดึงเร็วหรือช้าไปไม่เสียคะแนน มีลูกตะกร้อตกอยู่ตามแผนที่ด้วย ปาใส่คนที่กำลังตกปลาจะกวนเบ็ดเขา (ล็อก {GADGET.fisherLockMs / 1000} วินาที)</Card>
        <Card title="โบนัสทีมชนะรอบ" pts={`+${CHAOS.roundWinnerBonus} ต่อคน`}>ทีมที่ทำคะแนนในรอบนั้นสูงสุดตัวเดียว (เสมอไม่มีโบนัส) ทุกคนในทีมได้โบนัส</Card></>
      : me?.role === "ghost" ? <>
        <Card title="หลอก! (ใกล้มนุษย์ต่างทีม)" pts={`+${GHOST_ABILITIES.boo.points}`}>พลังนี้ให้คะแนนรวมสูงสุด {GHOST_POINT_CAP} ต่อแมตช์ คูลดาวน์ {GHOST_ABILITIES.boo.cooldownMs / 1000} วินาที</Card>
        <Card title="กระซิบ" pts="ไม่มีคะแนน">ส่งเสียงหลอนให้มนุษย์รอบตัว คูลดาวน์ {GHOST_ABILITIES.whisper.cooldownMs / 1000} วินาที</Card>
        <Card title="มืดลง" pts="ไม่มีคะแนน">ทำให้จอมนุษย์รอบตัวมืด {GHOST_ABILITIES.dim.ms / 1000} วินาที คูลดาวน์ {GHOST_ABILITIES.dim.cooldownMs / 1000} วินาที</Card>
        <p className="mute small">ผีเก็บหลักฐานและไขปริศนาไม่ได้ ไม่มีใครถูกหักคะแนนจากการถูกหลอก</p></> : <>
        <Card title="สืบคดีผี (เสาแสงสีม่วง 5 จุด + ปุ่ม 📋)" pts={`+${CASE.cluePoints} ต่อเบาะแส / +${CASE.solveFirst} ไขคดี`}>แต่ละเบาะแสบอกว่าผีตัวการ "ไม่ใช่" แบบไหน เทียบกับการ์ดตัวต้องสงสัยแล้วตัดออก เหลือไม่เกิน 2 ตนก็ชี้ตัวได้ ชี้ผิดไม่เสียคะแนน (รอ {CASE.accuseCooldownMs / 1000} วินาที) ทีมแรกที่ชี้ถูกได้ +{CASE.solveFirst} ต่อคน ทีมถัดไป +{CASE.solveLater}</Card>
        <Card title="เก็บหลักฐาน (ลูกแก้วสีฟ้า)" pts={`+${SCORE.evidence}`}>เกิดใหม่หลังเก็บ {EVIDENCE_RESPAWN_MS / 1000} วินาที</Card>
        <Card title="ไขปริศนาที่โรงเรียน (วงสีเหลือง)" pts={`+${SCORE.puzzle}`}>ตอบถูกครั้งแรกได้โบนัส +{PUZZLE.firstTryBonus} (ใช้คำใบ้ลดโบนัสครั้งละ {PUZZLE.hintBonusPenalty}) ตอบผิดไม่หักคะแนน</Card>
        <Card title={`ส่งของ (ส่งไปแล้ว ${me?.delivered ?? 0} ครั้ง)`} pts={`+${SCORE.mission}`}>{me?.carrying ? "กำลังถือของ ไปส่งที่วงสีทีมหน้าบ้านทีม" : "หยิบลังที่ตลาดแล้วถือไปส่งที่วงสีทีม"} ส่งได้ตลอดเวลาไม่จำกัดครั้ง แต่แต่ละรอบต้องส่งภายใน {DELIVERY.tripMs / 1000} วินาที ไม่งั้นลังหลุดมือ และหลังส่งต้องพัก {DELIVERY.cooldownMs / 1000} วินาที (ส่ง {DELIVERY.fullCount} ครั้งแรกได้ +{SCORE.mission} เต็ม หลังจากนั้นครั้งละ +{deliveryPoints(DELIVERY.fullCount + 1)})</Card>
        <Card title={`ป้ายความสำเร็จ (${earnedAchievements.length}/${ACHIEVEMENTS.length} ในแมตช์นี้ ไม่มีคะแนน)`} pts="">{ACHIEVEMENTS.map((a) => `${earnedAchievements.includes(a.id) ? "✅" : "🔒"} ${a.icon} ${a.name}: ${a.about}`).join(" · ")}</Card>
        <Card title="ภารกิจพิเศษ: โคมทอง" pts={`+${SCORE.specialMission}`}>{snap.specialActive ? "โคมทองกำลังปรากฏอยู่ตอนนี้! หาให้เจอ" : `ปรากฏสุ่มทุกประมาณ ${SPECIAL.everyMs / 60000} นาที อยู่ ${SPECIAL.lifetimeMs / 1000} วินาที`}</Card>
        <Card title={`${WEATHER[snap.weather as keyof typeof WEATHER]?.icon ?? ""} สภาพอากาศตอนนี้: ${WEATHER[snap.weather as keyof typeof WEATHER]?.name ?? "-"}`} pts="">{WEATHER[snap.weather as keyof typeof WEATHER]?.about} · สภาพอากาศเปลี่ยนทุก {WEATHER_PLAN.minMs / 1000}–{WEATHER_PLAN.maxMs / 1000} วินาที (ไม่มีใครเสียคะแนนจากสภาพอากาศ)</Card>
        <Card title="ผี AI ในแมตช์นี้ (หลอกให้ตกใจเท่านั้น)" pts="">{ghostsFor(snap.mode).map((k) => `${GHOST_KINDS[k].name}: ${GHOST_KINDS[k].about}`).join(" · ")}</Card>
        {snap.mode === "chaos_night" && <Card title="กลางคืน: หลบความมืด" pts={`+${NIGHT.shelterPoints}`}>เมื่อมีเตือนไฟดับ (ล่วงหน้า {NIGHT.warnMs / 1000} วินาที) ให้อย่างน้อยครึ่งหนึ่งของทีมกลับไปอยู่ในวงสีทีมหน้าบ้านทีมก่อนไฟดับ ได้ +{NIGHT.shelterPoints} ต่อคน (สูงสุด {NIGHT.shelterCap} ต่อแมตช์) ในวงนี้ผี AI หลอกไม่ได้ ไม่มีใครเสียคะแนน</Card>}
        <Card title="ช่วยเพื่อนที่ตกใจ" pts={`+${SCORE.helpTeammate}`}>เดินเข้าใกล้เพื่อนร่วมทีมที่ตกใจ (เดินช้า) แล้วกดโต้ตอบ สะสมได้สูงสุด {HELP.pointCap}</Card>
        <Card title="เหตุการณ์ในหมู่บ้าน (ผู้ใหญ่บ้านประกาศ)" pts="ไม่มีใครเสียคะแนน">🔥 ผีเจ้าที่โกรธ: ทั้งห้องไปยืนใกล้ผีพร้อมกันอย่างน้อยครึ่งหนึ่งของคนที่ยังเล่นอยู่ สะสมความสงบ {BOSS.calmGoalMs / 1000} วินาที ทุกคนได้ +{BOSS.rewardAll} คนที่ยืนอยู่ได้เพิ่ม +{BOSS.rewardNear} · 🚧 พื้นที่ปิดชั่วคราว {CLOSURE.durationMs / 1000} วินาที เดินเข้าวงแดงไม่ได้ · 🔎 ของหาย: หาแสงสีทองแถวจุดที่ประกาศ คนแรกที่เก็บได้ +{LOST.reward} เพื่อนร่วมทีม +{LOST.teamReward} · 🤝 แลกเบาะแส: ยืนใกล้ผู้เล่นทีมอื่นแล้วกดโต้ตอบเพื่อแลก 1 ต่อ 1 ได้ +{TRADE.points} (ทีมละไม่เกิน {TRADE.maxPerTeam} ครั้ง)</Card>
        <Card title="โบนัสทีมเวิร์ก" pts={`+${SCORE.teamworkBonus}`}>เพื่อนร่วมทีม {TEAMWORK.members} คนที่ต่างกันทำคะแนนได้ภายใน {TEAMWORK.windowMs / 1000} วินาที ทุกคนได้โบนัส</Card></>)}

      {tab === "map" && <MapView room={room} snap={snap} />}
      {tab === "board" && <>
        <h2>ทีม</h2>
        {board.map((t, i) => <div key={t.id} className="team" style={{ ["--c" as any]: t.color }}><div className="th"><b><span className="sw" />{i + 1}. {t.name}{t.id === me?.team ? " (ทีมคุณ)" : ""}</b><b>{t.pts}</b></div></div>)}
        <h2>ผู้เล่น</h2>
        <ol>{top.map((p) => <li key={p.id} style={{ fontWeight: p.id === room.sessionId ? 700 : 400 }}>{p.role === "ghost" ? "👻 " : ""}{p.name} — {p.score}</li>)}</ol>
        <p className="mute small">คะแนนที่เห็นเป็นค่าจาก server เสมอ</p></>}

      {tab === "settings" && <SettingsPanel onChange={onSettings} />}
      </div>
    </>
  );
}
