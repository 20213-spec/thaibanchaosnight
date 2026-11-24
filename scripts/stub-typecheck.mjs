// Offline approximate typecheck (no npm install needed): checks client/ and server/ against hand-written stubs of react, three, colyseus, express.
// It is NOT a replacement for `npm run typecheck` (real types). It only catches mistakes in our own code: wrong names, wrong shapes, bad imports.
// Usage: node scripts/stub-typecheck.mjs   (needs a `tsc` on PATH or in node_modules/.bin)
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stubs = path.join(root, "scripts/stub-check/stubs.d.ts");
const dir = mkdtempSync(path.join(tmpdir(), "tbcn-stub-"));
const nodeTypes = ["/opt/npm-tools/node_modules/@types", path.join(root, "node_modules/@types")].find(existsSync);
const base = { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", strict: true, noEmit: true, skipLibCheck: true, allowImportingTsExtensions: true };
const cfg = {
  server: { compilerOptions: { ...base, experimentalDecorators: true, useDefineForClassFields: false, esModuleInterop: true, types: ["node"], typeRoots: nodeTypes ? [nodeTypes] : [] }, files: [stubs], include: [path.join(root, "server/src"), path.join(root, "shared/src")] },
  client: { compilerOptions: { ...base, jsx: "react-jsx", lib: ["ES2022", "DOM", "DOM.Iterable"], types: [], typeRoots: [] }, files: [stubs], include: [path.join(root, "client/src")] },
};
// Codes that only come from the stubs being less detailed than the real packages.
const NOISE = /TS7006|TS2305|TS2503|TS2693|TS2416|styles\.css|ImportMeta/;
const tscBin = [path.join(root, "node_modules/.bin/tsc"), "tsc"].find((p) => p === "tsc" || existsSync(p));
let real = 0;
for (const [name, c] of Object.entries(cfg)) {
  const f = path.join(dir, `tsconfig.${name}.json`); writeFileSync(f, JSON.stringify(c));
  const r = spawnSync(tscBin, ["-p", f], { encoding: "utf8" });
  const lines = `${r.stdout}${r.stderr}`.split("\n").filter((l) => /error TS/.test(l));
  const rest = lines.filter((l) => !NOISE.test(l));
  console.log(`[${name}] ${lines.length} diagnostics, ${lines.length - rest.length} ignored as stub noise, ${rest.length} to look at`);
  rest.forEach((l) => console.log("  " + l.replace(root + "/", "")));
  real += rest.length;
}
process.exit(real ? 1 : 0);
