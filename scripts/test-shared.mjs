// Runs the shared unit tests on any Node >= 22.6 (needs TypeScript type stripping).
// Node 22/23: type stripping needs a flag. Node 24+: it is on by default and the old --experimental-default-type flag no longer exists.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 6)) {
  console.error(`Node ${process.versions.node} is too old for the shared tests. Install Node 22.6 or newer (Node 24 LTS is fine).`);
  process.exit(1);
}
const dir = "shared/test";
const files = readdirSync(dir).filter((f) => f.endsWith(".test.ts")).sort().map((f) => join(dir, f)); // no shell glob: works the same on Windows
const flags = ["--no-warnings", ...(major < 24 ? ["--experimental-strip-types"] : [])];
const r = spawnSync(process.execPath, [...flags, "--test", ...files], { stdio: "inherit" });
process.exit(r.status ?? 1);
