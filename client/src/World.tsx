import { settings } from "./settings.ts";
import { COOK_STATION } from "../../shared/src/index.ts";
const COOK_RING = 3.2; // visual ring around the stove (the server reach is a little larger)
import { TEAMS, PUZZLE_ZONE, PUZZLE_RADIUS, CRATE, dropZoneFor, DROP_REACH, TEMPLE, CHEDI, HUT } from "../../shared/src/index.ts";
import { Trees, Decor, Lamps, StiltHouses, TeamHouses, TEAM_CHIMNEYS, TEMPLE_INCENSE, Smoke, Signs, Sign, Fireflies, SkyDome, Pond, Rain, Leaves } from "./Scenery.tsx";

const Box = ({ p, s, c, r }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: [number, number, number] }) => (
  <mesh position={p} rotation={r}><boxGeometry args={s} /><meshLambertMaterial color={c} /></mesh>
);

export function World({ night = false, mode = "ghost_hunt", relay = false, cooking = false, weather = "clear" }: { night?: boolean; mode?: string; relay?: boolean; cooking?: boolean; weather?: string }) {
  const wet = weather === "rain" || weather === "storm";
  const bg = night ? "#0B1030" : weather === "fog" ? "#C9D3DA" : wet ? "#8E9AA6" : "#BFE6F5";
  const range: [number, number] = weather === "fog" ? (night ? [5, 26] : [8, 38]) : weather === "storm" ? (night ? [10, 40] : [22, 70]) : weather === "rain" ? (night ? [14, 48] : [30, 90]) : (night ? [18, 60] : [50, 125]);
  const dim = weather === "storm" ? 0.6 : weather === "rain" ? 0.75 : weather === "fog" ? 0.85 : 1;
  const hunt = mode !== "chaos_party" && mode !== "lobby"; // puzzle ring exists only in hunt modes; the crate and drop rings also during the party relay round
  const hi = settings.quality === "high";
  const windowC = night ? "#FFD27A" : "#BFE6F5";
  return (
    <>
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, range[0], range[1]]} />
      {night
        ? <><ambientLight intensity={(hi ? 0.35 : 0.7) * (weather === "storm" ? 0.8 : 1)} color="#8FA2FF" /><directionalLight position={[-30, 50, -20]} intensity={0.3} color="#9FB4FF" /></>
        : <><hemisphereLight args={["#CFE8FF", "#7CC86B", 0.75 * dim]} /><directionalLight position={[30, 50, 20]} intensity={0.95 * dim} color="#FFF4DD" /></>}
      <SkyDome night={night} weather={weather} />
      {wet && <Rain heavy={weather === "storm"} />}
      {weather === "wind" && <Leaves />}

      {/* ground, main road and side paths */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[90, 90]} /><meshLambertMaterial color={wet ? "#68A85A" : "#7CC86B"} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 4]}><planeGeometry args={[6, 56]} /><meshLambertMaterial color="#D9B98A" /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-11, 0.021, 4]}><planeGeometry args={[22, 2.4]} /><meshLambertMaterial color="#D9B98A" /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[17, 0.021, -22]}><planeGeometry args={[34, 2.4]} /><meshLambertMaterial color="#D9B98A" /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 4]}><planeGeometry args={[0.2, 54]} /><meshLambertMaterial color="#C9A874" /></mesh>

      {/* School: yard, steps, door, windows, flag */}
      <Box p={[0, 2, -28]} s={[16, 4, 7]} c="#F4E3B5" />
      <mesh position={[0, 5.2, -28]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[11.5, 2.4, 4]} /><meshLambertMaterial color="#C0392B" /></mesh>
      <Box p={[0, 1.2, -24.45]} s={[1.6, 2.4, 0.1]} c="#5A3E2B" /><Box p={[0, 0.15, -24.0]} s={[3, 0.3, 1]} c="#BDB6A5" />
      {[-6, -3, 3, 6].map((x) => <Box key={x} p={[x, 2.4, -24.47]} s={[1.4, 1.2, 0.08]} c={windowC} />)}
      <mesh position={[9, 3, -22]}><cylinderGeometry args={[0.07, 0.07, 6, 6]} /><meshLambertMaterial color="#C9C9CF" /></mesh>
      <Box p={[9.85, 5.4, -22]} s={[1.6, 1, 0.05]} c="#E5383B" />
      {hunt && <><mesh position={[PUZZLE_ZONE.x, 0.06, PUZZLE_ZONE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[PUZZLE_RADIUS - 0.6, PUZZLE_RADIUS, 40]} /><meshBasicMaterial color="#FFD23F" />
      </mesh>
      <mesh position={[PUZZLE_ZONE.x, 1.2, PUZZLE_ZONE.z]}><octahedronGeometry args={[0.7]} /><meshLambertMaterial color="#FFD23F" emissive="#FFB300" /></mesh></>}

      {/* Market: striped awnings, goods on the counters, hanging signs */}
      {[-28, -22, -16].map((x, i) => {
        const col = ["#E5383B", "#F5B700", "#2F6DF6"][i];
        return (
          <group key={x} position={[x, 0, 6]}>
            <Box p={[0, 0.6, 0]} s={[4, 1.2, 2]} c="#B07A4A" />
            <Box p={[0, 2.6, 0]} s={[4.6, 0.2, 3]} c={col} />
            {[0, 1, 2, 3, 4].map((k) => <Box key={k} p={[-1.8 + k * 0.9, 2.71, 0]} s={[0.45, 0.02, 3.02]} c="#FFFFFF" />)}
            <Box p={[-1.9, 1.5, 0]} s={[0.15, 3, 0.15]} c="#6B4A2B" /><Box p={[1.9, 1.5, 0]} s={[0.15, 3, 0.15]} c="#6B4A2B" />
            {[-1.4, -0.7, 0, 0.7, 1.4].map((gx, k) => <mesh key={k} position={[gx, 1.35, 0.1]}><sphereGeometry args={[0.2, 8, 6]} /><meshLambertMaterial color={["#FF9F1C", "#E5383B", "#7BC464", "#FFD23F", "#B48CFF"][(k + i) % 5]} /></mesh>)}
            <Sign text={["ผลไม้", "ปลาสด", "ของชำ"][i]} x={0} z={1.9} y={3.5} post={false} />
          </group>
        );
      })}

      {/* Delivery mission: crate at the market, drop ring at each team house */}
      {(hunt || relay) && <>
      <Box p={[CRATE.x, 0.5, CRATE.z]} s={[1.2, 1, 1.2]} c="#C98F00" />
      <mesh position={[CRATE.x, 0.05, CRATE.z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.6, 2.1, 24]} /><meshBasicMaterial color="#FFD23F" /></mesh>
      {TEAMS.map((t) => { const d = dropZoneFor(t.id); return (
        <mesh key={"drop" + t.id} position={[d.x, 0.05, d.z - 3]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[DROP_REACH - 0.5, DROP_REACH, 28]} /><meshBasicMaterial color={t.color} /></mesh>
      ); })}
      </>}

      {cooking && <group position={[COOK_STATION.x, 0, COOK_STATION.z]}>
        <Box p={[0, 0.5, 0]} s={[2.4, 1, 1.4]} c="#8A5A3C" />
        <mesh position={[-0.5, 1.25, 0]}><cylinderGeometry args={[0.45, 0.4, 0.5, 12]} /><meshLambertMaterial color="#3A3A3F" /></mesh>
        <mesh position={[0.6, 1.1, 0]}><cylinderGeometry args={[0.35, 0.35, 0.2, 12]} /><meshLambertMaterial color="#C0C5CE" /></mesh>
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[COOK_RING - 0.5, COOK_RING, 28]} /><meshBasicMaterial color="#FF9F1C" /></mesh>
      </group>}
      <TeamHouses night={night} />
      <StiltHouses night={night} />

      {/* วัด (temple): hall with two-tier roof, golden chedi, steps, lantern string, incense */}
      <Box p={[TEMPLE.x, 1.6, TEMPLE.z]} s={[10, 3.2, 7]} c="#F7EBC8" />
      <mesh position={[TEMPLE.x, 4.0, TEMPLE.z]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[8.2, 2.2, 4]} /><meshLambertMaterial color="#C0392B" /></mesh>
      <mesh position={[TEMPLE.x, 5.4, TEMPLE.z]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[5, 1.8, 4]} /><meshLambertMaterial color="#E8A317" /></mesh>
      <Box p={[TEMPLE.x, 0.15, TEMPLE.z + 3.9]} s={[4, 0.3, 1.2]} c="#D8CDB5" /><Box p={[TEMPLE.x, 1.2, TEMPLE.z + 3.52]} s={[1.6, 2.4, 0.08]} c="#7A3B2B" />
      {[-4, -2, 0, 2, 4].map((dx) => <mesh key={dx} position={[TEMPLE.x + dx, 3.3, TEMPLE.z + 3.7]}><sphereGeometry args={[0.2, 8, 6]} /><meshBasicMaterial color={night ? "#FFB300" : "#F5A623"} /></mesh>)}
      {[-1.5, 1.5].map((dx) => <mesh key={"inc" + dx} position={[TEMPLE.x + dx, 0.5, TEMPLE.z + 4.4]}><cylinderGeometry args={[0.18, 0.22, 0.8, 8]} /><meshLambertMaterial color="#8A5A3C" /></mesh>)}
      <mesh position={[CHEDI.x, 1.2, CHEDI.z]}><cylinderGeometry args={[CHEDI.r, CHEDI.r + 0.4, 2.4, 10]} /><meshLambertMaterial color="#F7EBC8" /></mesh>
      <mesh position={[CHEDI.x, 4.4, CHEDI.z]}><coneGeometry args={[1.7, 4.4, 10]} /><meshLambertMaterial color="#E8B923" emissive={night ? "#B07A00" : "#7A5A00"} /></mesh>
      <mesh position={[CHEDI.x, 7.1, CHEDI.z]}><coneGeometry args={[0.35, 1.4, 6]} /><meshLambertMaterial color="#E8B923" emissive={night ? "#B07A00" : "#7A5A00"} /></mesh>

      <Pond />

      {/* Rice field: darker crop rows, hut, scarecrow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[26, 0.03, -8]}><planeGeometry args={[22, 30]} /><meshLambertMaterial color="#A8D968" /></mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={"row" + i} rotation={[-Math.PI / 2, 0, 0]} position={[26, 0.05, -21 + i * 3.2]}><planeGeometry args={[21, 0.9]} /><meshLambertMaterial color="#6FB84A" /></mesh>
      ))}
      <Box p={[HUT.x, 1.0, HUT.z]} s={[3, 2, 3]} c="#B88A5A" />
      <mesh position={[HUT.x, 2.6, HUT.z]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[3, 1.4, 4]} /><meshLambertMaterial color="#8A6A3A" /></mesh>
      <group position={[24, 0, -14]}>
        <mesh position={[0, 1, 0]}><cylinderGeometry args={[0.06, 0.06, 2, 6]} /><meshLambertMaterial color="#6B4A2B" /></mesh>
        <mesh position={[0, 1.5, 0]}><boxGeometry args={[1.6, 0.08, 0.08]} /><meshLambertMaterial color="#6B4A2B" /></mesh>
        <mesh position={[0, 2.15, 0]}><sphereGeometry args={[0.25, 8, 8]} /><meshLambertMaterial color="#D9B26B" /></mesh>
        <mesh position={[0, 1.2, 0]}><boxGeometry args={[0.6, 0.7, 0.2]} /><meshLambertMaterial color="#3D7EA6" /></mesh>
      </group>

      <Trees />
      <Decor />
      <Lamps night={night} />
      <Signs />
      <Smoke sources={[...TEAM_CHIMNEYS, ...TEMPLE_INCENSE]} />
      {night && <Fireflies />}
    </>
  );
}
