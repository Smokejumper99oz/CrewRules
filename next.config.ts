import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: outputFileTracingRoot was removed - it caused "Cannot find module './XXX.js'" chunk errors
  // on Windows when running next start. Re-add only if needed for monorepo dependency tracing.
  turbopack: {
    root: path.join(__dirname),
  },
  serverExternalPackages: ["pdf-parse"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.gstatic.com",
        pathname: "/flights/airline_logos/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
