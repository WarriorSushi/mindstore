import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  typescript: {
    tsconfigPath: isProd ? "tsconfig.build.json" : "tsconfig.json",
  },
};

export default nextConfig;
