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

const productionWebPublicUrl = "https://lobby.holty.ru";
const productionApiPublicUrl = "https://api.lobby.holty.ru";

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

function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

function getProductionApiBaseUrl() {
  return productionApiPublicUrl;
}

export function resolveApiBaseUrlForServer(): string {
  if (runtimeConfig.apiPublicUrl) {
    return runtimeConfig.apiPublicUrl;
  }

  if (runtimeConfig.webPublicUrl) {
    return deriveApiUrlFromHostname(new URL(runtimeConfig.webPublicUrl));
  }

  return isProductionRuntime() ? getProductionApiBaseUrl() : "";
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
    return isProductionRuntime() ? getProductionApiBaseUrl() : "";
  }

  const normalizedHost = host.split(",")[0]?.trim();

  if (!normalizedHost) {
    console.warn(
      "[auth/runtime] server API base URL missing and request host is empty",
    );
    return isProductionRuntime() ? getProductionApiBaseUrl() : "";
  }

  const forwardedProto = headerStore
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const protocol =
    forwardedProto ||
    (shouldAllowLocalhostFallback() &&
    (normalizedHost.includes("localhost") || normalizedHost.includes("127.0.0.1"))
      ? "http"
      : "https");

  const derivedApiUrl = deriveApiUrlFromHostname(
    new URL(`${protocol}://${normalizedHost}`),
  );

  if (!derivedApiUrl) {
    console.warn(
      `[auth/runtime] unable to derive API URL from host=${normalizedHost}`,
    );
  }

  return derivedApiUrl || (isProductionRuntime() ? getProductionApiBaseUrl() : "");
}

export function resolveApiBaseUrlForBrowser(): string {
  if (runtimeConfig.apiPublicUrl) {
    return runtimeConfig.apiPublicUrl;
  }

  if (typeof window === "undefined") {
    return isProductionRuntime() ? getProductionApiBaseUrl() : "";
  }

  return (
    deriveApiUrlFromHostname(new URL(window.location.origin)) ||
    (isProductionRuntime() ? getProductionApiBaseUrl() : "")
  );
}

export function resolveRealtimeBaseUrlForBrowser(): string {
  if (runtimeConfig.realtimePublicUrl) {
    return runtimeConfig.realtimePublicUrl;
  }

  if (runtimeConfig.apiPublicUrl) {
    return runtimeConfig.apiPublicUrl;
  }

  if (typeof window === "undefined") {
    return isProductionRuntime() ? getProductionApiBaseUrl() : "";
  }

  return (
    deriveApiUrlFromHostname(new URL(window.location.origin)) ||
    (isProductionRuntime() ? getProductionApiBaseUrl() : "")
  );
}

function deriveApiUrlFromHostname(origin: URL): string {
  const { protocol, hostname } = origin;

  if (
    hostname === new URL(productionWebPublicUrl).hostname ||
    hostname.startsWith("lobby.")
  ) {
    return `${protocol}//api.${hostname}`;
  }

  if (
    shouldAllowLocalhostFallback() &&
    (hostname === "localhost" || hostname === "127.0.0.1")
  ) {
    return `${protocol}//${hostname}:3001`;
  }

  return "";
}

function shouldAllowLocalhostFallback() {
  return !isProductionRuntime();
}
