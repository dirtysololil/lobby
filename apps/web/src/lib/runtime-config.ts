function getPublicEnvValue(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];

    if (value) {
      return value;
    }
  }

  const fallbackMap: Record<string, string> = {
    NEXT_PUBLIC_APP_NAME: "Lobby",
    APP_NAME: "Lobby",
    NEXT_PUBLIC_API_PUBLIC_URL: "http://127.0.0.1:3001",
    API_PUBLIC_URL: "http://127.0.0.1:3001",
    NEXT_PUBLIC_WEB_PUBLIC_URL: "http://127.0.0.1:3000",
    WEB_PUBLIC_URL: "http://127.0.0.1:3000",
    NEXT_PUBLIC_MEDIA_PUBLIC_URL: "wss://127.0.0.1:7880",
    MEDIA_PUBLIC_URL: "wss://127.0.0.1:7880",
    NEXT_PUBLIC_REALTIME_PUBLIC_URL: "http://127.0.0.1:3001",
    REALTIME_PUBLIC_URL: "http://127.0.0.1:3001",
    NEXT_PUBLIC_REALTIME_PATH: "/socket.io",
    REALTIME_PATH: "/socket.io",
  };

  for (const name of names) {
    const fallback = fallbackMap[name];

    if (fallback) {
      return fallback;
    }
  }

  throw new Error(`Missing public runtime environment variable: ${names.join(" or ")}`);
}

export const runtimeConfig = {
  appName: getPublicEnvValue('NEXT_PUBLIC_APP_NAME', 'APP_NAME'),
  apiPublicUrl: getPublicEnvValue('NEXT_PUBLIC_API_PUBLIC_URL', 'API_PUBLIC_URL'),
  webPublicUrl: getPublicEnvValue('NEXT_PUBLIC_WEB_PUBLIC_URL', 'WEB_PUBLIC_URL'),
  mediaPublicUrl: getPublicEnvValue('NEXT_PUBLIC_MEDIA_PUBLIC_URL', 'MEDIA_PUBLIC_URL'),
  realtimePublicUrl: getPublicEnvValue('NEXT_PUBLIC_REALTIME_PUBLIC_URL', 'REALTIME_PUBLIC_URL'),
  realtimePath: getPublicEnvValue('NEXT_PUBLIC_REALTIME_PATH', 'REALTIME_PATH'),
};
