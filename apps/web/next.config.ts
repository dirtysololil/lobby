import { parseWebEnv } from "@lobby/config";
import type { NextConfig } from "next";

const env = parseWebEnv(process.env);

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_NAME: env.APP_NAME,
    NEXT_PUBLIC_WEB_PUBLIC_URL: env.WEB_PUBLIC_URL,
    NEXT_PUBLIC_API_PUBLIC_URL: env.API_PUBLIC_URL,
    NEXT_PUBLIC_MEDIA_PUBLIC_URL: env.MEDIA_PUBLIC_URL,
    NEXT_PUBLIC_REALTIME_PUBLIC_URL: env.REALTIME_PUBLIC_URL,
    NEXT_PUBLIC_REALTIME_PATH: env.REALTIME_PATH,
  },
};

export default nextConfig;
