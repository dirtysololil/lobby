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
  apiPublicUrl: normalizeBaseUrl(
    readEnvValue("NEXT_PUBLIC_API_PUBLIC_URL", "API_PUBLIC_URL"),
  ),
  webPublicUrl: normalizeBaseUrl(
    readEnvValue("NEXT_PUBLIC_WEB_PUBLIC_URL", "WEB_PUBLIC_URL"),
  ),
  mediaPublicUrl: normalizeBaseUrl(
    readEnvValue("NEXT_PUBLIC_MEDIA_PUBLIC_URL", "MEDIA_PUBLIC_URL"),
  ),
  realtimePublicUrl: normalizeBaseUrl(
    readEnvValue("NEXT_PUBLIC_REALTIME_PUBLIC_URL", "REALTIME_PUBLIC_URL"),
  ),
  realtimePath:
    readEnvValue("NEXT_PUBLIC_REALTIME_PATH", "REALTIME_PATH") ?? "/socket.io",
  realtimeTransportMode:
    readEnvValue(
      "NEXT_PUBLIC_REALTIME_TRANSPORT_MODE",
      "REALTIME_TRANSPORT_MODE",
    ) ?? "auto",
};

export function resolveApiBaseUrlForServer(): string {
  if (runtimeConfig.apiPublicUrl) {
    return runtimeConfig.apiPublicUrl;
  }

  if (runtimeConfig.webPublicUrl) {
    return deriveApiUrlFromHostname(new URL(runtimeConfig.webPublicUrl));
  }

  return "";
}

export async function resolveApiBaseUrlForServerRequest(): Promise<string> {
  const configuredBaseUrl = resolveApiBaseUrlForServer();

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const { headers } = await import("next/headers");
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");

  if (!host) {
    console.warn(
      "[auth/runtime] server API base URL missing and request host is unavailable",
    );
    return "";
  }

  const normalizedHost = host.split(",")[0]?.trim();

  if (!normalizedHost) {
    console.warn(
      "[auth/runtime] server API base URL missing and request host is empty",
    );
    return "";
  }

  const forwardedProto = headerStore
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const protocol =
    forwardedProto || (normalizedHost.includes("localhost") ? "http" : "https");

  const derivedApiUrl = deriveApiUrlFromHostname(
    new URL(`${protocol}://${normalizedHost}`),
  );

  if (!derivedApiUrl) {
    console.warn(
      `[auth/runtime] unable to derive API URL from host=${normalizedHost}`,
    );
  }

  return derivedApiUrl;
}

export function resolveApiBaseUrlForBrowser(): string {
  if (runtimeConfig.apiPublicUrl) {
    return runtimeConfig.apiPublicUrl;
  }

  if (typeof window === "undefined") {
    return "";
  }

  return deriveApiUrlFromHostname(new URL(window.location.origin));
}

export function resolveRealtimeBaseUrlForBrowser(): string {
  if (runtimeConfig.realtimePublicUrl) {
    return runtimeConfig.realtimePublicUrl;
  }

  if (runtimeConfig.apiPublicUrl) {
    return runtimeConfig.apiPublicUrl;
  }

  if (typeof window === "undefined") {
    return "";
  }

  return deriveApiUrlFromHostname(new URL(window.location.origin));
}

function deriveApiUrlFromHostname(origin: URL): string {
  const { protocol, hostname } = origin;

  if (hostname.startsWith("lobby.")) {
    return `${protocol}//api.${hostname}`;
  }

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${protocol}//${hostname}:3001`;
  }

  return "";
}
