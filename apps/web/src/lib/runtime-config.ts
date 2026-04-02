function readEnvValue(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  return undefined;
}

function normalizeBaseUrl(value: string | undefined): string {
  if (!value) {
    return "";
  }

  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export const runtimeConfig = {
  appName: readEnvValue("NEXT_PUBLIC_APP_NAME", "APP_NAME") ?? "Lobby",
  apiPublicUrl: normalizeBaseUrl(readEnvValue("NEXT_PUBLIC_API_PUBLIC_URL", "API_PUBLIC_URL")),
  webPublicUrl: normalizeBaseUrl(readEnvValue("NEXT_PUBLIC_WEB_PUBLIC_URL", "WEB_PUBLIC_URL")),
  mediaPublicUrl: normalizeBaseUrl(readEnvValue("NEXT_PUBLIC_MEDIA_PUBLIC_URL", "MEDIA_PUBLIC_URL")),
  realtimePublicUrl: normalizeBaseUrl(
    readEnvValue("NEXT_PUBLIC_REALTIME_PUBLIC_URL", "REALTIME_PUBLIC_URL"),
  ),
  realtimePath: readEnvValue("NEXT_PUBLIC_REALTIME_PATH", "REALTIME_PATH") ?? "/socket.io",
};
