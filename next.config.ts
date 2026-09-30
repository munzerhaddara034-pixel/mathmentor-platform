import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security/headers";

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
  // Security headers on every response (CSP itself is report-only; see src/lib/security/headers.ts).
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders() }];
  },
  serverExternalPackages: ["pdf-parse", "@netlify/blobs", "livekit-server-sdk", "pg", "typescript"],
};

export default nextConfig;
