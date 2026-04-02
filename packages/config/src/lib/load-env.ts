import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse } from "dotenv";

let isLoaded = false;

export function loadWorkspaceEnv(startDir = process.cwd()): void {
  if (isLoaded) {
    return;
  }

  const workspaceRoot = resolveWorkspaceRoot(startDir);
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const initialKeys = new Set(Object.keys(process.env));
  const candidateFiles = [
    ".env",
    `.env.${nodeEnv}`,
    ".env.local",
    `.env.${nodeEnv}.local`,
  ];

  for (const fileName of candidateFiles) {
    const filePath = join(workspaceRoot, fileName);

    if (!existsSync(filePath)) {
      continue;
    }

    const parsed = parse(readFileSync(filePath));

    for (const [key, value] of Object.entries(parsed)) {
      if (initialKeys.has(key)) {
        continue;
      }

      process.env[key] = value;
    }
  }

  isLoaded = true;
}

function resolveWorkspaceRoot(startDir: string): string {
  let currentDir = resolve(startDir);

  while (true) {
    if (existsSync(join(currentDir, "pnpm-workspace.yaml"))) {
      return currentDir;
    }

    const parentDir = dirname(currentDir);

    if (parentDir === currentDir) {
      return resolve(startDir);
    }

    currentDir = parentDir;
  }
}
