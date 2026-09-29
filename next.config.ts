import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Render deploy (owner edit): self-contained server bundle.
  output: "standalone",
  // Owner edit kept: no ESLint config is shipped, so skip lint during builds.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Type errors now fail the build again: the merged tree passes `tsc --noEmit` cleanly.
  typescript: {
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ["pdf-parse", "@netlify/blobs", "livekit-server-sdk"],
};

export default nextConfig;
