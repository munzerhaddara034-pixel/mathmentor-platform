import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@netlify/blobs", "livekit-server-sdk"],
};

export default nextConfig;
