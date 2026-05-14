const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..", "..");
const envPath = path.join(projectRoot, ".env");
const generatedConfigPath = path.resolve(__dirname, "..", "src", "generated-config.cjs");

const fallbackConfig = {
  appUrl: "https://lobby.webmason.ru",
  allowedOrigins: [
    "https://api.lobby.webmason.ru",
    "https://media.lobby.webmason.ru",
    "wss://media.lobby.webmason.ru",
  ],
};

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const env = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    env[key] = rawValue.replace(/^["']|["']$/g, "");
  }

  return env;
}

function normalizeUrl(value) {
  if (!value) {
    return "";
  }

  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

const env = parseEnvFile(envPath);
const appUrl = normalizeUrl(env.WEB_PUBLIC_URL) || fallbackConfig.appUrl;
const allowedOrigins = uniqueValues([
  normalizeUrl(env.API_PUBLIC_URL),
  normalizeUrl(env.REALTIME_PUBLIC_URL),
  normalizeUrl(env.MEDIA_PUBLIC_URL),
  ...fallbackConfig.allowedOrigins,
]);

const generatedConfig = {
  appUrl,
  allowedOrigins,
};

const contents = `module.exports = ${JSON.stringify(generatedConfig, null, 2)};\n`;
fs.writeFileSync(generatedConfigPath, contents, "utf8");
console.log(`[desktop] prepared ${path.relative(projectRoot, generatedConfigPath)}`);
