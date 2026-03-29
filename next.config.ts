import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  typescript: {
    tsconfigPath: isProd ? "tsconfig.build.json" : "tsconfig.json",
  },

  /* ─── Performance: Core Web Vitals ─── */
  compress: true,
  poweredByHeader: false,

  // Aggressive code splitting for better caching & smaller initial loads
  experimental: {
    optimizeCss: false, // requires critters — keep off unless installed
    optimizePackageImports: [
      "lucide-react",
      "sonner",
      "reagraph",
    ],
  },

  // Security + caching headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
