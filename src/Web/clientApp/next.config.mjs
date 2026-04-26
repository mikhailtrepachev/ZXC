import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = dirname(fileURLToPath(import.meta.url));
const backendUrl = process.env.BACKEND_URL || "http://localhost:8080";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  turbopack: {
    root: appDir,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/hubs/:path*",
        destination: `${backendUrl}/hubs/:path*`,
      },
      {
        source: "/openapi/:path*",
        destination: `${backendUrl}/openapi/:path*`,
      },
    ];
  },
};

export default nextConfig;
