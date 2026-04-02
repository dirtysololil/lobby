function getPublicEnvValue(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];

    if (value) {
      return value;
    }
  }

  throw new Error(
    `Missing public runtime environment variable: ${names.join(' or ')}`,
  );
}

export const runtimeConfig = {
  appName: getPublicEnvValue('NEXT_PUBLIC_APP_NAME', 'APP_NAME'),
  apiPublicUrl: getPublicEnvValue('NEXT_PUBLIC_API_PUBLIC_URL', 'API_PUBLIC_URL'),
  webPublicUrl: getPublicEnvValue('NEXT_PUBLIC_WEB_PUBLIC_URL', 'WEB_PUBLIC_URL'),
  mediaPublicUrl: getPublicEnvValue('NEXT_PUBLIC_MEDIA_PUBLIC_URL', 'MEDIA_PUBLIC_URL'),
  realtimePublicUrl: getPublicEnvValue('NEXT_PUBLIC_REALTIME_PUBLIC_URL', 'REALTIME_PUBLIC_URL'),
  realtimePath: getPublicEnvValue('NEXT_PUBLIC_REALTIME_PATH', 'REALTIME_PATH'),
};
