// One-command verification: node scripts/verify.mjs   (or: npm run verify)
// Runs install, typecheck (client + server separately), shared unit tests and the client build, then writes VERIFY_REPORT.txt
// with PASS/FAIL per step and the first error lines. Paste that file back to Claude. Flags: --skip-install, --skip-build.
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

const noModules = !existsSync("node_modules"); // a freshly unzipped folder has no packages yet, so install can never be skipped there
const skipInstall = process.argv.includes("--skip-install") && !noModules, skipBuild = process.argv.includes("--skip-build");
if (noModules && process.argv.includes("--skip-install")) console.log("node_modules not found: running npm install anyway.");
const steps = [
  !skipInstall && ["npm install", "npm install --no-audit --no-fund"],
  ["typecheck client", "npm run typecheck -w client"],
  ["typecheck server", "npm run typecheck -w server"],
  ["shared unit tests", "npm run test:shared"],
  !skipBuild && ["client build", "npm run build -w client"],
].filter(Boolean);

const lines = [`VERIFY REPORT  ${new Date().toISOString()}  node ${process.version}  ${process.platform}`, ""];
let failed = 0;
for (const [name, cmd] of steps) {
  process.stdout.write(`> ${name} ... `);
  const t0 = Date.now();
  const r = spawnSync(cmd, { shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`.split("\n").map((l) => l.trimEnd()).filter(Boolean);
  const ok = r.status === 0, secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (!ok) failed++;
  console.log(ok ? `PASS (${secs}s)` : `FAIL (${secs}s)`);
  lines.push(`${ok ? "PASS" : "FAIL"}  ${name}  (${secs}s)  exit=${r.status}`);
  if (!ok) {
    const real = out.filter((l) => !/^npm (error|ERR!)/i.test(l)); // the real message, not npm's wrapper lines
    const errs = real.filter((l) => /error|TS\d{4}|Cannot|failed|not ok|not recognized|not found|✖/i.test(l));
    lines.push(...(errs.length ? errs : real.length ? real : out).slice(0, 40).map((l) => "    " + l.slice(0, 220)));
    if (errs.length > 40) lines.push(`    ... and ${errs.length - 40} more error lines`);
  } else if (name === "shared unit tests") {
    lines.push(...out.filter((l) => /^# (tests|pass|fail)/.test(l)).map((l) => "    " + l));
  }
  lines.push("");
}
lines.push(failed === 0 ? "RESULT: ALL STEPS PASSED (still do the manual checks in TESTING.md)" : `RESULT: ${failed} STEP(S) FAILED`);
writeFileSync("VERIFY_REPORT.txt", lines.join("\n") + "\n");
console.log(`\n${lines[lines.length - 1]}\nReport saved to VERIFY_REPORT.txt, send its contents back to Claude.`);
process.exit(failed === 0 ? 0 : 1);
