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
    required: true,
  },
  {
    label: "public",
    from: resolve(appRoot, "public"),
    to: resolve(appRoot, ".next", "standalone", "apps", "web", "public"),
    required: false,
  },
];

for (const { label, from, to, required } of copies) {
  if (!existsSync(from)) {
    if (required) {
      throw new Error(`Missing source directory for ${label}: ${from}`);
    }

    console.warn(
      `[prepare-standalone-assets] Skipped optional ${label}, source directory not found: ${from}`,
    );
    continue;
  }

  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  console.log(`[prepare-standalone-assets] Copied ${label} -> ${to}`);
}
