import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");

const copies = [
  {
    label: ".next/static",
    from: resolve(appRoot, ".next", "static"),
    to: resolve(appRoot, ".next", "standalone", "apps", "web", ".next", "static"),
  },
  {
    label: "public",
    from: resolve(appRoot, "public"),
    to: resolve(appRoot, ".next", "standalone", "apps", "web", "public"),
  },
];

for (const { label, from, to } of copies) {
  if (!existsSync(from)) {
    throw new Error(`Missing source directory for ${label}: ${from}`);
  }

  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  console.log(`[prepare-standalone-assets] Copied ${label} -> ${to}`);
}
